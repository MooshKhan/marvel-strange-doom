import express from "express";
import mongoose from "mongoose";
import Character from "./models/Character.js";

const app = express();
const PORT = 3001;

// Return one page of characters in alphabetical order.
app.get("/api/characters", async (req, res) => {
    const rawPage = req.query.page ?? "1";
    const page = Number(rawPage);
    const limit = 20;
    const skip = (page - 1) * limit;
  
    if (
      typeof rawPage !== "string" ||
      !Number.isSafeInteger(page) ||
      page < 1 ||
      !Number.isSafeInteger(skip)
    ) {
      return res.status(400).json({
        error: "Page must be a positive whole number within the supported range.",
      });
    }
  
    try {
      const total = await Character.countDocuments({});
      const totalPages = Math.ceil(total / limit);
  
      const characters = await Character.find({})
        .sort({ name: 1, sourceId: 1 })
        .skip(skip)
        .limit(limit)
        .lean();
  
      res.json({
        characters,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      });
    } catch (error) {
      console.error("Character list failed:", error.message);
  
      res.status(500).json({
        error: "Could not load characters.",
      });
    }
  });

// Connect to MongoDB before accepting requests.
try {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is missing from the environment.");
  }

  await mongoose.connect(uri, {
    dbName: "marvel_explorer",
    serverSelectionTimeoutMS: 10000,
  });

  app.listen(PORT, "127.0.0.1", () => {
    console.log(`API running at http://127.0.0.1:${PORT}`);
  });
} catch (error) {
  console.error("Server startup failed:", error.message);
  await mongoose.disconnect();
  process.exitCode = 1;
}