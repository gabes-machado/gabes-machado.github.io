import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageDefinitions = [
  {
    path: new URL("../index.html", import.meta.url),
    canonicalUrl: "https://gabes-machado.github.io/",
  },
  {
    path: new URL("../talks/index.html", import.meta.url),
    canonicalUrl: "https://gabes-machado.github.io/talks/",
  },
  {
    path: new URL("../links/index.html", import.meta.url),
    canonicalUrl: "https://gabes-machado.github.io/links/",
  },
];

/**
 * Counts literal markup occurrences without requiring a DOM test dependency.
 *
 * @param {string} source - HTML source to inspect.
 * @param {string} pattern - Literal markup prefix to count.
 * @returns {number} Number of occurrences.
 */
function countOccurrences(source, pattern) {
  return source.split(pattern).length - 1;
}

for (const pageDefinition of pageDefinitions) {
  test(`${pageDefinition.canonicalUrl} exposes consistent page landmarks`, async () => {
    const html = await readFile(pageDefinition.path, "utf8");

    assert.equal(countOccurrences(html, "<main"), 1);
    assert.equal(countOccurrences(html, "<h1"), 1);
    assert.match(
      html,
      new RegExp(
        `<link rel="canonical" href="${pageDefinition.canonicalUrl.replaceAll("/", "\\/")}" \\/>`,
      ),
    );
    assert.match(html, />\s*Talks\s*</);
    assert.match(html, />\s*Links\s*</);
    assert.match(html, /data-navigation-toggle/);
    assert.match(html, /data-site-navigation/);
    assert.match(html, /aria-controls="primary-navigation"/);
    assert.doesNotMatch(html, /href=["']#["']/);
  });
}

test("talk placeholders do not expose incomplete resources as links", async () => {
  const html = await readFile(
    new URL("../talks/index.html", import.meta.url),
    "utf8",
  );

  assert.equal(countOccurrences(html, "class=\"talk-card\""), 2);
  assert.equal(countOccurrences(html, "aria-disabled=\"true\""), 4);
  assert.doesNotMatch(html, /youtube(?:-nocookie)?\.com\/embed\//);
});

test("link placeholders remain disabled until real destinations exist", async () => {
  const html = await readFile(
    new URL("../links/index.html", import.meta.url),
    "utf8",
  );

  assert.equal(countOccurrences(html, "aria-disabled=\"true\""), 4);
  assert.match(html, /<a class="link-hub__link" href="\.\.\/talks\/">/);
  assert.doesNotMatch(html, /href=["']#["']/);
});
