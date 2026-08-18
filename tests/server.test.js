import { test } from "node:test";
import assert from "node:assert/strict";
import { server } from "../server.js";

async function withServer(fn) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("CORS header is only sent for the allowed origin", async () => {
  await withServer(async (baseUrl) => {
    const allowed = await fetch(`${baseUrl}/index.html`, {
      headers: { Origin: "https://operationdhurandar.ashar.site" },
    });
    assert.equal(
      allowed.headers.get("access-control-allow-origin"),
      "https://operationdhurandar.ashar.site"
    );

    const blocked = await fetch(`${baseUrl}/index.html`, {
      headers: { Origin: "https://evil.example.com" },
    });
    assert.equal(blocked.headers.get("access-control-allow-origin"), null);
  });
});

test("serves index.html at the root path", async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") || "", /text\/html/);
  });
});

test("unknown paths return 404", async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/does-not-exist.txt`);
    assert.equal(res.status, 404);
  });
});
