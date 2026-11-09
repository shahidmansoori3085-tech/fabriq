# System Studio — design, build order and risks (2026-11-09)

The pasted master prompt is a reference, not a checklist. This is our own
design, based on what fabricators actually do and what we have verified.

## The product in one line
The shop opens a ready **draft of its series** (18 mm, 22, 25, 27 domal, 35 domal,
29/31 sleek, Gulf…). It ticks which parts it really uses, then types the cuts of
**one real window it already made**. FabriQ now cuts that system exactly the shop's
way. A second real window checks it. A brand-new system starts from a blank
sliding / openable / partition skeleton instead of a draft.

## What we deliberately do NOT build first (and why)
- **Free-form CAD canvas.** 95 % of jobs are rectangles with known layouts. A
  canvas makes the first five minutes harder. The front-view picture is drawn
  *from* the system and is not edited directly.
- **Solving slope from 2 windows.** The slope is known from geometry. Solving it
  from tape readings turns a 1-sut misread into about 1¼" error on a 10 ft window.
  One job sets the constants; the next job checks them.
- **IF/ELSE formula editor for workers.** Conditions are a few fixed switches
  (layout, rubber, roller, glass, interlock, mode). Each switch value can carry
  its own constant. This covers everything we have seen in 300+ videos. A free
  expression editor stays an expert option for later.
- **AI writing formulas.** AI may read a catalogue page and fill sizes for a
  human to confirm. Numbers come from jobs only.
- **37 screens.** The plan is 4: *My systems*, *System* (parts + switches),
  *Teach from a real window*, *Check*.

## Data model (lib/studio)
```
StudioSystem
  id, name, family (sliding | domal-type | …), version, status, basedOn
  profiles[]   id, name, code, maker, size, kgPerM, stockFt[], source
  switches     layout options, mode (half/equal), roller, rubber, glass…
  sizes[]      named sizes computed in order:
                 shutterW, shutterH, bearing, glassW, glassH …
                 each = slope × base + constant  (rounded once, in µm)
                 constant may differ per switch value (cases[])
                 each constant carries evidence {status, source, note}
  parts[]      profile, role label, scope (window | shutter | glass-shutter |
               meeting), count, length = a named size, angle 90/45,
               jali-profile override, optional switch condition
  extras[]     count items (rollers per shutter, lock, cleats) and
               running items (wool pile = shutter perimeter)
  tests[]      real jobs: input + measured cuts (golden tests for this system)
```
One evaluator turns (system, W, H, layout, switches) into the same `CutPiece` /
glass / hardware the current engine makes, so packing, sheets and PDFs are
reused as they are.

**Proof of the model:** the built-in Normal 18 mm and Domal 27 are re-expressed
as data, and a test checks that they give *identical* pieces, glass and
hardware to today's code on every golden path. If the model can hold the two
verified systems exactly, it can hold a shop's own.

## Teach and check (the "learning engine")
1. The fabricator gives one job: W, H, layout, and the cut of any parts they have
   (handle, interlock, track, glass…).
2. For each size, constant = measured − slope × base. Stored as **suggested**,
   with the job attached.
3. Second job: predicted vs measured, part by part. Within ½ sut → **verified for
   that layout**. Off → the part is named and the shop re-measures. Values are
   never averaged.
4. Each layout (2T, 3T, 3+1 …) is taught separately. Other layouts stay
   **unknown** until taught, and FabriQ refuses to cut them rather than guess.

## Build order (each step ships working and tested)
1. **Engine + data model + parity tests** (this step). The app UI is unchanged.
2. **Series drafts:** 18, 22, 25, 27 domal, 35 domal (1¾"/2"), 5-track 50, 29/31
   sleek, Gulf. Known rules are marked observed; the rest unknown.
3. **Studio screens** (My systems → System → Teach → Check), saved on the device,
   plus per-profile stock lengths.
4. **Use a custom system in a job** (the estimate runs it like a built-in one),
   with "where did this number come from" on every cut.
5. Openable / Z-partition / heavy door skeletons, using the same model with bay
   sizes.
6. Login + cloud sync + sharing (Supabase), versions per job.

## Risks and how we hold them
| Risk | Guard |
|---|---|
| Changing the engine breaks live cut lists | parity test against the golden suite; the old code stays the source for built-ins until parity is proven |
| Shop types a wrong measurement | the second job checks it; the part is named; nothing is averaged |
| A draft constant is wrong for a shop | drafts show "observed / unknown"; unknown blocks cutting |
| One profile's stock length differs | stock length is per profile, not global |
| Many switches confuse a worker | each switch has a default from the draft; the Teach step asks only about parts the shop ticked |
| A saved job changes when the system is edited | a job stores the system version it was cut with (step 4) |
