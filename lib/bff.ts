import { randomUUID } from "node:crypto";

import { writeLog, type LogFields } from "./log.ts";
import { USER_MESSAGES } from "./user-messages.ts";
import { UpstreamError, upstreamUserMessage } from "./upstream.ts";

export const CORRELATION_HEADER = "x-correlation-id";

const roundMs = (ms: number): number => Math.round(ms * 10) / 10;

/**
 * The BFF is where a visitor's action enters the system, so it is where the correlation id is
 * born. A browser-supplied one is ignored: it would let anyone write to our logs under any id.
 */
export const beginRequest = (request: Request, route: string, now: () => number = () => performance.now()) => {
  const correlationId = randomUUID();
  const startedAt = now();

  return {
    correlationId,
    /** Answers, and writes the one log line for this request: the single place it is recorded. */
    respond(status: number, body: unknown, outcome: string, fields: LogFields = {}): Response {
      const level = status === 500 ? "error" : status >= 502 ? "warn" : "log";
      writeLog(level, "BffRoute", "inbound handled", correlationId, {
        method: request.method,
        route,
        statusCode: status,
        durationMs: roundMs(now() - startedAt),
        outcome,
        ...fields,
      });
      return Response.json(body, { status, headers: { [CORRELATION_HEADER]: correlationId } });
    },
  };
};

export type Failure = { status: number; message: string; fields: LogFields };

/** What to answer, what to say, and what to record for anything that goes wrong behind a route. */
export const describeFailure = (error: unknown): Failure => {
  if (error instanceof UpstreamError) {
    return {
      status: error.httpStatus,
      message: upstreamUserMessage(error),
      fields: {
        outcome: "error",
        errorName: error.name,
        upstream: error.upstream,
        failure: error.failure,
        ...(error.upstreamStatus === null ? {} : { upstreamStatus: error.upstreamStatus }),
      },
    };
  }
  return {
    status: 500,
    message: USER_MESSAGES.somethingWrong,
    fields: { outcome: "error", errorName: error instanceof Error ? error.name : "Unknown" },
  };
};

/**
 * A server-rendered page has no response to log, so a failure behind it is recorded here, once,
 * and the visitor's sentence comes back for the page to show.
 */
export const recordPageFailure = (correlationId: string, route: string, error: unknown): string => {
  const failure = describeFailure(error);
  writeLog(failure.status === 500 ? "error" : "warn", "Page", "page data unavailable", correlationId, {
    route,
    statusCode: failure.status,
    ...failure.fields,
  });
  return failure.message;
};
