export type LogLevel = "error" | "warn" | "log" | "debug";

/**
 * The optional fields are a closed list on purpose: a free-form bag is how a question, a token or a
 * header ends up in a log line. Nothing here can carry the visitor's text.
 */
export type LogFields = {
  durationMs?: number;
  statusCode?: number;
  method?: string;
  route?: string;
  outcome?: string;
  errorName?: string;
  upstream?: string;
  failure?: string;
  upstreamStatus?: number;
};

export const SERVICE_NAME = "cosmic-arcana-storefront";

type LogSink = (line: string) => void;

let sink: LogSink = (line) => {
  process.stdout.write(`${line}\n`);
};

/** Tests capture lines instead of printing them. */
export const setLogSink = (next: LogSink | null): void => {
  sink =
    next ??
    ((line) => {
      process.stdout.write(`${line}\n`);
    });
};

export const writeLog = (
  level: LogLevel,
  context: string,
  message: string,
  correlationId: string,
  fields: LogFields = {},
): void => {
  sink(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      service: SERVICE_NAME,
      correlationId,
      context,
      message,
      ...fields,
    }),
  );
};
