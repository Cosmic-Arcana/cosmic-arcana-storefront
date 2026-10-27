import { auth0 } from "./auth0.ts";
import { bearerToken, resolveIdentity, verifierFromEnv } from "./bearer-identity.ts";
import { spreadUserIdFor } from "./spread-user.ts";

/**
 * The person behind an API request: a verified Auth0 access token from mobile or the extension, or
 * the browser's session cookie. Null means the request must be refused.
 */
export const resolveRequestUserId = async (request: Request): Promise<string | null> => {
  const authorization = request.headers.get("authorization");
  const session = bearerToken(authorization) === null ? await auth0.getSession().catch(() => null) : null;
  const identity = await resolveIdentity({
    authorization,
    sessionSub: session?.user?.sub,
    verify: verifierFromEnv(),
  });
  return spreadUserIdFor(identity);
};
