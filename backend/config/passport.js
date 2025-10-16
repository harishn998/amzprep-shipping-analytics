import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User.js';

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Extract user information from Google profile
      const email = profile.emails[0].value;
      const name = profile.displayName;
      const picture = profile.photos[0]?.value || '';
      const googleId = profile.id;

      console.log('Google login attempt:', email);

      // Optional: Check if email domain is allowed
      if (process.env.ALLOWED_EMAIL_DOMAINS && process.env.ALLOWED_EMAIL_DOMAINS.length > 0) {
        const allowedDomains = process.env.ALLOWED_EMAIL_DOMAINS.split(',');
        const emailDomain = email.split('@')[1];

        if (!allowedDomains.includes(emailDomain)) {
          console.log('Email domain not authorized:', emailDomain);
          return done(null, false, { message: 'Email domain not authorized' });
        }
      }

      // Find existing user or create new one in MongoDB
      let user = await User.findOne({ email });

      if (!user) {
        // Create new user
        user = await User.create({
          googleId,
          email,
          name,
          picture
        });
        console.log('✅ New user created in MongoDB:', email);
      } else {
        // Update existing user's last login and info
        user.lastLogin = new Date();
        user.name = name;  // Update name in case it changed
        user.picture = picture;  // Update picture in case it changed
        await user.save();
        console.log('✅ Existing user logged in:', email);
      }

      return done(null, user);
    } catch (error) {
      console.error('Passport error:', error);
      return done(error, null);
    }
  }
));

// Serialize user for session - store user ID
passport.serializeUser((user, done) => {
  done(null, user._id.toString());
});

// Deserialize user from session - fetch from MongoDB
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
