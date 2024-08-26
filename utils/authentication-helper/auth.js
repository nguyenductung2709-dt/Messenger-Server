const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { SECRET } = require('../config');
const { Session, Token } = require('../../models/index');
const { APP_URL } = require("../config");
const { sendingMail } = require("../mailing");

const generateToken = (user) => {
  return jwt.sign({ gmail: user.gmail, id: user.id }, SECRET, { expiresIn: '1h' });
};

const saveSession = async (userId, token) => {
  await Session.destroy({ where: { userId } });
  await Session.create({ userId, token });
};

const confirmEmail = async ( user, token ) => {
  await sendingMail({
    from: "no-reply@example.com",
    to: `${user.gmail}`,
    subject: "Please Verify Your Email Address",
    text: `Hello, ${user.firstName} ${user.lastName},

Thank you for registering with Tung Messaging App. To complete your registration with account ${user.username}, please verify your email address by clicking the link below:

${APP_URL}/api/users/verify-email/${user.id}/${token}

If you did not request this, please ignore this email.
  
Thank you for choosing Tung Messaging App.
  
Best regards,
Tung Nguyen
Tung Messaging App
tungdtnguyen123@gmail.com
`, });
}

const createTokenAndSendEmail = async ( user ) => {
  const setToken = await Token.create({
    userId: user.id,
    token: crypto.randomBytes(16).toString("hex"),
  });
  if (setToken) {
    await confirmEmail(user, setToken.token);
  } else {
    throw new Error("Token not created");
  }
}

module.exports = {
  confirmEmail,
  generateToken,
  saveSession,
  createTokenAndSendEmail,
};
