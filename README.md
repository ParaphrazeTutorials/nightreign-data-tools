# Nightreign Data Tools (The Round Table Codex)

Community-built helpers for Elden Ring: Nightreign — validate relic builds, plan chalices, and browse the underlying data.

## Quick links
- Live app: https://paraphrazetutorials.github.io/nightreign-data-tools/
- Reliquary (relic builder): https://paraphrazetutorials.github.io/nightreign-data-tools/Reliquary/
- Lexicon (data table): https://paraphrazetutorials.github.io/nightreign-data-tools/Lexicon/
- Project guide: ./docs/PROJECT_GUIDE.md

## What’s inside
- Reliquary (relic builder): a guardrail-first sandbox to mix effects and curses, catch illegal combos before you waste a roll, auto-sort by required roll order, and surface exact odds for Standard and Depth builds.
- Chalice Builder (full-loadout planner): design 18-slot chalices (9 Standard, 9 Depth), see trio groupings light up, drag/drop to rearrange, and get instant feedback on compatibility, curse requirements, and class filters.
- Lexicon (live data explorer): slice, sort, search, and export the authoritative reliquary dataset; every field (weights, compat IDs, categories) is at your fingertips for theorycrafting or QA.
- Assets and data pipeline: static JSON and art pulled from the game’s tables and kept fresh; the app fetches them at runtime so what you see always matches the latest drop.

## Why this exists
A practical AI-assisted side project to serve the Nightreign community: turning Acarii’s trusted data and community rules into a reliable web tool. Built to learn by doing, with real players as the customer.

## Try it (players)
- Open the live app (link above).
- Choose Reliquary to validate or experiment with relics; toggle “show illegal” for exploration, and use auto-sort for roll order.
- Use Chalice Builder for full 18-slot planning; Depth slots enforce curse-required effects.
- Use Lexicon to inspect effect fields, categories, weights, and export CSV.

## Contributing (quick start)
- Prereqs: Node 18+ recommended.
- Install: `npm install`
- Build CSS and bundle: `npm run build`
- Tests: `npm test` (Vitest); optional Playwright smoke: set `PLAYWRIGHT_BASE_URL` to a served Reliquary URL, then `npm run test:e2e`
- Run locally: serve the repo root with a static server (e.g., `npx serve .`) and open `index.html` (Pages-compatible static site).

## Data pipeline (source of truth)
- SQL: downloads/reliquary/queries/reliquary.sql (derives RelicType, RollOrder, weights, curse flags, compatibility).
- JSON: Data/reliquary.json, Data/chalicedata.json, Data/effectstats.json regenerated from the SQL/CSV inputs.
- Assets: icons and relic renders in Assets/; manifest at downloads/reliquary/manifest.json.

## Repository map
- Reliquary/: UI + logic for relics and chalices
- Lexicon/: data-table explorer
- Data/: game-derived JSON inputs
- downloads/: raw CSV/SQL inputs for regeneration
- styles/: CSS (built via PostCSS)
- scripts/: shared UI helpers
- docs/: project guide
- tests/: Vitest unit tests; tests/e2e for Playwright smoke

## Credits
- Community data: Acarii (Hexington Discord) and collaborators.
- Art: "Smile" (Discord) for featured illustrations.
- Story and stewardship: project by Jason Uphoff; built with GitHub Copilot (GPT-5.1-Codex-Max).

## Further reading
- Building Skills with Purpose — AI-assisted side project in gaming (LinkedIn): https://www.linkedin.com/pulse/building-skills-purpose-ai-assisted-side-project-gaming-jason-uphoff-cc4dc
