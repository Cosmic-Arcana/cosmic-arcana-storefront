/** Every sentence a visitor can read about something going wrong, in one place. */
export const USER_MESSAGES = {
  cardsUnavailable: "The cards are unavailable right now. Please try again in a moment.",
  savedUnavailable: "Your saved readings are unavailable right now. Please try again in a moment.",
  rateLimited: "Too many questions in a short time. Please wait a minute and try again.",
  signInRequired: "Please sign in to ask a question.",
  networkDown: "We couldn't reach the server. Check your connection and try again.",
  somethingWrong: "Something went wrong. Please try again.",
  readingAlreadyRemoved: "This reading was already removed.",
  removeFailed: "We couldn't remove this reading just now. Please try again.",
} as const;
