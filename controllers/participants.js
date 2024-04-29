const router = require("express").Router();
const middleware = require("../utils/middleware");
const { Participant, Conversation, Message, User } = require("../models/index");
const s3 = require("../utils/s3user");
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const bucketName = process.env.BUCKET_NAME;

router.get("/", async (req, res) => {
  try {
    const participants = await Participant.findAll({});
    res.status(200).json(participants);
  } catch (err) {
    console.error("Error retrieving participants:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
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

    for (const participant of participants) {
      const user = participant.user;
      if (user && user.avatarName) {
        const getObjectParams = {
          Bucket: bucketName,
          Key: user.avatarName,
        };
        const command = new GetObjectCommand(getObjectParams);
        const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
        user.avatarName = url;
      }
    }

    res.status(200).json(participants);
  } catch (err) {
    console.error("Error retrieving participants:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", middleware.findUserSession, async (req, res) => {
  try {
    const conversation = await Conversation.findByPk(req.body.conversationId, {
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
    const user = req.user;

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
      return res.status(404).json({ error: "Unauthorized" });
    }

    const gmail = req.body.gmail
    
    const participant = await User.findOne({
      where: {
        gmail: gmail,
      },
    });

    const createdFields = {
      ...req.body,
      userId: participant.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const participantCreated = await Participant.create(createdFields);
    res.status(201).json(participantCreated);
  } catch (err) {
    console.error("Error creating participant:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", middleware.findUserSession, async (req, res) => {
  try {
    const participant = await Participant.findByPk(req.params.id);
    if (!participant) {
      return res.status(404).json({ error: "Participant not found" });
    }

    // take the conversation that participant belongs to
    const conversation = await Conversation.findByPk(
      participant.conversationId,
      {
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
      },
    );

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // check if the current user is admin of this conversation
    const user = req.user;
    const userInConversation = conversation.participant_list.find(
      (participant) => participant.id === user.id,
    );
    if (
      !user ||
      !userInConversation ||
      !userInConversation.participant_details.isAdmin
    ) {
      return res.status(404).json({ error: "Unauthorized" });
    }
    participant.isAdmin = true;
    await participant.save();
    res.status(201).json(participant);
  } catch (err) {
    console.error("Error creating admin:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", middleware.findUserSession, async (req, res) => {
  try {
    const participant = await Participant.findByPk(req.params.id);

    if (!participant) {
      return res.status(404).json({ error: "Participant not found" });
    }

    // take the conversation that participant belongs to
    const conversation = await Conversation.findByPk(
      participant.conversationId,
      {
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
      },
    );

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // check if the current user is admin of this conversation, only admin can remove user from conversation
    const user = req.user;
    const userInConversation = conversation.participant_list.find(
      (participant) => participant.id === user.id,
    );
    if (
      !user ||
      !userInConversation ||
      !userInConversation.participant_details.isAdmin
    ) {
      return res.status(404).json({ error: "Unauthorized" });
    }

    await participant.destroy();
    res.status(204).json(participant);
  } catch (err) {
    console.error("Error deleting participant:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
