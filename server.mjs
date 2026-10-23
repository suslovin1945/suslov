import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP_DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(APP_DIR, "..", "work");
const STATE_FILE = path.join(DATA_DIR, "planner-state.json");
const PORT = 4173;
const HOST = "0.0.0.0";
const MAX_BODY_SIZE = 2 * 1024 * 1024;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

let snapshot = {
  revision: 0,
  state: null,
  updatedAt: null
};

try {
  const stored = JSON.parse(await fs.readFile(STATE_FILE, "utf8"));
  if (stored && typeof stored === "object" && stored.state) {
    snapshot = {
      revision: Number(stored.revision) || 1,
      state: stored.state,
      updatedAt: stored.updatedAt || null
    };
  }
} catch {
  // The first request creates the shared state file.
}

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  });
  response.end(body);
}

async function readRequestBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_SIZE) throw new Error("request too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function persistSnapshot() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const temporary = `${STATE_FILE}.${process.pid}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(snapshot, null, 2), "utf8");
  await fs.rename(temporary, STATE_FILE);
}

async function handleApi(request, response) {
  if (request.method === "GET") {
    sendJson(response, 200, snapshot);
    return;
  }
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "method not allowed" });
    return;
  }
  try {
    const body = await readRequestBody(request);
    const payload = JSON.parse(body);
    if (!payload?.state || typeof payload.state !== "object") {
      sendJson(response, 400, { error: "state object required" });
      return;
    }
    snapshot = {
      revision: snapshot.revision + 1,
      state: payload.state,
      updatedAt: new Date().toISOString()
    };
    await persistSnapshot();
    sendJson(response, 200, {
      revision: snapshot.revision,
      updatedAt: snapshot.updatedAt
    });
  } catch (error) {
    sendJson(response, 400, { error: error.message || "invalid request" });
  }
}

async function serveStatic(pathname, response) {
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = path.resolve(APP_DIR, relativePath);
  if (
    !filePath.startsWith(`${APP_DIR}${path.sep}`)
    || path.basename(filePath) === "server.mjs"
    || path.basename(filePath) === "start-server.cmd"
  ) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  try {
    const data = await fs.readFile(filePath);
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Content-Length": data.length,
      "Cache-Control": "no-cache"
    });
    response.end(data);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}

const server = http.createServer(async (request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  } catch {
    response.writeHead(400);
    response.end("Bad request");
    return;
  }
  if (pathname === "/api/state") {
    await handleApi(request, response);
    return;
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405);
    response.end("Method not allowed");
    return;
  }
  await serveStatic(pathname, response);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`端口 ${PORT} 已被占用，请先关闭旧的网页服务。`);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
  console.log(`时间管理计划同步服务已启动：http://localhost:${PORT}/`);
  console.log("手机和平板请使用电脑的局域网 IPv4 地址访问。");
  console.log(`同步数据文件：${STATE_FILE}`);
});
