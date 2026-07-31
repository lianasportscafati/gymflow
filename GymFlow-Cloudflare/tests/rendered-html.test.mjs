import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("renders development preview metadata", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.match(await response.text(), developmentPreviewMeta);
});

test("includes the full editable workout-plan archive flow in the production client", async () => {
  const assetsDirectory = new URL("../dist/client/assets/", import.meta.url);
  const files = await readdir(assetsDirectory);
  const javascript = await Promise.all(
    files
      .filter((file) => file.endsWith(".js"))
      .map((file) => readFile(new URL(file, assetsDirectory), "utf8")),
  );
  const bundle = javascript.join("\n");
  assert.match(bundle, /type:[`"']checkbox[`"']/);
  assert.match(bundle, /Completata/);
  assert.match(bundle, /Archivio/);
  assert.match(bundle, /Scheda/);
  assert.match(bundle, /Archivia scheda/);
  assert.match(bundle, /Archivia tutto/);
  assert.match(bundle, /Ripristina/);
  assert.match(bundle, /SOLA VISUALIZZAZIONE/);
  assert.match(bundle, /Visualizza/);
  assert.match(bundle, /ripristinala per modificarla/);
  assert.match(bundle, /Crea una nuova scheda/);
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(pageSource, /\?\?\s*planData\.plans\[0\]/);
});
