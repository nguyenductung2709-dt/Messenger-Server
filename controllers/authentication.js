const router = require("express").Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { SECRET } = require("../utils/config");
const { User, Session } = require("../models/index");
const middleware = require("../utils/middleware");
const passport = require("passport");

router.get("/login/success", async (req, res) => {
  const user = req.user;
  
  if (user) {
    const userDetails = user._json;
    let existingUser = await User.findOne({
      where: { gmail: userDetails.email },
      attributes: { exclude: ["passwordHash"] }
    });
    
    if (!existingUser) {
      // Create a new user in DB
      const userData = {
        gmail: userDetails.email,
        firstName: userDetails.given_name,
        lastName: userDetails.family_name,
        avatarName: userDetails.picture,
        isVerified: true
      };
      const newUser = await User.create(userData);
      
      // Create token
      const userForToken = {
        gmail: newUser.gmail,
        id: newUser.id
      };
      const token = jwt.sign(userForToken, SECRET, { expiresIn: '1h' });

      // Delete previous login information
      await Session.destroy({
        where: {
          userId: newUser.id
        }
      });

      // Add new login information
      await Session.create({
        userId: newUser.id,
        token
      });

      // Send response
      return res.status(200).json({
        error: false,
        message: "Successfully Logged In",
        user: {
          id: newUser.id, 
          token, 
          gmail: newUser.gmail
        }
      });
    } else {
      // User already exists
      // Create token
      const userForToken = {
        gmail: existingUser.gmail,
        id: existingUser.id
      };
      const token = jwt.sign(userForToken, SECRET, { expiresIn: '1h' });

      // Delete previous login information
      await Session.destroy({
        where: {
          userId: existingUser.id
        }
      });

      // Add new login information
      await Session.create({
        userId: existingUser.id,
        token
      });

      // Send response
      return res.status(200).json({
        error: false,
        message: "Successfully Logged In",
        user: {
          id: existingUser.id, 
          token, 
          gmail: existingUser.gmail
        }
      });
    }
  } else {
    res.status(403).json({ error: true, message: "Not Authorized" });
  }
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

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne(
    { where: { username } },
    { attributes: { exclude: ["passwordHash"] } },
  );
  
  let passwordCorrect = false;

  if (user && user.passwordHash) {
    passwordCorrect = await bcrypt.compare(password, user.passwordHash);
  }
  
  if (!user || !passwordCorrect) {
    return res.status(401).json({
      error: "Invalid username or password",
    });
  }
  
  if (user.disabled) {
    return res.status(401).json({
      error: "user has been disabled",
    });
  }
  const userForToken = {
    username: user.username,
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
  return res.status(200).send({ id: user.id, token, username: user.username });
});

router.post("/logout", middleware.findUserSession, async (req, res) => {
  if (req.isAuthenticated()) {
    req.logout();
  }
  if (!req.jwtUser) {
    return res.status(404).json({ error: "User not found" });
  }
  // delete information of the current login information
  const { id } = req.jwtUser;
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
