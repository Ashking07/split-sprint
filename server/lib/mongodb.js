import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

let cached = global.__mongoose;
if (!cached) cached = global.__mongoose = { conn: null, promise: null };

const CONN_OPTS = {
  serverSelectionTimeoutMS: 7000,
  connectTimeoutMS: 7000,
  socketTimeoutMS: 8000,
  maxPoolSize: 5,
};

export async function connectDB() {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not set. Add it to your environment variables.");
  }
  if (cached.conn && mongoose.connection.readyState === 1) return cached.conn;
  if (cached.conn) {
    cached.conn = null;
    cached.promise = null;
  }
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, CONN_OPTS).then((m) => m);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

// Start connecting at module load so the connection is warming up during cold start
if (MONGODB_URI && !cached.promise) {
  cached.promise = mongoose.connect(MONGODB_URI, CONN_OPTS).then((m) => {
    cached.conn = m;
    return m;
  }).catch(() => {
    cached.promise = null;
  });
}
