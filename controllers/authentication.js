const router = require("express").Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { SECRET } = require("../utils/config");
const { User, Session } = require("../models/index");
const middleware = require("../utils/middleware");

router.post("/login", async (req, res) => {
  const { gmail, password } = req.body;
  const user = await User.findOne(
    { where: { gmail } },
    { attributes: { exclude: ["passwordHash"] } },
  );
  const passwordCorrect =
    user == null ? false : await bcrypt.compare(password, user.passwordHash);
  if (!(user && passwordCorrect)) {
    return res.status(401).json({
      error: "invalid username or password",
    });
  }
  if (user.disabled) {
    return res.status(401).json({
      error: "user has been disabled",
    });
  }
  const userForToken = {
    gmail: user.gmail,
    id: user.id,
  };
  const token = jwt.sign(userForToken, SECRET, { expiresIn: 60 * 60 });

  // delete the previous login information
  await Session.destroy({
    where: {
      userId: user.id,
    },
  });

  // add the new login information
  await Session.create({
    userId: user.id,
    token,
  });
  return res.status(200).send({ id: user.id, token, gmail: user.gmail });
});

router.post("/logout", middleware.findUserSession, async (req, res) => {
  if (!req.user) {
    return res.status(404).json({ error: "User not found" });
  }
  // delete information of the current login information
  const { id } = req.user;
  await Session.destroy({ where: { userId: id } });
  return res.status(200).json({ message: "Successfully logged out!" });
});

/*
router.post('/reset_password', async (req, res) => {
  try {
    //Implement later with frontend
  } catch (err) {
    //Implement later with frontend
  }
});
*/

module.exports = router;
