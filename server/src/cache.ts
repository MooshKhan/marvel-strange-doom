export type CacheClient = {
    get(
      key: string
    ): Promise<string | null>;
  
    setEx(
      key: string,
      seconds: number,
      value: string
    ): Promise<unknown>;
  };
  
  export const CHARACTER_CACHE_TTL_SECONDS =
    60;
  
  export function characterListCacheKey({
    page,
    search,
    alignment,
  }: {
    page: number;
    search: string;
    alignment: string;
  }): string {
    const normalizedSearch =
      search
        .trim()
        .toLowerCase();
  
    return [
      "marvel",
      "characters",
      "v1",
      `page=${page}`,
      `search=${encodeURIComponent(
        normalizedSearch
      )}`,
      `alignment=${alignment}`,
    ].join(":");
  }