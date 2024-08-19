/* eslint-disable no-param-reassign */
const router = require("express").Router();
const { Friend, Conversation, Participant, User } = require("../models/index");
const middleware = require("../utils/middleware");

const { generateSignedUrl } = require("../utils/aws-sdk-s3");

const { getReceiverSocketId, io } = require("../socket/socket");

router.get("/:id", async (req, res) => {
  const friends = await Friend.findAll({
    where: { userId: req.params.id },
    include: [
      {
        model: User,
        attributes: { exclude: ["passwordHash"] },
      },
    ],
  });

  if (!friends) return res.status(404).json({ error: "No friends found" });

  await Promise.all(friends.map(async(friend) => {
    if (friend.user.avatarName) {
      friend.user.avatarName = await generateSignedUrl(friend.user.avatarName);
    }
  }))
  return res.status(200).json(friends);
});

router.post("/", middleware.findUserSession, async (req, res) => {
  const { jwtUser } = req;
  if (!jwtUser || !(req.body.userId === jwtUser.id)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Check if the request body contains a Gmail address
  const { gmail } = req.body;
  if (!gmail) {
    return res.status(400).json({ error: "Gmail address is required" });
  }

  // Find the user by their Gmail address
  const friend = await User.findOne({ where: { gmail } });
  if (!friend) {
    return res
      .status(404)
      .json({ error: "User with the provided Gmail address not found" });
  }

  // Ensure that the found user is not the same as the authenticated user
  if (friend.id === jwtUser.id) {
    return res
      .status(400)
      .json({ error: "You cannot add yourself as a friend" });
  }

  // Check if the relationship already exists
  const existingFriendship = await Friend.findOne({
    where: {
      userId: jwtUser.id,
      friendId: friend.id,
    },
  });

  if (existingFriendship) {
    return res.status(400).json({ error: "Friendship already exists" });
  }

  // when adding a friend, person B will become a friend of person A, and vice versa
  const firstFriend = await Friend.create({
    userId: jwtUser.id,
    friendId: friend.id,
  });

  const secondFriend = await Friend.create({
    userId: friend.id,
    friendId: jwtUser.id,
  });

  // After adding a friend, a conversation between them will be formed
  const conversation = await Conversation.create({
    creatorId: firstFriend.userId,
  });

  // Add participants to the conversation
  await Participant.bulkCreate([
    { conversationId: conversation.id, userId: firstFriend.userId },
    { conversationId: conversation.id, userId: secondFriend.userId },
  ]);

  const newConversation = await Conversation.findByPk(conversation.id, {
    include: [
      {
        model: User,
        as: "participant_list",
        attributes: {
          exclude: ["passwordHash", "createdAt", "updatedAt"],
        },
        through: {
          attributes: {
            exclude: ["createdAt", "updatedAt", "userId"],
          },
          as: "participant_details",
        },
      },
    ],
  });

  if (newConversation.imageName) {
    newConversation.imageName = await generateSignedUrl(
      newConversation.imageName,
    );
  }

  if (newConversation.participant_list.length > 0) {
    await Promise.all(newConversation.participant_list.map(async(participant) => {
      if (participant.avatarName) {
        participant.avatarName = await generateSignedUrl(participant.avatarName);
      }
    }))
  }

  const receiverFriendSocketId = getReceiverSocketId(friend.id);
  const newFriend = await Friend.findOne({
    where: { userId: friend.id, friendId: jwtUser.id },
    include: [
      {
        model: User,
        attributes: { exclude: ["passwordHash"] },
      },
    ],
  });
  
  if (newFriend.user.avatarName) {
    newFriend.user.avatarName = await generateSignedUrl(
      newFriend.user.avatarName,
    );
  }

  if (receiverFriendSocketId) {
    io.to(receiverFriendSocketId).emit("newFriend", newFriend);
  }

  const participantIds = newConversation.participant_list.map(
    (participant) => participant.id,
  );

  await Promise.all(participantIds.map(async(participantId) => {
    const receiverSocketId = getReceiverSocketId(participantId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newConversation", newConversation);
    }
  }))

  return res.status(201).json(firstFriend);
});

router.delete("/:id", middleware.findUserSession, async (req, res) => {
  const firstFriend = await Friend.findByPk(req.params.id);
  if (!firstFriend) {
    return res.status(404).json({ error: "Friend not found" });
  }
  const { jwtUser } = req;
  if (!jwtUser || !(firstFriend.userId === jwtUser.id)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  await firstFriend.destroy();

  // when deleting a friend, person B will not be friend of A, and A will also not be friend of B anymore.
  const secondFriend = await Friend.findOne({
    where: {
      userId: firstFriend.friendId,
      friendId: firstFriend.userId,
    },
  });

  await secondFriend.destroy();

  const returnedDetails = {
    firstFriend,
    secondFriend,
  };

  return res.status(204).json(returnedDetails);
});

module.exports = router;
