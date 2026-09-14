import { useState } from "react";
import "./App.css";

const API_URL = "/api/characters";

function App() {
  const [characters, setCharacters] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  async function loadCharacters() {
    setStatus("loading");
    setError("");
    setCharacters([]);

    try {
      const response = await fetch(API_URL);

      if (!response.ok) {
        throw new Error(`Request failed: HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error("Expected a list of characters from the API.");
      }

      setCharacters(data);
      setStatus("success");
    } catch (error) {
      setError(error.message);
      setStatus("error");
    }
  }

  return (
    <main className="explorer">
      <h1>Marvel Character Explorer</h1>
      <p>Discover Marvel heroes and villains.</p>

      <button
        className="load-button"
        onClick={loadCharacters}
        disabled={status === "loading"}
      >
        {status === "loading" ? "Loading..." : "Load Marvel characters"}
      </button>

      {error && <p role="alert">{error}</p>}

      {status === "success" && (
        <p role="status">
          {characters.length === 0
            ? "No characters found."
            : `Showing ${characters.length} characters.`}
        </p>
      )}

      <div className="character-grid">
        {characters.map((character) => (
          <article className="character-card" key={character._id}>
            {character.images?.md ? (
              <img
                src={character.images.md}
                alt={character.name}
                width="240"
                height="320"
                loading="lazy"
              />
            ) : (
              <p>Image unavailable.</p>
            )}

            <div className="character-info">
              <h2>{character.name}</h2>
              <p>
                Full name: {character.biography?.fullName || "Unknown"}
              </p>
              <p>
                Alignment: {character.biography?.alignment || "Unknown"}
              </p>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}

export default App;