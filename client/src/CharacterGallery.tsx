import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

import {
  Link,
  useLocation,
  useSearchParams,
} from "react-router";

import type {
  Character,
  CharacterListResponse,
  GalleryAlignment,
  LoadStatus,
  Pagination,
} from "./types";

import "./App.css";

const API_URL = "/api/characters";

const galleryAlignments: GalleryAlignment[] = [
  "all",
  "good",
  "bad",
  "neutral",
  "unknown",
];

function isGalleryAlignment(
  value: string
): value is GalleryAlignment {
  return galleryAlignments.some(
    (alignment) => alignment === value
  );
}

type GalleryResultsProps = {
  queryString: string;
  activeSearch: string;
  activeAlignment: GalleryAlignment;

  setSearchParams: ReturnType<
    typeof useSearchParams
  >[1];
};

function CharacterGallery() {
  const [searchParams, setSearchParams] =
    useSearchParams();

  const location = useLocation();

  const activeSearch =
    searchParams.get("search") ?? "";

  const alignmentParam =
    searchParams.get("alignment");

  const activeAlignment: GalleryAlignment =
    alignmentParam &&
    isGalleryAlignment(alignmentParam)
      ? alignmentParam
      : "all";

  const queryString =
    new URLSearchParams({
      page:
        searchParams.get("page") ?? "1",
      search: activeSearch,
      alignment: activeAlignment,
    }).toString();

  return (
    <GalleryResults
      key={`${queryString}-${location.key}`}
      queryString={queryString}
      activeSearch={activeSearch}
      activeAlignment={activeAlignment}
      setSearchParams={setSearchParams}
    />
  );
}

function GalleryResults({
  queryString,
  activeSearch,
  activeAlignment,
  setSearchParams,
}: GalleryResultsProps) {
  const [characters, setCharacters] =
    useState<Character[]>([]);

  const [status, setStatus] =
    useState<LoadStatus>("loading");

  const [error, setError] =
    useState("");

  const [pagination, setPagination] =
    useState<Pagination | null>(null);

  const [searchInput, setSearchInput] =
    useState(activeSearch);

  const [
    alignmentInput,
    setAlignmentInput,
  ] = useState<GalleryAlignment>(
    activeAlignment
  );

  useEffect(() => {
    const controller =
      new AbortController();

    async function fetchCharacters() {
      try {
        const response = await fetch(
          `${API_URL}?${queryString}`,
          {
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error(
            `Request failed: HTTP ${response.status}`
          );
        }

        const data =
          (await response.json()) as CharacterListResponse;

        if (
          !Array.isArray(
            data.characters
          ) ||
          !data.pagination ||
          !Number.isInteger(
            data.pagination.page
          )
        ) {
          throw new Error(
            "The API returned an unexpected response."
          );
        }

        if (
          !controller.signal.aborted
        ) {
          setCharacters(
            data.characters
          );

          setPagination(
            data.pagination
          );

          setStatus("success");
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

    fetchCharacters();

    return () =>
      controller.abort();
  }, [queryString]);

  function navigateGallery(
    page: number = 1,
    search: string = activeSearch,
    alignment: GalleryAlignment =
      activeAlignment
  ) {
    setSearchParams({
      page: String(page),
      search,
      alignment,
    });
  }

  function handleSearch(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (status === "loading") {
      return;
    }

    navigateGallery(
      1,
      searchInput.trim(),
      alignmentInput
    );
  }

  return (
    <main className="explorer">
      <h1>
        Marvel Character Explorer
      </h1>

      <p>
        Discover Marvel heroes and
        villains.
      </p>

      <form
        className="search-form"
        onSubmit={handleSearch}
        role="search"
      >
        <label htmlFor="character-search">
          Search by character name
        </label>

        <input
          id="character-search"
          type="search"
          value={searchInput}
          onChange={(event) =>
            setSearchInput(
              event.target.value
            )
          }
          placeholder="Try Strange or Doom"
          maxLength={100}
          disabled={
            status === "loading"
          }
        />

        <label htmlFor="alignment-filter">
          Alignment
        </label>

        <select
          id="alignment-filter"
          value={alignmentInput}
          onChange={(event) => {
            const value =
              event.target.value;

            if (
              isGalleryAlignment(
                value
              )
            ) {
              setAlignmentInput(
                value
              );
            }
          }}
          disabled={
            status === "loading"
          }
        >
          <option value="all">
            All alignments
          </option>

          <option value="good">
            Good
          </option>

          <option value="bad">
            Bad
          </option>

          <option value="neutral">
            Neutral
          </option>

          <option value="unknown">
            Unknown
          </option>
        </select>

        <button
          className="load-button"
          type="submit"
          disabled={
            status === "loading"
          }
        >
          {status === "loading"
            ? "Searching..."
            : "Search"}
        </button>

        <button
          className="load-button"
          type="button"
          disabled={
            status === "loading"
          }
          onClick={() =>
            navigateGallery(
              1,
              "",
              "all"
            )
          }
        >
          Show all
        </button>
      </form>

      {error && (
        <p role="alert">
          {error}
        </p>
      )}

      <p role="status">
        {status === "loading"
          ? "Loading characters..."
          : status === "success"
            ? characters.length === 0
              ? "No characters found."
              : pagination
                ? `Showing ${characters.length} of ${pagination.total} characters.`
                : "Characters loaded."
            : "Try searching again."}
      </p>

      {pagination &&
        pagination.totalPages > 0 && (
          <nav
            className="pagination"
            aria-label="Character pages"
          >
            <button
              className="load-button"
              type="button"
              onClick={() =>
                navigateGallery(
                  pagination.page -
                    1
                )
              }
              disabled={
                status ===
                  "loading" ||
                !pagination.hasPreviousPage
              }
            >
              Previous
            </button>

            <span>
              Page{" "}
              {pagination.page} of{" "}
              {
                pagination.totalPages
              }
            </span>

            <button
              className="load-button"
              type="button"
              onClick={() =>
                navigateGallery(
                  pagination.page +
                    1
                )
              }
              disabled={
                status ===
                  "loading" ||
                !pagination.hasNextPage
              }
            >
              Next
            </button>
          </nav>
        )}

      <div className="character-grid">
        {characters.map(
          (character) => (
            <article
              className="character-card"
              key={character._id}
            >
              {character.images
                ?.md ? (
                <img
                  src={
                    character
                      .images.md
                  }
                  alt={
                    character.name
                  }
                  width="240"
                  height="320"
                  loading="lazy"
                />
              ) : (
                <p>
                  Image unavailable.
                </p>
              )}

              <div className="character-info">
                <h2>
                  <Link
                    to={`/characters/${encodeURIComponent(
                      character.slug
                    )}?${queryString}`}
                  >
                    {
                      character.name
                    }
                  </Link>
                </h2>

                <p>
                  Full name:{" "}
                  {character
                    .biography
                    .fullName ||
                    "Unknown"}
                </p>

                <p>
                  Alignment:{" "}
                  {character
                    .biography
                    .alignment ||
                    "Unknown"}
                </p>
              </div>
            </article>
          )
        )}
      </div>
    </main>
  );
}

export default CharacterGallery;