# FabriQ — full handover (read this first)

Written by Claude Code on 2026-11-11. This document lets another agent (for
example Antigravity) continue FabriQ when Claude Code is out of usage. Keep it
true: **whoever changes the app updates this file in the same commit.**

---

## 1. The product in one minute

FabriQ is a phone web app for Indian aluminium fabricators:

- **Input:** window / door / partition sizes.
- **Output:** a material list (pipes to buy per stock length, glass, hardware)
  and a cutting sheet.
- **Accuracy is the whole product.** A wrong number wastes the fabricator's
  aluminium.

**Founder:** a fabricator himself. He writes in Hinglish (often in capitals).

**How to work with the founder:**
- **Talk to him** in simple Hinglish, short sentences.
- **Never show him code.** Explain what changed and what he can now do.
- **App text** must be simple professional English with short sentences.
  - No Hinglish in the UI.
  - Never write "owner" wording ("ask the owner", "only the owner…").
  - No prices, rates or money anywhere in the app.
- **Fabrication:** reason from geometry yourself (roller → shutter → glass).
  Ask him only for real measurements.

---

## 2. What is live today (2026-11-11)

| Where | What | Notes |
|---|---|---|
| **Production** `app-six-lilac-20.vercel.app` | branch `main` @ `92899a4` | What every customer sees. **No System Studio yet.** |
| **Private preview** `app-3pa0k75gn-indian-steels.vercel.app` | branch `claude/system-studio` | Only people logged in to the "Indian steels" Vercel team can open it. Founder is checking it now. Every push to this branch updates it (`.github/workflows/preview.yml`). |
| `claude/golden-tests` | older work | Fully contained in `claude/system-studio`. Ignore it. |

`claude/system-studio` is ahead of `main`:
- golden tests,
- engine fixes (Domal 2051 / interlock, 90° frames, glass rule, equal share),
- the whole System Studio,
- verified section templates for Sleek 29mm, 37mm, Banu Hashim 31mm & 35mm (Top/Bottom rails, Handle stiles, Slim interlocks, T-spines),
- photorealistic architectural 3D corner cutaway viewer (Reynaers / Crystal Windows style with DGU glass, gaskets, and stainless steel rails),
- section names and photo/CAD drawing overhaul across "New system" and Studio (real cropped photos from /public/sections/, 24 Banu Hashim dies traced from catalogue, full-bleed 2.5× larger RealSection vector rendering, and multi-chamber architectural guide sketches).

**Nothing goes to production until the founder writes clearly that it should go
live for everyone** (e.g. "sabke liye live karo"). See §9.

---

## 3. Repository map (`E:\alu-tool\app`, Next.js 16, React 19, Tailwind 4)

**Read `AGENTS.md` before touching Next.js code.** This Next version has breaking
changes; its docs are in `node_modules/next/dist/docs/`.

