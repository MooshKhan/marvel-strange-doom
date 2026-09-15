import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";

function CharacterDetail() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
const galleryQuery = searchParams.toString();
const galleryUrl = galleryQuery ? `/?${galleryQuery}` : "/";
  const [character, setCharacter] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadCharacter() {
      setStatus("loading");
      setError("");
      setCharacter(null);

      try {
        const response = await fetch(
          `/api/characters/${encodeURIComponent(slug)}`,
          { signal: controller.signal }
        );

        if (response.status === 404) {
          throw new Error("Character not found.");
        }

        if (!response.ok) {
          throw new Error(`Request failed: HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!controller.signal.aborted) {
          setCharacter(data);
          setStatus("success");
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(error.message);
          setStatus("error");
        }
      }
    }

    loadCharacter();

    return () => controller.abort();
  }, [slug]);

  return (
    <main className="explorer">
      <Link to={galleryUrl}>Back to gallery</Link>

      {status === "loading" && (
        <p role="status">Loading character...</p>
      )}

      {status === "error" && <p role="alert">{error}</p>}

      {status === "success" && character && (
        <article className="character-detail">
          <h1>{character.name}</h1>

          {character.images?.lg || character.images?.md ? (
            <img
              src={character.images.lg || character.images.md}
              alt={character.name}
              width="480"
              height="640"
            />
          ) : (
            <p>Image unavailable.</p>
          )}

          <p>
            Full name: {character.biography?.fullName || "Unknown"}
          </p>
          <p>
            Publisher: {character.biography?.publisher || "Unknown"}
          </p>
          <p>
            Alignment: {character.biography?.alignment || "Unknown"}
          </p>
        </article>
      )}
    </main>
  );
}

export default CharacterDetail;