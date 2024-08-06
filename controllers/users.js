/* eslint-disable no-param-reassign */
const router = require("express").Router();

// library to handle uploading files
const multer = require("multer");

const storage = multer.memoryStorage();
const upload = multer({ storage });

const bcrypt = require("bcrypt"); // used to encrypt passwords
const middleware = require("../utils/middleware");
const { User, Conversation, Friend } = require("../models/index");

// AWS S3 SDK library to upload and get images from AWS S3
const {
  randomFileName,
  uploadFile,
  generateSignedUrl,
} = require("../utils/aws-sdk");

router.get("/", async (req, res) => {
  const users = await User.findAll({
    attributes: { exclude: ["passwordHash"] },
    include: [
      {
        model: Conversation,
        as: "conversation",
        through: {
          as: "participant",
        },
      },
      {
        model: Friend,
      },
    ],
  });

  await Promise.all(users.map(async(user) => {
    if (user.avatarName) {
      user.avatarName = await generateSignedUrl(user.avatarName);
    }
  }))

  return res.status(200).json(users);
});

router.get("/:id", async (req, res) => {
  const user = await User.findByPk(req.params.id, {
    attributes: { exclude: ["passwordHash"] },
    include: [
      {
        model: Conversation,
        as: "conversation",
        through: {
          as: "participant",
        },
      },
      {
        model: Friend,
      },
    ],
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  if (user.avatarName) {
    user.avatarName = await generateSignedUrl(user.avatarName);
  }

  return res.status(200).json(user);
});

router.post("/", upload.single("avatarImage"), async (req, res) => {
  let imageName = null;

  if (req.file) {
    imageName = randomFileName();
    await uploadFile(imageName, req.file.buffer, req.file.mimetype);
  }

  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(req.body.password, saltRounds);

  const userData = {
    ...req.body,
    passwordHash,
  };

  if (imageName) {
    userData.avatarName = imageName;
  }

  const user = await User.create(userData);
  return res.status(201).json(user);
});

router.put(
  "/:id",
  upload.single("avatarImage"),
  middleware.findUserSession,
  async (req, res) => {
    const userWithId = await User.findByPk(req.params.id);
    const {user} = req;

    if (!userWithId) {
      return res.status(404).json({ error: "User not found" })
    }
    if (!user || user.id !== Number(req.params.id)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const updatedFields = {};
    if (req.body.gmail) {
      updatedFields.gmail = req.body.gmail;
    }
    if (req.body.firstName) {
      updatedFields.firstName = req.body.firstName;
    }
    if (req.body.lastName) {
      updatedFields.lastName = req.body.lastName;
    }
    if (req.body.middleName) {
      updatedFields.middleName = req.body.middleName;
    }
    if (req.body.dateOfBirth) {
      updatedFields.dateOfBirth = req.body.dateOfBirth;
    }

    if (req.file) {
      const imageName = randomFileName();
      if (user.avatarName) {
        await uploadFile(user.avatarName, req.file.buffer, req.file.mimetype);
      } else {
        await uploadFile(imageName, req.file.buffer, req.file.mimetype);
        updatedFields.avatarName = imageName;
      }
    }
    
    await user.update(updatedFields);
    return res.status(201).json(user);
  },
);

module.exports = router;
