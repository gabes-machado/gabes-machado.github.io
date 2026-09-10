import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { verifySite } from "../scripts/verify-site.mjs";

const fixtureSitemapUrl = "https://example.test/";
const execFileAsync = promisify(execFile);

async function createFixture(t) {
  const rootDirectory = await mkdtemp(path.join(tmpdir(), "verify-site-"));
  t.after(() => rm(rootDirectory, { force: true, recursive: true }));

  await Promise.all([
    writeFile(
      path.join(rootDirectory, "index.html"),
      '<!doctype html><link rel="stylesheet" href="./styles.css"><main>Test</main>',
    ),
    writeFile(path.join(rootDirectory, "styles.css"), "main { display: block; }\n"),
    writeFile(
      path.join(rootDirectory, "sitemap.xml"),
      `<urlset><url><loc>${fixtureSitemapUrl}</loc></url></urlset>`,
    ),
  ]);

  return rootDirectory;
}

test("site verification rejects a missing local reference", async (t) => {
  const rootDirectory = await createFixture(t);
  const options = { expectedSitemapUrls: [fixtureSitemapUrl] };

  await assert.doesNotReject(() => verifySite(rootDirectory, options));

  await writeFile(
    path.join(rootDirectory, "index.html"),
    '<!doctype html><img src="./missing.png" alt="">',
  );

  await assert.rejects(
    () => verifySite(rootDirectory, options),
    /index\.html: missing local reference "\.\/missing\.png"/,
  );
});

test("site verification checks absolute references on the configured origin", async (t) => {
  const rootDirectory = await createFixture(t);
  const options = {
    expectedSitemapUrls: [fixtureSitemapUrl],
    siteOrigin: fixtureSitemapUrl,
  };

  await writeFile(
    path.join(rootDirectory, "index.html"),
    '<!doctype html><img src="https://example.test/missing-absolute.png" alt="">',
  );

  await assert.rejects(
    () => verifySite(rootDirectory, options),
    /index\.html: missing local reference "https:\/\/example\.test\/missing-absolute\.png"/,
  );
});

test("site verification checks Open Graph image metadata", async (t) => {
  const rootDirectory = await createFixture(t);
  const options = {
    expectedSitemapUrls: [fixtureSitemapUrl],
    siteOrigin: fixtureSitemapUrl,
  };

  await writeFile(
    path.join(rootDirectory, "index.html"),
    '<!doctype html><meta property="og:image" content="https://example.test/missing-og.png">',
  );

  await assert.rejects(
    () => verifySite(rootDirectory, options),
    /index\.html: missing local reference "https:\/\/example\.test\/missing-og\.png"/,
  );
});

test("site verification checks Twitter image metadata", async (t) => {
  const rootDirectory = await createFixture(t);
  const options = {
    expectedSitemapUrls: [fixtureSitemapUrl],
    siteOrigin: fixtureSitemapUrl,
  };

  await writeFile(
    path.join(rootDirectory, "index.html"),
    '<!doctype html><meta name="twitter:image" content="https://example.test/missing-twitter.png">',
  );

  await assert.rejects(
    () => verifySite(rootDirectory, options),
    /index\.html: missing local reference "https:\/\/example\.test\/missing-twitter\.png"/,
  );
});

test("site verification rejects a reference symlink that escapes the site root", async (t) => {
  const rootDirectory = await createFixture(t);
  const outsideDirectory = await mkdtemp(path.join(tmpdir(), "verify-site-outside-"));
  const options = { expectedSitemapUrls: [fixtureSitemapUrl] };
  t.after(() => rm(outsideDirectory, { force: true, recursive: true }));

  await Promise.all([
    writeFile(
      path.join(rootDirectory, "index.html"),
      '<!doctype html><img src="./escaped.png" alt="">',
    ),
    writeFile(path.join(outsideDirectory, "escaped.png"), "outside\n"),
  ]);
  await symlink(
    path.join(outsideDirectory, "escaped.png"),
    path.join(rootDirectory, "escaped.png"),
  );

  await assert.rejects(
    () => verifySite(rootDirectory, options),
    /index\.html: missing local reference "\.\/escaped\.png"/,
  );
});

