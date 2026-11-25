import assert from "node:assert/strict";
import { once } from "node:events";
import { after, test } from "node:test";

process.env.PORT = "0";
const { server } = await import("./server.mjs");
await once(server, "listening");
after(() => server.close());

async function triage(body) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/triage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  return [response.status, await response.json()];
}

test("returns the model topic and draft for a valid request", async () => {
  assert.deepEqual(await triage(JSON.stringify({ text: "Когда доставка?" })), [200, {
    status: "ready",
    topic: "delivery",
    draft: "Спасибо за обращение. Уточним детали заявки.",
  }]);
});

for (const body of ["", "{", "null", "{}", '{"text":42}', '{"text":"  "}']) {
  test(`rejects invalid input ${JSON.stringify(body)}`, async () => {
    assert.deepEqual(await triage(body), [400, { status: "invalid_input" }]);
  });
}

for (const text of ["[timeout]", "[error]", "[bad-json]", "[bad-topic]", "[empty-draft]"]) {
  test(`sends ${text} to manual review`, async () => {
    const started = performance.now();
    assert.deepEqual(await triage(JSON.stringify({ text })), [200, {
      status: "manual_review",
      topic: null,
      draft: null,
    }]);
    if (text === "[timeout]") assert.ok(performance.now() - started < 900);
  });
}
