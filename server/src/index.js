import mongoose from "mongoose";
import MongoStore from "connect-mongo";
import { createApp } from "./app.js";

try {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is missing.");
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 random characters. See server/.env.example.");
  }
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: "marvel_explorer", serverSelectionTimeoutMS: 10000,
  });
  const store = MongoStore.create({ client: mongoose.connection.getClient(), dbName: "marvel_explorer", collectionName: "sessions" });
  store.on("error", error => console.error("Session store error:", error.name));
  const production = process.env.NODE_ENV === "production";
  const app = createApp({ store, secret: process.env.SESSION_SECRET, production });
  const port = Number(process.env.PORT || 3001);
  const host = production ? "0.0.0.0" : "127.0.0.1";
  const server = app.listen(port, host, () => console.log(`Marvel Explorer listening on ${host}:${port}`));
  for (const signal of ["SIGTERM", "SIGINT"]) {
    process.once(signal, () => {
      server.close(async () => { await mongoose.disconnect(); process.exit(0); });
      setTimeout(() => process.exit(1), 10000).unref();
    });
  }
} catch (error) {
  console.error("Server startup failed:", error.message.replace(/mongodb(?:\+srv)?:\/\/\S+/g, "[redacted]"));
  await mongoose.disconnect();
  process.exitCode = 1;
}
