# Trip Page Standards

Defaults for every trip itinerary page under `docs/trips/<slug>/`. Established 2026-07-12 from the Designer-agent review of `202607-singapore` (the reference implementation).

## Document structure
- Semantic outline: one `<h1>` (trip title) → `<h2 class="section-h">` per major section (Flights, Hotels, Budget, Activities, Checklist) → `<h3>` for day titles and hotel names.
- Landmarks: `<header>` (masthead + facts strip + theme toggle), `<main>` (all content), `<footer>` (caveats).
- Tables: `<th scope="col">` in `thead`; first-column name cells are `<th scope="row">`.

## Theme
- Token-based palette on `:root`, redefined under `@media (prefers-color-scheme: dark)`, then `:root[data-theme="dark"]` and `:root[data-theme="light"]` overrides (toggle must win both directions).
- Theme toggle button (`#theme-toggle`, ◐, top-right of header) stamps `data-theme` and persists to `localStorage('trip-theme')`.
- Light-theme accent must clear WCAG AA with headroom (≥5.5:1 on ground) — links render small.

## Typography
- Self-hosted WOFF2 from `docs/trips/fonts/` (shared across trips): Jost 400/600 (display), Source Serif 4 400/600 (body), `font-display: swap`. Never rely on Apple-only system fonts (Futura/Charter) — Android users lose the design silently.

## Images
- Max 640px longest edge, JPEG quality ~72, target 50–90KB each (`sips -Z 640 -s formatOptions 72`).
- Every `<img>` carries `width`/`height` attributes and `loading="lazy"`.
- Gallery images beyond the first use `data-src` and are swapped in on expand (display:none does NOT prevent lazy-image fetch).
- `onerror` swaps to a neutral SVG data-URI placeholder — never `this.remove()`.

## Interactive cards (hotel tiles etc.)
- Expand control is a real `<button aria-expanded>` wrapping the gallery only; links stay outside the button (no nested interactive controls).
- Visible affordance badge ("＋2 photos · details" ↔ "Show less").
- Collapsed state shows the persuasive pitch line; fine print (`.fine`) is what collapses.

## Mobile
- `.tablewrap` gets pure-CSS scroll shadows (local/scroll background-attachment recipe) so cut-off columns are discoverable.
- Phone numbers are tappable links (`https://wa.me/<number>` and/or `tel:`).
- Hint copy must describe the phone experience, not desktop ("across the page" means nothing when cards are already full-width).

## Content defaults (from user preferences)
- Prices THB-primary, local currency in parentheses, conversion rate noted.
- Every activity links to its official website (`target="_blank" rel="noopener"`), URLs HEAD-verified before publishing.
- Hotels: 3 options in expandable tiles with photos; availability + all-in prices (incl. taxes/fees) checked live where possible, honestly labeled "indicative" otherwise, with dated OTA deep-links per hotel.
- Pages carry `<meta name="robots" content="noindex">` and an emoji SVG favicon.
