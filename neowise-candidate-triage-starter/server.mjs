import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { classify } from "./mock-ai.mjs";

const html = await readFile(new URL("./index.html", import.meta.url));
const topics = new Set(["delivery", "pricing", "other"]);

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function handleTriage(request, response) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);

  let input;
  try {
    input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    input = null;
  }
  const text = input?.text;
  if (typeof text !== "string" || !text.trim()) {
    return json(response, 400, { status: "invalid_input" });
  }

  try {
    // shortcut: имитатор поддерживает отмену, для модели без поддержки нужен отдельный таймер.
    const output = await classify(text, { signal: AbortSignal.timeout(300) });
    const { topic, draft } = JSON.parse(output);
    if (topics.has(topic) && typeof draft === "string" && draft.trim()) {
      return json(response, 200, { status: "ready", topic, draft });
    }
  } catch {
    // Ошибка модели или разбора ответа требует ручной обработки.
  }
  return json(response, 200, { status: "manual_review", topic: null, draft: null });
}

export const server = createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(html);
    return;
  }
  if (request.method !== "POST" || request.url !== "/api/triage") {
    return json(response, 404, { status: "not_found" });
  }
  try {
    await handleTriage(request, response);
  } catch {
    json(response, 500, { status: "server_error" });
  }
}).listen(Number(process.env.PORT || 3000), "127.0.0.1");
