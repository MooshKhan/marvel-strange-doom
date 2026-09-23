import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import {
  Link,
  useLocation,
  useNavigate,
} from "react-router";

import {
  AuthContext,
  useAuth,
} from "./auth-context";

import type {
  AuthAction,
  AuthSessionResponse,
  AuthUser,
} from "./types";

type AuthProviderProps = {
  children: ReactNode;
};

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null
  );
}

function isAuthUser(
  value: unknown
): value is AuthUser {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.username === "string"
  );
}

function parseAuthResponse(
  value: unknown
): AuthSessionResponse {
  if (
    !isRecord(value) ||
    typeof value.csrfToken !== "string" ||
    !(
      value.user === null ||
      isAuthUser(value.user)
    )
  ) {
    throw new Error(
      "The account API returned an unexpected response."
    );
  }

  return {
    user: value.user,
    csrfToken: value.csrfToken,
  };
}

function apiErrorMessage(
  value: unknown,
  fallback: string
): string {
  if (
    isRecord(value) &&
    typeof value.error === "string"
  ) {
    return value.error;
  }

  return fallback;
}

function caughtErrorMessage(
  error: unknown,
  fallback: string
): string {
  return error instanceof Error
    ? error.message
    : fallback;
}

export function AuthProvider({
  children,
}: AuthProviderProps) {
  const [user, setUser] =
    useState<AuthUser | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const csrf = useRef<string>("");

  async function refresh():
    Promise<AuthSessionResponse> {
    const response = await fetch(
      "/api/auth/session"
    );

    if (!response.ok) {
      throw new Error(
        "Could not connect to accounts. Please refresh to retry."
      );
    }

    const raw =
      (await response.json()) as unknown;

    const data =
      parseAuthResponse(raw);

    csrf.current =
      data.csrfToken;

    setUser(data.user);

    return data;
  }

  useEffect(() => {
    const controller =
      new AbortController();

    async function initialize() {
      try {
        const response = await fetch(
          "/api/auth/session",
          {
            signal:
              controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error(
            "Could not connect to accounts. Please refresh to retry."
          );
        }

        const raw =
          (await response.json()) as unknown;

        const data =
          parseAuthResponse(raw);

        if (
          !controller.signal.aborted
        ) {
          csrf.current =
            data.csrfToken;

          setUser(data.user);
        }
      } catch (error) {
        if (
          !controller.signal.aborted
        ) {
          setError(
            caughtErrorMessage(
              error,
              "Could not connect to accounts."
            )
          );
        }
      } finally {
        if (
          !controller.signal.aborted
        ) {
          setLoading(false);
        }
      }
    }

    initialize();

    return () =>
      controller.abort();
  }, []);

  async function write(
    url: string,
    options: RequestInit
  ): Promise<Response> {
    if (!csrf.current) {
      await refresh();
    }

    const headers =
      new Headers(options.headers);

    headers.set(
      "X-CSRF-Token",
      csrf.current
    );

    const response =
      await fetch(url, {
        ...options,
        headers,
      });

    if (
      response.status === 401 ||
      response.status === 403
    ) {
      await refresh();
    }

    return response;
  }

  async function authenticate(
    action: AuthAction,
    username: string,
    password: string
  ): Promise<void> {
    const response =
      await write(
        `/api/auth/${action}`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            username,
            password,
          }),
        }
      );

    const raw =
      (await response.json()) as unknown;

    if (!response.ok) {
      throw new Error(
        apiErrorMessage(
          raw,
          "Could not sign in."
        )
      );
    }

    const data =
      parseAuthResponse(raw);

    csrf.current =
      data.csrfToken;

    setUser(data.user);
  }

  async function logout():
    Promise<void> {
    const response =
      await write(
        "/api/auth/logout",
        {
          method: "POST",
        }
      );

    if (!response.ok) {
      throw new Error(
        "Could not sign out. Please retry."
      );
    }

    csrf.current = "";
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        authenticate,
        logout,
        write,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function AccountBar() {
  const {
    user,
    loading,
    error,
    logout,
  } = useAuth();

  const [busy, setBusy] =
    useState(false);

  const [
    actionError,
    setActionError,
  ] = useState("");

  const location =
    useLocation();

  async function handleLogout() {
    setBusy(true);
    setActionError("");

    try {
      await logout();
    } catch (error) {
      setActionError(
        caughtErrorMessage(
          error,
          "Could not sign out."
        )
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <header className="account-bar">
      <Link to="/">
        Marvel Explorer
      </Link>

      <div>
        {loading ? (
          <span>
            Connecting...
          </span>
        ) : user ? (
          <>
            <span>
              Signed in as{" "}
              {user.username}
            </span>

            <button
              className="load-button secondary-button"
              disabled={busy}
              onClick={handleLogout}
            >
              Sign out
            </button>
          </>
        ) : (
          <Link
            to="/account"
            state={{
              from:
                location.pathname +
                location.search,
            }}
          >
            Sign in / Create account
          </Link>
        )}
      </div>

      {(error ||
        actionError) && (
        <p role="alert">
          {error ||
            actionError}
        </p>
      )}
    </header>
  );
}

export function AccountPage() {
  const {
    user,
    loading,
    error: connectionError,
    authenticate,
  } = useAuth();

  const [mode, setMode] =
    useState<AuthAction>("login");

  const [username, setUsername] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [error, setError] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  const navigate =
    useNavigate();

  const location =
    useLocation();

  const locationState =
    location.state as {
      from?: unknown;
    } | null;

  const from =
    locationState?.from;

  const destination =
    typeof from === "string" &&
    from.startsWith("/") &&
    !from.startsWith("//") &&
    !from.startsWith(
      "/account"
    )
      ? from
      : "/";

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (busy) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      await authenticate(
        mode,
        username,
        password
      );

      setPassword("");

      navigate(
        destination,
        {
          replace: true,
        }
      );
    } catch (error) {
      setError(
        caughtErrorMessage(
          error,
          "Could not sign in."
        )
      );
    } finally {
      setBusy(false);
    }
  }

  function toggleMode() {
    setMode(
      mode === "login"
        ? "register"
        : "login"
    );

    setError("");
    setPassword("");
  }

  return (
    <main className="explorer account-page">
      <h1>
        {mode === "register"
          ? "Create your account"
          : "Welcome back"}
      </h1>

      <p>
        Browse freely. Sign in
        to keep your own private
        character notes.
      </p>

      {user ? (
        <p>
          You’re signed in.{" "}
          <Link
            to={destination}
          >
            Continue exploring
          </Link>
        </p>
      ) : (
        <>
          <form
            className="account-form"
            onSubmit={
              handleSubmit
            }
          >
            <label htmlFor="username">
              Username
            </label>

            <input
              id="username"
              autoComplete="username"
              required
              minLength={3}
              maxLength={30}
              pattern="[A-Za-z0-9_]{3,30}"
              value={username}
              onChange={(event) =>
                setUsername(
                  event.target.value
                )
              }
              disabled={
                busy || loading
              }
              aria-describedby="username-help"
            />

            <small id="username-help">
              3–30 letters,
              numbers or
              underscores.
            </small>

            <label htmlFor="password">
              Password
            </label>

            <input
              id="password"
              type="password"
              autoComplete={
                mode ===
                "register"
                  ? "new-password"
                  : "current-password"
              }
              required
              minLength={12}
              maxLength={128}
              value={password}
              onChange={(event) =>
                setPassword(
                  event.target.value
                )
              }
              disabled={
                busy || loading
              }
              aria-describedby="password-help"
            />

            <small id="password-help">
              At least 12
              characters. Keep
              it in your
              password manager;
              password reset is
              not available yet.
            </small>

            <button
              className="load-button"
              disabled={
                busy ||
                loading ||
                Boolean(
                  connectionError
                )
              }
            >
              {busy
                ? "Please wait..."
                : mode ===
                    "register"
                  ? "Create account"
                  : "Sign in"}
            </button>

            {(error ||
              connectionError) && (
              <p role="alert">
                {error ||
                  connectionError}
              </p>
            )}
          </form>

          <button
            className="load-button secondary-button"
            type="button"
            disabled={busy}
            onClick={
              toggleMode
            }
          >
            {mode === "login"
              ? "New here? Create an account"
              : "Already have an account? Sign in"}
          </button>
        </>
      )}
    </main>
  );
}