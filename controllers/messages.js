/* eslint-disable no-param-reassign */
const router = require("express").Router();
const multer = require("multer");
const { findUserSession } = require("../utils/middleware");
const { pushUpdatedFieldsMessage, generateImageOrFileUrl } = require("../utils/helper-functions");
// library to handle uploading files
const storage = multer.memoryStorage();
const upload = multer({ storage });

const { Message, Conversation, User } = require("../models/index");

// AWS S3 SDK library to upload and get images from AWS S3
const { randomFileName, uploadFile } = require("../utils/aws/aws-sdk-s3");

const { getReceiverSocketId, io } = require("../socket/socket");

const generateFileUrl = async (message) => {
  await generateImageOrFileUrl(message.imageUrl);
  await generateImageOrFileUrl(message.fileUrl);
}

const prepareMessageData = async (req, jwtUser) => {
  const messageData = {
    senderId: jwtUser.id,
    ...req.body,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  if (req.file) {
    const { file } = req;
    const randomName = randomFileName();
    await uploadFile(randomName, file.buffer, file.mimetype);

    if (file.mimetype.includes("image")) {
      messageData.imageUrl = randomName;
    } else {
      messageData.fileUrl = randomName;
      messageData.fileName = file.originalname;
    }
  }

  return messageData;
};

const updateConversation = async (conversationId) => {
  const conversation = await Conversation.findOne({
    where: { id: conversationId },
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

  conversation.setDataValue('updatedAt', new Date());
  await conversation.save();
};

const notifyParticipants = async (conversationId, message) => {
  const conversation = await Conversation.findOne({
    where: { id: conversationId },
    include: [{ model: User, as: "participant_list" }],
  });

  const participantIds = conversation.participant_list.map(participant => participant.id).filter(id => id !== message.senderId);

  await Promise.all(
    participantIds.map(async (participantId) => {
      const receiverSocketId = getReceiverSocketId(participantId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("newMessage", message);
      }
    })
  );
};

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
    await generateFileUrl(message);
  }))
  return res.status(200).json(messages);
});

router.post("/", upload.single("messageImage"), findUserSession, async (req, res) => {
  const { jwtUser } = req;

  if (!jwtUser) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const messageData = await prepareMessageData(req, jwtUser);

  const message = await Message.create(messageData);
  await updateConversation(req.body.conversationId);
  await generateFileUrl(message);
  
  notifyParticipants(req.body.conversationId, message);

  return res.status(201).json(message);
});

router.put( "/:id", upload.single("messageImage"), findUserSession, async (req, res) => {
  const message = await Message.findByPk(req.params.id);
  const { jwtUser } = req;
  if (!message) {
    return res.status(404).json({ error: "Message not found" });
  }

  // handle if current user has the same id with owner of the message
  if (!jwtUser || jwtUser.id !== message.senderId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const updatedFields = await pushUpdatedFieldsMessage(req.body, ["message"], req.file, message);
  
  updatedFields.updatedAt = new Date();
  await message.update(updatedFields);
  return res.status(201).json(message);
});

router.delete("/:id", findUserSession, async (req, res) => {
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
