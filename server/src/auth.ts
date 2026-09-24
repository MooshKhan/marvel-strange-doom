import {
  randomBytes,
  scrypt,
  timingSafeEqual,
} from "node:crypto";

import {
  Router,
  type Request,
  type RequestHandler,
} from "express";

import {
  rateLimit,
} from "express-rate-limit";

import type {
  HydratedDocument,
  Model,
} from "mongoose";

import type {
  UserRecord,
} from "./models/User.js";

const scryptOptions = {
  N: 32768,
  r: 8,
  p: 3,
  maxmem:
    64 * 1024 * 1024,
};

function deriveKey(
  password: string,
  salt: string
): Promise<Buffer> {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      scrypt(
        password,
        salt,
        64,
        scryptOptions,
        (
          error,
          derivedKey
        ) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(derivedKey);
        }
      );
    }
  );
}

function token(): string {
  return randomBytes(32)
    .toString("hex");
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

function isDuplicateKeyError(
  error: unknown
): error is {
  code: number;
} {
  return (
    isRecord(error) &&
    error.code === 11000
  );
}

function regenerateSession(
  req: Request
): Promise<void> {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      req.session.regenerate(
        (error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        }
      );
    }
  );
}

function saveSession(
  req: Request
): Promise<void> {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      req.session.save(
        (error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        }
      );
    }
  );
}

export async function hashPassword(
  password: string
): Promise<string> {
  const salt =
    randomBytes(16)
      .toString("hex");

  const hash =
    await deriveKey(
      password,
      salt
    );

  return `${salt}:${hash.toString(
    "hex"
  )}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const [salt, hex] =
    stored.split(":");

  const expected =
    Buffer.from(
      hex,
      "hex"
    );

  const actual =
    await deriveKey(
      password,
      salt
    );

  return (
    expected.length ===
      actual.length &&
    timingSafeEqual(
      expected,
      actual
    )
  );
}

export const requireUser:
  RequestHandler = (
    req,
    res,
    next
  ) => {
    if (
      !req.session.user
    ) {
      res.status(401).json({
        error:
          "Please sign in to use your notes.",
      });

      return;
    }

    next();
  };

export const csrfProtection:
  RequestHandler = (
    req,
    res,
    next
  ) => {
    if (
      [
        "GET",
        "HEAD",
        "OPTIONS",
      ].includes(req.method)
    ) {
      next();
      return;
    }

    const sent =
      req.get(
        "X-CSRF-Token"
      );

    const expected =
      req.session
        .csrfToken;

    if (
      !sent ||
      !expected ||
      Buffer.byteLength(
        sent
      ) !==
        Buffer.byteLength(
          expected
        ) ||
      !timingSafeEqual(
        Buffer.from(sent),
        Buffer.from(
          expected
        )
      )
    ) {
      res.status(403).json({
        error:
          "Your session changed. Refresh the page and try again.",
      });

      return;
    }

    next();
  };

export function authRouter(
  User: Model<UserRecord>
) {
  const router =
    Router();

  const limiter =
    rateLimit({
      windowMs:
        15 *
        60 *
        1000,

      limit: 20,

      standardHeaders:
        "draft-8",

      legacyHeaders:
        false,

      message: {
        error:
          "Too many sign-in attempts. Please wait 15 minutes.",
      },
    });

  /*
   * Perform the same expensive password
   * work when a username does not exist.
   */
  const dummyHash =
    hashPassword(
      randomBytes(32)
        .toString("hex")
    );

  router.get(
    "/session",
    (
      req,
      res
    ) => {
      req.session
        .csrfToken ||=
        token();

      res.json({
        user:
          req.session
            .user ??
          null,

        csrfToken:
          req.session
            .csrfToken,
      });
    }
  );

  const actions = [
    "register",
    "login",
  ] as const;

  for (
    const action of
    actions
  ) {
    router.post(
      `/${action}`,
      limiter,
      async (
        req,
        res,
        next
      ) => {
        try {
          /*
           * HTTP input is runtime data.
           * Treat it as unknown until
           * we've checked its shape.
           */
          const body =
            isRecord(
              req.body
            )
              ? req.body
              : {};

          const rawUsername =
            body.username;

          const password =
            body.password;

          const username =
            typeof rawUsername ===
            "string"
              ? rawUsername
                  .trim()
                  .toLowerCase()
              : "";

          if (
            !/^[a-z0-9_]{3,30}$/.test(
              username
            ) ||
            typeof password !==
              "string" ||
            password.length <
              12 ||
            password.length >
              128
          ) {
            res.status(
              400
            ).json({
              error:
                "Use a username of 3–30 letters, numbers or underscores, and a password of 12–128 characters.",
            });

            return;
          }

          let user:
            HydratedDocument<UserRecord>;

          if (
            action ===
            "register"
          ) {
            try {
              user =
                await User.create(
                  {
                    username,

                    passwordHash:
                      await hashPassword(
                        password
                      ),
                  }
                );
            } catch (
              error
            ) {
              if (
                isDuplicateKeyError(
                  error
                )
              ) {
                res.status(
                  409
                ).json({
                  error:
                    "That username is already taken.",
                });

                return;
              }

              throw error;
            }
          } else {
            const foundUser =
              await User.findOne(
                {
                  username,
                }
              ).select(
                "+passwordHash"
              );

            const valid =
              await verifyPassword(
                password,

                foundUser
                  ?.passwordHash ??
                  (await dummyHash)
              );

            if (
              !foundUser ||
              !valid
            ) {
              res.status(
                401
              ).json({
                error:
                  "Incorrect username or password.",
              });

              return;
            }

            user =
              foundUser;
          }

          await regenerateSession(
            req
          );

          req.session.user = {
            id: String(
              user._id
            ),

            username:
              user.username,
          };

          req.session
            .csrfToken =
            token();

          await saveSession(
            req
          );

          res.status(
            action ===
              "register"
              ? 201
              : 200
          ).json({
            user:
              req.session
                .user,

            csrfToken:
              req.session
                .csrfToken,
          });
        } catch (
          error
        ) {
          next(error);
        }
      }
    );
  }

  router.post(
    "/logout",
    (
      req,
      res,
      next
    ) => {
      req.session.destroy(
        (error) => {
          if (error) {
            next(error);
            return;
          }

          res.clearCookie(
            "marvel.sid",
            {
              path: "/",
            }
          );

          res.status(
            204
          ).end();
        }
      );
    }
  );

  return router;
}