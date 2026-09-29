import { createHash, randomUUID } from "node:crypto";

import { DEMO_USER_ID } from "./demo-identity";

const NAMESPACE = "c0a51c00-a1c0-51c0-a1c0-c05a1ca1c0de";

const uuidFromNamespace = (name: string): string => {
  const ns = Buffer.from(NAMESPACE.replace(/-/g, ""), "hex");
  const hash = createHash("sha1").update(ns).update(name).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
};

export const userIdFromAuthSub = (sub: string): string => uuidFromNamespace(`auth0:${sub}`);

export const resolveSpreadUserId = (sub: string | undefined): string | null => {
  if (sub) {
    return userIdFromAuthSub(sub);
  }
  if (process.env.NODE_ENV === "production") {
    return null;
  }
  return DEMO_USER_ID;
};

export const newIdempotencyKey = (): string =>
  `w${Date.now().toString(36)}${randomUUID().replace(/-/g, "").slice(0, 10)}`;
