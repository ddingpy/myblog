const fs = require("fs");
const path = require("path");
const http = require("http");

const root = path.resolve(process.argv[2] || "/srv/jekyll/_site");
const port = Number(process.argv[3] || 4000);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

function safePathFromUrl(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const normalized = decoded.replace(/^\/+/, "");
  const candidate = path.resolve(root, normalized);

  if (!candidate.startsWith(root)) {
    return null;
  }

  return candidate;
}

function statSafe(filePath) {
  try {
    return fs.statSync(filePath);
  } catch {
    return null;
  }
}

const server = http.createServer((req, res) => {
  const requested = safePathFromUrl(req.url || "/");
  if (!requested) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Bad request");
    return;
  }

  let filePath = requested;
  let stats = statSafe(filePath);

  if (stats && stats.isDirectory()) {
    filePath = path.join(filePath, "index.html");
    stats = statSafe(filePath);
  }

  if (!stats || !stats.isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || "application/octet-stream";

  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "no-cache",
  });

  fs.createReadStream(filePath).pipe(res);
});

server.listen(port, "0.0.0.0", () => {
  process.stdout.write(`Static server listening on http://0.0.0.0:${port}\n`);
  process.stdout.write(`Serving from ${root}\n`);
});
