const router = require("express").Router();
const { Friend, Conversation, Participant, User } = require("../models");
const middleware = require("../utils/middleware");
const { generateAvatarUrl, generateImageOrFileUrl } = require("../utils/helper-functions");
const { getReceiverSocketId, io } = require("../socket/socket");

// Get all friends for a user
router.get("/:id", async (req, res) => {
  const friends = await Friend.findAll({
    where: { userId: req.params.id },
    include: [{ model: User, attributes: { exclude: ["passwordHash"] } }],
  });

  if (friends.length === 0) {
    return res.status(404).json({ error: "No friends found" });
  }

  await Promise.all(friends.map((friend) => generateAvatarUrl(friend.user)));

  return res.status(200).json(friends);
});

// Add a new friend
router.post("/", middleware.findUserSession, async (req, res) => {
  const { jwtUser } = req;
  const { gmail, userId } = req.body;

  if (!jwtUser || userId !== jwtUser.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!gmail) {
    return res.status(400).json({ error: "Gmail address is required" });
  }

  const friend = await User.findOne({ where: { gmail } });

  if (!friend) {
    return res.status(404).json({ error: "User not found" });
  }

  if (friend.id === jwtUser.id) {
    return res.status(400).json({ error: "You cannot add yourself as a friend" });
  }

  const existingFriendship = await Friend.findOne({
    where: { userId: jwtUser.id, friendId: friend.id },
  });

  if (existingFriendship) {
    return res.status(400).json({ error: "Friendship already exists" });
  }

  const [firstFriend, conversation] = await Promise.all([
    Friend.create({ userId: jwtUser.id, friendId: friend.id }),
    Friend.create({ userId: friend.id, friendId: jwtUser.id }),
    Conversation.create({ creatorId: jwtUser.id }),
  ]);

  await Participant.bulkCreate([
    { conversationId: conversation.id, userId: jwtUser.id },
    { conversationId: friend.id, userId: friend.id },
  ]);

  const newConversation = await Conversation.findByPk(conversation.id, {
    include: [
      {
        model: User,
        as: "participant_list",
        attributes: { exclude: ["passwordHash", "createdAt", "updatedAt"] },
        through: {
          attributes: { exclude: ["createdAt", "updatedAt", "userId"] },
          as: "participant_details",
        },
      },
    ],
  });

  await generateImageOrFileUrl(newConversation.imageName);

  await Promise.all(
    newConversation.participant_list.map((participant) =>
      generateAvatarUrl(participant.user)
    )
  );

  const receiverFriendSocketId = getReceiverSocketId(friend.id);
  const newFriend = await Friend.findOne({
    where: { userId: friend.id, friendId: jwtUser.id },
    include: [{ model: User, attributes: { exclude: ["passwordHash"] } }],
  });

  await generateAvatarUrl(newFriend.user);

  if (receiverFriendSocketId) {
    io.to(receiverFriendSocketId).emit("newFriend", newFriend);
  }

  const participantIds = newConversation.participant_list.map(
    (participant) => participant.id
  );

  await Promise.all(
    participantIds.map((participantId) => {
      const receiverSocketId = getReceiverSocketId(participantId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("newConversation", newConversation);
      }
    })
  );

  return res.status(201).json(firstFriend);
});

// Remove a friend
router.delete("/:id", middleware.findUserSession, async (req, res) => {
  const firstFriend = await Friend.findByPk(req.params.id);

  if (!firstFriend) {
    return res.status(404).json({ error: "Friend not found" });
  }

  const { jwtUser } = req;
  if (!jwtUser || firstFriend.userId !== jwtUser.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  await firstFriend.destroy();

  const secondFriend = await Friend.findOne({
    where: { userId: firstFriend.friendId, friendId: firstFriend.userId },
  });

  if (secondFriend) {
    await secondFriend.destroy();
  }

  return res.status(204).json({ firstFriend, secondFriend });
});

module.exports = router;
