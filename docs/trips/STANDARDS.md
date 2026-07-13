# Trip Page Standards

Defaults for every trip itinerary page under `docs/trips/<slug>/`. Established 2026-07-12 from the Designer-agent review of `202607-singapore` (the reference implementation).

**Start every new trip by copying `docs/trips/TEMPLATE/`** — a renderable scaffold implementing everything below, with a HOWTO comment at the top and exemplar units (day block, hotel tile, scoped tables, parallax bands) to duplicate and fill. Preview at preed.ee/trips/TEMPLATE/.

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

## Collapsible section boxes (default)
- Every major section (At a glance / Day by day / Flights / Hotels / Budget / Eat sheet / Checklist) is a `<details class="secbox">` — **collapsed by default**, native details/summary (keyboard-accessible, no JS).
- The collapsed summary shows the section title **plus a one-line `.sum-desc` description** so the reader knows what's inside before expanding.
- Each day is its own collapsible box inside Day by day.

## Parallax destination photo bands (default)
- Every trip page gets 3–4 full-bleed photo bands of destination landmarks between major sections, revealing a fixed background layer (`#bg-stage`, `position:fixed; z-index:-1`) that crossfades per band via IntersectionObserver — never `background-attachment:fixed` (broken on iOS Safari).
- Content lives in `.sheet` wrappers (`display:flow-root`, solid theme background + spread box-shadow to cover body padding); bands are transparent windows with a caption chip naming the place.
- Photos: Wikimedia Commons (CC0/CC BY/CC BY-SA), visually verified before publishing, ≤1400px and ≈150–300KB each, attribution links in the footer. Only the first background loads at page-open; the rest defer ~1.5s via `data-img` swap. Crossfade respects `prefers-reduced-motion`.

## Mobile
- `.tablewrap` gets pure-CSS scroll shadows (local/scroll background-attachment recipe) so cut-off columns are discoverable.
- Phone numbers are tappable links (`https://wa.me/<number>` and/or `tel:`).
- Hint copy must describe the phone experience, not desktop ("across the page" means nothing when cards are already full-width).

## Content defaults (from user preferences)
- Prices THB-primary, local currency in parentheses, conversion rate noted.
- Every activity links to its official website (`target="_blank" rel="noopener"`), URLs HEAD-verified before publishing.
- Hotels: options in expandable tiles with photos — the section title states the true option count. Availability MUST be checked for the exact dates (drop unavailable properties); prices labeled "indicative" unless live-quoted. Every hotel links to Booking.com with dates and occupancy pre-filled (`searchresults.html?ss=<name>&checkin=&checkout=&group_adults=&group_children=&age=…&no_rooms=1`).
- Pizza: every trip schedules the destination's best pizza as a named meal slot — verify current rankings (50 Top Pizza Asia-Pacific / Michelin / strong local consensus), include address, price, hours and reservation note, plus a backup.
- Points: every hotels section includes a Citi ThankYou points card — **transfer partners only, never the Citi travel portal** (user preference). Re-verify current partners/ratios (they devalue; Apr 2026 precedent), name the partner properties at the destination that fit the party, state points needed; if no partner property fits, say so honestly. Full research in `research/points.md`.
- Footer/fine-print text runs the full content width (no narrow max-width caps inside full-width boxes).
- Pages carry `<meta name="robots" content="noindex">` and an emoji SVG favicon.
