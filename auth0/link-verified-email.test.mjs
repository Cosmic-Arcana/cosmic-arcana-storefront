import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { decideLink, handle } from "./link-verified-email.js";

const github = (overrides = {}) => ({
  user_id: "github|42",
  email: "Ada@Example.com",
  email_verified: true,
  created_at: "2026-01-01T00:00:00.000Z",
  identities: [{ provider: "github", user_id: "42", connection: "github" }],
  ...overrides,
});

const google = (overrides = {}) => ({
  user_id: "google-oauth2|7",
  email: "ada@example.com",
  email_verified: true,
  created_at: "2026-02-01T00:00:00.000Z",
  identities: [{ provider: "google-oauth2", user_id: "7", connection: "google-oauth2" }],
  ...overrides,
});

describe("decideLink", () => {
  it("links two verified accounts of the same email, case-insensitively", () => {
    const decision = decideLink({ current: google(), candidates: [github()] });
    assert.equal(decision.link, true);
    assert.equal(decision.primary.user_id, "github|42");
    assert.equal(decision.secondary.user_id, "google-oauth2|7");
  });

  it("makes the earlier account primary whichever one signs in", () => {
    const fromGithub = decideLink({ current: github(), candidates: [google()] });
    const fromGoogle = decideLink({ current: google(), candidates: [github()] });
    assert.equal(fromGithub.primary.user_id, "github|42");
    assert.equal(fromGoogle.primary.user_id, "github|42");
  });

  it("never links when the signing-in account has an unverified email", () => {
    const decision = decideLink({ current: google({ email_verified: false }), candidates: [github()] });
    assert.deepEqual(decision, { link: false, reason: "email not verified" });
  });

  it("never links to a candidate with an unverified email", () => {
    const decision = decideLink({ current: google(), candidates: [github({ email_verified: false })] });
    assert.deepEqual(decision, { link: false, reason: "no other verified account" });
  });

  it("treats a missing verification flag as unverified", () => {
    const unflagged = github();
    delete unflagged.email_verified;
    assert.equal(decideLink({ current: google(), candidates: [unflagged] }).link, false);
  });

  it("does nothing when no other account has the email", () => {
    assert.deepEqual(decideLink({ current: google(), candidates: [google()] }), {
      link: false,
      reason: "no other verified account",
    });
  });

  it("leaves accounts alone when more than one other account matches", () => {
    const other = github({ user_id: "github|43", identities: [{ provider: "github", user_id: "43" }] });
    const decision = decideLink({ current: google(), candidates: [github(), other] });
    assert.deepEqual(decision, { link: false, reason: "more than one other account" });
  });

  it("does nothing for an account that is already linked", () => {
    const linked = google({ identities: [...google().identities, github().identities[0]] });
    assert.deepEqual(decideLink({ current: linked, candidates: [github()] }), { link: false, reason: "already linked" });
  });

  it("does not link a database or other connection", () => {
    const password = google({ identities: [{ provider: "auth0", user_id: "7", connection: "Username-Password-Authentication" }] });
    assert.deepEqual(decideLink({ current: password, candidates: [github()] }), {
      link: false,
      reason: "provider not linkable",
    });
  });

  it("ignores a candidate of the same provider", () => {
    const sameProvider = google({ user_id: "google-oauth2|8", identities: [{ provider: "google-oauth2", user_id: "8" }] });
    assert.equal(decideLink({ current: google(), candidates: [sameProvider] }).link, false);
  });

  it("ignores a candidate with a different email", () => {
    assert.equal(decideLink({ current: google(), candidates: [github({ email: "someone@else.com" })] }).link, false);
  });
});

const secrets = { MANAGEMENT_API_DOMAIN: "tenant.eu.auth0.com", MANAGEMENT_API_CLIENT_ID: "id", MANAGEMENT_API_CLIENT_SECRET: "secret" };