test("site verification rejects a source symlink that escapes the site root", async (t) => {
  const rootDirectory = await createFixture(t);
  const outsideDirectory = await mkdtemp(path.join(tmpdir(), "verify-site-outside-"));
  const options = { expectedSitemapUrls: [fixtureSitemapUrl] };
  t.after(() => rm(outsideDirectory, { force: true, recursive: true }));

  const outsideSource = path.join(outsideDirectory, "escaped-source.html");
  await writeFile(outsideSource, "<!doctype html><main>Outside</main>");
  await symlink(outsideSource, path.join(rootDirectory, "escaped-source.html"));

  await assert.rejects(
    () => verifySite(rootDirectory, options),
    /escaped-source\.html: source resolves outside site root/,
  );
});

test("site verification rejects a sitemap symlink that escapes the site root", async (t) => {
  const rootDirectory = await createFixture(t);
  const outsideDirectory = await mkdtemp(path.join(tmpdir(), "verify-site-outside-"));
  const options = { expectedSitemapUrls: [fixtureSitemapUrl] };
  const sitemapPath = path.join(rootDirectory, "sitemap.xml");
  const outsideSitemap = path.join(outsideDirectory, "sitemap.xml");
  t.after(() => rm(outsideDirectory, { force: true, recursive: true }));

  await writeFile(
    outsideSitemap,
    `<urlset><url><loc>${fixtureSitemapUrl}</loc></url></urlset>`,
  );
  await rm(sitemapPath);
  await symlink(outsideSitemap, sitemapPath);

  await assert.rejects(
    () => verifySite(rootDirectory, options),
    /sitemap\.xml: source resolves outside site root/,
  );
});

test("site verification rejects a missing same-document fragment", async (t) => {
  const rootDirectory = await createFixture(t);
  const options = { expectedSitemapUrls: [fixtureSitemapUrl] };

  await writeFile(
    path.join(rootDirectory, "index.html"),
    '<!doctype html><main id="present"><a href="#missing">Missing</a></main>',
  );

  await assert.rejects(
    () => verifySite(rootDirectory, options),
    /index\.html: missing fragment "#missing" in index\.html/,
  );
});

test("site verification does not treat data attributes as fragment targets", async (t) => {
  const rootDirectory = await createFixture(t);
  const options = { expectedSitemapUrls: [fixtureSitemapUrl] };

  await writeFile(
    path.join(rootDirectory, "index.html"),
    '<!doctype html><main data-id="missing"><a href="#missing">Missing</a></main>',
  );

  await assert.rejects(
    () => verifySite(rootDirectory, options),
    /index\.html: missing fragment "#missing" in index\.html/,
  );
});

test("site verification accepts unquoted HTML fragment targets", async (t) => {
  const rootDirectory = await createFixture(t);
  const options = { expectedSitemapUrls: [fixtureSitemapUrl] };

  await writeFile(
    path.join(rootDirectory, "index.html"),
    "<!doctype html><main id=target><a href=#target>Target</a></main>",
  );

  await assert.doesNotReject(() => verifySite(rootDirectory, options));
});

test("site verification rejects a missing cross-document fragment", async (t) => {
  const rootDirectory = await createFixture(t);
  const options = { expectedSitemapUrls: [fixtureSitemapUrl] };

  await Promise.all([
    writeFile(
      path.join(rootDirectory, "index.html"),
      '<!doctype html><a href="./about.html#missing">Missing</a>',
    ),
    writeFile(
      path.join(rootDirectory, "about.html"),
      '<!doctype html><main id="present">About</main>',
    ),
  ]);

  await assert.rejects(
    () => verifySite(rootDirectory, options),
    /index\.html: missing fragment "#missing" in about\.html/,
  );
});

test("site verification ignores references in HTML comments", async (t) => {
  const rootDirectory = await createFixture(t);
  const options = { expectedSitemapUrls: [fixtureSitemapUrl] };

  await writeFile(
    path.join(rootDirectory, "index.html"),
    '<!doctype html><!-- <img src="./not-a-reference.png" alt=""> --><main>Test</main>',
  );

  await assert.doesNotReject(() => verifySite(rootDirectory, options));
});

test("site verification ignores URL-like HTML data attributes", async (t) => {
  const rootDirectory = await createFixture(t);
  const options = { expectedSitemapUrls: [fixtureSitemapUrl] };

  await writeFile(
    path.join(rootDirectory, "index.html"),
    '<!doctype html><main data-href="./not-a-reference.html">Test</main>',
  );

  await assert.doesNotReject(() => verifySite(rootDirectory, options));
});

test("site verification checks HTML srcset references", async (t) => {
  const rootDirectory = await createFixture(t);
  const options = { expectedSitemapUrls: [fixtureSitemapUrl] };

  await writeFile(
    path.join(rootDirectory, "index.html"),
    '<!doctype html><img srcset="./missing-small.png 1x, ./missing-large.png 2x" alt="">',
  );

  await assert.rejects(
    () => verifySite(rootDirectory, options),
    /index\.html: missing local reference "\.\/missing-small\.png"/,
  );
});

