import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer;

export const connectDB = async () => {
  try {
    let uri = process.env.MONGODB_URI;
    
    // Fallback to in-memory database if the user has the default localhost URI but no MongoDB installed.
    if (uri && (uri.includes('127.0.0.1') || uri.includes('localhost'))) {
      try {
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
        console.log(`MongoDB Connected (Local): ${mongoose.connection.host}`);
        return;
      } catch (err) {
        console.log('Local MongoDB not running. Spinning up in-memory database...');
        mongoServer = await MongoMemoryServer.create();
        uri = mongoServer.getUri();
      }
    }

    const conn = await mongoose.connect(uri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

export const disconnectDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
};

export default connectDB;
