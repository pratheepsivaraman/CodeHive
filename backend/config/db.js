import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer = null;

export const connectDB = async () => {
  let uri = process.env.MONGODB_URI;

  // In test environment or if no URI provided, use memory server directly
  if (process.env.NODE_ENV === 'test' || !uri) {
    try {
      if (!mongoServer) {
        mongoServer = await MongoMemoryServer.create();
      }
      uri = mongoServer.getUri();
      const conn = await mongoose.connect(uri);
      console.log(`MongoDB Connected (In-Memory Test DB): ${conn.connection.host}`);
      return conn;
    } catch (err) {
      console.error('Failed to start in-memory MongoDB:', err.message);
      throw err;
    }
  }

  // Attempt connection to configured URI with 3.5s timeout
  try {
    const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 3500 });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (err) {
    console.warn(`Could not connect to primary MongoDB (${err.message}).`);
    console.log('Spinning up in-memory MongoDB fallback database...');
    try {
      if (!mongoServer) {
        mongoServer = await MongoMemoryServer.create();
      }
      const fallbackUri = mongoServer.getUri();
      const conn = await mongoose.connect(fallbackUri);
      console.log(`MongoDB Connected (In-Memory Fallback): ${conn.connection.host}`);
      return conn;
    } catch (fallbackErr) {
      console.error(`Fatal MongoDB connection error: ${fallbackErr.message}`);
      process.exit(1);
    }
  }
};

export const disconnectDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
};

export default connectDB;