test("site verification accepts data URLs in HTML srcset attributes", async (t) => {
  const rootDirectory = await createFixture(t);
  const options = { expectedSitemapUrls: [fixtureSitemapUrl] };

  await writeFile(
    path.join(rootDirectory, "index.html"),
    '<!doctype html><img srcset="data:image/svg+xml,%3Csvg%3E 1x, ./styles.css 2x" alt="">',
  );

  await assert.doesNotReject(() => verifySite(rootDirectory, options));
});

test("site verification checks HTML poster references", async (t) => {
  const rootDirectory = await createFixture(t);
  const options = { expectedSitemapUrls: [fixtureSitemapUrl] };

  await writeFile(
    path.join(rootDirectory, "index.html"),
    '<!doctype html><video poster="./missing-poster.webp"></video>',
  );

  await assert.rejects(
    () => verifySite(rootDirectory, options),
    /index\.html: missing local reference "\.\/missing-poster\.webp"/,
  );
});

test("site verification checks other HTML URL attributes", async (t) => {
  const rootDirectory = await createFixture(t);
  const options = { expectedSitemapUrls: [fixtureSitemapUrl] };

  await writeFile(
    path.join(rootDirectory, "index.html"),
    '<!doctype html><form action="./missing-handler.html"></form>',
  );

  await assert.rejects(
    () => verifySite(rootDirectory, options),
    /index\.html: missing local reference "\.\/missing-handler\.html"/,
  );
});

test("site verification checks unquoted HTML URL attributes", async (t) => {
  const rootDirectory = await createFixture(t);
  const options = { expectedSitemapUrls: [fixtureSitemapUrl] };

  await writeFile(
    path.join(rootDirectory, "index.html"),
    "<!doctype html><img src=./missing-unquoted.png alt>",
  );

  await assert.rejects(
    () => verifySite(rootDirectory, options),
    /index\.html: missing local reference "\.\/missing-unquoted\.png"/,
  );
});

test("site verification checks unquoted HTML srcset attributes", async (t) => {
  const rootDirectory = await createFixture(t);
  const options = { expectedSitemapUrls: [fixtureSitemapUrl] };

  await writeFile(
    path.join(rootDirectory, "index.html"),
    "<!doctype html><img srcset=./missing-unquoted-srcset.png alt>",
  );

  await assert.rejects(
    () => verifySite(rootDirectory, options),
    /index\.html: missing local reference "\.\/missing-unquoted-srcset\.png"/,
  );
});

test("site verification checks space-separated HTML URL attributes", async (t) => {
  const rootDirectory = await createFixture(t);
  const options = { expectedSitemapUrls: [fixtureSitemapUrl] };

  await writeFile(
    path.join(rootDirectory, "index.html"),
    '<!doctype html><a href="/" ping="./missing-audit-one ./missing-audit-two">Home</a>',
  );

  await assert.rejects(
    () => verifySite(rootDirectory, options),
    /index\.html: missing local reference "\.\/missing-audit-one"/,
  );
});

test("site verification checks unquoted HTML URL-list attributes", async (t) => {
  const rootDirectory = await createFixture(t);
  const options = { expectedSitemapUrls: [fixtureSitemapUrl] };

  await writeFile(
    path.join(rootDirectory, "index.html"),
    '<!doctype html><a href="/" ping=./missing-unquoted-audit>Home</a>',
  );

  await assert.rejects(
    () => verifySite(rootDirectory, options),
    /index\.html: missing local reference "\.\/missing-unquoted-audit"/,
  );
});

test("site verification checks unquoted HTML archive attributes", async (t) => {
  const rootDirectory = await createFixture(t);
  const options = { expectedSitemapUrls: [fixtureSitemapUrl] };

  await writeFile(
    path.join(rootDirectory, "index.html"),
    "<!doctype html><object archive=./missing-unquoted-archive></object>",
  );

  await assert.rejects(
    () => verifySite(rootDirectory, options),
    /index\.html: missing local reference "\.\/missing-unquoted-archive"/,
  );
});

test("site verification checks multiline JavaScript imports", async (t) => {
  const rootDirectory = await createFixture(t);
  const options = { expectedSitemapUrls: [fixtureSitemapUrl] };

  await writeFile(
    path.join(rootDirectory, "entry.js"),
    'import {\n  missingExport,\n} from "./missing-module.js";\n',
  );

  await assert.rejects(
    () => verifySite(rootDirectory, options),
    /entry\.js: missing local reference "\.\/missing-module\.js"/,
  );
});

