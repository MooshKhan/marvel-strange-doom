import {
  useEffect,
  useState,
} from "react";

import {
  Link,
  useParams,
  useSearchParams,
} from "react-router";

import CharacterNotes from "./CharacterNotes";

import {
  useAuth,
} from "./auth-context";

import type {
  Character,
  LoadStatus,
} from "./types";

function CharacterDetail() {
  const {
    user,
    loading: authLoading,
  } = useAuth();

  const { slug } =
    useParams();

  const [searchParams] =
    useSearchParams();

  const galleryQuery =
    searchParams.toString();

  const galleryUrl =
    galleryQuery
      ? `/?${galleryQuery}`
      : "/";

  const [
    character,
    setCharacter,
  ] =
    useState<Character | null>(
      null
    );

  const [status, setStatus] =
    useState<LoadStatus>(
      "loading"
    );

  const [error, setError] =
    useState("");

  useEffect(() => {
    const controller =
      new AbortController();

    async function loadCharacter() {
      if (!slug) {
        setError(
          "Character slug is missing."
        );

        setStatus("error");

        return;
      }

      setStatus("loading");
      setError("");
      setCharacter(null);

      try {
        const response =
          await fetch(
            `/api/characters/${encodeURIComponent(
              slug
            )}`,
            {
              signal:
                controller.signal,
            }
          );

        if (
          response.status ===
          404
        ) {
          throw new Error(
            "Character not found."
          );
        }

        if (!response.ok) {
          throw new Error(
            `Request failed: HTTP ${response.status}`
          );
        }

        const data =
          (await response.json()) as Character;

        if (
          !controller.signal.aborted
        ) {
          setCharacter(data);
          setStatus(
            "success"
          );
        }
      } catch (error) {
        if (
          !controller.signal.aborted
        ) {
          setError(
            error instanceof Error
              ? error.message
              : "An unexpected error occurred."
          );

          setStatus("error");
        }
      }
    }

    loadCharacter();

    return () =>
      controller.abort();
  }, [slug]);

  const imageUrl =
    character?.images?.lg ??
    character?.images?.md;

  return (
    <main className="explorer">
      <Link to={galleryUrl}>
        Back to gallery
      </Link>

      {status === "loading" && (
        <p role="status">
          Loading character...
        </p>
      )}

      {status === "error" && (
        <p role="alert">
          {error}
        </p>
      )}

      {status === "success" &&
        character && (
          <article className="character-detail">
            <h1>
              {character.name}
            </h1>

            {imageUrl ? (
              <img
                src={imageUrl}
                alt={
                  character.name
                }
                width="480"
                height="640"
              />
            ) : (
              <p>
                Image unavailable.
              </p>
            )}

            <p>
              Full name:{" "}
              {character
                .biography
                .fullName ||
                "Unknown"}
            </p>

            <p>
              Publisher:{" "}
              {character
                .biography
                .publisher ||
                "Unknown"}
            </p>

            <p>
              Alignment:{" "}
              {character
                .biography
                .alignment ||
                "Unknown"}
            </p>
          </article>
        )}

      {status === "success" &&
        character &&
        user && (
          <CharacterNotes
            key={`${character.slug}-${user.id}`}
            slug={
              character.slug
            }
            characterName={
              character.name
            }
          />
        )}

      {status === "success" &&
        character &&
        !user &&
        !authLoading && (
          <section className="character-notes">
            <h2>
              Your private
              notes
            </h2>

            <p>
              <Link
                to="/account"
                state={{
                  from:
                    `/characters/${slug}${
                      galleryQuery
                        ? `?${galleryQuery}`
                        : ""
                    }`,
                }}
              >
                Sign in or
                create an
                account
              </Link>{" "}
              to write, edit
              and save notes
              about{" "}
              {character.name}.
            </p>
          </section>
        )}
    </main>
  );
}

export default CharacterDetail;