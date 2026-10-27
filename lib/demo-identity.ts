export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";

export const newIdempotencyKey = (): string =>
  `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
