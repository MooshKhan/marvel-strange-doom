import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";

import { AuthContext, useAuth } from "./auth-context.js";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const csrf = useRef("");

  async function refresh() {
    const response = await fetch("/api/auth/session");
    if (!response.ok) throw new Error("Could not connect to accounts. Please refresh to retry.");
    const data = await response.json();
    csrf.current = data.csrfToken;
    setUser(data.user);
    return data;
  }

  useEffect(() => {
    const controller = new AbortController();
    async function initialize() {
      try {
        const response = await fetch("/api/auth/session", { signal: controller.signal });
        if (!response.ok) throw new Error("Could not connect to accounts. Please refresh to retry.");
        const data = await response.json();
        if (!controller.signal.aborted) { csrf.current = data.csrfToken; setUser(data.user); }
      } catch (err) { if (!controller.signal.aborted) setError(err.message); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    initialize();
    return () => controller.abort();
  }, []);

  async function write(url, options) {
    if (!csrf.current) await refresh();
    const response = await fetch(url, {
      ...options,
      headers: { ...options.headers, "X-CSRF-Token": csrf.current },
    });
    if (response.status === 401 || response.status === 403) await refresh();
    return response;
  }

  async function authenticate(action, username, password) {
    const response = await write(`/api/auth/${action}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not sign in.");
    csrf.current = data.csrfToken;
    setUser(data.user);
  }

  async function logout() {
    const response = await write("/api/auth/logout", { method: "POST" });
    if (!response.ok) throw new Error("Could not sign out. Please retry.");
    csrf.current = "";
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, error, authenticate, logout, write }}>
    {children}
  </AuthContext.Provider>;
}

export function AccountBar() {
  const { user, loading, error, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const location = useLocation();
  return <header className="account-bar">
    <Link to="/">Marvel Explorer</Link>
    <div>
      {loading ? <span>Connecting...</span> : user ? <>
        <span>Signed in as {user.username}</span>
        <button className="load-button secondary-button" disabled={busy} onClick={async () => {
          setBusy(true); setActionError("");
          try { await logout(); } catch (err) { setActionError(err.message); }
          finally { setBusy(false); }
        }}>Sign out</button>
      </> : <Link to="/account" state={{ from: location.pathname + location.search }}>Sign in / Create account</Link>}
    </div>
    {(error || actionError) && <p role="alert">{error || actionError}</p>}
  </header>;
}

export function AccountPage() {
  const { user, loading, error: connectionError, authenticate } = useAuth();
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from;
  const destination = typeof from === "string" && from.startsWith("/") && !from.startsWith("//") && !from.startsWith("/account") ? from : "/";

  return <main className="explorer account-page">
    <h1>{mode === "register" ? "Create your account" : "Welcome back"}</h1>
    <p>Browse freely. Sign in to keep your own private character notes.</p>
    {user ? <p>You’re signed in. <Link to={destination}>Continue exploring</Link></p> : <>
      <form className="account-form" onSubmit={async event => {
        event.preventDefault(); if (busy) return;
        setBusy(true); setError("");
        try { await authenticate(mode, username, password); setPassword(""); navigate(destination, { replace: true }); }
        catch (err) { setError(err.message); }
        finally { setBusy(false); }
      }}>
        <label htmlFor="username">Username</label>
        <input id="username" autoComplete="username" required minLength={3} maxLength={30}
          pattern="[A-Za-z0-9_]{3,30}" value={username} onChange={e => setUsername(e.target.value)}
          disabled={busy || loading} aria-describedby="username-help" />
        <small id="username-help">3–30 letters, numbers or underscores.</small>
        <label htmlFor="password">Password</label>
        <input id="password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"}
          required minLength={12} maxLength={128} value={password} onChange={e => setPassword(e.target.value)}
          disabled={busy || loading} aria-describedby="password-help" />
        <small id="password-help">At least 12 characters. Keep it in your password manager; password reset is not available yet.</small>
        <button className="load-button" disabled={busy || loading || Boolean(connectionError)}>
          {busy ? "Please wait..." : mode === "register" ? "Create account" : "Sign in"}
        </button>
        {(error || connectionError) && <p role="alert">{error || connectionError}</p>}
      </form>
      <button className="load-button secondary-button" disabled={busy} onClick={() => {
        setMode(mode === "login" ? "register" : "login"); setError(""); setPassword("");
      }}>{mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}</button>
    </>}
  </main>;
}
