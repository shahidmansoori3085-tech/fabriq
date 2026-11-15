# How a window is made — knowledge for every agent working on FabriQ

Read this before you touch a system, a section, a cut rule or a drawing.
It explains how an aluminium window is built in an Indian shop and why
each cut is the length it is. The founder is an expert fabricator; he expects
you to think like one.

- **This file** = the ideas (what each piece is, how the systems work, how a
  number is worked out). Written by hand.
- **`docs/SYSTEMS-REFERENCE.md`** = every system in the app, its pieces,
  sections, rules, evidence and a worked 6′×4′ example. **Generated** from
  `lib/studio/templates.ts` — never edit it by hand; run
  `npx tsx scripts/systems-reference.ts` after you change a system.
- Deeper background: `E:\alu-tool\docs\17-fabrication-handbook.md` (how cuts
  derive from drawings) and `E:\alu-tool\docs\19-system-builder-knowledge-map.md`.

If this file and the code disagree, the code (`templates.ts`) is what the
app cuts — tell Claude / the founder instead of silently "fixing" either.

---

## 1. Words and units

| Word | Meaning |
|---|---|
| W, H | The window's outside width and height (the opening the customer gives). |
| Sut | 1/8 inch = 3.175 mm. Shops say "6 sut" = ¾″ = 19.05 mm. |
| Inch / foot | 25.4 mm / 304.8 mm. Sizes like 6′×4′ = 1828.8 × 1219.2 mm. |
| µm | Inside the code every length is in micrometres (1 mm = 1000). |
| Section / profile | One aluminium extrusion shape, known by its catalogue code (1041, 2046, BH-6712…). |
| Pipe / bar | One full length of a section as bought (usually 16 ft). |
| Track / frame | The outer fixed part the shutters run in. |
| Shutter | One sliding panel: a frame of sections holding glass or jali. |
| Jali / mesh | Mosquito-net shutter (letter **J** in a layout; **G** = glass). |
| Roller | The wheel under the shutter. It runs on the track (or on a roller clip). |
| Roller clip / track rail | Small section snapped into the bottom track for the roller to run on (Euro / Gulf). |
| Handle (stile) | The upright of a shutter at the lock side. |
| Interlock | The upright where two shutters meet and hook into each other. |
| Bearing | In Normal (Bombay) windows: the top and bottom pieces of a shutter (the roller sits in the bottom one). |
| Interlock patti / interlock clip | A separate strip screwed onto the meeting uprights so the two shutters hook (Domal, Euro "clip" way). |
| Slim interlock | A narrow upright that *replaces* the shutter section on the meeting side. Glass goes into a slot on its face. Gives a thinner meeting line and wider glass. |
| Shutter top / bottom (shutter-rail) | Gulf systems: a different section for the shutter's top and bottom than for its sides. |
| Pocket | How far in from a shutter's outside edge the glass stops. Glass = shutter − pocket on one side − pocket on the other. |
| 90° / 45° | Cut angle. 90° = butt joint, screwed. 45° = mitre, corners cleated / crimped. |
| Sash | Openable (casement) shutter. |
| Mullion | Centre upright between two openable sashes. |
| Glazing clip / bead | Strip that holds the glass in an openable sash. |

## 2. Every window is a chain of sizes

Nothing is guessed piece by piece. Each size comes from the one before it:

```
W, H ─► frame pieces ─► shutter width & height ─► (bearing) ─► glass / jali size
```

- Change the roller and the shutter height changes by the same amount, and so
  does the glass height. Change the track and everything below it moves.
- So when one number is wrong, find which link of the chain is wrong; do not
  patch the last number.
- In the app each system's `sizes` list is this chain, worked top to bottom.
  Each rule is `base × num ÷ den + add` (e.g. `W ÷ 2`, `H − 41.3`,
  `shutterW − 64.1`). The first rule whose condition matches is used.

### How the shutter width is shared

