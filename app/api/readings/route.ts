import { beginRequest, describeFailure } from "../../../lib/bff";
import { fetchHistoryPage, historyBaseUrl } from "../../../lib/history";
import { resolveRequestUserId } from "../../../lib/request-user";
import { USER_MESSAGES } from "../../../lib/user-messages";

export async function GET(request: Request) {
  const { correlationId, respond } = beginRequest(request, "/api/readings");
  if (!historyBaseUrl()) {
    return respond(503, { error: USER_MESSAGES.savedUnavailable }, "unconfigured");
  }
  const userId = await resolveRequestUserId(request);
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
