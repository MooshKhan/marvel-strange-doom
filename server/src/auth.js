import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { Router } from "express";
import { rateLimit } from "express-rate-limit";

const scrypt = promisify(scryptCallback);
const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const token = () => randomBytes(32).toString("hex");

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, 64, options);
  return `${salt}:${hash.toString("hex")}`;
}

export async function verifyPassword(password, stored) {
  const [salt, hex] = stored.split(":");
  const expected = Buffer.from(hex, "hex");
  const actual = await scrypt(password, salt, 64, options);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function requireUser(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "Please sign in to use your notes." });
  next();
}

export function csrfProtection(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const sent = req.get("X-CSRF-Token");
  const expected = req.session.csrfToken;
  if (!sent || !expected || Buffer.byteLength(sent) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(sent), Buffer.from(expected))) {
    return res.status(403).json({ error: "Your session changed. Refresh the page and try again." });
  }
  next();
}

export function authRouter(User) {
  const router = Router();
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20,
    standardHeaders: "draft-8", legacyHeaders: false,
    message: { error: "Too many sign-in attempts. Please wait 15 minutes." } });
  // Same work for a missing user as a wrong password.
  const dummyHash = hashPassword(randomBytes(32).toString("hex"));

  router.get("/session", (req, res) => {
    req.session.csrfToken ||= token();
    res.json({ user: req.session.user ?? null, csrfToken: req.session.csrfToken });
  });

  for (const action of ["register", "login"]) {
    router.post(`/${action}`, limiter, async (req, res, next) => {
      try {
        const { username: rawUsername, password } = req.body ?? {};
        const username = typeof rawUsername === "string" ? rawUsername.trim().toLowerCase() : "";
        if (!/^[a-z0-9_]{3,30}$/.test(username) || typeof password !== "string" ||
            password.length < 12 || password.length > 128) {
          return res.status(400).json({ error: "Use a username of 3–30 letters, numbers or underscores, and a password of 12–128 characters." });
        }
        let user;
        if (action === "register") {
          try {
            user = await User.create({ username, passwordHash: await hashPassword(password) });
          } catch (error) {
            if (error.code === 11000) return res.status(409).json({ error: "That username is already taken." });
            throw error;
          }
        } else {
          user = await User.findOne({ username }).select("+passwordHash");
          const valid = await verifyPassword(password, user?.passwordHash ?? await dummyHash);
          if (!user || !valid) return res.status(401).json({ error: "Incorrect username or password." });
        }
        await new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
        req.session.user = { id: String(user._id), username: user.username };
        req.session.csrfToken = token();
        await new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
        res.status(action === "register" ? 201 : 200).json({ user: req.session.user, csrfToken: req.session.csrfToken });
      } catch (error) { next(error); }
    });
  }

  router.post("/logout", (req, res, next) => {
    req.session.destroy(error => {
      if (error) return next(error);
      res.clearCookie("marvel.sid", { path: "/" });
      res.status(204).end();
    });
  });
  return router;
}
