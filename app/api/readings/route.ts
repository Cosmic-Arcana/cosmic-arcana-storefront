import { auth0 } from "../../../lib/auth0";
import { beginRequest, describeFailure } from "../../../lib/bff";
import { fetchHistoryPage, historyBaseUrl } from "../../../lib/history";
import { resolveSpreadUserId } from "../../../lib/spread-user";
import { USER_MESSAGES } from "../../../lib/user-messages";

export async function GET(request: Request) {
  const { correlationId, respond } = beginRequest(request, "/api/readings");
  if (!historyBaseUrl()) {
    return respond(503, { error: USER_MESSAGES.savedUnavailable }, "unconfigured");
  }
  const session = await auth0.getSession().catch(() => null);
  const userId = resolveSpreadUserId(session?.user?.sub);
  if (!userId) {
    return respond(401, { error: USER_MESSAGES.signInRequired }, "signed-out");
  }

  const cursor = new URL(request.url).searchParams.get("cursor");
  try {
    return respond(200, await fetchHistoryPage(userId, { cursor, correlationId }), "listed");
  } catch (cause) {
    const failure = describeFailure(cause);
    return respond(failure.status, { error: failure.message }, "error", failure.fields);
  }
}
