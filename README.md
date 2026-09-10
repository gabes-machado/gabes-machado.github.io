# Gabes Machado — Portfolio

Personal portfolio published at [gabes-machado.github.io](https://gabes-machado.github.io/).

## Local preview

The site is built with static HTML, CSS, and JavaScript and has no build-time dependencies. From the repository root, start a local server:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

The public routes are:

- `/` — portfolio home
- `/talks/` — talk videos, transcripts and slides
- `/links/` — profile and contact links

## Updating page content

Talk entries live in `talks/index.html`. Replace each placeholder media block
with a privacy-enhanced YouTube embed and convert the disabled resource labels
into links when transcripts and slides are available:

```html
<iframe
  class="talk-card__video"
  src="https://www.youtube-nocookie.com/embed/VIDEO_ID"
  title="Talk title — event name"
  loading="lazy"
  referrerpolicy="strict-origin-when-cross-origin"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
  allowfullscreen
></iframe>
```

Profile destinations live in `links/index.html`. Replace each disabled
`span.link-hub__link` placeholder with an anchor using the same class after its
URL is available.

## Verification

The required Node.js major version is recorded in `.node-version`. Run the same dependency-free gates used by CI from the repository root:

```sh
node --test tests/*.test.mjs
git ls-files -z -- '*.js' '*.mjs' | xargs -0 -n 1 node --check
node scripts/verify-site.mjs
```

The site verifier checks that `sitemap.xml` contains exactly the three canonical public URLs and that supported references cannot escape the canonical site root and resolve to files (or HTML directory indexes). Its reference grammar covers:

- HTML URL attributes, `srcset`, `archive`/`ping` URL lists, document fragments, and literal Open Graph/Twitter image `content` values.
- CSS `url(...)` values and quoted `@import` paths.
- JavaScript/MJS static imports, side-effect imports, and `export ... from` specifiers with quoted string literals, plus dynamic `import()` specifiers written as quoted strings or interpolation-free template literals. Bare and computed module specifiers are not resolved.
- Literal path-relative and root-relative URLs, plus absolute or protocol-relative HTTP(S) URLs on the configured site origin. Query strings following a path are ignored during file lookup, fragments are checked in HTML targets, and other origins or schemes are treated as external.

## Deployment

GitHub Pages publishes the repository root from the `main` branch. Every push to `main` automatically starts a new Pages deployment.
