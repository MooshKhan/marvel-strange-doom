export type Alignment =
  | "good"
  | "bad"
  | "neutral"
  | "unknown";

export type GalleryAlignment = Alignment | "all";

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