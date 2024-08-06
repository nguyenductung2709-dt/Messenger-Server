const router = require("express").Router();
const middleware = require("../utils/middleware");
const { Participant, Conversation, Message, User } = require("../models/index");
const { generateSignedUrl } = require("../utils/aws-sdk");
const { getReceiverSocketId, io } = require("../socket/socket");

router.get("/:id", async (req, res) => {
  const participants = await Participant.findAll({
    where: {
      conversationId: req.params.id,
    },
    include: [
      {
        model: User,
        attributes: { exclude: ["passwordHash"] },
      },
    ],
  });

  if (!participants) {
    return res.status(404).json({ error: "Participants not found" });
  }

  await Promise.all(
    participants.map(async (participant) => {
      const { user } = participant;
      if (user && user.avatarName) {
        user.avatarName = await generateSignedUrl(user.avatarName);
      }
    }),
  );

  return res.status(200).json(participants);
});

router.post("/", middleware.findUserSession, async (req, res) => {
  const conversation = await Conversation.findByPk(req.body.conversationId, {
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

  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }
  const { user } = req;

  // ids of all participants
  const participants = conversation.participant_list
    .map((participant) => participant.id)
    .filter((id) => id !== user.id);

  // take the user in the conversation with the current user's id
  const userInConversation = conversation.participant_list.find(
    (participant) => participant.id === user.id,
  );

  // only admin can add another participant so check if the current user is admin
  if (
    !user ||
    !userInConversation ||
    !userInConversation.participant_details.isAdmin
  ) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { gmail } = req.body;

  const participant = await User.findOne({
    where: {
      gmail,
    },
  });

  const createdFields = {
    conversationId: req.body.conversationId,
    userId: participant.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const participantCreated = await Participant.create(createdFields);

  conversation.setDataValue('updatedAt', new Date()); // method to update the conversation
  await conversation.save();
  
  // get the updated conversation
  const updatedConversation = await Conversation.findByPk(
    req.body.conversationId,
    {
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
    },
  );

  // send the details of new conversation to each participant in the conversation
  await Promise.all(
    participants.map(async (participantId) => {
      const receiverSocketId = getReceiverSocketId(participantId);
      if (receiverSocketId) {
        await io
          .to(receiverSocketId)
          .emit("updateConversation", updatedConversation);
      }
    }),
  );

  return res.status(201).json(participantCreated);
});

router.put("/:id", middleware.findUserSession, async (req, res) => {
  const participant = await Participant.findByPk(req.params.id);
  if (!participant) {
    return res.status(404).json({ error: "Participant not found" });
  }

  // take the conversation that participant belongs to
  const conversation = await Conversation.findByPk(participant.conversationId, {
    include: [
      {
        model: Message,
        attributes: {
          exclude: ["createdAt", "updatedAt"],
        },
      },
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

  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  // check if the current user is admin of this conversation
  const { user } = req;
  const userInConversation = conversation.participant_list.find(
    (singleParticipant) => singleParticipant.id === user.id,
  );
  if (
    !user ||
    !userInConversation ||
    !userInConversation.participant_details.isAdmin
  ) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  participant.isAdmin = true;
  await participant.save();
  conversation.setDataValue('updatedAt', new Date()); // method to update the conversation
  await conversation.save();
  return res.status(201).json(participant);
});

router.delete("/:id", middleware.findUserSession, async (req, res) => {
  const participant = await Participant.findByPk(req.params.id);

  if (!participant) {
    return res.status(404).json({ error: "Participant not found" });
  }

  // take the conversation that participant belongs to
  const conversation = await Conversation.findByPk(participant.conversationId, {
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

  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  // check if the current user is admin of this conversation, only admin can remove user from conversation
  const { user } = req;

  const userInConversation = conversation.participant_list.find(
    (singleParticipant) => singleParticipant.id === user.id,
  );

  const participantDeleted = await Participant.findOne({
    where: { id: req.params.id },
  });

  const participants = conversation.participant_list
    .map((singleParticipant) => singleParticipant.id)
    .filter((id) => id !== user.id && id !== participantDeleted.userId);

  if (
    !user ||
    !userInConversation ||
    !userInConversation.participant_details.isAdmin
  ) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  await participant.destroy();

  // get the updated conversation
  const updatedConversation = await Conversation.findByPk(conversation.id, {
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

  // send the details of new conversation to each participant in the conversation
  await Promise.all(
    participants.map(async (participantId) => {
      const receiverSocketId = getReceiverSocketId(participantId);
      if (receiverSocketId) {
        await io
          .to(receiverSocketId)
          .emit("updateConversation", updatedConversation);
      }
    }),
  );

  // send the details of the conversation to the deleted participant
  const receiverSocketId = getReceiverSocketId(participantDeleted.userId);
  if (receiverSocketId) {
    io.to(receiverSocketId).emit("deleteConversation", updatedConversation);
  }

  return res.status(204).json(participant);
});

module.exports = router;