const harness = ({ candidates = [], failLink = false, failToken = false } = {}) => {
  const requests = [];
  const events = [];
  const cache = new Map();
  const fetchImpl = async (url, init = {}) => {
    const { pathname } = new URL(url);
    requests.push({ pathname, method: init.method ?? "GET", body: init.body ? JSON.parse(init.body) : undefined });
    if (pathname === "/oauth/token") {
      return failToken
        ? { ok: false, status: 401, json: async () => ({}) }
        : { ok: true, json: async () => ({ access_token: "mgmt", expires_in: 86400 }) };
    }
    if (pathname === "/api/v2/users-by-email") {
      return { ok: true, json: async () => candidates };
    }
    return failLink ? { ok: false, status: 500, json: async () => ({}) } : { ok: true, json: async () => [] };
  };
  const api = {
    cache: { get: (key) => (cache.has(key) ? { value: cache.get(key) } : undefined), set: (key, value) => cache.set(key, value) },
    authentication: { setPrimaryUser: (id) => events.push(["setPrimaryUser", id]) },
    access: { deny: (reason) => events.push(["deny", reason]) },
  };
  return { requests, events, fetchImpl, api };
};

describe("the Action", () => {
  it("links the new identity into the earlier account and makes that account the login's user", async () => {
    const { requests, events, fetchImpl, api } = harness({ candidates: [github(), google()] });
    await handle({ user: google(), secrets }, api, { fetchImpl });

    assert.deepEqual(events, [["setPrimaryUser", "github|42"]]);
    const link = requests.find((request) => request.method === "POST" && request.pathname.endsWith("/identities"));
    assert.equal(link.pathname, "/api/v2/users/github%7C42/identities");
    assert.deepEqual(link.body, { provider: "google-oauth2", user_id: "7" });
  });

  it("links without switching the primary when the signing-in account is the earlier one", async () => {
    const { requests, events, fetchImpl, api } = harness({ candidates: [github(), google()] });
    await handle({ user: github(), secrets }, api, { fetchImpl });

    assert.deepEqual(events, []);
    const link = requests.find((request) => request.method === "POST" && request.pathname.endsWith("/identities"));
    assert.equal(link.pathname, "/api/v2/users/github%7C42/identities");
    assert.deepEqual(link.body, { provider: "google-oauth2", user_id: "7" });
  });

  it("does not call Auth0 at all for an unverified email", async () => {
    const { requests, fetchImpl, api } = harness();
    await handle({ user: google({ email_verified: false }), secrets }, api, { fetchImpl });
    assert.equal(requests.length, 0);
  });

  it("does nothing when it is not configured", async () => {
    const { requests, events, fetchImpl, api } = harness({ candidates: [github()] });
    await handle({ user: google(), secrets: {} }, api, { fetchImpl });
    assert.equal(requests.length, 0);
    assert.deepEqual(events, []);
  });

  it("lets the login continue with separate accounts when Auth0 cannot be reached", async () => {
    const { events, fetchImpl, api } = harness({ failToken: true });
    await handle({ user: google(), secrets }, api, { fetchImpl });
    assert.deepEqual(events, []);
  });

  it("denies the login if the link fails after the primary user was switched", async () => {
    const { events, fetchImpl, api } = harness({ candidates: [github(), google()], failLink: true });
    await handle({ user: google(), secrets }, api, { fetchImpl });
    assert.deepEqual(events[0], ["setPrimaryUser", "github|42"]);
    assert.equal(events[1][0], "deny");
  });

  it("leaves accounts separate and the login alone when the link fails without a switch", async () => {
    const { events, fetchImpl, api } = harness({ candidates: [github(), google()], failLink: true });
    await handle({ user: github(), secrets }, api, { fetchImpl });
    assert.deepEqual(events, []);
  });

  it("asks Auth0 for the address of the signing-in user only, and sends the management token as a bearer", async () => {
    const seen = [];
    const { fetchImpl, api } = harness({ candidates: [] });
    const spy = async (url, init) => {
      seen.push({ url, authorization: init?.headers?.authorization });
      return fetchImpl(url, init);
    };
    await handle({ user: google(), secrets }, api, { fetchImpl: spy });
    const lookup = seen.find((call) => call.url.includes("users-by-email"));
    assert.ok(lookup.url.endsWith("email=ada%40example.com"));
    assert.equal(lookup.authorization, "Bearer mgmt");
  });
});
