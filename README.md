# wandlr

Shrink files. Nothing leaves your browser.

wandlr is a small, free tool to compress and convert images and PDFs. Everything
runs locally, in your browser — no uploads, no accounts, no tracking, no server
storage.

Live at [wandlr.de](https://wandlr.de).

## Why trust it

The easiest way to trust a "we don't upload your files" claim is to be able to
check it yourself:

- Open your browser's network tab while converting a file — it stays empty.
- The entire source is right here in this repository. No build step, no
  bundler, no minification of the app code — what you read is what runs.
- Images are processed with the browser's native Canvas API. PDFs use two
  well-known open-source libraries ([pdf.js](https://github.com/mozilla/pdf.js)
  and [pdf-lib](https://github.com/Hopding/pdf-lib)), vendored in `vendor/` and
  loaded once, then run entirely offline in memory.

## What it does

- **Images** — compress and convert between JPEG, PNG and WebP, with a quality
  slider and a live before/after size comparison. Multiple files at once.
- **PDF** — compress a PDF by re-rendering each page as an image at your chosen
  quality. This trades selectable/searchable text for a smaller file — a
  deliberate, disclosed trade-off, not a limitation we're hiding.

## Running it locally

There's no build step. Serve the folder with any static file server and open
it, for example:

```
python3 -m http.server
```

## Stack

Plain HTML, CSS and JavaScript (ES modules). No framework, no bundler.
`vendor/` contains the pre-built browser bundles of pdf.js (Apache-2.0) and
pdf-lib (MIT), used as-is.

## License

MIT — see [LICENSE](./LICENSE).
