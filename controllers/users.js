/* eslint-disable no-param-reassign */
const router = require("express").Router();

// library to handle uploading files
const multer = require("multer");

const storage = multer.memoryStorage();
const upload = multer({ storage });
const crypto = require("crypto"); 

const bcrypt = require("bcrypt"); // used to encrypt passwords
const middleware = require("../utils/middleware");
const { User, Conversation, Friend, Token } = require("../models/index");
const { sendingMail } = require("../utils/mailing");

// AWS S3 SDK library to upload and get images from AWS S3
const {
  randomFileName,
  uploadFile,
  generateSignedUrl,
} = require("../utils/aws-sdk-s3");

const {
  invalidateCloudFrontCache,
} = require("../utils/aws-sdk-cloudfront");

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

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
      if (!isValidUrl(user.avatarName)) {
        user.avatarName = await generateSignedUrl(user.avatarName);
      }
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
    if (!isValidUrl(user.avatarName)) {
      user.avatarName = await generateSignedUrl(user.avatarName);
    }
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

  const { gmail, firstName, lastName } = req.body;

  if (imageName) {
    userData.avatarName = imageName;
  }

  const user = await User.create(userData);
  if (user) {
    let setToken = await Token.create({
      userId: user.id,
      token: crypto.randomBytes(16).toString("hex"),
    });
    if (setToken) {
      sendingMail({
        from: "no-reply@example.com",
        to: `${gmail}`,
        subject: "Please Verify Your Email Address",
        text: `Hello, ${firstName} ${lastName},
        
Thank you for registering with Tung Messaging App. To complete your registration, please verify your email address by clicking the link below:

${process.env.APP_URL}/api/users/verify-email/${user.id}/${setToken.token}

If you did not request this, please ignore this email.
      
Thank you for choosing Tung Messaging App.
      
Best regards,
Tung Nguyen
Tung Messaging App
tungdtnguyen123@gmail.com
`,
      });           
    } else {
      return res.status(400).send("token not created");
    }

    console.log("user", JSON.stringify(user, null, 2));

    return res.status(201).send(user);
  } else {
    return res.status(409).send("Details are not correct");
  }
});

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
    return res.status(200).send("Email verified successfully");
  } else {
    return res.status(400).send("Invalid token");
  }
})

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
      if (user.avatarName) {
        await uploadFile(user.avatarName, req.file.buffer, req.file.mimetype);
        await invalidateCloudFrontCache(user.avatarName);
      } else {
        const imageName = randomFileName();
        await uploadFile(imageName, req.file.buffer, req.file.mimetype);
        updatedFields.avatarName = imageName;
      }
    }
    
    await user.update(updatedFields);
    return res.status(201).json(user);
  },
);

module.exports = router;
