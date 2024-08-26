/* eslint-disable no-param-reassign */
const router = require("express").Router();

// library to handle uploading files
const multer = require("multer");

const storage = multer.memoryStorage();
const upload = multer({ storage });

const bcrypt = require("bcrypt"); // used to encrypt passwords
const { pushUpdatedFields, generateAvatarUrl } = require('../utils/helper-functions');
const { findUserSession } = require("../utils/middleware");
const { User, Conversation, Friend, Token } = require("../models/index");
const { createTokenAndSendEmail } = require("../utils/authentication-helper/auth");
const { APP_URL, SALT_ROUNDS } = require("../utils/config");

// AWS S3 SDK library to upload and get images from AWS S3
const { randomFileName, uploadFile } = require("../utils/aws/aws-sdk-s3");

const usersAttributeAndIncludeOptions = {
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
};

router.get("/", async (req, res) => {
  const users = await User.findAll(usersAttributeAndIncludeOptions);

  await Promise.all(users.map(async(user) => {
    await generateAvatarUrl(user);
  }))

  return res.status(200).json(users);
});

router.get("/:id", async (req, res) => {
  const user = await User.findByPk(req.params.id, usersAttributeAndIncludeOptions);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  await generateAvatarUrl(user);

  return res.status(200).json(user);
});

router.post("/", upload.single("avatarImage"), async (req, res) => {
  let imageName = null;

  if (req.file) {
    imageName = randomFileName();
    await uploadFile(imageName, req.file.buffer, req.file.mimetype);
  }

  const passwordHash = await bcrypt.hash(req.body.password, SALT_ROUNDS);

  const userData = {
    ...req.body,
    passwordHash,
  };

  const { username, gmail } = req.body;

  if (imageName) {
    userData.avatarName = imageName;
  }
  const userWithUserName = await User.findOne({ where: { username } });
  if (userWithUserName) {
    return res.status(400).json({ error: "Username is already taken" });
  }

  const userWithVerifiedGmail = await User.findOne({ where: { gmail, isVerified: true } });
  if (userWithVerifiedGmail) {
    return res.status(400).json({ error: "Email is already used and verified by other user" });
  }

  const user = await User.create(userData);

  if (user) {
    await createTokenAndSendEmail(user);
    return res.status(201).send(user);
  } else {
    return res.status(404).send("User not created");
  }
});

router.post('/resend-verification-email/:id', async(req, res) => {
  const oldToken = await Token.findOne({ where: { userId: req.params.id }});
  if (oldToken) {
    await oldToken.destroy();
  }
  const user = await User.findOne({ where: { id: req.params.id } });
  
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const userWithVerifiedGmail = await User.findOne({ where: { gmail: user.gmail, isVerified: true } });
  if (userWithVerifiedGmail) {
    return res.status(400).json({ error: "Email is already used and verified by other user. Please change to another email address." });
  }
  await createTokenAndSendEmail(user);
  
  return res.status(200).send("Email sent successfully");
}      
);

router.get('/verify-email/:id/:token', async(req, res) => {
  const user = await User.findByPk(req.params.id);
  const token = await Token.findOne({
    where: {
      userId: req.params.id,
      token: req.params.token
    }
  });

  if (user && token) {
    await user.update({ isVerified: true });
    await token.destroy();
    res.redirect(`${APP_URL}/email-verification-success`);
  } else {
    return res.status(400).send("Invalid token");
  }
})

router.put("/:id", upload.single("avatarImage"), findUserSession, async (req, res) => {
  const { id } = req.params;
  const { user } = req;
  const userWithId = await User.findByPk(id);

  if (!userWithId) {
    return res.status(404).json({ error: "User not found" });
  }

  if (!user || user.id !== Number(id)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const fieldsToUpdate = ["gmail", "firstName", "lastName", "middleName", "dateOfBirth"];
  const updatedFields = await pushUpdatedFields(req.body, fieldsToUpdate, req.file, user, "avatarName");

  await user.update(updatedFields);
  return res.status(201).json(user);
});

module.exports = router;