| Path | What it is |
|---|---|
| `app/page.tsx` (~2,650 lines) | The whole main app: job screen, add-window flow, results, settings. CRLF line endings. |
| `app/studio/page.tsx` | System Studio: My systems, New system, My sections. |
| `lib/engine/` | **The built-in engine.** `estimator.ts` (all systems, `estimate()`), `cutting.ts` (bar packing), `sections.ts` (section master), `units.ts` (µm, sut, parsing), `questions.ts`, `quick-item.ts` (`buildJobItem`), `sheet-seed.ts`, `review.ts`, `knowledge.ts`. |
| `lib/studio/` | **System Studio engine.** See §5. |
| `components/` | `diagrams.tsx` (job pictures), `eng-sheet.tsx` (engineering sheet), `studio-*.tsx` + `components/studio/*` (Studio UI), `section-sketch.tsx`, `studio-3d.tsx` (three.js). |
| `lib/ai/` | AI providers for reading sheet photos (gateway, gemini, openrouter, nvidia). Needs keys from Vercel env. |
| `scripts/trace-sections.ts` + `scripts/sections/*.json` | Catalogue section tracer (§6). |
| `evals/` | All tests (§7). |
| `docs/studio/` | Studio design, evidence register (every number's source), research audit. |
| `.github/workflows/` | `check.yml` (non-main branches: tsc + tests + lint), `preview.yml` (private preview), `deploy.yml` (production, on push to `main`). |

**Research outside the repo (`E:\alu-tool`):**
- `docs/16`–`19`: customer call, fabrication handbook, doc 18 + its review,
  knowledge map.
- `research/`: videos, catalogues, transcripts.
- `research/catalogue/new-series/`: the 15 catalogue PDFs.

---

## 4. Built-in engine — the rules that must not break

- **Units:** everything is integer **µm**. 1 sut = 1/8″ = **3175 µm**. Never
  round to mm inside the engine.
- **Systems:** `normal_2t`, `normal_3t`, `domal`, `door_single`, `partition`,
  `z_section`, and `studio` (a System Studio system, §5).

**Verified constants** (founder jobs). Do not change without the founder:

| What | Value | Basis |
|---|---|---|
| Normal shutter H | H − 41.3 mm | founder's 72×60 job |
| Normal track | W − 6 sut | 90° frame |
| Normal bearing | shutterW − 80 mm | |
| Normal glass | shutterW − 64.125, shutterH − 66.675 | videos |
| Domal shutter H | H − 66.7 mm | founder's 66×58 job |
| Domal glass | shutter − 102 mm (both ways) | |
| Domal frame | 2-track = 2051 (`domal_frame_2t`), 3-track = 2062 | |
| Domal interlock | 2 per *glass–glass* meeting | |
| Shutter width | W/2 | **"Equal share"** (Settings) is opt-in |
| Z-section | sight line 40, sash +10, glass −5/side, mullion takes 20 each side | |
| Door | clearance = profile inches − ½″ | |
| Partition | SP/DP 38.1 face, panel − 4 sut | door leaf −2 sut / −3 sut |

**Never invent a cutting number.**
- Catalogues print sizes and weights, **never** cutting rules.
- Doc 18's formulas (Gulf H−55/65/75, Domal (W+22)/2 and so on) were **made up**
  and are rejected.
- Every number needs a source in `docs/studio/FORMULA_EVIDENCE_REGISTER.md`.

**Stock lengths:** the default is 16′ bars with 8′ halves. Some sections ship
12′ (`barLengthFt`).

---

## 5. System Studio (`lib/studio/`) — how it works

The shop builds its own window system. Every system is **data**, not code.

**Files:**

| File | What it does |
|---|---|
| `model.ts` | The data model. `StudioSystem` = `profiles` + `sizes` + `parts` + `extras` + `switches` + `layouts`. **Sizes** are rules: `round((base·num + pre)/den) + add`, with cases chosen by `when` (tracks, glass count, switches). `add: null` = unknown → cutting is blocked. Every case carries `evidence` (verified / observed / suggested / unknown). **Parts** say which profile, how many, cut to which size, the angle (45/90), and the place in the drawing. **Scopes:** window, shutter, meeting (glass–glass), between (casement mullion). |
| `evaluate.ts` | Turns a system + job into pieces, panels, hardware and a trace. Throws `StudioUnknownError` when a size or section is missing. `perShutter` lets each shutter pick its own section (e.g. slim interlock small on one shutter, big on the next). |
| `teach.ts` | One real job sets each constant (the slope comes from geometry, never from fitting two jobs). `check()` compares with a second job (½ sut tolerance, never averaged). A learned rule is scoped to the track count plus the switches it uses. |
| `templates.ts` | All drafts — see below. `BUILT_IN_PROFILES` is the section library. |
| `geometry.ts` | Front-view geometry, to scale, from the same data. |
| `relief.ts` | Front-face shading from the real section shape. |
| `components/studio-3d.tsx` | Real sections extruded with mitres. |
| `shapes.ts` + `shapes/*.json` | Traced catalogue shapes by maker code. `shapeOf(profile)` also uses the shop's own traced or DXF shape (`profile.shape`). |
| `tracer.ts` | In-phone photo tracer. |
| `dxf.ts` | DXF section import. |
| `store.ts` | The shop's library in `localStorage` key `fabriq_studio_v1` (this phone only), plus export/import as a file. |
| `runtime.ts` | Registry used by the main app. `systemOfItem()` reads the frozen copy. |

**Templates in `templates.ts`:**

| Template | Status |
|---|---|
| `normal-18`, `domal-27` (OMEO) | verified; parity tests prove engine-exact |
| `z-40`, `z-55` casement | verified; z-parity |
| `normal-25`, `normal-5t`, `domal-35` | some rules from videos (observed) |
| `ample-22` (mini domal), `-25`, `-26`, `-27`, `-29`, `-37` | catalogue sections, cuts unknown |
| `eleanor-27` | catalogue sections, cuts unknown |
| `euro-26` (BH 6000/6001 + 2559 clip), `gulf-25` (BH 2550–2559), `bh-31`, `bh-35` | Euro and Gulf group; slim interlock small or big per shutter (one piece, never an extra spine); cuts unknown |
| `gulf-s30` (Alucoat), `mini-domal-20`, `gulf` | catalogue sections or structure only, cuts unknown |
| `blank-*` | blank starting points |

**Studio systems inside a real job:**
1. The add-window flow lists the shop's systems first (`studio:<id>`).
   Unfinished ones send the shop to My systems.
2. `buildJobItem` stores a **frozen JSON copy** in `item.meta.studio`, so
   editing a system never changes an old job.
3. `estimate()` builds the item through `studioResult()`. A layout that has
   not been taught is refused by name.

**UI:** the editor has the drawing / 3D on top, a piece or shutter panel, and
the tabs Pieces · Cutting list · Teach · Rules.

---

## 6. Catalogue section tracer

Run it with:

```
PDFTOPPM=<path to pdftoppm.exe> npx tsx scripts/trace-sections.ts scripts/sections/<file>.json
```

Poppler is at `C:\Users\umarm\AppData\Local\Microsoft\WinGet\Packages\oschwartz10612.Poppler_Microsoft.Winget.Source_8wekyb3d8bbwe\poppler-25.07.0\Library\bin\`.

**Manifest fields:**
- `catalogue`: a Windows path like `E:/...`, not `/e/...`.
- `out`: a `lib/studio/shapes/*.json` file.
- `maker`
- `style`
- `pages[].cells`: in reading order, with the printed `w`/`h`. Use `null` to
  skip a drawing.
- `key`: when one code is printed on two profiles.
- `skipTop`
- `scaleWhenOff: "max"`
- `grid` (for `black-grid`).

**Styles:**

| Style | Used for |
|---|---|
| `grid` | Ample: 2×3 cells, grey metal |
| `cad-red` | OMEO: red outlines / green fill, thin walls filled |
| `dark-fill` | Banu Hashim |
| `black-grid` | Alucoat: ruled table, opening removes dimension lines |
| `orange-fill` | Eleanor |

**Scale check:** the two printed sizes must agree within 4 %. If they do not,
the shape is flagged "check size" in the app.

**Always look at a preview after tracing.** Write a temporary SVG to `public/`,
then delete it. Register a new maker in `shapes.ts` under the same code key the
profiles use (`codes: { maker: "code" }`).

**Traced so far:**
- Ample: 22, 25, 26, 27 domal, 29, 37 (74 sections).
- OMEO: Bombay 18, domal and Z (23 sections).
- Banu Hashim: 31 mm, p.61.
- Alucoat: S-30, p.20.
- Eleanor: 27 domal, pp.36–37.

**Known catalogue facts:**
- Antigravity's `research/catalogue/new-series/INDEX.md` is wrong in places:
  32 mm is casement, and the Ample domal codes are wrong.
- Ample 22's code 41085 is printed on two profiles.

---

## 7. Tests (all must pass; `npm test` runs them in order)

| Test | What it guards |
|---|---|
| `evals/units/parse.ts` | Parsing sizes as typed. |
| `evals/engine/invariants.ts`, `options.ts`, `z-door-partition.ts`, `normal-fix-top.ts`, `z-middle-fix.ts` | Engine invariants and options. |
| `evals/engine/golden.ts` + `golden.json` | **Every question path's exact cut list** (622 paths) plus the founder's jobs. `--update` rewrites `golden.json` — only after the founder agrees the change is right, and say why in the commit. |
| `evals/studio/parity.ts` | Studio Normal 18 / Domal 27 = engine, exactly (352 cases). |
| `evals/studio/teach.ts` | Teach and check behaviour, template sanity. |
| `evals/studio/z-parity.ts` | Z 40 / 55 = engine (32 windows). |
| `evals/studio/tracer.ts` | The photo tracer. |
| `evals/studio/in-job.ts` | Studio systems through the real job path, and the frozen copy. |
| `evals/studio/dxf.ts` | DXF import. |
| `evals/studio/derive.ts` | Shutter height from the drawing = engine (Domal). |
| `evals/studio/assemble.ts` | Windows built from the drawings: clip seat, shutter clears, rule = drawing (Euro, Gulf, Ample, Eleanor 29, Euro 27 on both tracks, 35 mm). |
| `evals/studio/full-window.ts` | 17 systems × 4 sizes: frames, shutters, meeting pieces, clips, glass. |
| `evals/studio/recognize.ts` | 21 known sections recognised by shape. |

`evals/sheets/run.ts` (`npm run eval:sheets`) is the AI sheet-reading eval. It
needs API keys. Run it before changing AI prompts or seeding.

**On this laptop:** tests take minutes and the laptop has about 1 GB free RAM.
Prefer letting GitHub run them (`check.yml` runs on every non-main branch push).

---

## 8. Laptop and tool quirks

- **Windows.** Many files have **CRLF** line endings (`app/page.tsx`,
  `lib/engine/*`). Exact-text edits must handle `\r\n`.
- **Dev server:** `.claude/launch.json` "fabriq" → `npm run dev` on port **3002**.
  Never `npm run build` while it runs (it corrupts `.next`).
- **Vercel:** this machine cannot reach `api.vercel.com` reliably. Deploy only
  through GitHub Actions, never the local `vercel` CLI.
- **GitHub:** there is no `gh` CLI. Use the REST API with the token from
  `git credential fill` (never print it).
- **Preview link:** after a push to `claude/system-studio`, open the "Private
  preview" run's summary on GitHub. Each run prints `Preview: https://…`.

---

## 9. Releasing to everyone (only on the founder's clear words)

1. All checks are green on `claude/system-studio`, and the founder has checked
   the private preview.
2. `git checkout main && git pull --ff-only origin main && git merge --ff-only claude/system-studio`.
   If fast-forward fails, stop and ask.
3. `git push origin main`. `deploy.yml` runs the tests and deploys to production.
4. Check `https://app-six-lilac-20.vercel.app/studio` loads. Tell the founder.

---

**Cuts from the drawing** (`lib/studio/derive.ts`): systems marked `heightFrom: domal-legs` get a Rules-tab card — shutter height = H − 2 × frame height + roller (24 mm, every roller). It shows "Same cut" against the real rule and fills only unknown heights (never a verified one). Proven on OMEO Domal (0.1 / 0.7 mm).

**Windows built from the drawings** (`lib/studio/assemble.ts`, `scripts/assemble-window.ts`, test `evals/studio/assemble.ts`): sections become solids; clip, roller and shutter are slid into place by bisection. Gives Euro 26 H − 69.9 / 69.8, Gulf 25 H − 39.6, Gulf 35 H − 42.4, Ample 25 H − 58.4, mini domal 22 H − 46.0, BH Domal 27 H − 73.7 (suggested in the templates). Normal 18 (13 mm bearing roller, `buildBombay`) gives H − 40.3 vs engine H − 41.3 ✓. Clips seat on their head / wings (legs are springs). Track "legs" outside the running track are design only. Full list, maker differences and what is not done: docs/studio/FORMULA_EVIDENCE_REGISTER.md. Gulf = Euro with one-groove left/right tracks (founder; drawings agree).

**2026-11-13 — what shops see (all on `claude/system-studio`, private preview):**
- **New system** picker: type chips (Domal / Euro / Gulf / Normal / Casement), size chips, "Most used" (25 Euro & Gulf, 27 Euro & Domal, 29 Euro, 30 Gulf, 31 Gulf, 35 Domal / Euro / Gulf — founder), each card with its type, size and "Checked on real jobs". Names are "Euro 29 mm — Ample" style (`SERIES` in templates.ts).
- **Meeting side choice** (`withMeetChoice`): slim interlock (small or big, shutter by shutter) or the shutter itself + interlock clip. The piece is called "Meeting Side" for both. Glass width follows the choice.
- **Units**: feet (ft.in.sut, 4.6.2 = 4′ 6″ 2 sut), inch, mm. Add / take-off numbers are typed in inches in feet mode.
- **Cut like your shop**: type window 1 (teaches), window 2 (checks); a failed check can "Learn from this one".
- **Section recognition** in My sections → Add a section: a DXF or photo is read in a Web Worker (`lib/studio/recognize.worker.ts`) and the form says "Looks like a … shutter" and sets "What is it". Checked with the Ample 41050 jali DXF → Mesh shutter.
- **Euro 27** has a "29 track" switch (Ample / BH 47.7 or Eleanor 48.0); **Euro 29 — Eleanor** is its own system. The Pieces list now picks each piece's section with the same matching as the cut list (tracks and every switch) — before, it looked only at the track count.
- `scripts/audit-studio.ts` runs every system, layout and mix at 4 sizes and lists problems. Known and accepted: Ample 25 / 37 interlock clip has no section yet (shop chooses), Domal 35 4- / 5-track frame section, BH 6405 / 6502 / 6048 / 2118 untraced.

**2026-11-13 (later) — founder decisions now in the app:**
- **Pipes to buy = full pipes + one piece.** No half (8 ft) bars any more. Each section has ONE pipe length (the shop picks it in the section form; 16 ft by default). After the full pipes, the least-used bar is bought as one piece cut to the whole feet it needs: "4 × 16' + 6' piece". Glazing clip stays whole 12 ft bars (`sellsPiece: false`). Engine: `lib/engine/cutting.ts` (`buying`, `stockGroups`); `SectionSummary.stock` / `boughtFt`; `bars16` = full pipes, `bars8` = pieces. golden.json was updated for this (only the "buy" lines changed; every cut length is the same).
- **Interlock clip is cut to the shutter height** whatever its code (founder). Systems with no clip section use the generic "Interlock Clip" piece (`ANY_CLIP`), so the cut is never blocked.
- **Euro 29 — Eleanor shutter switch:** 2903 or 2906 (single glass), 2909 (double glass), all four sides, own glass size (`withShutterChoice`).
- **Recogniser knows interlock clips** (thin, one straight wall, the other side open, 24–46 mm): 41054, 2918, 2725, 2726, BH-6711, BH-6054, AT-30007.
- Dropped by the founder: Z 50 mm, Normal 25.

**2026-11-13 (evening) — every system inside Window, no company names (founder):**
- Window asks: kind (Normal / Domal / Euro / Gulf / Casement, plus "My own" when the shop has extra systems) → size in mm → tracks → shutters → sizes. `WINDOW_SYSTEMS` in templates.ts is the list (one system per kind and size). Normal 18, Domal 27 and Z run on the checked engine until the shop changes them; every other size runs the Studio built-in directly (`studioSystem()` falls back to TEMPLATES) — no copy is needed to use it.
- Settings → **Window systems** (/studio) lists every window by kind. Tapping a built-in makes the shop's copy; Window then uses that copy (`systemForWindow`, newest wins). "My systems" button removed from the header.
- No company names on screen: template names are kind + size; other makers' versions (Ample/Eleanor/BH Domal 27, Eleanor 29, Ample 26, Gulf any) are kept in code, not offered (`OFFERED`). Old saved copies drop the " — Maker" part on load. Descriptions and rule sources pass through `noMaker()`.
- 37 mm taken out of the app (founder, 2026-11-14): Ample 37 stays in code, not offered.
- Slim interlock never adds an interlock clip (checked on every system). With "slim", the meeting side is the slim: Ample 29 → 41289; Ample 25 / 37 and Eleanor 29 ask for the slim section and do not guess its glass width.

## 10. Backlog (highest value first)

1. **Founder's review of the private preview.** Fix whatever he reports.
2. **Founder questions** (ask in simple Hinglish):
   - Gulf: does the side run full height, or the bottom track full width?
   - 4-track Normal: which section? It is built on the 2-track today.
   - Is 2081 the mesh shutter?
   - Roller height photo.
   - A real DXF from his extruder, to test DXF import.
3. Teach the drafts from his real windows. He enters one window, then checks
   with a second.
4. Stock lengths per profile in the optimiser: the Studio stores
   `stockFt[]`, but packing still uses only the first length.
5. More catalogue pages: Eleanor 21–26 / 32, the Banu Hashim series,
   the Ample 30 / 32 / 40 / 50 casement pages.
6. Studio: fixed-top band (the engine has it, the Studio does not), openable
   doors and partitions in the Studio, glass bead / rubber in 3D.
7. Login and cloud sync (Supabase), sharing systems from extruders.

---

## 11. Where to log work

Write every working session in **`docs/SOLO-LOG.md`** (date, branch,
commits, what changed, what is unsure).

Claude Code reads it on return and reviews those commits first.
