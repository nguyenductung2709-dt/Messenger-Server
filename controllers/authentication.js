const router = require("express").Router();
const { SECRET } = require("../utils/config");
const jwt = require("jsonwebtoken");
const { User, Session } = require("../models/index");
const bcrypt = require("bcrypt");
const middleware = require("../utils/middleware");

router.post("/login", async (req, res) => {
  try {
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
      token: token,
    });
    res.status(200).send({ id: user.id, token, gmail: user.gmail });
  } catch (err) {
    console.error("Error updating user:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/logout", middleware.findUserSession, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(404).json({ error: "User not found" });
    }
    // delete information of the current login information
    const id = req.user.id;
    await Session.destroy({ where: { userId: id } });
    return res.status(200).json({ message: "Successfully logged out!" });
  } catch (error) {
    console.error("Error updating user:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/reset_password", async (req, res) => {
  try {
    //Implement later with frontend
  } catch (err) {
    //Implement later with frontend
  }
});

module.exports = router;
