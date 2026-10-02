import { decideAsk } from "../../../lib/ask";
import { auth0 } from "../../../lib/auth0";
import { beginRequest, describeFailure } from "../../../lib/bff";
import { allowRequest } from "../../../lib/rate-limit";
import { resolveSpreadUserId } from "../../../lib/spread-user";
import { createSpread, tarotBaseUrl } from "../../../lib/tarot";
import { USER_MESSAGES } from "../../../lib/user-messages";

const clientKey = (request: Request): string =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  request.headers.get("x-real-ip") ||
  "local";

const readJson = async (request: Request): Promise<unknown> => {
  try {
    return await request.json();
  } catch {
    return null;
  }
};

export async function POST(request: Request) {
  const { correlationId, respond } = beginRequest(request, "/api/spreads");
  const allowed = allowRequest(clientKey(request));
  const configured = Boolean(tarotBaseUrl());
  // Only read the body once the request has earned it; a flood never reaches the parser.
  const payload = allowed && configured ? await readJson(request) : null;
  const session = await auth0.getSession().catch(() => null);

  const decision = decideAsk({
    payload,
    allowed,
    configured,
    userId: resolveSpreadUserId(session?.user?.sub),
  });

  switch (decision.kind) {
    case "rate-limited":
      return respond(429, { error: USER_MESSAGES.rateLimited }, "rate-limited");
    case "unconfigured":
      return respond(503, { error: USER_MESSAGES.cardsUnavailable }, "unconfigured");
    case "invalid":
      return respond(400, { error: decision.reason }, "invalid");
    case "signed-out":
      return respond(401, { error: USER_MESSAGES.signInRequired }, "signed-out");
    default:
      break;
  }

  try {
    const spread = await createSpread(decision.question, decision.userId, correlationId);
    return respond(200, spread, "created");
  } catch (cause) {
    const failure = describeFailure(cause);
    return respond(failure.status, { error: failure.message }, "error", failure.fields);
  }
}
