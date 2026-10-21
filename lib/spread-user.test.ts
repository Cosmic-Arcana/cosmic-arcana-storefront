import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { DEMO_USER_ID } from "./demo-identity.ts";
import { spreadUserIdFor, userIdFromAuthSub } from "./spread-user.ts";

const environment = process.env as Record<string, string | undefined>;
const original = environment.NODE_ENV;

afterEach(() => {
  environment.NODE_ENV = original;
});

describe("spreadUserIdFor", () => {
  it("maps a user to the same id for a given subject every time", () => {
    const first = spreadUserIdFor({ kind: "user", sub: "github|42" });
    assert.equal(first, userIdFromAuthSub("github|42"));
    assert.equal(first, spreadUserIdFor({ kind: "user", sub: "github|42" }));
  });

  it("gives different people different ids", () => {
    assert.notEqual(
      spreadUserIdFor({ kind: "user", sub: "github|42" }),
      spreadUserIdFor({ kind: "user", sub: "google-oauth2|42" }),
    );
  });

  it("is the demo user for an anonymous visitor outside production", () => {
    environment.NODE_ENV = "development";
    assert.equal(spreadUserIdFor({ kind: "anonymous" }), DEMO_USER_ID);
  });

  it("is nobody for an anonymous visitor in production", () => {
    environment.NODE_ENV = "production";
    assert.equal(spreadUserIdFor({ kind: "anonymous" }), null);
  });

  it("is nobody for a rejected credential, even outside production", () => {
    environment.NODE_ENV = "development";
    assert.equal(spreadUserIdFor({ kind: "rejected" }), null);
  });
});
