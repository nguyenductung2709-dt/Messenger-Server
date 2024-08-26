const OAuth2Strategy = require("passport-google-oauth20").Strategy;
const passport = require("passport");
const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = require("./config");

passport.use(
		new OAuth2Strategy({
			clientID: GOOGLE_CLIENT_ID,
			clientSecret: GOOGLE_CLIENT_SECRET,
			callbackURL:"/api/auth/google/callback",
			scope:["profile","email"]
		},
		function (accessToken, refreshToken, profile, callback) {
			callback(null, profile);
		}
	)
);

passport.serializeUser((user, done) => {
	done(null, user);
});

passport.deserializeUser((user, done) => {
	done(null, user);
});