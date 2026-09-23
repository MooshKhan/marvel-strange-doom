import mongoose from "mongoose";
import MongoStore from "connect-mongo";

import type { Express } from "express";
import type { Store } from "express-session";

import {
  createApp as createJavaScriptApp,
} from "./app.js";

/*
 * app.js is still JavaScript during this migration sprint.
 *
 * TypeScript cannot yet infer its full createApp()
 * configuration correctly, so this is a temporary bridge.
 *
 * Once app.js becomes app.ts in the next sprint,
 * this type bridge can be removed.
 */
type CreateAppOptions = {
  store: Store;
  secret: string;
  production?: boolean;
  models?: Record<string, unknown>;
  ready?: () => boolean;
};

type CreateApp = (
  options: CreateAppOptions
) => Express;

const createApp =
  createJavaScriptApp as unknown as CreateApp;

try {
  const mongoUri =
    process.env.MONGODB_URI;

  const sessionSecret =
    process.env.SESSION_SECRET;

  if (!mongoUri) {
    throw new Error(
      "MONGODB_URI is missing."
    );
  }

  if (
    !sessionSecret ||
    sessionSecret.length < 32
  ) {
    throw new Error(
      "SESSION_SECRET must contain at least 32 random characters. See server/.env.example."
    );
  }

  await mongoose.connect(
    mongoUri,
    {
      dbName:
        "marvel_explorer",

      serverSelectionTimeoutMS:
        10000,
    }
  );

  const store =
    MongoStore.create({
      client:
        mongoose.connection
          .getClient(),

      dbName:
        "marvel_explorer",

      collectionName:
        "sessions",
    });

  store.on(
    "error",
    (error: Error) => {
      console.error(
        "Session store error:",
        error.name
      );
    }
  );

  const production =
    process.env.NODE_ENV ===
    "production";

  const app =
    createApp({
      store,
      secret:
        sessionSecret,
      production,
    });

  const port =
    Number(
      process.env.PORT ??
        3001
    );

  const host =
    production
      ? "0.0.0.0"
      : "127.0.0.1";

  const server =
    app.listen(
      port,
      host,
      () => {
        console.log(
          `Marvel Explorer listening on ${host}:${port}`
        );
      }
    );

  for (
    const signal of [
      "SIGTERM",
      "SIGINT",
    ] as const
  ) {
    process.once(
      signal,
      () => {
        server.close(
          async () => {
            await mongoose.disconnect();

            process.exit(0);
          }
        );

        setTimeout(
          () =>
            process.exit(1),
          10000
        ).unref();
      }
    );
  }
} catch (error) {
  const message =
    error instanceof Error
      ? error.message
      : "Unknown server startup error.";

  console.error(
    "Server startup failed:",
    message.replace(
      /mongodb(?:\+srv)?:\/\/\S+/g,
      "[redacted]"
    )
  );

  await mongoose.disconnect();

  process.exitCode = 1;
}