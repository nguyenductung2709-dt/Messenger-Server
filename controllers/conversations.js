/* eslint-disable no-param-reassign */
const router = require("express").Router();
const multer = require("multer");
const { Conversation, Message, User, Participant } = require("../models/index");
const middleware = require("../utils/middleware");

// library to handle uploading files
const storage = multer.memoryStorage();
const upload = multer({ storage });

const {
  randomFileName,
  uploadFile,
  generateSignedUrl,
} = require("../utils/aws-sdk-s3");

const {
  invalidateCloudFrontCache,
} = require("../utils/aws-sdk-cloudfront");

const { getReceiverSocketId, io } = require("../socket/socket");

router.get("/", async (req, res) => {
  const conversations = await Conversation.findAll({
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
  // make imageName into url for better use in frontend
  await Promise.all(
    conversations.map(async (conversation) => {
      if (conversation.imageName) {
        conversation.imageName = await generateSignedUrl(
          conversation.imageName,
        );
      }
      if (conversation.participant_list.length > 0) {
        await Promise.all(
          conversation.participant_list.map(async (participant) => {
            if (participant.avatarName) {
              participant.avatarName = await generateSignedUrl(
                participant.avatarName,
              );
            }
          }),
        );
      }
    }),
  );
  return res.status(200).json(conversations);
});

router.get("/:id", async (req, res) => {
  const conversation = await Conversation.findByPk(req.params.id, {
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

  // make imageName into url for better use in frontend
  if (conversation.imageName) {
    conversation.imageName = await generateSignedUrl(conversation.imageName);
  }

  if (conversation.participant_list.length > 0) {
    await Promise.all(
      conversation.participant_list.map(async (participant) => {
        if (participant.avatarName) {
          participant.avatarName = await generateSignedUrl(
            participant.avatarName,
          );
        }
      }),
    );
  }
  return res.status(200).json(conversation);
});

router.post(
  "/",
  upload.single("groupImage"),
  middleware.findUserSession,
  async (req, res) => {
    const { user } = req;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    let conversation;

    if (req.file) {
      // handle uploading new groupImage
      const imageName = randomFileName();
      await uploadFile(imageName, req.file.buffer, req.file.mimetype);

      conversation = await Conversation.create({
        creatorId: user.id,
        ...req.body,
        imageName,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else {
      conversation = await Conversation.create({
        creatorId: user.id,
        ...req.body,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // after creating a conversation, the creator will become the first and admin of the conversation
    await Participant.create({
      conversationId: conversation.id,
      userId: conversation.creatorId,
      isAdmin: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const { participants } = req.body;

    await Promise.all(
      participants.map(async (participantId) => {
        await Participant.create({
          conversationId: conversation.id,
          userId: participantId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }),
    );

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

    await Promise.all(
      participants.map(async (participantId) => {
        const receiverSocketId = getReceiverSocketId(participantId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("newConversation", newConversation);
        }
      }),
    );

    return res.status(201).json(conversation);
  },
);

router.put(
  "/:id",
  upload.single("groupImage"),
  middleware.findUserSession,
  async (req, res) => {
    const conversation = await Conversation.findByPk(req.params.id, {
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

    const { user } = req;
    const userInConversation = conversation.participant_list.find(
      (participant) => participant.id === user.id,
    );

    if (
      !user ||
      !userInConversation ||
      !userInConversation.participant_details.isAdmin
    ) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const updatedFields = {};
    if (req.body.title) {
      updatedFields.title = req.body.title;
    }

    if (req.file) {
      if (conversation.imageName) {
        await uploadFile(conversation.imageName, req.file.buffer, req.file.mimetype);
        await invalidateCloudFrontCache(conversation.imageName);
      } else {
        const imageName = randomFileName();
        await uploadFile(imageName, req.file.buffer, req.file.mimetype);
        updatedFields.imageName = imageName;
      }
    }

    updatedFields.updatedAt = new Date();
    await conversation.update(updatedFields);

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

    if (updatedConversation.imageName) {
      updatedConversation.imageName = await generateSignedUrl(
        updatedConversation.imageName,
      );
    }

    const participants = conversation.participant_list
      .map((participant) => participant.id)
      .filter((id) => id !== user.id);

    await Promise.all(
      participants.map(async (participant) => {
        const receiverSocketId = getReceiverSocketId(participant);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit(
            "updateConversation",
            updatedConversation,
          );
        }
      }),
    );
    return res.status(201).json(conversation);
  },
);

router.delete("/:id", middleware.findUserSession, async (req, res) => {
  const conversation = await Conversation.findByPk(req.params.id, {
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

  // take the current user based on the token and find that user in the conversation
  const { user } = req;
  const userInConversation = conversation.participant_list.find(
    (participant) => participant.id === user.id,
  );

  // only admin user from a conversation is allowed to delete the conversation
  if (
    [
      !user,
      !userInConversation,
      !userInConversation.participant_details.isAdmin,
    ].includes(true)
  ) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const participants = await Participant.findAll({
    where: { conversationId: conversation.id },
  });
  await Promise.all(participants.map((participant) => participant.destroy()));
  await conversation.destroy();
  return res.status(204).json(conversation);
});

module.exports = router;