- **Half each** (the usual way): every shutter is W ÷ 2. Two shutters overlap
  at the interlock, so together they are wider than the clear opening — that
  overlap is what seals the meeting line.
- **Equal share** (Normal 18, 3 or 4 glass): the opening is shared so the window
  opens more, e.g. 3 glass = (W − 7½″) ÷ 3 + 80 mm.
- 3- and 4-track Domal 35 and others have their own shop shares (see the reference).

### How the shutter height is found (sliding)

Shutter height = what is left between the top and bottom tracks, plus what
the roller lifts it, minus nothing else:

```
shutter H = H − (top track depth) − (bottom track depth) + (roller height) − (roller clip height, if any)
```

Written in the app as `H − 2 × track − clip + 24 roller` (rollers are 24 mm
unless the shop says otherwise). The shutter must still lift out at the top,
so it never runs to the very top of the U.

### How the glass size is found

Glass = shutter size − (pocket at one edge) − (pocket at the other edge).
The pocket is read off the section drawing: from the section's outside edge
to the bottom of its glass slot, minus the gap the glass needs (gasket/rubber).

- If both uprights are the same section, both pockets are equal.
- If the meeting upright is a slim interlock, its pocket is much smaller,
  so the glass is **wider** (e.g. Euro 29: shutter − 105.4 with clip, but
  shutter − 65.6 with the small slim interlock).
- The shutter section of a series goes on all 4 sides (Gulf too — founder), so the
  glass height uses the same pocket as the glass width (with a clip).

## 3. The families

### A. Normal / "Bombay" sliding (Normal 18 mm)

How it is built:
- Frame: top, two sides and bottom track, all **90°** (screwed). The top and
  bottom sit **between** the two sides, so they are W − 6 sut (19.1 mm); the
  sides run the full height H.
- Each shutter is **four separate sections**: a handle upright, an interlock
  upright, and two bearings (top and bottom) that fit between them.
