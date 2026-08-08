# India SMS DLT Template Validator

A free, static, client-side tool that checks an actual SMS message against its registered TRAI DLT content
template (structure match, variable pre-tagging compliance, GSM-7/Unicode encoding, and SMS segment count).
No backend, no build step — pure HTML/CSS/JS, ready for GitHub Pages.

## Files

```
index.html              Main validator tool + overview content
guide/index.html         PE / Header / Content Template registration guide
variable-tagging/index.html   TRAI's Nov 2025 pre-tagging direction, explained
faq/index.html            FAQ (with FAQPage schema)
assets/validator.js       Core validation engine (also unit-testable under Node)
assets/app.js              Browser UI wiring
assets/style.css           Shared stylesheet
assets/favicon.svg
assets/test-validator.js  Node test suite for the engine — run with `node assets/test-validator.js`
sitemap.xml / robots.txt
```

## 1. Deployment status

Live at: **https://receive-sms-live.github.io/dlt-template-validator/**

Repo: **https://github.com/receive-sms-live/dlt-template-validator** (public)

All canonical tags, Open Graph URLs, JSON-LD `url` fields, `sitemap.xml`, and `robots.txt` already point at
this URL — the `SITE_URL_PLACEHOLDER` swap described in earlier drafts of this README has been done.

If you ever move the site to a custom domain (e.g. a subdomain of receive-smss.live) instead of the default
`github.io` URL, add a `CNAME` file containing just that domain to the repo root, point a DNS CNAME record
at `receive-sms-live.github.io`, enable it under **Settings → Pages → Custom domain**, then re-run:
```
find . -type f \( -name "*.html" -o -name "*.xml" -o -name "*.txt" \) -exec sed -i '' \
  's#https://receive-sms-live.github.io/dlt-template-validator#https://YOUR-CUSTOM-DOMAIN#g' {} +
```
(drop the `''` after `-i` on Linux/GNU sed) and push the change.

## 2. After it's live — SEO follow-up

- Submit the site in **Google Search Console** (Search Console → Add property → your GitHub Pages URL),
  then submit `sitemap.xml` there so Google crawls all four pages.
- Do the same in **Bing Webmaster Tools** — Bing indexing also feeds some AI answer engines.
- The backlink to `https://receive-smss.live/sms/in` is already placed in three spots: a callout box on the
  homepage, a callout on the variable-tagging page, and the footer of every page (three real, contextual
  links pointing at a live, topically-relevant page tends to help more than one — but don't add many more
  than this or it starts to look like link manipulation to search engines).
- Each page targets different keywords by design (validator/checker, registration guide, variable tagging
  2026, FAQ) — this is deliberate so the site can rank for more than one query instead of competing with
  itself.

## 3. Local testing

Open `index.html` directly in a browser (no server needed — everything is static and relative-pathed), or
serve it locally:
```
cd path/to/this/folder
python3 -m http.server 8000
```
then visit `http://localhost:8000/`.

To re-run the engine's test suite after any change to `assets/validator.js`:
```
node assets/test-validator.js
```

## Notes on accuracy

The variable-tagging content cites TRAI's direction dated 18 November 2025 (F.No. D-2711/(2)/2024-QoS) and
its official press release. Rules, tag definitions, and deadlines can be amended by TRAI — if you're making
compliance decisions, verify current requirements directly on trai.gov.in and your DLT operator's portal.
This tool performs local text/format checks only; it does not connect to the live TRAI or operator DLT
registry.
