# Project Guide — Nightreign Data Tools

The canonical reference for how the Round Table Codex works: data sources, selection rules, probability models, chalice logic, and project workflow. Keep this in sync with the live logic in Reliquary and Chalice Builder.

## Product overview
- Reliquary: build/validate relics, show compatibility, ordering, and roll odds for Standard and Depth.
- Chalice Builder: plan 18-slot loadouts (9 Standard, 9 Depth) with grouping, compatibility, and curse enforcement.
- Lexicon: explore, filter, and export the live reliquary dataset.

## Data sources (authoritative)
- Effects + curses: Data/reliquary.json (generated from downloads/reliquary/queries/reliquary.sql). Fields include weights, relic type, roll order, compatibility IDs, curse flags, categories, and descriptions.
- Chalice definitions: Data/chalicedata.json (per-character color triplets for Standard/Depth accenting and grouping).
- Stat contributions: Data/effectstats.json (MetricGroup/MetricType/Value/Unit/ConditionRequired keyed by EffectID).
- Assets: icons/renders/portraits in Assets/ resolved by reliquary.assets.js and palette.js.

## Key entities and fields
- EffectID: unique effect or curse identifier (e.g., 7036100 = HP Recovery From Successful Guarding).
- CompatibilityID: mutual-exclusion group; any shared ID is illegal together unless “show illegal” is enabled for exploration.
- RelicType: Standard | Depth Of Night | Both. A Standard-only or Depth-only pick auto-sets type when unset.
- RollOrder: required ascending order of effects on a relic; auto-sort can fix order when possible.
- ChanceWeight columns:
	- Standard: 110 (slot3/only), 210 (slot2/med, slot1/med-large), 310 (slot1/large).
	- Depth effects: 2000000 (Depth effect requiring a curse), 2200000 (Depth effect not requiring a curse).
	- Depth curses: 3000000.
- CurseRequired: 1 if the effect must be paired with a curse (Depth only).
- Curse: 1 if the row itself is a curse (rolls from 3000000 column only).
- Characters: CSV; empty/ALL means no class restriction.
- SelfStacking: current logic does not allow duplicate EffectIDs on a side; SelfStacking metadata is informational for now.

## Reliquary selection rules
- Type filter: dropdown sets Standard/Depth/All; if unset/All, selecting a Standard-only or Depth-only effect auto-sets the relic type. Illegal mode bypasses type filtering but still marks conflicts.
- Class filter: filters pools by Characters when set.
- Eligibility: start from type/class-filtered pool → drop already taken EffectIDs → drop rows sharing a blocked CompatibilityID unless “show illegal” is on.
- Compatibility: no two effects (or curses) with the same CompatibilityID on a valid relic.
- Order: effects must be in ascending RollOrder; auto-sort proposes a valid ordering when possible.
- Position: fill slots 1→2→3; gaps before filled slots are invalid.
- Curse pairing: if CurseRequired=1, a curse must be selected in that slot (Depth only). Missing curses make the build invalid.
- Type mismatch: Standard-only and Depth-only effects together are invalid (unless illegal mode is active).

### Standard probability model
- Weights by size: Large slots use [310, 210, 110]; Medium [210, 110]; Small [110].
- Process: enumerate permutations of the selected effects; for each slot, probability = (picked weight / sum of eligible weights for that slot), removing the picked effect and its compat group as you advance; sum over permutations.
- Example (Large, 3 effects, no shared compat):
	- E1 weights 60/40/20; E2 weights 30/50/40; E3 weights 10/30/60 for slots 1/2/3.
	- Slot totals initially: 100 / 120 / 120.
	- Permutation E1→E2→E3: (60/100) * (50/120) * (60/120) ≈ 0.125. Compute all 6 permutations and sum; UI shows percent (10 decimals) and “1 in N”.

