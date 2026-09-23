import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import {
  useAuth,
} from "./auth-context";

import type {
  Note,
} from "./types";

type CharacterNotesProps = {
  slug: string;
  characterName: string;
};

type NoteChangeMethod =
  | "PATCH"
  | "DELETE";

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null
  );
}

function isNote(
  value: unknown
): value is Note {
  return (
    isRecord(value) &&
    typeof value._id === "string" &&
    typeof value.owner === "string" &&
    typeof value.character === "string" &&
    typeof value.text === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

function apiErrorMessage(
  value: unknown,
  fallback: string
): string {
  if (
    isRecord(value) &&
    typeof value.error === "string"
  ) {
    return value.error;
  }

  return fallback;
}

function caughtErrorMessage(
  error: unknown,
  fallback: string
): string {
  return error instanceof Error
    ? error.message
    : fallback;
}

function CharacterNotes({
  slug,
  characterName,
}: CharacterNotesProps) {
  const { write } =
    useAuth();

  const [notes, setNotes] =
    useState<Note[]>([]);

  const [text, setText] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [
    loadError,
    setLoadError,
  ] = useState("");

  const [
    saveError,
    setSaveError,
  ] = useState("");

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [reload, setReload] =
    useState(0);

  const [
    editingId,
    setEditingId,
  ] = useState<string | null>(
    null
  );

  const [
    editText,
    setEditText,
  ] = useState("");

  const [
    deletingId,
    setDeletingId,
  ] = useState<string | null>(
    null
  );

  const [
    actionError,
    setActionError,
  ] = useState("");

  const saveRequest =
    useRef<AbortController | null>(
      null
    );

  const endpoint =
    `/api/characters/${encodeURIComponent(
      slug
    )}/notes`;

  useEffect(() => {
    const controller =
      new AbortController();

    async function loadNotes() {
      setLoading(true);
      setLoadError("");

      try {
        const response =
          await fetch(
            endpoint,
            {
              signal:
                controller.signal,
            }
          );

        if (!response.ok) {
          throw new Error(
            "Could not load notes. Please try again."
          );
        }

        const data =
          (await response.json()) as unknown;

        if (
          !isRecord(data) ||
          !Array.isArray(
            data.notes
          ) ||
          !data.notes.every(
            isNote
          )
        ) {
          throw new Error(
            "Unexpected notes response."
          );
        }

        if (
          !controller.signal.aborted
        ) {
          setNotes(data.notes);
        }
      } catch (error) {
        if (
          !controller.signal.aborted
        ) {
          setLoadError(
            caughtErrorMessage(
              error,
              "Could not load notes."
            )
          );
        }
      } finally {
        if (
          !controller.signal.aborted
        ) {
          setLoading(false);
        }
      }
    }

    loadNotes();

    return () =>
      controller.abort();
  }, [endpoint, reload]);

  useEffect(
    () => () =>
      saveRequest.current?.abort(),
    []
  );

  async function handleSave(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      saveRequest.current ||
      loading ||
      loadError ||
      editingId ||
      deletingId
    ) {
      return;
    }

    const trimmedText =
      text.trim();

    setSaveError("");
    setMessage("");

    if (
      !trimmedText ||
      trimmedText.length >
        1000
    ) {
      setSaveError(
        "Enter a note between 1 and 1000 characters."
      );

      return;
    }

    const controller =
      new AbortController();

    saveRequest.current =
      controller;

    setSaving(true);

    try {
      const response =
        await write(
          endpoint,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              text: trimmedText,
            }),

            signal:
              controller.signal,
          }
        );

      const data =
        (await response
          .json()
          .catch(
            () => null
          )) as unknown;

      if (!response.ok) {
        throw new Error(
          apiErrorMessage(
            data,
            "Could not save the note."
          )
        );
      }

      if (!isNote(data)) {
        throw new Error(
          "Could not confirm the save. Reload notes before trying again."
        );
      }

      if (
        !controller.signal.aborted
      ) {
        setNotes(
          (current) =>
            [
              data,
              ...current,
            ].slice(0, 50)
        );

        setText("");

        setMessage(
          "Note saved."
        );
      }
    } catch (error) {
      if (
        !controller.signal.aborted
      ) {
        setSaveError(
          caughtErrorMessage(
            error,
            "Could not save the note."
          )
        );
      }
    } finally {
      saveRequest.current =
        null;

      if (
        !controller.signal.aborted
      ) {
        setSaving(false);
      }
    }
  }

  async function changeNote(
    method: NoteChangeMethod,
    noteId: string
  ) {
    if (
      saveRequest.current ||
      loading ||
      loadError
    ) {
      return;
    }

    const trimmedText =
      editText.trim();

    setActionError("");
    setMessage("");

    if (
      method === "PATCH" &&
      (!trimmedText ||
        trimmedText.length >
          1000)
    ) {
      setActionError(
        "Enter a note between 1 and 1000 characters."
      );

      return;
    }

    const controller =
      new AbortController();

    saveRequest.current =
      controller;

    setSaving(true);

    try {
      const response =
        await write(
          `${endpoint}/${encodeURIComponent(
            noteId
          )}`,
          {
            method,

            ...(method ===
              "PATCH" && {
              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  text:
                    trimmedText,
                }),
            }),

            signal:
              controller.signal,
          }
        );

      if (!response.ok) {
        const data =
          (await response
            .json()
            .catch(
              () => null
            )) as unknown;

        throw new Error(
          apiErrorMessage(
            data,
            "The note could not be changed. Please try again."
          )
        );
      }

      if (
        method === "PATCH"
      ) {
        const updated =
          (await response.json()) as unknown;

        if (
          !isNote(updated) ||
          updated._id !==
            noteId
        ) {
          throw new Error(
            "Could not confirm the update. Reload notes to check it."
          );
        }

        if (
          !controller.signal.aborted
        ) {
          setNotes(
            (current) =>
              current.map(
                (note) =>
                  note._id ===
                  noteId
                    ? updated
                    : note
              )
          );

          setEditingId(null);
          setEditText("");

          setMessage(
            "Note updated."
          );
        }
      } else if (
        !controller.signal.aborted
      ) {
        setNotes(
          (current) =>
            current.filter(
              (note) =>
                note._id !==
                noteId
            )
        );

        setDeletingId(null);

        setMessage(
          "Note deleted."
        );

        setLoading(true);

        setReload(
          (value) =>
            value + 1
        );
      }
    } catch (error) {
      if (
        !controller.signal.aborted
      ) {
        setActionError(
          caughtErrorMessage(
            error,
            "The note could not be changed."
          )
        );
      }
    } finally {
      saveRequest.current =
        null;

      if (
        !controller.signal.aborted
      ) {
        setSaving(false);
      }
    }
  }

  const busy =
    saving ||
    loading ||
    Boolean(loadError);

  return (
    <section
      className="character-notes"
      aria-labelledby="notes-heading"
    >
      <h2 id="notes-heading">
        Notes about{" "}
        {characterName}
      </h2>

      <p>
        Only you can see these
        notes · showing up to
        the latest 50.
      </p>

      {loading && (
        <p role="status">
          Loading notes...
        </p>
      )}

      {loadError && (
        <div>
          <p role="alert">
            {loadError}
          </p>

          <button
            className="load-button"
            onClick={() =>
              setReload(
                (value) =>
                  value + 1
              )
            }
          >
            Retry loading notes
          </button>
        </div>
      )}

      <form
        className="note-form"
        onSubmit={handleSave}
      >
        <label htmlFor="note-text">
          Add a note
        </label>

        <textarea
          id="note-text"
          value={text}
          onChange={(event) => {
            setText(
              event.target.value
            );

            setMessage("");
            setSaveError("");
          }}
          rows={4}
          maxLength={1000}
          required
          disabled={
            busy ||
            Boolean(editingId) ||
            Boolean(deletingId)
          }
          aria-describedby="note-length"
        />

        <small id="note-length">
          {text.length} / 1000
          characters
        </small>

        <button
          className="load-button"
          type="submit"
          disabled={
            busy ||
            Boolean(editingId) ||
            Boolean(deletingId) ||
            !text.trim()
          }
        >
          {saving &&
          !editingId &&
          !deletingId
            ? "Saving..."
            : "Save note"}
        </button>

        {saveError && (
          <p role="alert">
            {saveError}
          </p>
        )}

        <p role="status">
          {message}
        </p>
      </form>

      {actionError && (
        <div>
          <p role="alert">
            {actionError}
          </p>

          <button
            className="load-button"
            disabled={busy}
            onClick={() => {
              setEditingId(null);
              setDeletingId(null);
              setActionError("");

              setReload(
                (value) =>
                  value + 1
              );
            }}
          >
            Reload notes
          </button>
        </div>
      )}

      {!loading &&
        !loadError &&
        (notes.length === 0 ? (
          <p>
            No notes yet. Add
            the first one.
          </p>
        ) : (
          <ul className="note-list">
            {notes.map(
              (note) => (
                <li
                  key={note._id}
                >
                  {editingId ===
                  note._id ? (
                    <form
                      className="note-form"
                      onSubmit={(
                        event
                      ) => {
                        event.preventDefault();

                        changeNote(
                          "PATCH",
                          note._id
                        );
                      }}
                    >
                      <label
                        htmlFor={`edit-${note._id}`}
                      >
                        Edit note
                      </label>

                      <textarea
                        id={`edit-${note._id}`}
                        value={
                          editText
                        }
                        onChange={(
                          event
                        ) =>
                          setEditText(
                            event
                              .target
                              .value
                          )
                        }
                        maxLength={
                          1000
                        }
                        required
                        disabled={
                          busy
                        }
                        aria-describedby={`edit-length-${note._id}`}
                      />

                      <small
                        id={`edit-length-${note._id}`}
                      >
                        {
                          editText.length
                        }{" "}
                        / 1000
                        characters
                      </small>

                      <div className="note-actions">
                        <button
                          className="load-button"
                          type="submit"
                          disabled={
                            busy ||
                            !editText.trim()
                          }
                        >
                          {saving
                            ? "Saving changes..."
                            : "Save changes"}
                        </button>

                        <button
                          className="load-button secondary-button"
                          type="button"
                          disabled={
                            busy
                          }
                          onClick={() => {
                            setEditingId(
                              null
                            );

                            setActionError(
                              ""
                            );
                          }}
                        >
                          Cancel edit
                        </button>
                      </div>
                    </form>
                  ) : (
                    <p>
                      {note.text}
                    </p>
                  )}

                  <time
                    dateTime={
                      note.createdAt
                    }
                  >
                    Created{" "}
                    {new Date(
                      note.createdAt
                    ).toLocaleString()}
                  </time>

                  {note.updatedAt !==
                    note.createdAt && (
                    <time
                      dateTime={
                        note.updatedAt
                      }
                    >
                      Edited{" "}
                      {new Date(
                        note.updatedAt
                      ).toLocaleString()}
                    </time>
                  )}

                  {deletingId ===
                  note._id ? (
                    <div className="note-delete-confirmation">
                      <p>
                        Delete this
                        note
                        permanently?
                      </p>

                      <div className="note-actions">
                        <button
                          className="load-button"
                          disabled={
                            busy
                          }
                          onClick={() =>
                            changeNote(
                              "DELETE",
                              note._id
                            )
                          }
                        >
                          {saving
                            ? "Deleting..."
                            : "Confirm delete"}
                        </button>

                        <button
                          className="load-button secondary-button"
                          disabled={
                            busy
                          }
                          onClick={() => {
                            setDeletingId(
                              null
                            );

                            setActionError(
                              ""
                            );
                          }}
                        >
                          Cancel delete
                        </button>
                      </div>
                    </div>
                  ) : editingId !==
                    note._id ? (
                    <div className="note-actions">
                      <button
                        className="load-button secondary-button"
                        disabled={
                          busy ||
                          Boolean(
                            editingId
                          ) ||
                          Boolean(
                            deletingId
                          )
                        }
                        onClick={() => {
                          setEditingId(
                            note._id
                          );

                          setEditText(
                            note.text
                          );

                          setActionError(
                            ""
                          );

                          setMessage(
                            ""
                          );
                        }}
                      >
                        Edit
                      </button>

                      <button
                        className="load-button secondary-button"
                        disabled={
                          busy ||
                          Boolean(
                            editingId
                          ) ||
                          Boolean(
                            deletingId
                          )
                        }
                        onClick={() => {
                          setDeletingId(
                            note._id
                          );

                          setActionError(
                            ""
                          );

                          setMessage(
                            ""
                          );
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </li>
              )
            )}
          </ul>
        ))}
    </section>
  );
}

export default CharacterNotes;