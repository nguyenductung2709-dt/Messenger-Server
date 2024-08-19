/* eslint-disable no-param-reassign */
const router = require("express").Router();
const multer = require("multer");
const middleware = require("../utils/middleware");

// library to handle uploading files
const storage = multer.memoryStorage();
const upload = multer({ storage });

const { Message, Conversation, User } = require("../models/index");

// AWS S3 SDK library to upload and get images from AWS S3
const {
  randomFileName,
  uploadFile,
  generateSignedUrl,
} = require("../utils/aws-sdk-s3");

const {
  invalidateCloudFrontCache,
} = require("../utils/aws-sdk-cloudfront");

const { getReceiverSocketId, io } = require("../socket/socket");

router.get("/:id", async (req, res) => {
  const messages = await Message.findAll({
    where: {
      conversationId: req.params.id,
    },
    include: [
      {
        model: Conversation,
        attributes: {
          exclude: ["createdAt", "updatedAt"],
        },
      },
      {
        model: User,
        attributes: {
          exclude: ["passwordHash", "createdAt", "updatedAt"],
        },
      },
    ],
  });

  await Promise.all(messages.map(async(message) => {
    if (message.imageUrl) {
      message.imageUrl = await generateSignedUrl(message.imageUrl);
    }
    if (message.fileUrl) {
      message.fileUrl = await generateSignedUrl(message.fileUrl);
    }
  }))
  return res.status(200).json(messages);
});

router.post(
  "/",
  upload.single("messageImage"),
  middleware.findUserSession,
  async (req, res) => {
    const { jwtUser } = req;
    if (!jwtUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const messageData = {
      senderId: jwtUser.id,
      ...req.body,
    };

    if (req.file) {
      const { file } = req;
      const randomName = randomFileName();
      await uploadFile(randomName, file.buffer, file.mimetype);

      if (file.mimetype.includes("image")) {
        messageData.imageUrl = randomName;
      } else {
        messageData.fileUrl = randomName;
        messageData.fileName = req.file.originalname;
      }
    }

    messageData.createdAt = new Date();
    messageData.updatedAt = new Date();

    const message = await Message.create(messageData);

    const conversation = await Conversation.findOne({
      where: { id: req.body.conversationId },
      include: [
        {
          model: User,
          as: "participant_list",
          attributes: { exclude: ["passwordHash", "createdAt"] },
          through: {
            attributes: { exclude: ["createdAt", "updatedAt", "userId"] },
            as: "participant_details",
          },
        },
      ],
    });

    // update the conversation
    conversation.setDataValue('updatedAt', new Date()); // method to update the conversation
    await conversation.save();

    // handle making imageName into url
    if (message.imageUrl) {
      message.imageUrl = await generateSignedUrl(message.imageUrl);
    }

    // handle making fileName into url
    if (message.fileUrl) {
      message.fileUrl = await generateSignedUrl(message.fileUrl);
    }

    const participantIds = conversation.participant_list.map(
      (participant) => participant.id,
    );

    await Promise.all(participantIds.map(async(participantId) => {
      const receiverSocketId = getReceiverSocketId(participantId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("newMessage", message);
      }
    }))
    return res.status(201).json(message);
  },
);

router.put(
  "/:id",
  upload.single("messageImage"),
  middleware.findUserSession,
  async (req, res) => {
    const message = await Message.findByPk(req.params.id);
    const { jwtUser } = req;
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // handle if current user has the same id with owner of the message
    if (!jwtUser || jwtUser.id !== message.senderId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // handle updating of each element
    const updatedFields = {};

    if (req.body.message) {
      updatedFields.message = req.body.message;
    }

    if (req.file) {
      if (message.imageUrl) {
        await uploadFile(message.imageUrl, req.file.buffer, req.file.mimetype);
        await invalidateCloudFrontCache(message.imageUrl);
      } else if (message.fileUrl) {
        await uploadFile(message.fileUrl, req.file.buffer, req.file.mimetype);
        await invalidateCloudFrontCache(message.fileUrl);
      }
    }

    updatedFields.updatedAt = new Date();
    await message.update(updatedFields);
    return res.status(201).json(message);
  },
);

router.delete("/:id", middleware.findUserSession, async (req, res) => {
  const message = await Message.findByPk(req.params.id);
  if (!message) {
    return res.status(404).json({ error: "Message not found" });
  }

  // handle if the current user is the same as the owner of this message
  const { jwtUser } = req;
  if (!jwtUser || jwtUser.id !== message.senderId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  await message.destroy();
  return res.status(204).json(message);
});

module.exports = router;
