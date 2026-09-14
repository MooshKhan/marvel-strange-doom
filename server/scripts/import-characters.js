import mongoose from "mongoose";
import Character from "../src/models/Character.js";

const SOURCE_VERSION = "0.3.0";
const API_URL =
  `https://cdn.jsdelivr.net/gh/akabab/superhero-api@${SOURCE_VERSION}/api/all.json`;

try {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is missing from the environment.");
  }

  // Fetch the external dataset.
  console.log("Downloading character data...");

  const response = await fetch(API_URL);

  if (!response.ok) {
    throw new Error(`API request failed: HTTP ${response.status}`);
  }

  const characters = await response.json();

  if (!Array.isArray(characters)) {
    throw new Error("Expected an array of characters.");
  }

  // Select the Marvel records.
  const marvelCharacters = characters.filter(
    character => character?.biography?.publisher === "Marvel Comics"
  );

  if (marvelCharacters.length === 0) {
    throw new Error("No Marvel characters were found.");
  }

  console.log("Marvel records found:", marvelCharacters.length);

  // Transform the records into our schema's structure.
  const importedAt = new Date();

  const records = marvelCharacters.map(character => ({
    sourceId: character.id,
    name: character.name,
    slug: character.slug,

    biography: {
      fullName: character.biography.fullName || "",
      publisher: character.biography.publisher,
      alignment: ["good", "bad", "neutral"].includes(
        character.biography.alignment
      )
        ? character.biography.alignment
        : "unknown",
    },

    images: {
      md: character.images?.md,
      lg: character.images?.lg,
    },

    sourceVersion: SOURCE_VERSION,
    importedAt,
  }));

  // Validate every record before writing any character data.
  for (const record of records) {
    const document = new Character(record);
    await document.validate();
  }

  console.log("All records passed schema validation.");

  // Connect and ensure the model's indexes are ready.
  await mongoose.connect(uri, {
    dbName: "marvel_explorer",
    serverSelectionTimeoutMS: 10000,
  });

  await Character.init();

  let inserted = 0;
  let matched = 0;

  // Insert new records or update existing ones.
  for (const record of records) {
    const result = await Character.updateOne(
      { sourceId: record.sourceId },
      { $set: record },
      { upsert: true, runValidators: true }
    );

    inserted += result.upsertedCount;
    matched += result.matchedCount;
  }

  const total = await Character.countDocuments({
    "biography.publisher": "Marvel Comics",
  });

  console.log("Import complete.");
  console.log("New records inserted:", inserted);
  console.log("Existing records matched:", matched);
  console.log("Marvel records in database:", total);
} catch (error) {
  console.error("Import failed:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}