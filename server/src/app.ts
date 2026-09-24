import express, {
  type ErrorRequestHandler,
  type Express,
} from "express";

import mongoose from "mongoose";

import session, {
  type Store,
} from "express-session";

import helmet from "helmet";

import {
  rateLimit,
} from "express-rate-limit";

import {
  fileURLToPath,
} from "node:url";

import path from "node:path";

import CharacterModel from "./models/Character.js";

import NoteModel from "./models/Note.js";

import UserModel from "./models/User.js";

import {
  authRouter,
  csrfProtection,
  requireUser,
} from "./auth.js";

type AppModels = {
  Character:
    typeof CharacterModel;

  Note:
    typeof NoteModel;

  User:
    typeof UserModel;
};

export type CreateAppOptions = {
  store?: Store;

  secret?: string;

  production?: boolean;

  models?: Partial<
    AppModels
  >;

  ready?: () =>
    boolean;
};

const allowedAlignments =
  [
    "all",
    "good",
    "bad",
    "neutral",
    "unknown",
  ] as const;

type AlignmentFilter =
  (typeof allowedAlignments)[number];

type CharacterFilter = {
  name?: {
    $regex: string;
    $options: "i";
  };

  "biography.alignment"?:
    Exclude<
      AlignmentFilter,
      "all"
    >;
};

function isAlignmentFilter(
  value: string
): value is AlignmentFilter {
  return (
    allowedAlignments as
      readonly string[]
  ).includes(value);
}

function isRecord(
  value: unknown
): value is Record<
  string,
  unknown
