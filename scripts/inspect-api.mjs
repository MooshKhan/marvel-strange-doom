const API_URL =
  "https://cdn.jsdelivr.net/gh/akabab/superhero-api@0.3.0/api/all.json";

try {
  // Request the JSON file from the server.
  const response = await fetch(API_URL);

  // Check whether the server returned a successful HTTP status.
  if (!response.ok) {
    throw new Error(`Request failed: HTTP ${response.status}`);
  }

  // Parse the JSON response into JavaScript values.
  const characters = await response.json();

  // Verify that the top-level value is a list.
  if (!Array.isArray(characters)) {
    throw new Error("Expected an array of characters.");
  }

  console.log("Total characters:", characters.length);

  // Keep records whose publisher is Marvel Comics.
  const marvelCharacters = characters.filter(
    character => character.biography?.publisher === "Marvel Comics"
  );

  console.log("Marvel characters:", marvelCharacters.length);

  // Show a compact preview of the first five Marvel records.
  console.table(
    marvelCharacters.slice(0, 10).map(character => ({
      id: character.id,
      name: character.name,
      publisher: character.biography?.publisher,
      alignment: character.biography?.alignment,
    }))
  );

  // Inspect one complete record and its image URL.
  const firstCharacter = marvelCharacters[0];

  if (!firstCharacter) {
    throw new Error("No characters matched the Marvel Comics filter.");
  }

  console.log("First Marvel character:");
  console.dir(firstCharacter, { depth: null });

  console.log("Image URL:", firstCharacter.images?.md);
} catch (error) {
  console.error("Could not inspect the API:", error);
  process.exitCode = 1;
}