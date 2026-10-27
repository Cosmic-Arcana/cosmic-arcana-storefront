const FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

/**
 * UTC on purpose: these pages render on the server, which cannot know the reader's timezone, and a
 * local-time guess would differ between the server and the browser.
 */
export const formatReadingDate = (iso: string): string => {
  const date = new Date(iso);
  if (iso === "" || Number.isNaN(date.getTime())) {
    return "";
  }
  return `${FORMAT.format(date)} UTC`;
};
