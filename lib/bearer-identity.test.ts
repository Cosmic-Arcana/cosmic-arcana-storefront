import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { exportJWK, generateKeyPair, SignJWT, type JWTPayload } from "jose";

import { bearerToken, resolveIdentity, verifyAccessToken } from "./bearer-identity.ts";

const config = { domain: "tenant.eu.auth0.com", audience: "https://api.cosmic-arcana.example" };

const signer = async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256", use: "sig" };
  const getKey = async () => publicKey;
  const sign = (claims: JWTPayload, overrides: { issuer?: string; audience?: string; expiresIn?: string } = {}) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
      .setIssuer(overrides.issuer ?? `https://${config.domain}/`)
      .setAudience(overrides.audience ?? config.audience)
      .setIssuedAt()
      .setExpirationTime(overrides.expiresIn ?? "5m")
      .sign(privateKey);
  return { getKey, sign };
};

describe("bearerToken", () => {
  it("reads the token of a bearer header", () => {
    assert.equal(bearerToken("Bearer abc.def.ghi"), "abc.def.ghi");
  });

  it("is case-insensitive about the scheme", () => {
    assert.equal(bearerToken("bearer abc"), "abc");
  });

  it("returns null when there is no header", () => {
    assert.equal(bearerToken(null), null);
  });

  it("returns an empty string for a bearer scheme without a token, so it is still refused", () => {
    assert.equal(bearerToken("Bearer "), "");
  });

  it("returns null for another scheme", () => {
    assert.equal(bearerToken("Basic dXNlcjpwYXNz"), null);
  });
});

describe("verifyAccessToken", () => {
  it("returns the subject of a valid token", async () => {
    const { getKey, sign } = await signer();
    assert.equal(await verifyAccessToken(await sign({ sub: "github|42" }), config, getKey), "github|42");
  });

  it("refuses a token for another audience", async () => {
    const { getKey, sign } = await signer();
    const token = await sign({ sub: "github|42" }, { audience: "https://other.example" });
    assert.equal(await verifyAccessToken(token, config, getKey), null);
  });

  it("refuses a token from another issuer", async () => {
    const { getKey, sign } = await signer();
    const token = await sign({ sub: "github|42" }, { issuer: "https://evil.example/" });
    assert.equal(await verifyAccessToken(token, config, getKey), null);
  });

  it("refuses an expired token", async () => {
    const { getKey, sign } = await signer();
    const token = await sign({ sub: "github|42" }, { expiresIn: "-1m" });
    assert.equal(await verifyAccessToken(token, config, getKey), null);
  });

  it("refuses a token signed with another key", async () => {
    const attacker = await signer();
    const honest = await signer();
    const forged = await attacker.sign({ sub: "github|42" });
    assert.equal(await verifyAccessToken(forged, config, honest.getKey), null);
  });

  it("refuses an unsigned token", async () => {
    const { getKey } = await signer();
    const header = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url");
    const body = Buffer.from(
      JSON.stringify({ sub: "github|42", iss: `https://${config.domain}/`, aud: config.audience }),
    ).toString("base64url");
    assert.equal(await verifyAccessToken(`${header}.${body}.`, config, getKey), null);
  });

  it("refuses a token without a subject", async () => {
    const { getKey, sign } = await signer();
    assert.equal(await verifyAccessToken(await sign({}), config, getKey), null);
  });

  it("refuses text that is not a token", async () => {
    const { getKey } = await signer();
    assert.equal(await verifyAccessToken("not-a-jwt", config, getKey), null);
  });
});

describe("resolveIdentity", () => {
  const verifies = (sub: string | null) => async () => sub;

  it("is the cookie session when no bearer header is sent", async () => {
    const identity = await resolveIdentity({ authorization: null, sessionSub: "google-oauth2|7", verify: verifies(null) });
    assert.deepEqual(identity, { kind: "user", sub: "google-oauth2|7" });
  });

  it("is anonymous without a header or a session", async () => {
    const identity = await resolveIdentity({ authorization: null, sessionSub: undefined, verify: verifies(null) });
    assert.deepEqual(identity, { kind: "anonymous" });
  });

  it("is the token subject for a valid bearer", async () => {
    const identity = await resolveIdentity({
      authorization: "Bearer good",
      sessionSub: undefined,
      verify: verifies("github|42"),
    });
    assert.deepEqual(identity, { kind: "user", sub: "github|42" });
  });

  it("prefers a valid bearer over the cookie session", async () => {
    const identity = await resolveIdentity({
      authorization: "Bearer good",
      sessionSub: "google-oauth2|7",
      verify: verifies("github|42"),
    });
    assert.deepEqual(identity, { kind: "user", sub: "github|42" });
  });

  it("rejects an invalid bearer instead of falling back to the cookie session", async () => {
    const identity = await resolveIdentity({
      authorization: "Bearer bad",
      sessionSub: "google-oauth2|7",
      verify: verifies(null),
    });
    assert.deepEqual(identity, { kind: "rejected" });
  });

  it("rejects an empty bearer", async () => {
    const identity = await resolveIdentity({ authorization: "Bearer ", sessionSub: undefined, verify: verifies("x") });
    assert.deepEqual(identity, { kind: "rejected" });
  });

  it("ignores another authorization scheme and uses the cookie session", async () => {
    const identity = await resolveIdentity({
      authorization: "Basic dXNlcjpwYXNz",
      sessionSub: "google-oauth2|7",
      verify: verifies(null),
    });
    assert.deepEqual(identity, { kind: "user", sub: "google-oauth2|7" });
  });
});