- Handle and interlock run the full shutter height: H − 41.3 mm (founder's job).
- Bearings fit between handle and interlock: shutter width − 40 − 40 =
  shutter width − 80.
- Glass goes into the channels of all four, so it is a little bigger than the
  bearing: glass W = shutter − 64.1 (bearing + 5 sut), glass H = shutter H − 66.7.

Sections (1½″ × ¾″ = 40 × 18 set): 2-track 1000/1801 top-side, 1011/1821 bottom;
3-track 1021 / 1031; handle 1041; interlock 1081; bearing 1051.

**2½″ × ¾″ set (60 × 19)** — same tracks, wider shutter pieces. The founder's
rule: "it looks just like the ¾×1½ set, only 60 mm". So every shutter piece is
20 mm wider: bearing = shutter − 120, glass W = shutter − 104.1, glass H =
shutter H − 106.7. The interlock has its hook **in the middle** and screw ports
on **both sides**; the bearing is not the interlock. These numbers are
*suggested* until checked on one real window.

Taken out on purpose (founder): Normal 25 mm and the 5-track. They are still
known inside the code but not offered.

### B. Domal sliding (Domal 20, Mini domal 22, Domal 27, Domal 35)

How it is built:
- Frame: one track section goes round all four sides at **45°**, full W and full H.
- Shutter: **one shutter section on all four sides**, mitred at 45°.
  There is no separate handle or bearing section — "all glass shutters are alike,
  just sized differently (20/22/27/29/35…)".
- Where two shutters meet, an **interlock patti / clip** is screwed on each
  meeting upright (2 per meeting point) so they hook.
- Shutter height comes from the track's legs and the roller
  (`heightFrom: domal-legs`: H − 2 × frame height + roller).
- Glass = shutter − 2 × pocket on both width and height (same section all round).
  Domal 27 (OMEO 2046): shutter − 102 both ways — verified on the founder's job.

Specials:
- Domal 35 has 2-, 3-, 4- (3+1) and 5-track (4+1) layouts and two track depths
  (42.6 one leg / 48 two legs).
- Mini domal 22 has no clip; the roller runs straight on the pointed track.

### C. Euro sliding (Euro 25, 26, 27, 29, 35)

How it is built:
- Frame: a **U-groove track goes round all four sides at 45°**, like Domal.
- A **roller clip** (track rail) is snapped into the bottom U; the roller runs
  on it. It is cut to the clear width between the side tips: W − 2 × track depth.
- Shutter: one section on top, bottom and handle side, 45°.
- The meeting side is the shop's choice (`meet` switch):
  - **clip** — the same shutter section on the meeting side, plus an interlock
    clip on each meeting upright;
  - **slim** — the meeting upright is a slim interlock (small, big/reinforced,
    light or double-glass — `pick_shutterMeet`), chosen **shutter by shutter**
    (a real window can have a small slim on one shutter and a big one on the next).
- Shutter H = H − 2 × track + 24 roller − clip.
- Glass W changes with the meeting choice (see §2); glass H uses the top/bottom pocket.

Euro 27 runs on the 29 mm Euro track (two makers' tracks, `track` 47 / 48).
Euro 29's slims come from the 29 mm catalogue (2913 small, 2914 big,
2915 light, 2916 double glass). **41289 is an H-section, not a slim** — do not
use it as one.

### D. Gulf sliding (Gulf 25, 30, 31, 35)

How it is built:
- Frame: top and bottom tracks, and **separate one-groove side tracks**, all
  **90°**. Top and bottom fit **between** the sides: W − 2 × side depth.
  (If a shop runs them full width, that is a shop choice — set it to W.)
- Roller clip in the bottom track, like Euro.
- Shutter: **the series' own shutter on all 4 sides**, 45° — 2555 (25), 6406 (31),
  6510 (35). The catalogues also print "shutter top / bottom" sections (2554, 6404,
  6504) — **not used** (founder): 6404 is 29 mm and 6504 is 31.7 mm thick, so they
  are not even the right series. Always read the printed size on the drawing.
- Meeting side: slim interlock (small / big / double glass) or clip.
  **The Gulf catalogues have no interlock clip of their own** — the clip choice
  is left empty until the founder says which clip shops use. Do not guess one.
- Gulf 30 is different: same shutter all round, 90° frame screwed, interlock clip
  or double interlock. **No rail**: the roller runs on the Bottom Gulf's own U tops.
  The solid rail AT-30101 belongs to the low-threshold sill AT-30102.

### E. Openable / casement (Z 40, Z 55)

How it is built:
- Outer Z frame at 45°, full W × H.
- Sash (Z-pipe) at 45°. The sash **laps over** the frame, so it is *bigger*
  than the clear opening: sash = clear + 10 mm overlap.
  1 sash: W − 80 + 10; 2 sashes: (W − 80 − 40) ÷ 2 + 10 (40 = mullion), and so on.
  Sash height = H − 80 + 10.
- Mullion between sashes: H − 80 (between outer top and bottom).
- Glazing clips hold the glass: pocket = sash − 2 × 40; glass = pocket − 10.
- All verified on the founder's jobs.

### F. Jali (mesh) shutters

A **J** in the layout makes that shutter a jali shutter. Where the system has a
jali section (`meshProfile`, e.g. Domal 2081, Ample 41050 / 41085), the app
cuts that section instead of the glass shutter and gives a mesh size instead of
a glass size. Jali shutters (founder's full list): 2081, 41050, 41074, 41085, 41310.

## 4. Knowing a section by its shape

Wrong role = wrong glass size = wasted glass. The app's section reader does this
in two steps (Add a section → photo or DXF):

1. **Shape rules** (`lib/studio/recognize.ts`, test `evals/studio/recognize.ts`) —
   the signatures below.
2. **Compare with every known section** (`lib/studio/know.ts`, test
   `evals/studio/know.ts`). Every traced section the app's systems use is
   "known", with the systems and pieces it goes in. A new drawing is compared
   shape-to-shape (turned or mirrored too; dimension lines and numbers are
   ignored; every wall given the same weight so an outline and a filled photo
   match). Same shape + same size → "Same section as 2046", with what the piece
   does (`KIND_KNOWLEDGE`) and where it is used. When the rules cannot tell, the
   closest known shapes give the job. A photo works best cropped close to the
   section.

The signatures:

- **Glass shutter:** a deep roller channel (≥ 24 mm) at one end and a ~10 mm
  glass pocket at the other (2046, 41055, 41082).
- **Jali shutter:** the same deep channel, but **no glass pocket**.
- **Track:** two or more U grooves or legs standing up. A wide section with
  **one** groove is a Gulf side track (BH 2550 / 6400 / 6500, AT-30001).
  Outer legs are only for looks.
- **Slim interlock:** glass goes into a slot on its face (BH 6052, 6506, 6408, 2556).
- **Clip / rail:** small, ≤ 20 mm (BH 2559, 6513, 914401).
- **H-section:** channels on both sides (e.g. 41289) — a joiner, not an interlock.
- Not used in shops (founder): 914698, 914744, 992328.
- Catalogue drawings are **not always to scale**. Read the printed numbers
  (slot width, height), not the picture size (2729 and 2914 were both off).

## 5. Where a number may come from (never invent one)

Every rule carries its evidence. The order of trust:

1. **verified** — the founder's real job (his cut sizes on a real window).
2. **observed** — shop videos or what the founder said.
3. **suggested** — worked out from the catalogue drawings
   (`FROM_DRAWING(...)`, "Check on one window"). Fine to use, must say so.
4. **unknown** — `add: null`. The app refuses to cut. This is the honest
   answer when nobody knows. Ask the founder for one real measurement.

Rules that follow:
- Never type a deduction that has no source. Write the source in the rule and in
  `docs/studio/FORMULA_EVIDENCE_REGISTER.md`.
- Work out what geometry gives you (roller → shutter → glass) yourself; ask the
  founder only for real dimensions or shop habits.
- `evals/engine/golden.json` holds the live cut lists. It changes only with the
  founder's OK.
- `evals/studio/drawings.ts` builds every system from its section drawings and
  checks the app's glass and shutter sizes against them (every slim choice too).
  Run `npm test` before you push.

## 6. Buying pipes

For each section: full pipes of the chosen pipe length (default 16 ft) **plus one
piece cut to the whole feet still needed** — e.g. "4 × 16′ + 6′ piece". No half
bars. A piece longer than the pipe is an error, never split. Glazing clip = whole
12 ft bars. (`lib/engine/cutting.ts`)

## 7. Things the founder has already corrected — do not repeat

- 2½″ × ¾″: the bearing had been drawn as the interlock. The interlock hook sits
  in the middle, screw ports on both sides.
- Gulf has no catalogue interlock clip. Don't add one from another series.
- 41289 is an H-section, not the Euro 29 slim.
- Gulf 25 / 31 / 35: the shutter goes on all 4 sides; the catalogue top/bottom
  sections (2554, 6404, 6504) are not used. 6404 is 29 mm, 6504 is 31.7 mm — the
  printed size shows they are another series.
- Gulf 30: no solid rail (AT-30101 is for the low-threshold sill).
- Every N mm sliding system's shutter pieces must be N mm thick, every section's
  printed size must match its drawing, and every window must build from its
  drawings: `evals/studio/geometry.ts` checks all of it on every system.
- Normal 25 mm, the 5-track Normal and 37 mm are out of the app on purpose.
- My sections shows only sections the app's systems actually cut, each once.
- No company names and no bold sizes on section pictures; pictures must not be cut off.
- App text: simple professional English, no prices, no "owner" wording.

## 8. When you change a system

1. Edit `lib/studio/templates.ts` with the source of every number.
2. `npx tsx scripts/systems-reference.ts` to refresh `docs/SYSTEMS-REFERENCE.md`.
3. `npm test` (drawing check, golden, studio tests) and `npx tsc --noEmit`.
4. Push your branch; never `main` unless the founder says go live.
