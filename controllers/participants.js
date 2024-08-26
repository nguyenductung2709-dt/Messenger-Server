const router = require("express").Router();
const middleware = require("../utils/middleware");
const { Participant, Conversation, Message, User } = require("../models/index");
const { generateAvatarUrl } = require("../utils/helper-functions");
const { getReceiverSocketId, io } = require("../socket/socket");

const participantIncludeOptions = [
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
];

const updateConversationTimestamp = async (conversation) => {
  conversation.setDataValue('updatedAt', new Date());
  await conversation.save();
};

const sendConversationUpdate = async (participants, updatedConversation) => {
  await Promise.all(
    participants.map(async (participantId) => {
      const receiverSocketId = getReceiverSocketId(participantId);
      if (receiverSocketId) {
        await io.to(receiverSocketId).emit("updateConversation", updatedConversation);
      }
    })
  );
};

const checkAuthorization = (conversation, jwtUser) => {
  const userInConversation = conversation.participant_list.find(
    (participant) => participant.id === jwtUser.id
  );

  if (!jwtUser || !userInConversation?.participant_details.isAdmin) {
    return false;
  }
}

router.get("/:id", async (req, res) => {
  const participants = await Participant.findAll({
    where: { conversationId: req.params.id },
    include: [{ model: User, attributes: { exclude: ["passwordHash"] } }],
  });

  if (!participants) {
    return res.status(404).json({ error: "Participants not found" });
  }

  await Promise.all(
    participants.map(async(participant) => {
      await generateAvatarUrl(participant.user);
    })
  );

  return res.status(200).json(participants);
});

router.post("/", middleware.findUserSession, async (req, res) => {
  const { conversationId, gmail } = req.body;
  const { jwtUser } = req;
  const conversation = await Conversation.findByPk(conversationId, { include: participantIncludeOptions });

  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  const participants = conversation.participant_list
    .map((participant) => participant.id)
    .filter((id) => id !== jwtUser.id);

  if (!checkAuthorization(conversation, jwtUser)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const participant = await User.findOne({ where: { gmail } });
  const participantCreated = await Participant.create({
    conversationId,
    userId: participant.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await updateConversationTimestamp(conversation);
  const updatedConversation = await Conversation.findByPk(conversationId, { include: participantIncludeOptions });

  await sendConversationUpdate(participants, updatedConversation);

  return res.status(201).json(participantCreated);
});

router.put("/:id", middleware.findUserSession, async (req, res) => {
  const { jwtUser } = req;

  const participant = await Participant.findByPk(req.params.id);

  if (!participant) {
    return res.status(404).json({ error: "Participant not found" });
  }

  const conversation = await Conversation.findByPk(participant.conversationId, {
    include: [
      { model: Message, attributes: { exclude: ["createdAt", "updatedAt"] } },
      ...participantIncludeOptions,
    ],
  });

  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  if (!checkAuthorization(conversation, jwtUser)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  participant.isAdmin = true;
  await participant.save();
  await updateConversationTimestamp(conversation);

  return res.status(201).json(participant);
});

router.delete("/:id", middleware.findUserSession, async (req, res) => {
  const { jwtUser } = req;

  const participant = await Participant.findByPk(req.params.id);
  if (!participant) {
    return res.status(404).json({ error: "Participant not found" });
  }

  const conversation = await Conversation.findByPk(participant.conversationId, {
    include: participantIncludeOptions,
  });
  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  if (!checkAuthorization(conversation, jwtUser)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const participantDeleted = await Participant.findOne({ where: { id: req.params.id } });

  const participants = conversation.participant_list
    .map((singleParticipant) => singleParticipant.id)
    .filter((id) => id !== jwtUser.id && id !== participantDeleted.userId);

  await participant.destroy();
  const updatedConversation = await Conversation.findByPk(conversation.id, { include: participantIncludeOptions });

  await sendConversationUpdate(participants, updatedConversation);

  const receiverSocketId = getReceiverSocketId(participantDeleted.userId);
  if (receiverSocketId) {
    io.to(receiverSocketId).emit("deleteConversation", updatedConversation);
  }
  return res.status(204).json(participant);
});

module.exports = router;
