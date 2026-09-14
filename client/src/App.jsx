import { useState } from "react";
import "./App.css";

const API_URL = "/api/characters";

function App() {
  const [characters, setCharacters] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [pagination, setPagination] = useState(null);

  async function loadCharacters(page = 1) {
    setStatus("loading");
    setError("");
  
    try {
      const response = await fetch(`${API_URL}?page=${page}`);
  
      if (!response.ok) {
        throw new Error(`Request failed: HTTP ${response.status}`);
      }
  
      const data = await response.json();
  
      if (
        !Array.isArray(data.characters) ||
        !data.pagination ||
        !Number.isInteger(data.pagination.page)
      ) {
        throw new Error("The API returned an unexpected response.");
      }
  
      setCharacters(data.characters);
      setPagination(data.pagination);
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
        onClick={() => loadCharacters(1)}
        disabled={status === "loading"}
      >
        {status === "loading" ? "Loading..." : "Load Marvel characters"}
      </button>

      {error && <p role="alert">{error}</p>}

      <p role="status">
  {status === "loading"
    ? "Loading characters..."
    : pagination
      ? characters.length === 0
        ? "No characters found."
        : `Showing ${characters.length} of ${pagination.total} characters.`
      : "Load characters to begin."}
</p>

{pagination && pagination.totalPages > 0 && (
  <nav className="pagination" aria-label="Character pages">
    <button
      className="load-button"
      onClick={() => loadCharacters(pagination.page - 1)}
      disabled={
        status === "loading" || !pagination.hasPreviousPage
      }
    >
      Previous
    </button>

    <span>
      Page {pagination.page} of {pagination.totalPages}
    </span>

    <button
      className="load-button"
      onClick={() => loadCharacters(pagination.page + 1)}
      disabled={
        status === "loading" || !pagination.hasNextPage
      }
    >
      Next
    </button>
  </nav>
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