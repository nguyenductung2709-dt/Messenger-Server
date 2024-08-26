const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { APP_URL } = require('../config');
const { sendingMail } = require('../mailing');

const generateResetToken = async () => {
  const token = crypto.randomBytes(16).toString('hex');
  const tokenHash = await bcrypt.hash(token, 10);
  return { token, tokenHash };
};

const sendResetEmail = async (user, token) => {
  const resetLink = `${APP_URL}/reset-password?id=${user.id}&token=${token}`;

  await sendingMail({
    from: 'no-reply@example.com',
    to: user.gmail,
    subject: 'Password Reset Request for Your Tung Messaging App Account',
    text: `Hello, ${user.firstName} ${user.lastName},

We received a request to reset the password for your account on Tung Messaging App. If you made this request, here is the verification code you need to reset your password:

${token}

Please access the following link to reset your password:

${resetLink}

If you did not request a password reset, please ignore this email. Your account will remain secure, and no changes will be made.

Thank you for choosing Tung Messaging App.

Best regards,
Tung Nguyen
Tung Messaging App
tungdtnguyen123@gmail.com`,
  });
};

module.exports = {
  generateResetToken,
  sendResetEmail,
};
