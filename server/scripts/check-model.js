import Character from "../src/models/Character.js";

const character = new Character({
  sourceId: 1,
  name: "A-Bomb",
  slug: "1-a-bomb",
  biography: {
    fullName: "Richard Milhouse Jones",
    publisher: "Marvel Comics",
    alignment: "good",
  },
  images: {
    md: "https://cdn.jsdelivr.net/gh/akabab/superhero-api@0.3.0/api/images/md/1-a-bomb.jpg",
  },
  sourceVersion: "0.3.0",
  importedAt: new Date(),
});

try {
  await character.validate();

  console.log("Character model validation passed.");
  console.dir(character.toObject(), { depth: null });
} catch (error) {
  console.error("Character model validation failed:", error.message);
  process.exitCode = 1;
}