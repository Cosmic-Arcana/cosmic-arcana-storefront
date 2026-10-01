import http from "node:http";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => arg.replace(/^--/, "").split("=")),
);
const listen = Number(args.listen);
const target = Number(args.target);

if (!listen || !target) {
  console.error("usage: fault-proxy.mjs --listen=<port> --target=<port>");
  process.exit(1);
}

// One mutable mode per proxy. Tests flip it over HTTP so a server-side fetch from the app (which
// the browser can never intercept) meets a dead, slow, failing or garbled upstream on demand.
let fault = { kind: "pass" };

const readJson = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch (error) {
        reject(error);
      }
    });
  });

const forward = (req, res) => {
  const upstream = http.request(
    { host: "127.0.0.1", port: target, method: req.method, path: req.url, headers: req.headers },
    (upstreamResponse) => {
      res.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
      upstreamResponse.pipe(res);
    },
  );
  upstream.on("error", () => {
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "fault proxy could not reach its target" }));
  });
  req.pipe(upstream);
};

const server = http.createServer(async (req, res) => {
  if (req.url === "/__fault") {
    if (req.method === "POST") {
      try {
        fault = await readJson(req);
      } catch {
        res.writeHead(400).end();
        return;
      }
    } else if (req.method === "DELETE") {
      fault = { kind: "pass" };
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(fault));
    return;
  }

  switch (fault.kind) {
    case "down":
      req.socket.destroy();
      return;
    case "hang":
      return;
    case "status":
      res.writeHead(fault.status, { "content-type": "application/json" });
      res.end(JSON.stringify({ statusCode: fault.status, message: "injected failure" }));
      return;
    case "garbage":
      res.writeHead(200, { "content-type": "application/json" });
      res.end("<html>not json</html>");
      return;
    case "delay":
      setTimeout(() => forward(req, res), fault.delayMs);
      return;
    default:
      forward(req, res);
  }
});

server.listen(listen, "127.0.0.1", () => {
  console.log(`fault proxy listening on ${listen}, forwarding to ${target}`);
});
