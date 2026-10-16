import mongoose from "mongoose";
import MongoStore from "connect-mongo";
import {
  createClient,
} from "redis";

import {
  createApp,
} from "./app.js";

import type {
  CacheClient,
} from "./cache.js";

let redisClient:
  ReturnType<
    typeof createClient
  > | null = null;

try {
  const mongoUri =
    process.env.MONGODB_URI;

  const sessionSecret =
    process.env.SESSION_SECRET;

  const redisUrl =
    process.env.REDIS_URL;

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
    (
      error: Error
    ) => {
      console.error(
        "Session store error:",
        error.name
      );
    }
  );

  /*
   * Redis is intentionally optional.
   *
   * MongoDB remains the source of truth.
   * If Redis is unavailable, Marvel should
   * continue working without caching.
   */
  let cache:
    CacheClient | undefined;

  if (redisUrl) {
    try {
      redisClient =
        createClient({
          url: redisUrl,
        });

      redisClient.on(
        "error",
        (
          error: Error
        ) => {
          console.error(
            "Redis error:",
            error.message
          );
        }
      );

      await redisClient.connect();

      cache =
        redisClient;

      console.log(
        "Redis cache connected."
      );
    } catch (
      error
    ) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown Redis connection error.";

      console.error(
        "Redis unavailable; continuing without cache:",
        message
      );

      redisClient =
        null;
    }
  } else {
    console.log(
      "REDIS_URL not set; cache disabled."
    );
  }

  const production =
    process.env.NODE_ENV ===
    "production";

  const app =
    createApp({
      store,
      secret:
        sessionSecret,
      production,
      cache,
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
            /*
             * Mongo is durable primary
             * storage. Close it cleanly.
             */
            await mongoose.disconnect();

            /*
             * Redis is optional.
             * Closing the process would
             * remove this connection anyway,
             * but we attempt a graceful quit.
             */
            if (
              redisClient?.isOpen
            ) {
              try {
                await redisClient.quit();
              } catch {
                // Process is shutting down.
              }
            }

            process.exit(
              0
            );
          }
        );

        setTimeout(
          () =>
            process.exit(
              1
            ),
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

  if (
    redisClient?.isOpen
  ) {
    try {
      await redisClient.quit();
    } catch {
      // Startup already failed.
    }
  }

  process.exitCode = 1;
}