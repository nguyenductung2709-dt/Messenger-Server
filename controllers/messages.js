const router = require("express").Router();
const middleware = require("../utils/middleware");

// library to handle uploading files
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const crypto = require("crypto"); // used to generate random string
const { Message, Conversation, User } = require("../models/index");

//AWS S3 SDK library to upload and get images from AWS S3
const s3 = require("../utils/s3user");
const {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const { getReceiverSocketId, io } = require('../socket/socket.js');

const bucketName = process.env.BUCKET_NAME;

const generateRandomName = (bytes = 32) =>
  crypto.randomBytes(bytes).toString("hex"); // generate random image name to avoid conflicts

router.get("/", async (req, res) => {
  try {
    const messages = await Message.findAll({
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
    // a message can contain a file or an image
    for (const message of messages) {
      let getObjectParams = {};
      // handle making imageName into url
      if (message.imageUrl) {
        getObjectParams = {
          Bucket: bucketName,
          Key: message.imageUrl,
        };
        const command = new GetObjectCommand(getObjectParams);
        const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
        message.imageUrl = url;
      }
      // handle making fileName into url
      if (message.fileUrl) {
        getObjectParams = {
          Bucket: bucketName,
          Key: message.fileUrl,
        };
        const command = new GetObjectCommand(getObjectParams);
        const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
        message.fileUrl = url;
      }
    }
    res.status(200).json(messages);
  } catch (err) {
    console.error("Error retrieving messages:", err);
    res.status(500).json({ error: "Failed to retrieve messages" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const messages = await Message.findAll({
      where: {
        conversationId: req.params.id
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

    for (const message of messages) {
      let getObjectParams = {};

      // handle making imageName into url
      if (message.imageUrl) {
        getObjectParams = {
          Bucket: bucketName,
          Key: message.imageUrl,
        };
        const command = new GetObjectCommand(getObjectParams);
        const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
        message.imageUrl = url;
      }

      // handle making fileName into url
      if (message.fileUrl) {
        getObjectParams = {
          Bucket: bucketName,
          Key: message.fileUrl,
        };
        const command = new GetObjectCommand(getObjectParams);
        const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
        message.fileUrl = url;
      }
    }

    res.status(200).json(messages);
  } catch (err) {
    console.error("Error retrieving messages:", err);
    res.status(500).json({ error: "Failed to retrieve messages" });
  }
});

router.post(
  "/",
  upload.single("messageImage"),
  middleware.findUserSession,
  async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(404).json({ error: "Unauthorized" });
      }

      let messageData = {
        senderId: user.id,
        ...req.body,
      };

      if (req.file) {
        const originalName = req.file.originalname;
        const randomName = generateRandomName();
        const params = {
          Bucket: bucketName,
          Key: randomName,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
        };
        const command = new PutObjectCommand(params);
        await s3.send(command);

        const imageExtensionsRegex = /\.(jpg|jpeg|png|HEIC|webp)$/i;
        if (imageExtensionsRegex.test(originalName)) {
          messageData.imageUrl = randomName; // if has tail as above, it will be stored in imageName
        } else {
          messageData.fileUrl = randomName; // else, it will be stored in fileName
          messageData.fileName = req.file.originalname; // store fileName
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
            attributes: { exclude: ["passwordHash", "createdAt", "updatedAt"] },
            through: {
              attributes: { exclude: ["createdAt", "updatedAt", "userId"] },
              as: "participant_details",
            },
          },
        ],
      });

      let getObjectParams = {};

      // handle making imageName into url
      if (message.imageUrl) {
        getObjectParams = {
          Bucket: bucketName,
          Key: message.imageUrl,
        };
        const command = new GetObjectCommand(getObjectParams);
        const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
        message.imageUrl = url;
      }

      // handle making fileName into url
      if (message.fileUrl) {
        getObjectParams = {
          Bucket: bucketName,
          Key: message.fileUrl,
        };
        const command = new GetObjectCommand(getObjectParams);
        const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
        message.fileUrl = url;
      }
    
      
      const participantIds = conversation.participant_list.map(participant => participant.id);

      for (const participantId of participantIds) {
        const receiverSocketId = getReceiverSocketId(participantId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("newMessage", message);
        }
      }

      res.status(201).json(message);
    } catch (err) {
      console.error("Error creating message:", err);
      res.status(500).json({ error: "Failed to create message" });
    }
  },
);

router.put(
  "/:id",
  upload.single("messageImage"),
  middleware.findUserSession,
  async (req, res) => {
    try {
      const message = await Message.findByPk(req.params.id);
      const user = req.user;
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }

      // handle if current user has the same id with owner of the message
      if (!user || user.id != message.senderId) {
        return res.status(404).json({ error: "Unauthorized" });
      }

      // handle updating of each element
      const updatedFields = {};

      if (req.body.message) {
        updatedFields.message = req.body.message;
      }
      if (req.file) {
        let deleteParams = {};
        if (message.imageUrl) {
          deleteParams = {
            Bucket: bucketName,
            Key: message.imageUrl,
          };
        }

        if (message.fileUrl) {
          deleteParams = {
            Bucket: bucketName,
            Key: message.fileUrl,
          };
        }
        const deleteCommand = new DeleteObjectCommand(deleteParams);
        await s3.send(deleteCommand);

        const originalName = req.file.originalname;
        const randomName = generateRandomName();
        const params = {
          Bucket: bucketName,
          Key: randomName,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
        };
        const command = new PutObjectCommand(params);
        await s3.send(command);

        const imageExtensionsRegex = /\.(jpg|jpeg|png|HEIC)$/i;
        if (imageExtensionsRegex.test(originalName)) {
          updatedFields.imageUrl = randomName;
        } else {
          updatedFields.fileUrl = randomName;
        }
      }
      updatedFields.updatedAt = new Date();
      await message.update(updatedFields);
      res.status(201).json(message);
    } catch (err) {
      console.error("Error updating message:", err);
      res.status(500).json({ error: "Failed to update message" });
    }
  },
);

router.delete("/:id", middleware.findUserSession, async (req, res) => {
  try {
    const message = await Message.findByPk(req.params.id);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // handle if the current user is the same as the owner of this message
    const user = req.user;
    if (!user || user.id != message.senderId) {
      return res.status(404).json({ error: "Unauthorized" });
    }
    await message.destroy();
    res.status(204).json(message);
  } catch (err) {
    console.error("Error updating message:", err);
    res.status(500).json({ error: "Failed to update message" });
  }
});

module.exports = router;
