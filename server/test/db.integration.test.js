import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

import session from "express-session";
import mongoose from "mongoose";
import {
  MongoMemoryServer,
} from "mongodb-memory-server";

import {
  createApp,
} from "../src/app.js";

import Character from "../src/models/Character.js";
import Note from "../src/models/Note.js";
import User from "../src/models/User.js";

const credentials = (
  username
) => ({
  username,
  password:
    "A long test-only password!",
});

function createAgent(base) {
  return {
    cookie: "",
    csrf: "",

    async request(
      path,
      method = "GET",
      body
    ) {
      const headers = {};

      if (this.cookie) {
        headers.Cookie =
          this.cookie;
      }

      if (
        method !== "GET" &&
        this.csrf
      ) {
        headers[
          "X-CSRF-Token"
        ] = this.csrf;
      }

      if (
        body !== undefined
      ) {
        headers[
          "Content-Type"
        ] =
          "application/json";
      }

      const response =
        await fetch(
          base + path,
          {
            method,
            headers,

            ...(body !==
              undefined && {
              body:
                JSON.stringify(
                  body
                ),
            }),
          }
        );

      const cookie =
        response.headers.get(
          "set-cookie"
        );

      if (cookie) {
        this.cookie =
          cookie.split(
            ";"
          )[0];
      }

      const text =
        await response.text();

      let json = null;

      try {
        json =
          JSON.parse(text);
      } catch {
        // Some successful responses,
        // such as DELETE 204,
        // intentionally have no JSON.
      }

      if (
        json?.csrfToken
      ) {
        this.csrf =
          json.csrfToken;
      }

      return {
        status:
          response.status,

        json,
        text,

        headers:
          response.headers,
      };
    },
  };
}

test(
  "real MongoDB works with characters, accounts, notes and indexes",
  async (t) => {
    /*
     * Start a temporary real MongoDB
     * process just for this test.
     */
    const mongo =
      await MongoMemoryServer.create();

    await mongoose.connect(
      mongo.getUri(),
      {
        dbName:
          "marvel_test",
      }
    );

    /*
     * init() ensures Mongoose has
     * created the schema indexes
     * before we test them.
     */
    await Promise.all([
      Character.init(),
      User.init(),
      Note.init(),
    ]);

    /*
     * Seed actual MongoDB documents.
     */
    await Character.create([
      {
        sourceId: 332,
        slug: "332-hulk",
        name: "Hulk",

        biography: {
          fullName:
            "Bruce Banner",

          publisher:
            "Marvel Comics",

          alignment:
            "good",
        },

        images: {},

        sourceVersion:
          "test",

        importedAt:
          new Date(),
      },

      {
        sourceId: 547,
        slug:
          "547-red-hulk",
        name:
          "Red Hulk",

        biography: {
          fullName:
            "Thaddeus Ross",

          publisher:
            "Marvel Comics",

          alignment:
            "neutral",
        },

        images: {},

        sourceVersion:
          "test",

        importedAt:
          new Date(),
      },
    ]);

    const app =
      createApp({
        secret:
          randomBytes(32)
            .toString(
              "hex"
            ),

        store:
          new session.MemoryStore(),

        ready: () =>
          mongoose
            .connection
            .readyState === 1,
      });

    const server =
      app.listen(
        0,
        "127.0.0.1"
      );

    await new Promise(
      (resolve) =>
        server.once(
          "listening",
          resolve
        )
    );

    t.after(
      async () => {
        await new Promise(
          (resolve) =>
            server.close(
              resolve
            )
        );

        await mongoose.disconnect();

        await mongo.stop();
      }
    );

    const address =
      server.address();

    if (
      !address ||
      typeof address ===
        "string"
    ) {
      throw new Error(
        "Test server did not expose a TCP port."
      );
    }

    const base =
      `http://127.0.0.1:${address.port}`;

    const alice =
      createAgent(base);

    /*
     * --------------------------------
     * REAL MONGODB SEARCH
     * --------------------------------
     */

    const search =
      await alice.request(
        "/api/characters?search=hulk&alignment=neutral"
      );

    assert.equal(
      search.status,
      200
    );

    assert.equal(
      search.json
        .characters
        .length,
      1
    );

    assert.equal(
      search.json
        .characters[0]
        .name,
      "Red Hulk"
    );

    /*
     * --------------------------------
     * REAL USER PERSISTENCE
     * --------------------------------
     */

    await alice.request(
      "/api/auth/session"
    );

    const registered =
      await alice.request(
        "/api/auth/register",
        "POST",
        credentials(
          "alice"
        )
      );

    assert.equal(
      registered.status,
      201
    );

    const storedUser =
      await User.findOne({
        username:
          "alice",
      }).select(
        "+passwordHash"
      );

    assert.ok(
      storedUser,
      "User should really exist in MongoDB."
    );

    assert.notEqual(
      storedUser.passwordHash,
      credentials(
        "alice"
      ).password
    );

    /*
     * --------------------------------
     * REAL NOTE + OBJECTID CASTING
     * --------------------------------
     */

    const noteResponse =
      await alice.request(
        "/api/characters/332-hulk/notes",
        "POST",
        {
          text:
            "Stored in real MongoDB",
        }
      );

    assert.equal(
      noteResponse.status,
      201
    );

    const storedNote =
      await Note.findById(
        noteResponse
          .json._id
      ).lean();

    assert.ok(
      storedNote,
      "Note should really exist in MongoDB."
    );

    assert.equal(
      storedNote.text,
      "Stored in real MongoDB"
    );

    /*
     * The session stores the user ID
     * as a string, while MongoDB stores
     * the Note.owner field as ObjectId.
     *
     * This proves real Mongoose casting
     * is working.
     */
    assert.equal(
      String(
        storedNote.owner
      ),
      registered.json
        .user.id
    );

    const hulk =
      await Character
        .findOne({
          slug:
            "332-hulk",
        })
        .lean();

    assert.ok(hulk);

    assert.equal(
      String(
        storedNote.character
      ),
      String(
        hulk._id
      )
    );

    /*
     * Also verify that querying notes
     * through the Express API works
     * against real MongoDB.
     */
    const notes =
      await alice.request(
        "/api/characters/332-hulk/notes"
      );

    assert.equal(
      notes.status,
      200
    );

    assert.equal(
      notes.json
        .notes.length,
      1
    );

    assert.equal(
      notes.json
        .notes[0]
        .text,
      "Stored in real MongoDB"
    );

    /*
     * --------------------------------
     * REAL UNIQUE INDEX
     * --------------------------------
     */

    await assert.rejects(
      () =>
        Character.create(
          {
            sourceId: 332,

            slug:
              "different-hulk",

            name:
              "Duplicate Hulk",

            biography: {
              fullName:
                "",

              publisher:
                "Marvel Comics",

              alignment:
                "good",
            },

            images: {},

            sourceVersion:
              "test",

            importedAt:
              new Date(),
          }
        ),

      (error) =>
        error &&
        typeof error ===
          "object" &&
        error.code ===
          11000
    );

    /*
     * --------------------------------
     * REAL NOTE INDEX
     * --------------------------------
     */

    const indexes =
      await Note.collection
        .indexes();

    const ownershipIndex =
      indexes.some(
        (index) =>
          index.key.owner ===
            1 &&
          index.key
            .character ===
            1 &&
          index.key
            .createdAt ===
            -1 &&
          index.key._id ===
            -1
      );

    assert.equal(
      ownershipIndex,
      true,
      "Expected the owner/character/createdAt/_id note index to exist."
    );
  }
);