> {
  return (
    typeof value ===
      "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function errorMessage(
  error: unknown
): string {
  return error instanceof Error
    ? error.message
    : "Unknown error";
}

function sessionUserId(
  req: express.Request
): string {
  const user =
    req.session.user;

  if (!user) {
    throw new Error(
      "Authenticated request is missing its session user."
    );
  }

  return user.id;
}

export function createApp(
  {
    store,
    secret,
    production = false,
    models = {},
    ready = () =>
      mongoose.connection
        .readyState === 1,
  }: CreateAppOptions = {}
): Express {
  if (
    !secret ||
    secret.length < 32
  ) {
    throw new Error(
      "SESSION_SECRET must contain at least 32 characters."
    );
  }

  if (
    production &&
    !store
  ) {
    throw new Error(
      "A persistent session store is required in production."
    );
  }

  const Character =
    models.Character ??
    CharacterModel;

  const Note =
    models.Note ??
    NoteModel;

  const User =
    models.User ??
    UserModel;

  const app =
    express();

  app.disable(
    "x-powered-by"
  );

  if (production) {
    app.set(
      "trust proxy",
      1
    );
  }

  app.use(
    helmet({
      contentSecurityPolicy:
        production
          ? {
              directives: {
                imgSrc: [
                  "'self'",
                  "https://cdn.jsdelivr.net",
                  "data:",
                ],
              },
            }
          : false,

      strictTransportSecurity:
        production,
    })
  );

  app.get(
    "/api/health",
    (
      _req,
      res
    ) => {
      const healthy =
        ready();

      res.status(
        healthy
          ? 200
          : 503
      ).json({
        status:
          healthy
            ? "ok"
            : "unavailable",
      });
    }
  );

  app.use(
    "/api",
    rateLimit({
      windowMs:
        60_000,

      limit: 300,

      standardHeaders:
        "draft-8",

      legacyHeaders:
        false,

      message: {
        error:
          "Too many requests. Please wait a minute.",
      },
    })
  );

  app.use(
    "/api",
    (
      _req,
      res,
      next
    ) => {
      res.set(
        "Cache-Control",
        "no-store"
      );

      next();
    }
  );

  app.use(
    express.json({
      limit: "16kb",
    })
  );

  app.use(
    "/api",
    session({
      name:
        "marvel.sid",

      secret,

      store,

      resave:
        false,

      saveUninitialized:
        false,

      cookie: {
        httpOnly:
          true,

        secure:
          production,

        sameSite:
          "lax",

        maxAge:
          7 *
          24 *
          60 *
          60 *
          1000,
      },
    })
  );

  app.use(
    "/api",
    csrfProtection
  );

  app.use(
    "/api/auth",
    authRouter(User)
  );

  /*
   * Return one page of characters
   * in alphabetical order.
   */
  app.get(
    "/api/characters",
    async (
      req,
      res
    ) => {
      const rawPage:
        unknown =
        req.query.page ??
        "1";

      const page =
        Number(rawPage);

      const limit = 20;

      const skip =
        (page - 1) *
        limit;

      if (
        typeof rawPage !==
          "string" ||
        !Number.isSafeInteger(
          page
        ) ||
        page < 1 ||
        !Number.isSafeInteger(
          skip
        )
      ) {
        res.status(
          400
        ).json({
          error:
            "Page must be a positive whole number within the supported range.",
        });

        return;
      }

      const rawSearch:
        unknown =
        req.query.search ??
        "";

      if (
        typeof rawSearch !==
          "string" ||
        rawSearch.length >
          100
      ) {
        res.status(
          400
        ).json({
          error:
            "Search must be text with no more than 100 characters.",
        });

        return;
      }

      const search =
        rawSearch.trim();

      /*
       * Treat punctuation as literal
       * text instead of regex syntax.
       */
      const escapedSearch =
        search.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        );

      const filter:
        CharacterFilter =
        search
          ? {
              name: {
                $regex:
                  escapedSearch,

                $options:
                  "i",
              },
            }
          : {};

      const rawAlignment:
        unknown =
        req.query
          .alignment ??
        "all";

      if (
        typeof rawAlignment !==
          "string" ||
        !isAlignmentFilter(
          rawAlignment
        )
      ) {
        res.status(
          400
        ).json({
          error:
            "Alignment must be all, good, bad, neutral, or unknown.",
        });

        return;
      }

      if (
        rawAlignment !==
        "all"
      ) {
        filter[
          "biography.alignment"
        ] =
          rawAlignment;
      }

      try {
        const total =
          await Character
            .countDocuments(
              filter
            );

        const totalPages =
          Math.ceil(
            total /
              limit
          );

        const characters =
          await Character.find(
            filter
          )
            .sort({
              name: 1,
              sourceId: 1,
            })
            .skip(skip)
            .limit(limit)
            .lean();

        res.json({
          characters,

          pagination: {
            page,
            limit,
            total,
            totalPages,

            hasNextPage:
              page <
              totalPages,

            hasPreviousPage:
              page > 1,
          },
        });
      } catch (
        error
      ) {
        console.error(
          "Character list failed:",
          errorMessage(
            error
          )
        );

        res.status(
          500
        ).json({
          error:
            "Could not load characters.",
        });
      }
    }
  );

  /*
   * Return one character
   * identified by its slug.
   */
  app.get(
    "/api/characters/:slug",
    async (
      req,
      res
    ) => {
      try {
        const character =
          await Character
            .findOne({
              slug:
                req.params
                  .slug,
            })
            .lean();

        if (!character) {
          res.status(
            404
          ).json({
            error:
              "Character not found.",
          });

          return;
        }

        res.json(
          character
        );
      } catch (
        error
      ) {
        console.error(
          "Character lookup failed:",
          errorMessage(
            error
          )
        );

        res.status(
          500
        ).json({
          error:
            "Could not load the character.",
        });
      }
    }
  );

  /*
   * Create a private note.
   */
  app.post(
    "/api/characters/:slug/notes",
    requireUser,
    async (
      req,
      res
    ) => {
      const body =
        isRecord(
          req.body
        )
          ? req.body
          : {};

      const rawText =
        body.text;

      if (
        typeof rawText !==
        "string"
      ) {
        res.status(
          400
        ).json({
          error:
            "Note text must be a string.",
        });

        return;
      }

      const text =
        rawText.trim();

      if (
        text.length ===
          0 ||
        text.length >
          1000
      ) {
        res.status(
          400
        ).json({
          error:
            "A note must contain between 1 and 1000 characters.",
        });

        return;
      }

      try {
        const character =
          await Character
            .findOne({
              slug:
                req.params
                  .slug,
            })
            .lean();

        if (!character) {
          res.status(
            404
          ).json({
            error:
              "Character not found.",
          });

          return;
        }

        const note =
          await Note.create(
            {
              owner:
                sessionUserId(
                  req
                ),

              character:
                character._id,

              text,
            }
          );

        res.status(
          201
        ).json(note);
      } catch (
        error
      ) {
        console.error(
          "Creating note failed:",
          errorMessage(
            error
          )
        );

        res.status(
          500
        ).json({
          error:
            "Could not save the note.",
        });
      }
    }
  );

  /*
   * Return the latest 50
   * private notes.
   */
  app.get(
    "/api/characters/:slug/notes",
    requireUser,
    async (
      req,
      res
    ) => {
      try {
        const character =
          await Character
            .findOne({
              slug:
                req.params
                  .slug,
            })
            .lean();

        if (!character) {
          res.status(
            404
          ).json({
            error:
              "Character not found.",
          });

          return;
        }

        const notes =
          await Note.find({
            owner:
              sessionUserId(
                req
              ),

            character:
              character._id,
          })
            .sort({
              createdAt:
                -1,

              _id: -1,
            })
            .limit(50)
            .lean();

        res.json({
          notes,
        });
      } catch (
        error
      ) {
        console.error(
          "Loading notes failed:",
          errorMessage(
            error
          )
        );

        res.status(
          500
        ).json({
          error:
            "Could not load notes.",
        });
      }
    }
  );

  /*
   * Edit only an owned note
   * for the character in the URL.
   */
  app.patch(
    "/api/characters/:slug/notes/:noteId",
    requireUser,
    async (
      req,
      res
    ) => {
      if (
        !mongoose
          .isObjectIdOrHexString(
            req.params
              .noteId
          )
      ) {
        res.status(
          400
        ).json({
          error:
            "Invalid note ID.",
        });

        return;
      }

      const body =
        isRecord(
          req.body
        )
          ? req.body
          : {};

      const rawText =
        body.text;

      if (
        typeof rawText !==
          "string" ||
        !rawText.trim() ||
        rawText
          .trim()
          .length >
          1000
      ) {
        res.status(
          400
        ).json({
          error:
            "A note must contain between 1 and 1000 characters.",
        });

        return;
      }

      try {
        const character =
          await Character
            .findOne({
              slug:
                req.params
                  .slug,
            })
            .lean();

        if (!character) {
          res.status(
            404
          ).json({
            error:
              "Character not found.",
          });

          return;
        }

        const note =
          await Note
            .findOneAndUpdate(
              {
                _id:
                  req.params
                    .noteId,

                character:
                  character._id,

                owner:
                  sessionUserId(
                    req
                  ),
              },

              {
                $set: {
                  text:
                    rawText
                      .trim(),
                },
              },

              {
                returnDocument:
                  "after",

                runValidators:
                  true,
              }
            );

        if (!note) {
          res.status(
            404
          ).json({
            error:
              "Note not found for this character.",
          });

          return;
        }

        res.json(note);
      } catch (
        error
      ) {
        console.error(
          "Updating note failed:",
          errorMessage(
            error
          )
        );

        res.status(
          500
        ).json({
          error:
            "Could not update the note.",
        });
      }
    }
  );

  /*
   * Delete only an owned note
   * for the character in the URL.
   */
  app.delete(
    "/api/characters/:slug/notes/:noteId",
    requireUser,
    async (
      req,
      res
    ) => {
      if (
        !mongoose
          .isObjectIdOrHexString(
            req.params
              .noteId
          )
      ) {
        res.status(
          400
        ).json({
          error:
            "Invalid note ID.",
        });

        return;
      }

      try {
        const character =
          await Character
            .findOne({
              slug:
                req.params
                  .slug,
            })
            .lean();

        if (!character) {
          res.status(
            404
          ).json({
            error:
              "Character not found.",
          });

          return;
        }

        const note =
          await Note
            .findOneAndDelete(
              {
                owner:
                  sessionUserId(
                    req
                  ),

                _id:
                  req.params
                    .noteId,

                character:
                  character._id,
              }
            );

        if (!note) {
          res.status(
            404
          ).json({
            error:
              "Note not found for this character.",
          });

          return;
        }

        res.status(
          204
        ).end();
      } catch (
        error
      ) {
        console.error(
          "Deleting note failed:",
          errorMessage(
            error
          )
        );

        res.status(
          500
        ).json({
          error:
            "Could not delete the note.",
        });
      }
    }
  );

  app.use(
    "/api",
    (
      _req,
      res
    ) => {
      res.status(
        404
      ).json({
        error:
          "API endpoint not found.",
      });
    }
  );

  if (production) {
    const publicDir =
      fileURLToPath(
        new URL(
          "../../client/dist/",
          import.meta.url
        )
      );

    app.use(
      express.static(
        publicDir,
        {
          index: false,
        }
      )
    );

    app.get(
      "/{*path}",
      (
        _req,
        res
      ) => {
        res.sendFile(
          path.join(
            publicDir,
            "index.html"
          )
        );
      }
    );
  }

  const errorHandler:
    ErrorRequestHandler = (
      error,
      _req,
      res,
      _next
    ) => {
      const errorType =
        isRecord(error) &&
        typeof error.type ===
          "string"
          ? error.type
          : "";

      if (
        errorType ===
        "entity.parse.failed"
      ) {
        res.status(
          400
        ).json({
          error:
            "Request body must be valid JSON.",
        });

        return;
      }

      if (
        errorType ===
        "entity.too.large"
      ) {
        res.status(
          413
        ).json({
          error:
            "Request body is too large.",
        });

        return;
      }

      const name =
        error instanceof Error
          ? error.name
          : "UnknownError";

      console.error(
        "Request failed:",
        name
      );

      res.status(
        500
      ).json({
        error:
          "Something went wrong. Please try again.",
      });
    };

  app.use(
    errorHandler
  );

  return app;
}