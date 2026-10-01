import { auth0 } from "../../../../lib/auth0";
import { CORRELATION_HEADER, beginRequest, describeFailure } from "../../../../lib/bff";
import { deleteOutcome, historyBaseUrl, isSpreadId } from "../../../../lib/history";
import { resolveSpreadUserId } from "../../../../lib/spread-user";
import { upstreamFetch } from "../../../../lib/upstream";
import { USER_MESSAGES } from "../../../../lib/user-messages";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ spreadId: string }> },
) {
  const { correlationId, respond } = beginRequest(request, "/api/readings/[spreadId]");
  const { spreadId } = await params;
  const base = historyBaseUrl();
  if (!base) {
    return respond(503, { error: USER_MESSAGES.removeFailed }, "unconfigured");
  }
  if (!isSpreadId(spreadId)) {
    return respond(400, { error: "invalid reading id" }, "invalid");
  }

  const session = await auth0.getSession().catch(() => null);
  const userId = resolveSpreadUserId(session?.user?.sub);
  if (!userId) {
    return respond(401, { error: USER_MESSAGES.signInRequired }, "signed-out");
  }

  const headers: Record<string, string> = { [CORRELATION_HEADER]: correlationId };
  const internal = process.env.INTERNAL_SERVICE_TOKEN;
  if (internal) {
    headers["x-internal-token"] = internal;
  }

  try {
    const upstream = await upstreamFetch("history", `${base}/users/${userId}/spread-history/${spreadId}`, {
      method: "DELETE",
      headers,
    });
    const outcome = deleteOutcome(upstream.status);
    return respond(
      outcome.status,
      outcome.body,
      outcome.status === 200 ? "removed" : "refused",
      outcome.status === 200 ? {} : { upstream: "history", upstreamStatus: upstream.status },
    );
  } catch (cause) {
    // A history service that is down must not surface as a 500 from our own api.
    const failure = describeFailure(cause);
    return respond(failure.status, { error: USER_MESSAGES.removeFailed }, "error", failure.fields);
  }
}
