import mongoose from "mongoose";

try {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is missing from the environment.");
  }

  await mongoose.connect(uri, {
    dbName: "marvel_explorer",
    serverSelectionTimeoutMS: 10000,
  });

  await mongoose.connection.db.command({ ping: 1 });

  console.log("Connected to MongoDB successfully.");
  console.log("Database:", mongoose.connection.name);
} catch (error) {
  console.error("Database connection failed:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}