### Depth probability model
- Slots by size: Small [2000000]; Medium [2000000, 2000000]; Large [2000000, 2000000, 2200000]. CurseRequired effects must sit in a 2000000 slot. Curses roll on 3000000.
- Curse-count priors for Large: 0=0.4, 1=0.3, 2=0.2, 3=0.1 (multiplies joint probability).
- Process: build effect assignments into valid slots (respecting nonzero weights and curse-required placement); compute probabilities with compat blocking; compute curse permutations separately; multiply, then apply curse-count prior (Large only).
- Example (Large, 2 effects + 1 required curse):
	- Effect A (no curse needed): weights 2000000=80, 2200000=60. Effect B (curse required): weights 2000000=50, 2200000=0. Curse C: weight3000000=40.
	- Valid assignments place B in a 2000000 slot and A in the remaining 2000000 or 2200000 slot; each assignment multiplies per-slot weights over remaining unblocked weights. Curses roll separately on 3000000 and are blocked by compat as well. Final probability multiplies effect path, curse path, and the 1-curse prior (0.3).

## Chalice Builder rules
- Two sides: Standard accepts Standard/Both effects; Depth accepts Depth/Both.
- No duplicates per side: the builder disallows duplicate EffectIDs on the same side. Compatibility IDs must also be unique per side.
- Curse enforcement: Depth slots that pick a CurseRequired effect must also pick a curse; missing curses make that trio invalid.
- Class filter: applies to both effects and curses; changing class prunes incompatible selections.
- Grouping: builder searches for valid 3-effect combos per side (type/class/compat/order/curse satisfied). Valid trios are grouped and colored from chalicedata.json. Unused/invalid picks show reasons (e.g., missing curse, incompatibility, type mismatch).
- Colors: chalice color dots come from chalicedata.json (standard1-3, depth1-3). Missing entries fall back to white.

## Stat aggregation (Chalice view)
- For each selected effect, gather effectstats rows. If Unit=pct, multiply into a running multiplier; if Unit=flat, add. ConditionRequired rows only count when toggled on. Stackable rows multiply by the selected stack count.
- PercentChange = (multiplier - 1) * 100 for pct metrics; flats stay additive. UI renders Attributes, Attack, Negation, and Other lists with +/- formatting.

## Data pipeline / regeneration
- Regenerate reliquary.json: run downloads/reliquary/queries/reliquary.sql over source tables (AttachEffectParam, AttachEffectTableParam, Compatibility, AttachEffectName). Derive RelicType, RollOrder, CurseRequired, Curse, weights (DLC 255 sentinel uses base weight), and compat.
- Regenerate chalicedata.json: update per-character color triplets (standard/depth) used for grouping and accents.
- Regenerate effectstats.json: refresh MetricGroup/Type/Value/Unit/ConditionRequired per EffectID; keep AllowedCharacters aligned with Characters.
- Files are fetched at runtime with cache: "no-store" to avoid stale data.

## Project workflow (issues)
- Board: https://github.com/users/ParaphrazeTutorials/projects/1
- Statuses: Backlog → Ready → In Progress → In Review → Done; Blocked for dependencies/risks.
- Required fields: Type (Feature|Bug|Feedback), Priority (P0–P3), Area (UI|Data|Infra|Docs), Size (S|M|L), Status.
- Labels mirror the required fields; Blocked also uses status:blocked.
- Intake: .github/ISSUE_TEMPLATE/bug_feedback.yml and feature_request.yml.

## Development and testing
- Install: npm install
- Build CSS + bundle: npm run build
- Unit tests: npm test (Vitest)
- Optional Playwright smoke: set PLAYWRIGHT_BASE_URL to a served Reliquary URL, then npm run test:e2e
- Local run: serve repo root with a static server (e.g., npx serve .) and open index.html (Pages-compatible).

## Glossary
- Effect: non-curse row in reliquary.json.
- Curse: row with Curse=1; rolls via ChanceWeight_3000000 on Depth.
- Compatibility Group: rows sharing CompatibilityID; only one per relic/side.
- Relic Type: Standard (110/210/310), Depth Of Night (2000000/2200000), Both supports either.
- Roll Order: ascending requirement for validity; auto-sort can fix ordering.
- ChanceWeight columns: per-slot roll weights; zero/absent makes that roll impossible.
- Show Illegal: exploration mode that permits blocked combos but marks builds invalid.
