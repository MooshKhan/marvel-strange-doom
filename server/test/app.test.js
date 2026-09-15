import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import session from "express-session";
import { createApp } from "../src/app.js";

// Real HTTP, session cookies and password hashing; isolated in-memory model doubles.
// No connection to Atlas and no changes to the user's notes.
const id = () => randomBytes(12).toString("hex");
function fixtures() {
  const users = [], notes = [];
  const characters = [
    { _id: id(), slug: "332-hulk", name: "Hulk", sourceId: 332, biography: { alignment: "good" } },
    { _id: id(), slug: "547-red-hulk", name: "Red Hulk", sourceId: 547, biography: { alignment: "neutral" } },
  ];
  const matches = (doc, filter) => Object.entries(filter).every(([key, value]) => {
    const actual = key.split(".").reduce((obj, part) => obj?.[part], doc);
    return value?.$regex !== undefined ? new RegExp(value.$regex, value.$options).test(actual) : String(actual) === String(value);
  });
  const chain = rows => ({ sort() { return this; }, skip(n) { rows = rows.slice(n); return this; },
    limit(n) { rows = rows.slice(0, n); return this; }, lean: async () => structuredClone(rows) });
  const Character = {
    findOne: filter => ({ lean: async () => structuredClone(characters.find(doc => matches(doc, filter)) ?? null) }),
    countDocuments: async filter => characters.filter(doc => matches(doc, filter)).length,
    find: filter => chain(characters.filter(doc => matches(doc, filter))),
  };
  const User = {
    create: async doc => {
      if (users.some(user => user.username === doc.username)) throw Object.assign(new Error("Duplicate"), { code: 11000 });
      const user = { _id: id(), ...doc }; users.push(user); return user;
    },
    findOne: filter => ({ select: async () => users.find(doc => matches(doc, filter)) ?? null }),
  };
  const Note = {
    create: async doc => { const note = { _id: id(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...doc }; notes.push(note); return structuredClone(note); },
    find: filter => chain(notes.filter(doc => matches(doc, filter)).slice().reverse()),
    findOneAndUpdate: async (filter, update) => {
      const note = notes.find(doc => matches(doc, filter)); if (!note) return null;
      Object.assign(note, update.$set, { updatedAt: new Date().toISOString() }); return structuredClone(note);
    },
    findOneAndDelete: async filter => { const index = notes.findIndex(doc => matches(doc, filter)); return index < 0 ? null : notes.splice(index, 1)[0]; },
  };
  return { models: { Character, User, Note }, users, notes, characters };
}

async function harness(t, overrides = {}) {
  const data = fixtures();
  const app = createApp({ secret: randomBytes(32).toString("hex"), models: data.models, ready: () => true, ...overrides });
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const agent = () => ({
    cookie: "", csrf: "",
    async request(path, method = "GET", body, extraHeaders = {}) {
      const response = await fetch(base + path, { method,
        headers: { ...(this.cookie && { Cookie: this.cookie }), ...(method !== "GET" && { "X-CSRF-Token": this.csrf }),
          ...(body !== undefined && { "Content-Type": "application/json" }), ...extraHeaders },
        ...(body !== undefined && { body: JSON.stringify(body) }),
      });
      const cookie = response.headers.get("set-cookie"); if (cookie) this.cookie = cookie.split(";")[0];
      const text = await response.text(); let json; try { json = JSON.parse(text); } catch { json = null; }
      if (json?.csrfToken) this.csrf = json.csrfToken;
      return { status: response.status, json, text, headers: response.headers };
    },
  });
  return { ...data, agent, base };
}

const notesPath = "/api/characters/332-hulk/notes";
const credentials = username => ({ username, password: "A long test-only password!" });

test("accounts, private notes, ownership and logout work end to end", async t => {
  const h = await harness(t), alice = h.agent(), bob = h.agent(), guest = h.agent();
  assert.equal((await guest.request(notesPath)).status, 401);
  assert.equal((await guest.request("/api/auth/register", "POST", credentials("alice"))).status, 403);
  await alice.request("/api/auth/session"); const anonymousCookie = alice.cookie;
  const registered = await alice.request("/api/auth/register", "POST", credentials("ALICE"));
  assert.equal(registered.status, 201); assert.equal(registered.json.user.username, "alice");
  assert.notEqual(alice.cookie, anonymousCookie, "login regenerates the session ID");
  assert.match(registered.headers.get("set-cookie"), /HttpOnly/);
  assert.match(registered.headers.get("set-cookie"), /SameSite=Lax/);
  assert.equal(registered.json.passwordHash, undefined);
  assert.notEqual(h.users[0].passwordHash, credentials("alice").password);
  assert.equal((await alice.request("/api/auth/session")).json.user.username, "alice");
  assert.equal((await alice.request(notesPath, "POST", { text: "hello" }, { "X-CSRF-Token": "wrong" })).status, 403);
  const created = await alice.request(notesPath, "POST", { text: "  Hulk note  ", owner: "fake", character: "fake" });
  assert.equal(created.status, 201); assert.equal(created.json.text, "Hulk note");
  assert.equal(created.json.owner, registered.json.user.id);
  const path = `${notesPath}/${created.json._id}`;
  await bob.request("/api/auth/session"); await bob.request("/api/auth/register", "POST", credentials("bob"));
  assert.deepEqual((await bob.request(notesPath)).json.notes, []);
  assert.equal((await bob.request(path, "PATCH", { text: "stolen" })).status, 404);
  assert.equal((await bob.request(path, "DELETE")).status, 404);
  assert.equal((await alice.request(`/api/characters/547-red-hulk/notes/${created.json._id}`, "DELETE")).status, 404);
  for (const text of ["", " ", "x".repeat(1001), null, 42]) {
    assert.equal((await alice.request(notesPath, "POST", { text })).status, 400);
    assert.equal((await alice.request(path, "PATCH", { text })).status, 400);
  }
  assert.equal((await alice.request(`${notesPath}/invalid`, "DELETE")).status, 400);
  const updated = await alice.request(path, "PATCH", { text: " edited ", owner: bob.cookie });
  assert.equal(updated.status, 200); assert.equal(updated.json.text, "edited");
  assert.equal(updated.json.owner, created.json.owner);
  assert.equal((await alice.request(notesPath)).json.notes[0].text, "edited");
  // Legacy notes without an owner must never appear in a new user's account.
  h.notes.push({ _id: id(), character: h.characters[0]._id, text: "legacy private data" });
  assert.equal((await alice.request(notesPath)).json.notes.length, 1);
  assert.equal((await alice.request(path, "DELETE")).status, 204);
  assert.equal((await alice.request(path, "DELETE")).status, 404);
  const oldCookie = alice.cookie;
  assert.equal((await alice.request("/api/auth/logout", "POST")).status, 204);
  alice.cookie = oldCookie;
  assert.equal((await alice.request(notesPath)).status, 401);
  await alice.request("/api/auth/session");
  assert.equal((await alice.request("/api/auth/login", "POST", { ...credentials("alice"), password: "wrong password long" })).status, 401);
  assert.equal((await alice.request("/api/auth/login", "POST", credentials("alice"))).status, 200);
  assert.equal((await alice.request("/api/auth/register", "POST", credentials("alice"))).status, 409);
});

test("catalog filters, validation, missing records and health", async t => {
  const { agent } = await harness(t); const client = agent();
  assert.equal((await client.request("/api/health")).status, 200);
  for (const query of ["page=0", "page=-1", "page=1.5", "page=1&page=2", "alignment=evil", "search=" + "x".repeat(101)]) {
    assert.equal((await client.request(`/api/characters?${query}`)).status, 400, query);
  }
  const filtered = await client.request("/api/characters?search=hulk&alignment=neutral");
  assert.equal(filtered.json.characters[0].name, "Red Hulk");
  assert.equal(filtered.json.pagination.total, 1);
  assert.equal((await client.request("/api/characters?search=.*")).json.characters.length, 0, "regex punctuation is literal");
  assert.equal((await client.request("/api/characters/no-such-character")).status, 404);
  assert.equal((await client.request("/api/missing")).status, 404);
});

test("production serves deep links and secure cookies; bad JSON and oversized bodies rejected", async t => {
  const { agent, base } = await harness(t, { production: true, store: new session.MemoryStore() });
  const client = agent();
  const page = await client.request("/characters/332-hulk");
  assert.equal(page.status, 200); assert.match(page.text, /Marvel Character Explorer/);
  assert.match(page.headers.get("content-security-policy"), /script-src 'self'/);
  const response = await client.request("/api/auth/session", "GET", undefined, { "X-Forwarded-Proto": "https" });
  assert.match(response.headers.get("set-cookie"), /Secure/);
  const malformed = await fetch(base + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
  assert.equal(malformed.status, 400);
  const oversized = await fetch(base + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ junk: "x".repeat(20000) }) });
  assert.equal(oversized.status, 413);
});

test("authentication attempts are rate limited", async t => {
  const { agent } = await harness(t); const client = agent();
  await client.request("/api/auth/session");
  for (let n = 0; n < 20; n++) assert.equal((await client.request("/api/auth/login", "POST", {})).status, 400);
  assert.equal((await client.request("/api/auth/login", "POST", {})).status, 429);
});
