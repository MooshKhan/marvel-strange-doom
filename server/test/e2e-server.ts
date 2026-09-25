import {
    randomBytes,
  } from "node:crypto";
  
  import mongoose from "mongoose";
  
  import MongoStore from "connect-mongo";
  
  import {
    MongoMemoryServer,
  } from "mongodb-memory-server";
  
  import {
    createApp,
  } from "../src/app.js";
  
  import Character from "../src/models/Character.js";
  import Note from "../src/models/Note.js";
  import User from "../src/models/User.js";
  
  const HOST =
    "127.0.0.1";
  
  const PORT =
    3001;
  
  /*
   * Create a temporary MongoDB
   * specifically for browser E2E tests.
   *
   * Nothing here touches Atlas.
   */
  const mongo =
    await MongoMemoryServer.create();
  
  await mongoose.connect(
    mongo.getUri(),
    {
      dbName:
        "marvel_e2e",
    }
  );
  
  /*
   * Ensure real MongoDB indexes
   * exist before testing begins.
   */
  await Promise.all([
    Character.init(),
    User.init(),
    Note.init(),
  ]);
  
  /*
   * Seed enough real character data
   * for our browser workflow.
   */
  await Character.create([
    {
      sourceId: 332,
  
      slug:
        "332-hulk",
  
      name:
        "Hulk",
  
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
        "e2e",
  
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
        "e2e",
  
      importedAt:
        new Date(),
    },
  ]);
  
  /*
   * Unlike our earlier HTTP tests,
   * even session data is stored
   * in the temporary MongoDB here.
   */
  const store =
    MongoStore.create({
      client:
        mongoose.connection
          .getClient(),
  
      dbName:
        "marvel_e2e",
  
      collectionName:
        "sessions",
    });
  
  const app =
    createApp({
      store,
  
      secret:
        randomBytes(32)
          .toString(
            "hex"
          ),
  
      production:
        false,
  
      ready: () =>
        mongoose.connection
          .readyState === 1,
    });
  
  const server =
    app.listen(
      PORT,
      HOST,
      () => {
        console.log(
          `E2E backend listening on http://${HOST}:${PORT}`
        );
      }
    );
  
  let shuttingDown =
    false;
  
  async function shutdown(
    exitCode: number
  ) {
    if (shuttingDown) {
      return;
    }
  
    shuttingDown =
      true;
  
    await new Promise<void>(
      (resolve) => {
        server.close(
          () =>
            resolve()
        );
      }
    );
  
    await mongoose.disconnect();
  
    await mongo.stop();
  
    process.exit(
      exitCode
    );
  }
  
  process.once(
    "SIGTERM",
    () => {
      void shutdown(0);
    }
  );
  
  process.once(
    "SIGINT",
    () => {
      void shutdown(0);
    }
  );