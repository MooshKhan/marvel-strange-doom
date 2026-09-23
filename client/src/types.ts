export type Alignment =
  | "good"
  | "bad"
  | "neutral"
  | "unknown";

export type GalleryAlignment =
  | Alignment
  | "all";

export type Character = {
  _id: string;
  sourceId: number;
  name: string;
  slug: string;

  biography: {
    fullName: string;
    publisher: string;
    alignment: Alignment;
  };

  images?: {
    md?: string;
    lg?: string;
  };

  sourceVersion: string;
  importedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type CharacterListResponse = {
  characters: Character[];
  pagination: Pagination;
};

export type LoadStatus =
  | "loading"
  | "success"
  | "error";

/* ---------------- Authentication ---------------- */

export type AuthUser = {
  id: string;
  username: string;
};

export type AuthAction =
  | "login"
  | "register";

export type AuthSessionResponse = {
  user: AuthUser | null;
  csrfToken: string;
};

export type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  error: string;

  authenticate: (
    action: AuthAction,
    username: string,
    password: string
  ) => Promise<void>;

  logout: () => Promise<void>;

  write: (
    url: string,
    options: RequestInit
  ) => Promise<Response>;
};

/* ---------------- Notes ---------------- */

export type Note = {
  _id: string;
  owner: string;
  character: string;
  text: string;
  createdAt: string;
  updatedAt: string;
  __v?: number;
};

export type NotesResponse = {
  notes: Note[];
};