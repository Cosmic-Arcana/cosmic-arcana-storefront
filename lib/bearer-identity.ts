import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export type VerifyConfig = { domain: string; audience: string };

export type Identity = { kind: "user"; sub: string } | { kind: "anonymous" } | { kind: "rejected" };

type Verify = (token: string) => Promise<string | null>;

const keySets = new Map<string, JWTVerifyGetKey>();

// One remote key set per tenant: jose caches the keys and limits how often it refetches them.
const keysFor = (domain: string): JWTVerifyGetKey => {
  let keys = keySets.get(domain);
  if (!keys) {
    keys = createRemoteJWKSet(new URL(`https://${domain}/.well-known/jwks.json`));
    keySets.set(domain, keys);
  }
  return keys;
};

/** Null when the header is absent or another scheme; an empty string for "Bearer" without a token. */
export const bearerToken = (header: string | null): string | null => {
  const match = header ? /^bearer(?:\s+(.*))?$/i.exec(header.trim()) : null;
  return match ? (match[1] ?? "") : null;
};

/** The subject of a token Auth0 signed for this API, or null for anything else. Never throws. */
export const verifyAccessToken = async (
  token: string,
  { domain, audience }: VerifyConfig,
  getKey: JWTVerifyGetKey = keysFor(domain),
): Promise<string | null> => {
  try {
    const { payload } = await jwtVerify(token, getKey, {
      issuer: `https://${domain}/`,
      audience,
      algorithms: ["RS256"],
    });
    return typeof payload.sub === "string" && payload.sub.length > 0 ? payload.sub : null;
  } catch {
    return null;
  }
};

export const readVerifyConfig = (env: NodeJS.ProcessEnv = process.env): VerifyConfig | null => {
  const domain = env.AUTH0_DOMAIN?.trim();
  const audience = env.AUTH0_AUDIENCE?.trim();
  return domain && audience ? { domain, audience } : null;
};

/** With no config a bearer cannot be checked, and an unchecked token must never become a person. */
export const verifierFromEnv = (env: NodeJS.ProcessEnv = process.env): Verify => {
  const config = readVerifyConfig(env);
  return async (token) => (config ? verifyAccessToken(token, config) : null);
};

/**
 * A bearer header is a claim to be someone, so a bad one is refused outright. Falling back to the
 * cookie session would let a broken client act as whoever happens to be signed in in the browser.
 */
export const resolveIdentity = async ({
  authorization,
  sessionSub,
  verify,
}: {
  authorization: string | null;
  sessionSub: string | undefined;
  verify: Verify;
}): Promise<Identity> => {
  const token = bearerToken(authorization);
  if (token !== null) {
    const sub = token ? await verify(token) : null;
    return sub ? { kind: "user", sub } : { kind: "rejected" };
  }
  return sessionSub ? { kind: "user", sub: sessionSub } : { kind: "anonymous" };
};
