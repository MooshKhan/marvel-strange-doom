BEGIN;

ALTER TABLE notes
ADD COLUMN IF NOT EXISTS pinned BOOLEAN
NOT NULL
DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS
notes_owner_pinned_created_idx
ON notes (
    owner_id,
    pinned DESC,
    created_at DESC
);

COMMIT;