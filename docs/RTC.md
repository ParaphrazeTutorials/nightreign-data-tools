# Nightreign Data Tools — Q&D Reference (for GPT)

Audience: mixed (devs + end users). Be explicit and narrative-friendly. Goal: let GPT explain how the tools derive relic/chalice outcomes, probabilities, compatibility, and stats, with concrete numeric examples.

## Scope & Modules
- Reliquary picker (individual relic builder): primary logic and rendering in [Reliquary/reliquary.js](https://github.com/ParaphrazeTutorials/nightreign-data-tools-dev/blob/main/Reliquary/reliquary.js); pure helpers in [Reliquary/reliquary.logic.js](https://github.com/ParaphrazeTutorials/nightreign-data-tools-dev/blob/main/Reliquary/reliquary.logic.js); UI fragments in [Reliquary/reliquary.ui.js](https://github.com/ParaphrazeTutorials/nightreign-data-tools-dev/blob/main/Reliquary/reliquary.ui.js); menus in [Reliquary/reliquary.menus.js](https://github.com/ParaphrazeTutorials/nightreign-data-tools-dev/blob/main/Reliquary/reliquary.menus.js); DOM map in [Reliquary/reliquary.dom.js](https://github.com/ParaphrazeTutorials/nightreign-data-tools-dev/blob/main/Reliquary/reliquary.dom.js); asset helpers in [Reliquary/reliquary.assets.js](https://github.com/ParaphrazeTutorials/nightreign-data-tools-dev/blob/main/Reliquary/reliquary.assets.js).
- Chalice builder (multi-slot Standard + Depth of Night planner): uses the same logic files, plus chalice color data for grouping and stat rollups.
- Lexicon data table (dataset explorer/exporter): [Lexicon/lexicon.js](https://github.com/ParaphrazeTutorials/nightreign-data-tools-dev/blob/main/Lexicon/lexicon.js), [Lexicon/index.html](https://paraphrazetutorials.github.io/nightreign-data-tools-dev/Lexicon/index.html).
- Shared UI palette/theme helpers: [scripts/ui/palette.js](https://github.com/ParaphrazeTutorials/nightreign-data-tools-dev/blob/main/scripts/ui/palette.js), [scripts/ui/theme.js](https://github.com/ParaphrazeTutorials/nightreign-data-tools-dev/blob/main/scripts/ui/theme.js).

## Data Sources (authoritative)
- Effects + curses: [Data/reliquary.json](https://github.com/ParaphrazeTutorials/nightreign-data-tools-dev/blob/main/Data/reliquary.json) generated from [downloads/reliquary/queries/reliquary.sql](https://github.com/ParaphrazeTutorials/nightreign-data-tools-dev/blob/main/downloads/reliquary/queries/reliquary.sql). Contains weights, relic type, roll order, compat IDs, curse flags, categories, descriptions.
- Chalice definitions (color triplets per character): [Data/chalicedata.json](https://github.com/ParaphrazeTutorials/nightreign-data-tools-dev/blob/main/Data/chalicedata.json); used to color-group chalice combos and set side accents.
- Stat contributions per effect: [Data/effectstats.json](https://github.com/ParaphrazeTutorials/nightreign-data-tools-dev/blob/main/Data/effectstats.json); rows keyed by EffectID with MetricGroup/MetricType/Value/Unit and ConditionRequired.
- Assets: icons/renders/portraits in Assets/; resolved via reliquary.assets.js and palette.js.

## Key Entities & Fields (with narrative)
- `EffectID`: unique identifier for an effect or curse. Example: 7036100 = “HP Recovery From Successful Guarding”.
- `CompatibilityID`: mutual-exclusion group. Two rows with the same `CompatibilityID` cannot coexist on a valid relic (unless “show illegal” is active). Example: if effects A and B both have `CompatibilityID=900`, you may pick only one of them.
- `RelicType`: `Standard`, `Depth Of Night`, or `Both` (derived in SQL). Selecting a Standard-only effect forces relic type Standard when type was unset.
- `RollOrder`: enforced ascending order of effects on the relic. Calculated in SQL (ROW_NUMBER over RawRollOrder). UI flags and can auto-sort. Example: EffectIDs with RollOrder 10, 30, 50 must appear as slots 1, 2, 3 respectively; picking 50 before 10 is invalid until auto-sorted.
- `ChanceWeight_*`: per-slot weights. Standard uses 110 (small or slot3 of large), 210 (slot2 of large or slot1 of medium), 310 (slot1 of large). Depth uses 2000000 (Depth effect that requires a curse), 2200000 (Depth effect without a curse), 3000000 (curses). Zero weight means impossible to roll in that slot.
- `CurseRequired`: `1` if the effect must be paired with a curse (Depth only). Example: a Depth effect with `CurseRequired=1` cannot be valid unless a curse is selected in that slot.
- `Curse`: `1` if the row itself is a curse (rolls from 3000000 column only; Depth side).
- `Characters`: CSV; empty or “ALL” means no restriction. Used to filter eligible effects/curses when a class is selected.
- Stat rows: `MetricGroup` (Attributes, Attack, Negation, Other), `MetricType`, `Value`, `Unit` (`pct` multiplies, `flat` adds), `ConditionRequired` (1 = user-toggleable). Example: EffectID 7044400 adds +12% Attack to “Bestial Incantation” (pct multiplier), unconditional.

## Selection Rules (Reliquary picker)
- Type filter: dropdown sets Standard/Depth/All; if unset/All, selecting a Standard-only or Depth-only effect auto-sets the relic type when compatible. Illegal mode bypasses type filtering but still marks conflicts.
- Class filter: filters pools by `Characters`. Empty/ALL leaves all classes eligible.
- Eligibility flow: take type/class-filtered pool → drop already taken EffectIDs → drop rows sharing a blocked `CompatibilityID` → optionally show illegal to bypass blocking.
- Compatibility: no two effects (or curses) with the same `CompatibilityID` on a valid relic.
- Order: effects must appear in ascending `RollOrder`; auto-sort proposes a valid ordering when possible.
- Position rule: fill slots from 1 → 2 → 3; gaps before filled slots are invalid.
- Curse pairing: if `CurseRequired=1`, a curse must be picked in that slot (Depth only). Missing curse invalidates the build.
- Relic type mismatch: Standard-only and Depth-only effects together invalidate the build (unless illegal mode).

### Example — Validity and ordering
- Pick Effect A (RollOrder 12, Standard), Effect B (RollOrder 30, Standard). Type auto-sets to Standard; ordering is valid (12 then 30).
- If you add Effect C (RollOrder 5, Standard), the UI flags roll-order issue; auto-sort rearranges to C (5), A (12), B (30).

### Example — Compatibility blocking
- Effect X and Effect Y both have `CompatibilityID=700`. After picking X in slot 1, Y is removed from eligible pools for slots 2/3. If “show illegal” is toggled, Y can be picked but the relic is marked invalid.

## Probability Model (with concrete numbers)

### Standard relics
- Slots and weights: Large uses slot1=310, slot2=210, slot3=110. Medium uses slot1=210, slot2=110. Small uses slot1=110.
- Process: enumerate permutations of the selected effects, multiply (weight of picked effect in that slot) / (sum of weights of remaining eligible effects for that slot), removing the picked effect and its compat group each step, then sum over permutations.
- Numeric example (Large relic, 3 effects):
	- Suppose pool has only these three Standard effects and no shared compat: E1 weight310=60, weight210=40, weight110=20; E2 weights 30/50/40; E3 weights 10/30/60. Totals per slot initially: slot1 total=60+30+10=100; slot2 total=40+50+30=120; slot3 total=20+40+60=120.
	- Permutation E1→E2→E3: P = (60/100) * (50/ (120-compat of E1)) * (60/ (120-compat of E1,E2)). With no compat sharing, slot2 total stays 120, slot3 total stays 120, so P = 0.6 * (50/120) * (60/120) ≈ 0.6 * 0.4167 * 0.5 ≈ 0.125.
	- Compute all 6 permutations similarly and sum. That sum is the overall probability shown. The UI then displays percent with 10 decimals and “1 in N”.

### Depth of Night relics
- Size → effect slots: Small = [2000000]; Medium = [2000000, 2000000]; Large = [2000000, 2000000, 2200000]. Effects with `CurseRequired=1` must sit in a 2000000 slot. Curses roll separately from 3000000.
- Priors for curse count on Large (`LARGE_CURSE_PRIORS`): 0 curses=0.4, 1=0.3, 2=0.2, 3=0.1. This prior multiplies the joint effect+curse probability.
- Process: generate assignments of required effects into the available slots that have nonzero weights, honoring curse-required placement; compute probability per assignment with compat blocking; separately compute curse permutation probabilities with compat blocking; multiply and sum; apply curse-count prior for Large.
- Numeric example (Depth Large, 2 effects + 1 curse):
	- Effect A (no curse needed) weights: 2000000=80, 2200000=60. Effect B (curse required) weights: 2000000=50, 2200000=0. Curse C weight3000000=40.
	- Effect slots: [2000000, 2000000, 2200000]. Valid assignments: B must occupy a 2000000 slot; A can go 2000000 or 2200000.
		* Assignment 1: slot1=B(50), slot2=A(80), slot3 empty(60 for A). Totals per column (example): col2000000 total= (B50 + A80 + others); col2200000 total= (A60 + others). Assume totals: col2000000=200, col2200000=120. Effect probability = (50/200) * (80/ (200-compatB)) * (60/120) ≈ 0.25 * 0.4 * 0.5 = 0.05.
		* Assignment 2: slot1=A(80), slot2=B(50), slot3 empty(60 for A). Prob = (80/200) * (50/ (200-compatA)) * (60/120) ≈ 0.4 * 0.25 * 0.5 = 0.05.
	- Curse probability: one curse slot (3000000 column). Suppose total weight3000000 = 100. P_curse = 40/100 = 0.4.
	- Joint per assignment ≈ 0.05 * 0.4 = 0.02. Sum assignments = 0.04. Apply Large prior for 1 curse (0.3) → final ≈ 0.04 * 0.3 = 0.012 (1.2%). UI shows percent and “1 in 83”.
- Impossibility reasons surfaced in tooltips: missing required curse, zero weights for needed slots, compat clashes, or type mismatch.

## Chalice Builder Rules (with examples)
- Two sides: Standard side only accepts Standard/Both effects; Depth side only Depth/Both. Each side has 9 slots.
- Per-side reuse: an EffectID can appear up to 3 times on that side. If `SelfStacking=0`, reuse beyond 1 is blocked. Example: if an effect with SelfStacking=0 is in Standard Slot S1, attempting to duplicate it to S2 will be disabled.
- Compatibility: no shared `CompatibilityID` within a side (effects and curses both participate). Example: placing Effect X (CID 800) on Depth Slot D1 removes any other CID 800 entries from eligibility for D2–D9.
- Class filter: selecting a class prunes both effects and curses to those whose `Characters` list matches or is ALL/empty. Changing class auto-prunes incompatible selections.
- Depth curses: enforced only when the paired effect has `CurseRequired=1`. The “Curse Required” badge shows until a curse is picked for that slot.
- Grouping: builder searches for valid 3-effect combos per side (type/class/compat/order/curse satisfied). It wraps grouped slots with a colored outline (colors derived from chalice color list). Unused/invalid picks are reported with reasons (e.g., missing curse, incompatibility, type mismatch).
- Colors: chalice color dots come from chalicedata.json (standard1-3, depth1-3). These colors set side accents and grouping hues; missing entries fall back to white.

### Example — Standard side reuse and compat
- If Standard slots have E1 (CID 100), E2 (CID 101), adding E1 again is allowed up to 3 total if `SelfStacking` is not 0. If E3 also has CID 100, it is blocked once E1 is present.

### Example — Depth side with curse requirement
- Depth Slot D1: Effect B with `CurseRequired=1` selected; the slot shows “Curse Required”. User picks Curse C (CID 900). If another curse with CID 900 is attempted in D2, it is blocked by compat.

## Stat Overview (Chalice view, with numbers)
- Totals are computed across all selected chalice effects (Standard + Depth).
- For each effect, gather `effectstats` rows:
	- If `Unit=pct`: convert to multiplier = 1 + Value/100, multiply into the running product for that MetricGroup/MetricType.
	- If `Unit=flat`: add Value to running flat total.
	- If `ConditionRequired=1`: include only when user toggle for that EffectID is on.
- After aggregation, percentChange = (multiplier - 1) * 100 for pct metrics; flat stays as-is.
- Display: Attributes grid, Attack grid (with altTypes, e.g., Holy/Dark), Negation grid, and “Other” list for remaining metrics. Near-zero values show “-”.

### Numeric example
- Suppose two selected effects contribute to “Attack:Fire”:
	- Effect X: +12% Fire (pct) → multiplier 1.12
	- Effect Y: +8% Fire (pct) → multiplier 1.08
	- Combined multiplier = 1.12 * 1.08 = 1.2096 → percentChange ≈ +20.96% (shown as +20.96%).
- For a flat stat: “Attributes:Strength” with +5 and +3 from two effects → flat total +8; if no pct applies, display “+8”.
- If a conditional row (ConditionRequired=1) is toggled off, its contribution is omitted from totals and the extras list shows the toggle.

## UI Behaviors
- Menus: effect/curse menus offer category list, search, selected badge, and “Curse Required” badge for Depth-required effects. Category pills are themed via palette/theme helpers.
- Color chip: “Random” draws from palette COLORS; relic image path is driven by relic type, color, and stage (slot count filled).
- Validation: header badge flips Valid/Invalid; row badges mark incompatibility or relic-type mismatch; move indicators show needed roll-order shifts; curse-required alerts show until satisfied.

## Lexicon (Data Table)
- Modules: only Reliquary is active; others are placeholders. Loads reliquary.json directly.
- Columns: inferred, then reordered to prioritize EffectID/Description/Category/RelicType/weights. Types inferred for stable sorting.
- Interactions: per-column stable sort, per-column floating filter (opens near header), global search across all columns, zoom controls (S/M/L).
- Rendering: categories show as colored pills (theme-driven).
- Export: current view to CSV. Downloads modal fetches manifest from downloads/reliquary/manifest.json.
- Column info modal: uses COLUMN_DEFINITIONS in lexicon.js to describe fields.

## Data Pipeline / Update Checklist
- Regenerate reliquary.json: run [downloads/reliquary/queries/reliquary.sql](https://github.com/ParaphrazeTutorials/nightreign-data-tools-dev/blob/main/downloads/reliquary/queries/reliquary.sql) over source tables (AttachEffectParam, AttachEffectTableParam, Compatibility, AttachEffectName). Derive RelicType, RollOrder (ROW_NUMBER), CurseRequired, Curse, and weights with DLC override rule (255 sentinel uses base weight).
- Regenerate chalicedata.json: update per-character color triplets (standard/depth). Sorting per character is optional but current file is grouped.
- Regenerate effectstats.json: refresh MetricGroup/Type/Value/Unit/ConditionRequired per EffectID; keep AllowedCharacters aligned with Characters.
- No build step: files are fetched at runtime with `cache: "no-store"` to avoid stale data.

## Glossary (quick refs)
- Effect: non-curse row in reliquary.json.
- Curse: row with `Curse=1`; rolls via ChanceWeight_3000000 on Depth.
- Compatibility Group: rows sharing `CompatibilityID`; only one may appear in a valid relic/side.
- Relic Type: `Standard` (110/210/310), `Depth Of Night` (2000000/2200000), `Both` supports either.
- Roll Order: ascending requirement for validity; auto-sort helps fix order.
- ChanceWeight columns: per-slot roll weights; zero/absent makes that roll impossible.
- SelfStacking: 1 yes, 0 no, 2 unknown; affects chalice reuse.
- Show Illegal: exploration mode that allows blocked combos but marks build invalid.

## Known Notes / TODOs (from data/comments)
- Some `EffectExtendedDescription` fields contain TODOs for verification (damage, timing). Treat as provisional until tested.
- No external API/build infra; all logic is client-side JS + static JSON.
