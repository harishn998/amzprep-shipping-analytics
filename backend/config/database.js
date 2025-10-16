import mongoose from 'mongoose';

let isConnected = false;

const connectDB = async () => {
  // Prevent multiple connections
  if (isConnected) {
    console.log('📊 Using existing MongoDB connection');
    return;
  }

  try {
    console.log('🔄 Connecting to MongoDB Atlas...');

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // These options help with connection stability
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,  // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000,  // Close sockets after 45s of inactivity
    });

    isConnected = true;

    console.log('✅ MongoDB Connected:', conn.connection.host);
    console.log('📁 Database:', conn.connection.name);

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  MongoDB disconnected');
      isConnected = false;
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('🔌 MongoDB connection closed through app termination');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.error('Full error:', error);
    isConnected = false;

    // In development, exit on connection failure
    if (process.env.NODE_ENV === 'development') {
      process.exit(1);
    }
  }
};

export default connectDB;
