export const FAVORITES_STORAGE_KEY = "ann-favorites-v1";
export const FAVORITES_CHANGED_EVENT = "ann:favorites-changed";

export interface FavoriteStory {
  slug: string;
  title: string;
  originalTitle: string | null;
  summary: string | null;
  contentType: string;
  sourceName: string;
  publishedAt: string | null;
  score: number | null;
  savedAt: string;
}

export type FavoriteStoryInput = Omit<FavoriteStory, "savedAt">;

interface FavoritesStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function isFavoriteStory(value: unknown): value is FavoriteStory {
  if (!value || typeof value !== "object") return false;
  const story = value as Partial<FavoriteStory>;
  return (
    typeof story.slug === "string" &&
    typeof story.title === "string" &&
    typeof story.contentType === "string" &&
    typeof story.sourceName === "string" &&
    typeof story.savedAt === "string"
  );
}

export function readFavorites(storage: FavoritesStorage): FavoriteStory[] {
  try {
    const raw = storage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    const seen = new Set<string>();
    return parsed
      .filter(isFavoriteStory)
      .filter((story) => {
        if (seen.has(story.slug)) return false;
        seen.add(story.slug);
        return true;
      })
      .slice(0, 100);
  } catch {
    return [];
  }
}

export function writeFavorites(
  storage: FavoritesStorage,
  favorites: FavoriteStory[],
) {
  storage.setItem(
    FAVORITES_STORAGE_KEY,
    JSON.stringify(favorites.slice(0, 100)),
  );
}

export function addFavorite(
  favorites: FavoriteStory[],
  story: FavoriteStoryInput,
  savedAt = new Date().toISOString(),
): FavoriteStory[] {
  return [
    { ...story, savedAt },
    ...favorites.filter((favorite) => favorite.slug !== story.slug),
  ].slice(0, 100);
}

export function removeFavorite(
  favorites: FavoriteStory[],
  slug: string,
): FavoriteStory[] {
  return favorites.filter((favorite) => favorite.slug !== slug);
}

export function notifyFavoritesChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(FAVORITES_CHANGED_EVENT));
  }
}
