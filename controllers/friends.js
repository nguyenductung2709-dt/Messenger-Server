const { Friend, Conversation, Participant, User, Message } = require("../models/index");
const router = require("express").Router();
const middleware = require("../utils/middleware");
const s3 = require("../utils/s3user");
const {
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const { getReceiverSocketId, io } = require('../socket/socket.js');

const bucketName = process.env.BUCKET_NAME;

router.get("/", async (req, res) => {
  try {
    const friends = await Friend.findAll({});
    res.status(200).json(friends);
  } catch (err) {
    console.error("Error retrieving friends:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const friends = await Friend.findAll({
      where: { userId: req.params.id },
      include: [
        {
          model: User,
          attributes: { exclude: ["passwordHash"] },
        },
      ],
    });

    for (const friend of friends) {
      const getObjectParams = {
        Bucket: bucketName,
        Key: friend.user.avatarName,
      };
      const command = new GetObjectCommand(getObjectParams);
      const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
      friend.user.avatarName = url;
    }
    res.status(200).json(friends);
  } catch (err) {
    console.error("Error retrieving friend:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", middleware.findUserSession, async (req, res) => {
  try {
    const user = req.user;
    if (!user || !(req.body.userId === user.id)) {
      return res.status(404).json({ error: "Unauthorized" });
    }

    // Check if the request body contains a Gmail address
    const { gmail } = req.body;
    if (!gmail) {
      return res.status(400).json({ error: "Gmail address is required" });
    }

    // Find the user by their Gmail address
    const friend = await User.findOne({ where: { gmail: gmail } });
    if (!friend) {
      return res.status(404).json({ error: "User with the provided Gmail address not found" });
    }

    // Ensure that the found user is not the same as the authenticated user
    if (friend.id === user.id) {
      return res.status(400).json({ error: "You cannot add yourself as a friend" });
    }

    // Check if the relationship already exists
    const existingFriendship = await Friend.findOne({
      where: {
        userId: user.id,
        friendId: friend.id,
      },
    });

    if (existingFriendship) {
      return res.status(400).json({ error: "Friendship already exists" });
    }

    // when adding a friend, person B will become a friend of person A, and vice versa
    const firstFriend = await Friend.create({
      userId: user.id,
      friendId: friend.id,
    });

    const secondFriend = await Friend.create({
      userId: friend.id,
      friendId: user.id,
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
      const getObjectParams = {
        Bucket: bucketName,
        Key: newConversation.imageName,
      };
      const command = new GetObjectCommand(getObjectParams);
      const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
      newConversation.imageName = url;
    }

    if (newConversation.participant_list.length > 0) {
      for (const participant of newConversation.participant_list) {
        const getObjectParams = {
          Bucket: bucketName,
          Key: participant.avatarName,
        };
        const command = new GetObjectCommand(getObjectParams);
        const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
        participant.avatarName = url;
      }
    }

    
    const receiverFriendSocketId = getReceiverSocketId(friend.id);
    const newFriend = await Friend.findOne({
      where: { userId: friend.id, friendId: user.id },
      include: [
        {
          model: User,
          attributes: { exclude: ["passwordHash"] },
        },
      ],
    });

    const getObjectParams = {
      Bucket: bucketName,
      Key: newFriend.user.avatarName,
    };
    const command = new GetObjectCommand(getObjectParams);
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
    newFriend.user.avatarName = url;
    
    
    if (receiverFriendSocketId) {
      io.to(receiverFriendSocketId).emit("newFriend", newFriend);
    }
    
    const participantIds = newConversation.participant_list.map(participant => participant.id);

    for (const participantId of participantIds) {
      const receiverSocketId = getReceiverSocketId(participantId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("newConversation", newConversation);
      }
    }
        
    res.status(201).json(firstFriend);
  } catch (err) {
    console.error("Error creating friend:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});


router.delete("/:id", middleware.findUserSession, async (req, res) => {
  try {
    const firstFriend = await Friend.findByPk(req.params.id);
    if (!firstFriend) {
      return res.status(404).json({ error: "Friend not found" });
    }
    const user = req.user;
    if (!user || !(firstFriend.userId === user.id)) {
      return res.status(404).json({ error: "Unauthorized" });
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

    res.status(204).json(returnedDetails);
  } catch (err) {
    console.error("Error deleting friend:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
