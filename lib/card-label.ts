const KEEP_SMALL = new Set(["of"]);

const capitalise = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

/**
 * Card ids are slugs. Showing them as words is a presentation choice only: it adds no meaning and
 * does not pretend to know the deck's real card names.
 */
export const cardLabel = (cardId: string): string =>
  cardId
    .split("-")
    .filter(Boolean)
    .map((word, index) => (index > 0 && KEEP_SMALL.has(word) ? word : capitalise(word)))
    .join(" ");

export const positionLabel = (positionKey: string): string => {
  const words = positionKey.split("-").filter(Boolean).join(" ");
  return capitalise(words);
};
