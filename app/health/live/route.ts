export const dynamic = "force-dynamic";

/**
 * Answers whether this process is serving requests, and nothing else. It does not call tarot,
 * history or mcp: the storefront degrades when they are down instead of failing, so an
 * orchestrator must not take it out of rotation for their sake.
 */
export function GET(): Response {
  return Response.json({ status: "ok" }, { headers: { "cache-control": "no-store" } });
}
