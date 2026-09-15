import { useEffect, useRef, useState } from "react";
import { useAuth } from "./auth-context.js";

function CharacterNotes({ slug, characterName }) {
  const { write } = useAuth();
  const [notes, setNotes] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [actionError, setActionError] = useState("");
  const saveRequest = useRef(null);
  const endpoint = `/api/characters/${encodeURIComponent(slug)}/notes`;

  useEffect(() => {
    const controller = new AbortController();

    async function loadNotes() {
      setLoading(true);
      setLoadError("");

      try {
        const response = await fetch(endpoint, { signal: controller.signal });
        if (!response.ok) throw new Error("Could not load notes. Please try again.");
        const data = await response.json();
        if (!Array.isArray(data.notes)) throw new Error("Unexpected notes response.");
        if (!controller.signal.aborted) setNotes(data.notes);
      } catch (error) {
        if (!controller.signal.aborted) setLoadError(error.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadNotes();
    return () => controller.abort();
  }, [endpoint, reload]);

  useEffect(() => () => saveRequest.current?.abort(), []);

  async function handleSave(event) {
    event.preventDefault();
    if (saveRequest.current || loading || loadError || editingId || deletingId) return;

    const trimmedText = text.trim();
    setSaveError("");
    setMessage("");

    if (!trimmedText || trimmedText.length > 1000) {
      setSaveError("Enter a note between 1 and 1000 characters.");
      return;
    }

    const controller = new AbortController();
    saveRequest.current = controller;
    setSaving(true);

    try {
      const response = await write(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmedText }),
        signal: controller.signal,
      });
      const note = await response.json();
      if (!response.ok) throw new Error(note.error || "Could not save the note.");
      if (!note._id || typeof note.text !== "string") {
        throw new Error("Could not confirm the save. Reload notes before trying again.");
      }

      if (!controller.signal.aborted) {
        // Match the API's newest-first list, capped at 50 notes.
        setNotes((current) => [note, ...current].slice(0, 50));
        setText("");
        setMessage("Note saved.");
      }
    } catch (error) {
      if (!controller.signal.aborted) setSaveError(error.message);
    } finally {
      saveRequest.current = null;
      if (!controller.signal.aborted) setSaving(false);
    }
  }

  async function changeNote(method, noteId) {
    if (saveRequest.current || loading || loadError) return;
    const trimmedText = editText.trim();
    setActionError("");
    setMessage("");

    if (method === "PATCH" && (!trimmedText || trimmedText.length > 1000)) {
      setActionError("Enter a note between 1 and 1000 characters.");
      return;
    }

    const controller = new AbortController();
    saveRequest.current = controller;
    setSaving(true);

    try {
      const response = await write(`${endpoint}/${encodeURIComponent(noteId)}`, {
        method,
        ...(method === "PATCH" && {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: trimmedText }),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "The note could not be changed. Please try again.");
      }

      if (method === "PATCH") {
        const updated = await response.json();
        if (updated._id !== noteId || typeof updated.text !== "string") {
          throw new Error("Could not confirm the update. Reload notes to check it.");
        }
        if (!controller.signal.aborted) {
          setNotes((current) => current.map((note) => note._id === noteId ? updated : note));
          setEditingId(null);
          setEditText("");
          setMessage("Note updated.");
        }
      } else if (!controller.signal.aborted) {
        // DELETE returns 204 with no JSON body. Reload to fill the latest-50 list.
        setNotes((current) => current.filter((note) => note._id !== noteId));
        setDeletingId(null);
        setMessage("Note deleted.");
        setLoading(true);
        setReload((value) => value + 1);
      }
    } catch (error) {
      if (!controller.signal.aborted) setActionError(error.message);
    } finally {
      saveRequest.current = null;
      if (!controller.signal.aborted) setSaving(false);
    }
  }

  const busy = saving || loading || Boolean(loadError);

  return (
    <section className="character-notes" aria-labelledby="notes-heading">
      <h2 id="notes-heading">Notes about {characterName}</h2>
      <p>Only you can see these notes · showing up to the latest 50.</p>

      {loading && <p role="status">Loading notes...</p>}
      {loadError && (
        <div>
          <p role="alert">{loadError}</p>
          <button className="load-button" onClick={() => setReload((value) => value + 1)}>
            Retry loading notes
          </button>
        </div>
      )}

      <form className="note-form" onSubmit={handleSave}>
        <label htmlFor="note-text">Add a note</label>
        <textarea
          id="note-text"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setMessage("");
            setSaveError("");
          }}
          rows={4}
          maxLength={1000}
          required
          disabled={busy || Boolean(editingId) || Boolean(deletingId)}
          aria-describedby="note-length"
        />
        <small id="note-length">{text.length} / 1000 characters</small>
        <button
          className="load-button"
          type="submit"
          disabled={busy || Boolean(editingId) || Boolean(deletingId) || !text.trim()}
        >
          {saving && !editingId && !deletingId ? "Saving..." : "Save note"}
        </button>
        {saveError && <p role="alert">{saveError}</p>}
        <p role="status">{message}</p>
      </form>

      {actionError && (
        <div>
          <p role="alert">{actionError}</p>
          <button
            className="load-button"
            disabled={busy}
            onClick={() => {
              setEditingId(null);
              setDeletingId(null);
              setActionError("");
              setReload((value) => value + 1);
            }}
          >
            Reload notes
          </button>
        </div>
      )}

      {!loading && !loadError && (
        notes.length === 0 ? (
          <p>No notes yet. Add the first one.</p>
        ) : (
          <ul className="note-list">
            {notes.map((note) => (
              <li key={note._id}>
                {editingId === note._id ? (
                  <form
                    className="note-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      changeNote("PATCH", note._id);
                    }}
                  >
                    <label htmlFor={`edit-${note._id}`}>Edit note</label>
                    <textarea
                      id={`edit-${note._id}`}
                      value={editText}
                      onChange={(event) => setEditText(event.target.value)}
                      maxLength={1000}
                      required
                      disabled={busy}
                      aria-describedby={`edit-length-${note._id}`}
                    />
                    <small id={`edit-length-${note._id}`}>{editText.length} / 1000 characters</small>
                    <div className="note-actions">
                      <button className="load-button" type="submit" disabled={busy || !editText.trim()}>
                        {saving ? "Saving changes..." : "Save changes"}
                      </button>
                      <button className="load-button secondary-button" type="button" disabled={busy}
                        onClick={() => { setEditingId(null); setActionError(""); }}>
                        Cancel edit
                      </button>
                    </div>
                  </form>
                ) : <p>{note.text}</p>}
                <time dateTime={note.createdAt}>
                  Created {new Date(note.createdAt).toLocaleString()}
                </time>
                {note.updatedAt !== note.createdAt && (
                  <time dateTime={note.updatedAt}>Edited {new Date(note.updatedAt).toLocaleString()}</time>
                )}

                {deletingId === note._id ? (
                  <div className="note-delete-confirmation">
                    <p>Delete this note permanently?</p>
                    <div className="note-actions">
                      <button className="load-button" disabled={busy} onClick={() => changeNote("DELETE", note._id)}>
                        {saving ? "Deleting..." : "Confirm delete"}
                      </button>
                      <button className="load-button secondary-button" disabled={busy}
                        onClick={() => { setDeletingId(null); setActionError(""); }}>
                        Cancel delete
                      </button>
                    </div>
                  </div>
                ) : editingId !== note._id && (
                  <div className="note-actions">
                    <button className="load-button secondary-button"
                      disabled={busy || Boolean(editingId) || Boolean(deletingId)}
                      onClick={() => {
                        setEditingId(note._id);
                        setEditText(note.text);
                        setActionError("");
                        setMessage("");
                      }}>
                      Edit
                    </button>
                    <button className="load-button secondary-button"
                      disabled={busy || Boolean(editingId) || Boolean(deletingId)}
                      onClick={() => {
                        setDeletingId(note._id);
                        setActionError("");
                        setMessage("");
                      }}>
                      Delete
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )
      )}
    </section>
  );
}

export default CharacterNotes;
