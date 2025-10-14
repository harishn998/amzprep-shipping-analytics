import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

// Simple in-memory user storage (for testing)
// In production, use MongoDB, PostgreSQL, etc.
const users = [];

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

      // Find existing user or create new one
      let user = users.find(u => u.email === email);

      if (!user) {
        user = {
          id: Date.now().toString(),
          googleId: profile.id,
          email,
          name,
          picture,
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString()
        };
        users.push(user);
        console.log('New user created:', email);
      } else {
        user.lastLogin = new Date().toISOString();
        console.log('Existing user logged in:', email);
      }

      return done(null, user);
    } catch (error) {
      console.error('Passport error:', error);
      return done(error, null);
    }
  }
));

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser((id, done) => {
  const user = users.find(u => u.id === id);
  done(null, user);
});

export default passport;
