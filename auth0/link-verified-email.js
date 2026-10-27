// Auth0 Post-Login Action. Deployed in the tenant (see README.md), kept here so it is reviewed and
// tested like the rest of the identity code.
//
// One person across GitHub and Google: two accounts are linked only when BOTH assert a verified
// email. An unverified address can be registered by anyone, so linking on it would hand them the
// other account. Anything unclear leaves the accounts separate; a login is never blocked.

const LINKABLE_PROVIDERS = new Set(["github", "google-oauth2"]);

const idPart = (userId) => userId.split("|").slice(1).join("|");

const sameEmail = (a, b) => typeof a === "string" && typeof b === "string" && a.toLowerCase() === b.toLowerCase();

const primaryOf = (first, second) => {
  const [older, newer] = [first, second].sort(
    (a, b) => String(a.created_at).localeCompare(String(b.created_at)) || a.user_id.localeCompare(b.user_id),
  );
  return { primary: older, secondary: newer };
};

/**
 * Pure decision: link nothing, or say which account is primary and which is folded into it. The
 * earlier account wins, so the choice does not depend on which one signs in first.
 */
const decideLink = ({ current, candidates }) => {
  if (!current.email || current.email_verified !== true) {
    return { link: false, reason: "email not verified" };
  }
  if (current.identities.length !== 1) {
    return { link: false, reason: "already linked" };
  }
  if (!LINKABLE_PROVIDERS.has(current.identities[0].provider)) {
    return { link: false, reason: "provider not linkable" };
  }

  const others = candidates.filter(
    (user) =>
      user.user_id !== current.user_id &&
      user.email_verified === true &&
      sameEmail(user.email, current.email) &&
      user.identities?.length === 1 &&
      LINKABLE_PROVIDERS.has(user.identities[0].provider) &&
      user.identities[0].provider !== current.identities[0].provider,
  );
  if (others.length === 0) {
    return { link: false, reason: "no other verified account" };
  }
  if (others.length > 1) {
    return { link: false, reason: "more than one other account" };
  }

  return { link: true, ...primaryOf(current, others[0]) };
};

const log = (level, message, fields = {}) => {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    service: "auth0-link-verified-email",
    correlationId: fields.correlationId ?? "none",
    context: "PostLoginAction",
    message,
    ...fields,
  });
  (level === "error" ? console.error : console.log)(line);
};

const managementToken = async (event, api, fetchImpl) => {
  const domain = event.secrets.MANAGEMENT_API_DOMAIN;
  const clientId = event.secrets.MANAGEMENT_API_CLIENT_ID;
  const cacheKey = `management-token-${clientId}`;
  const cached = api.cache.get(cacheKey);
  if (cached?.value) {
    return cached.value;
  }

  const response = await fetchImpl(`https://${domain}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: event.secrets.MANAGEMENT_API_CLIENT_SECRET,
      audience: `https://${domain}/api/v2/`,
    }),
  });
  if (!response.ok) {
    throw new Error(`token request failed with ${response.status}`);
  }
  const { access_token: token, expires_in: expiresIn } = await response.json();
  // Auth0's own example passes the lifetime in seconds scaled by 0.8; kept as is rather than guessing the unit.
  api.cache.set(cacheKey, token, { ttl: expiresIn * 0.8 });
  return token;
};

const call = async (fetchImpl, token, url, init = {}) => {
  const response = await fetchImpl(url, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
  });
  if (!response.ok) {
    throw new Error(`${init.method ?? "GET"} ${new URL(url).pathname} failed with ${response.status}`);
  }
  return response.json();
};

const handle = async (event, api, { fetchImpl }) => {
  const { MANAGEMENT_API_DOMAIN, MANAGEMENT_API_CLIENT_ID, MANAGEMENT_API_CLIENT_SECRET } = event.secrets ?? {};
  if (!MANAGEMENT_API_DOMAIN || !MANAGEMENT_API_CLIENT_ID || !MANAGEMENT_API_CLIENT_SECRET) {
    log("warn", "linking skipped", { outcome: "not configured" });
    return;
  }

  const user = event.user;
  if (!user.email || user.email_verified !== true || user.identities.length !== 1) {
    return;
  }

  let primarySwitched = false;
  try {
    const token = await managementToken(event, api, fetchImpl);
    const candidates = await call(
      fetchImpl,
      token,
      `https://${MANAGEMENT_API_DOMAIN}/api/v2/users-by-email?email=${encodeURIComponent(user.email)}`,
    );

    const decision = decideLink({ current: user, candidates });
    if (!decision.link) {
      log("log", "linking skipped", { outcome: decision.reason });
      return;
    }

    const { primary, secondary } = decision;
    if (primary.user_id !== user.user_id) {
      // Must come before the link, or Auth0 cannot build the login user (its own example does the same).
      api.authentication.setPrimaryUser(primary.user_id);
      primarySwitched = true;
    }
    await call(
      fetchImpl,
      token,
      `https://${MANAGEMENT_API_DOMAIN}/api/v2/users/${encodeURIComponent(primary.user_id)}/identities`,
      {
        method: "POST",
        body: JSON.stringify({ provider: secondary.identities[0].provider, user_id: idPart(secondary.user_id) }),
      },
    );
    log("log", "accounts linked", { outcome: "linked" });
  } catch (error) {
    log("error", "linking failed", {
      outcome: primarySwitched ? "sign-in denied" : "left separate",
      errorName: error.name,
      errorMessage: error.message,
    });
    if (primarySwitched) {
      // The login now names a primary user this identity is not linked to, so Auth0 would fail it anyway.
      api.access.deny("Sign-in could not be completed. Please try again.");
    }
  }
};

exports.onExecutePostLogin = async (event, api) => {
  await handle(event, api, { fetchImpl: fetch });
};

exports.decideLink = decideLink;
exports.handle = handle;
