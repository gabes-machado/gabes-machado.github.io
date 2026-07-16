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

Run the dependency-free test suite with Node.js:

```sh
node --test tests/*.test.mjs
```

## Deployment

GitHub Pages publishes the repository root from the `main` branch. Every push to `main` automatically starts a new Pages deployment.
