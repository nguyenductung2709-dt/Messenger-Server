const router = require("express").Router();
const multer = require("multer");
const { Conversation, Message, User, Participant } = require("../models/index");
const { pushUpdatedFields, generateAvatarUrl, generateImageOrFileUrl } = require("../utils/helper-functions");
const { findUserSession }= require("../utils/middleware");

// library to handle uploading files
const storage = multer.memoryStorage();
const upload = multer({ storage });

const { randomFileName, uploadFile } = require("../utils/aws/aws-sdk-s3");

const { getReceiverSocketId, io } = require("../socket/socket");

const conversationIncludeOptions = [
  {
    model: Message,
    attributes: { exclude: ["createdAt", "updatedAt"] },
  },
  {
    model: User,
    as: "participant_list",
    attributes: { exclude: ["passwordHash", "createdAt", "updatedAt"] },
    through: {
      attributes: { exclude: ["createdAt", "updatedAt", "userId"] },
      as: "participant_details",
    },
  },
];

const populateImageUrls = async (conversation) => {
  await generateImageOrFileUrl(conversation.imageName);
  if (conversation.participant_list?.length) {
    await Promise.all(
      conversation.participant_list.map(async (participant) => {
        await generateAvatarUrl(participant);
      })
    );
  }
};

const notifyParticipants = async (participants, event, data) => {
  await Promise.all(
    participants.map(async (participantId) => {
      const receiverSocketId = getReceiverSocketId(participantId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit(event, data);
      }
    })
  );
};

const isUserAdminInConversation = (userId, conversation) =>
  conversation.participant_list.some((participant) =>
    participant.id === userId && participant.participant_details.isAdmin);

const getNonAdminParticipants = (adminId, conversation) =>
  conversation.participant_list.map((participant) => participant.id).filter((id) => id !== adminId);


router.get("/", async (req, res) => {
  const conversations = await Conversation.findAll({ include: conversationIncludeOptions });

  // make imageName into url for better use in frontend
  await Promise.all(conversations.map(populateImageUrls));

  return res.status(200).json(conversations);
});

router.get("/:id", async (req, res) => {
  try {
    const conversation = await Conversation.findByPk(req.params.id, {
      include: conversationIncludeOptions,
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    await populateImageUrls(conversation);
    res.status(200).json(conversation);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/", upload.single("groupImage"), findUserSession, async (req, res) => {
  const { jwtUser } = req;

  if (!jwtUser) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const conversationData = { creatorId: jwtUser.id, ...req.body, createdAt: new Date(), updatedAt: new Date() };

  if (req.file) {
    const imageName = randomFileName();
    await uploadFile(imageName, req.file.buffer, req.file.mimetype);
    conversationData.imageName = imageName;
  }

  const conversation = await Conversation.create(conversationData);
  await Participant.create({
    conversationId: conversation.id,
    userId: conversation.creatorId,
    isAdmin: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await Promise.all(
    req.body.participants.map(async (participantId) =>
      Participant.create({ conversationId: conversation.id, userId: participantId, createdAt: new Date(), updatedAt: new Date() })
    )
  );

  const newConversation = await Conversation.findByPk(conversation.id, { include: conversationIncludeOptions });
  await notifyParticipants(req.body.participants, "newConversation", newConversation);

  res.status(201).json(conversation);
});


router.put("/:id", upload.single("groupImage"), findUserSession, async (req, res) => {
  const { jwtUser } = req;

  const conversation = await Conversation.findByPk(req.params.id, { include: conversationIncludeOptions });

  if (!conversation || !isUserAdminInConversation(jwtUser.id, conversation)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const updatedFields = await pushUpdatedFields(req.body, ["title"], req.file, conversation, "imageName");
  await conversation.update(updatedFields);

  const updatedConversation = await Conversation.findByPk(conversation.id, { include: conversationIncludeOptions });
  await populateImageUrls(updatedConversation);

  await notifyParticipants(getNonAdminParticipants(jwtUser.id, conversation), "updateConversation", updatedConversation);

  res.status(200).json(updatedConversation);
});

router.delete("/:id", findUserSession, async (req, res) => {
  const { jwtUser } = req;
  const conversation = await Conversation.findByPk(req.params.id, { include: conversationIncludeOptions });

  if (!conversation || !isUserAdminInConversation(jwtUser.id, conversation)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  await Participant.destroy({ where: { conversationId: conversation.id } });
  await conversation.destroy();

  res.status(204).end();
});

module.exports = router;
