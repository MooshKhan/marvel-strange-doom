import type { Context } from "react";

export type AuthUser = {
  id: string;
  username: string;
};

export type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  error: string;

  authenticate: (
    action: "login" | "register",
    username: string,
    password: string
  ) => Promise<void>;

  logout: () => Promise<void>;

  write: (
    url: string,
    options: RequestInit
  ) => Promise<Response>;
};

export const AuthContext: Context<AuthContextValue | null>;

export function useAuth(): AuthContextValue;