test("site verification checks imports after postfix division expressions", async (t) => {
  const rootDirectory = await createFixture(t);
  const options = { expectedSitemapUrls: [fixtureSitemapUrl] };

  await writeFile(
    path.join(rootDirectory, "entry.js"),
    'let value = 1;\nvalue++ / 2;\nimport "./missing-after-division.js";\n',
  );

  await assert.rejects(
    () => verifySite(rootDirectory, options),
    /entry\.js: missing local reference "\.\/missing-after-division\.js"/,
  );
});

test("site verification checks imports after regular expressions in if bodies", async (t) => {
  const rootDirectory = await createFixture(t);
  const options = { expectedSitemapUrls: [fixtureSitemapUrl] };

  await writeFile(
    path.join(rootDirectory, "entry.js"),
    'if (true) /a+/.test("a");\nimport "./missing-after-regexp.js";\n',
  );

  await assert.rejects(
    () => verifySite(rootDirectory, options),
    /entry\.js: missing local reference "\.\/missing-after-regexp\.js"/,
  );
});

test("site verification checks side-effect JavaScript imports", async (t) => {
  const rootDirectory = await createFixture(t);
  const options = { expectedSitemapUrls: [fixtureSitemapUrl] };

  await writeFile(
    path.join(rootDirectory, "entry.js"),
    'import "./missing-side-effect.js";\n',
  );

  await assert.rejects(
    () => verifySite(rootDirectory, options),
    /entry\.js: missing local reference "\.\/missing-side-effect\.js"/,
  );
});

test("site verification checks dynamic JavaScript imports", async (t) => {
  const rootDirectory = await createFixture(t);
  const options = { expectedSitemapUrls: [fixtureSitemapUrl] };

  await writeFile(
    path.join(rootDirectory, "entry.js"),
    'const module = import("./missing-dynamic.js");\n',
  );

  await assert.rejects(
    () => verifySite(rootDirectory, options),
    /entry\.js: missing local reference "\.\/missing-dynamic\.js"/,
  );
});

test("site verification ignores computed dynamic JavaScript imports", async (t) => {
  const rootDirectory = await createFixture(t);
  const options = { expectedSitemapUrls: [fixtureSitemapUrl] };

  await writeFile(
    path.join(rootDirectory, "entry.js"),
    'const module = import("./computed-" + moduleName);\n',
  );

  await assert.doesNotReject(() => verifySite(rootDirectory, options));
});

test("site verification ignores methods named import", async (t) => {
  const rootDirectory = await createFixture(t);
  const options = { expectedSitemapUrls: [fixtureSitemapUrl] };

  await writeFile(
    path.join(rootDirectory, "entry.js"),
    'const module = loader.import("./not-a-reference.js");\n',
  );

  await assert.doesNotReject(() => verifySite(rootDirectory, options));
});

test("site verification checks dynamic imports with template literals", async (t) => {
  const rootDirectory = await createFixture(t);
  const options = { expectedSitemapUrls: [fixtureSitemapUrl] };

  await writeFile(
    path.join(rootDirectory, "entry.js"),
    "const module = import(`./missing-template-module.js`);\n",
  );

  await assert.rejects(
    () => verifySite(rootDirectory, options),
    /entry\.js: missing local reference "\.\/missing-template-module\.js"/,
  );
});

test("site verification checks imports in template interpolations", async (t) => {
  const rootDirectory = await createFixture(t);
  const options = { expectedSitemapUrls: [fixtureSitemapUrl] };

  await writeFile(
    path.join(rootDirectory, "entry.js"),
    "const moduleName = `${import(\"./missing-template.js\")}`;\n",
  );

  await assert.rejects(
    () => verifySite(rootDirectory, options),
    /entry\.js: missing local reference "\.\/missing-template\.js"/,
  );
});

test("site verification rejects directory JavaScript imports", async (t) => {
  const rootDirectory = await createFixture(t);
  const options = { expectedSitemapUrls: [fixtureSitemapUrl] };
  const moduleDirectory = path.join(rootDirectory, "module");

  await mkdir(moduleDirectory);
  await Promise.all([
    writeFile(path.join(rootDirectory, "entry.js"), 'import "./module/";\n'),
    writeFile(path.join(moduleDirectory, "index.html"), "<!doctype html><main>Not JS</main>"),
  ]);

  await assert.rejects(
    () => verifySite(rootDirectory, options),
    /entry\.js: missing local reference "\.\/module\/"/,
  );
});

