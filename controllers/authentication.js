const router = require('express').Router();
const passport = require('passport');
const bcrypt = require('bcrypt');
const { SALT_ROUNDS } = require('../utils/config');
const { isValidEmail } = require('../utils/helper-functions');
const { findUserSession } = require('../utils/middleware');
const { generateToken, saveSession } = require('../utils/authentication-helper/auth');
const { generateResetToken, sendResetEmail } = require('../utils/authentication-helper/password');
const { User, Session } = require('../models/index');

router.get('/login/success', async (req, res) => {
  const user = req.user;
  
  if (!user) {
    return res.status(403).json({ error: true, message: "Not Authorized" });
  }

  const userDetails = user._json;
  let existingUser = await User.findOne(
    { where: { gmail: userDetails.email },
     attributes: { exclude: ["passwordHash"] } 
    }
  );

  const userData = {
    gmail: userDetails.email,
    firstName: userDetails.given_name,
    lastName: userDetails.family_name,
    avatarName: userDetails.picture,
    isVerified: true,
  };

  const finalUser = existingUser || await User.create(userData);
  const token = generateToken(finalUser);

  await saveSession(finalUser.id, token);

  return res.status(200).json({
    error: false,
    message: "Successfully Logged In",
    user: { id: finalUser.id, token, gmail: finalUser.gmail }
  });
});

router.get("/login/failed", (req, res) => {
	res.status(401).json({
		error: true,
		message: "Log in failure",
	});
});

router.get("/google", passport.authenticate("google", ["profile", "email"]));

router.get(
	"/google/callback",
	passport.authenticate("google", {
		successRedirect: "http://localhost:5173",
		failureRedirect: "/api/auth/login/failed",
	})
);

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  const user = await User.findOne(
    { where: { username } },
    { attributes: { exclude: ["passwordHash"] } },
  );
  
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({
      error: "Invalid username or password",
    });
  }

  if (user.disabled) {
    return res.status(401).json({ error: "User has been disabled" });
  }

  const token = generateToken(user);
  await saveSession(user.id, token);

  return res.status(200).json({ id: user.id, token, username: user.username });
});

router.post('/logout', findUserSession, async (req, res) => {
  if (req.isAuthenticated()) {
    req.logout();
  }

  if (!req.jwtUser) {
    return res.status(404).json({ error: "User not found" });
  }

  await Session.destroy({ where: { userId: req.jwtUser.id } });
  return res.status(200).json({ message: "Successfully logged out!" });
});

router.post('/request-reset-password', async (req, res) => {
  const input = req.body.input;
  const query = isValidEmail(input) ? { gmail: input } : { username: input };

  const user = await User.findOne({ where: query });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  if (!user.isVerified) {
    return res.status(403).json({ error: "Email address was not verified" });
  }

  const { token, tokenHash } = await generateResetToken();

  user.resetPasswordToken = tokenHash;
  await user.save();

  await sendResetEmail(user, token);

  return res.status(200).json({ message: "Token was sent successfully" });
});

router.put('/reset-password', async (req, res) => {
  const { id, token, password } = req.body;

  if (!token) {
    return res.status(400).json({ error: "Token is required" });
  }

  const user = await User.findByPk(id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const isTokenValid = await bcrypt.compare(token, user.resetPasswordToken);
  if (!isTokenValid) {
    return res.status(400).json({ error: "Invalid token" });
  }

  user.resetPasswordToken = null;
  user.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  await user.save();

  return res.status(200).json({ message: "Password reset successfully" });
});

module.exports = router;