test("site verification ignores import-like text in JavaScript strings", async (t) => {
  const rootDirectory = await createFixture(t);
  const options = { expectedSitemapUrls: [fixtureSitemapUrl] };

  await writeFile(
    path.join(rootDirectory, "entry.js"),
    'const example = \'import("./not-a-reference.js")\';\n',
  );

  await assert.doesNotReject(() => verifySite(rootDirectory, options));
});

test("site verification checks CSS url references", async (t) => {
  const rootDirectory = await createFixture(t);
  const options = { expectedSitemapUrls: [fixtureSitemapUrl] };

  await writeFile(
    path.join(rootDirectory, "styles.css"),
    'main { background-image: url("./missing-background.svg"); }\n',
  );

  await assert.rejects(
    () => verifySite(rootDirectory, options),
    /styles\.css: missing local reference "\.\/missing-background\.svg"/,
  );
});

test("site verification checks CSS import references", async (t) => {
  const rootDirectory = await createFixture(t);
  const options = { expectedSitemapUrls: [fixtureSitemapUrl] };

  await writeFile(
    path.join(rootDirectory, "styles.css"),
    '@import "./missing-theme.css";\n',
  );

  await assert.rejects(
    () => verifySite(rootDirectory, options),
    /styles\.css: missing local reference "\.\/missing-theme\.css"/,
  );
});

test("site verification ignores references in CSS comments", async (t) => {
  const rootDirectory = await createFixture(t);
  const options = { expectedSitemapUrls: [fixtureSitemapUrl] };

  await writeFile(
    path.join(rootDirectory, "styles.css"),
    '/* background: url("./not-a-reference.svg"); */\nmain { display: block; }\n',
  );

  await assert.doesNotReject(() => verifySite(rootDirectory, options));
});

test("site verification ignores url-like text in CSS strings", async (t) => {
  const rootDirectory = await createFixture(t);
  const options = { expectedSitemapUrls: [fixtureSitemapUrl] };

  await writeFile(
    path.join(rootDirectory, "styles.css"),
    'main::before { content: \'url("./not-a-reference.png")\'; }\n',
  );

  await assert.doesNotReject(() => verifySite(rootDirectory, options));
});

test("site verification requires the exact expected sitemap URLs", async (t) => {
  const rootDirectory = await createFixture(t);
  const options = { expectedSitemapUrls: [fixtureSitemapUrl] };

  await assert.doesNotReject(() => verifySite(rootDirectory, options));

  await writeFile(
    path.join(rootDirectory, "sitemap.xml"),
    "<urlset><url><loc>https://example.test/unexpected/</loc></url></urlset>",
  );

  await assert.rejects(
    () => verifySite(rootDirectory, options),
    /sitemap\.xml: URLs differ; missing https:\/\/example\.test\/; unexpected https:\/\/example\.test\/unexpected\//,
  );
});

test("site verification ignores sitemap URLs in XML comments", async (t) => {
  const rootDirectory = await createFixture(t);
  const options = { expectedSitemapUrls: [fixtureSitemapUrl] };

  await writeFile(
    path.join(rootDirectory, "sitemap.xml"),
    `<urlset><!-- <url><loc>${fixtureSitemapUrl}</loc></url> --></urlset>`,
  );

  await assert.rejects(
    () => verifySite(rootDirectory, options),
    /sitemap\.xml: URLs differ; missing https:\/\/example\.test\//,
  );
});

test("site verification ignores sitemap locations outside URL entries", async (t) => {
  const rootDirectory = await createFixture(t);
  const options = { expectedSitemapUrls: [fixtureSitemapUrl] };

  await writeFile(
    path.join(rootDirectory, "sitemap.xml"),
    `<urlset><loc>${fixtureSitemapUrl}</loc></urlset>`,
  );

  await assert.rejects(
    () => verifySite(rootDirectory, options),
    /sitemap\.xml: URLs differ; missing https:\/\/example\.test\//,
  );
});

test("site verification runs the repository checks from the command line", async () => {
  const scriptPath = fileURLToPath(new URL("../scripts/verify-site.mjs", import.meta.url));
  const { stdout } = await execFileAsync(process.execPath, [scriptPath]);

  assert.match(
    stdout,
    /^Verified 3 sitemap URLs and \d+ local references across \d+ source files\.\n$/u,
  );
});
