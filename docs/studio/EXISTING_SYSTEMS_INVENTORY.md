# Existing systems inventory (code as of branch claude/golden-tests, 2026-11-09)

All systems live in hand-written code in `lib/engine/estimator.ts` (1,201
lines). Units are integer µm. Results are pinned by `evals/engine/golden.ts`
(622 answer paths × 4 sizes + founder jobs).

| System id | What it builds | Parts (section ids) | Constants and where they came from | Status |
|---|---|---|---|---|
| normal_2t / normal_3t | Bombay 18 mm sliding | 2t_top/3t_top (top + 2 sides), 2t_bottom/3t_bottom, handle_std, interlock, bearing ×2 per shutter | shutter H = H − 41.3 mm (founder job); track = W − 6 sut (founder + videos); bearing = shutter W − 80 mm; glass W = shutter W − 64.125 (bearing + 5 sut, videos); glass H = shutter H − 66.675; equal-share K₃ = 7½", K₄ = 11" (videos) | verified on 1 founder job |
| domal | Domal 27×65 sliding | domal_frame_2t (2051) / domal_frame (2062), domal_glass_shutter / domal_jali_shutter ×4 per shutter, domal_interlock ×2 per glass meeting | shutter H = H − 66.7 mm (founder job); glass = shutter − 102 mm both ways; W/2 (founder); equal share (W + 1⅝")/3, (W + 4")/4 (videos) | verified on 1 founder job |
| (both) fixed top | "upar fix" band | SP pipe frame + glazing clip | SP face 38.1, glass clear 4 sut | founder-confirmed |
| door_single | hinged door | door_palla_75/60/50, door_center_*, door_frame_pattam (3 sides) | clearance = profile inches − ½" (founder 30×84 job) | verified |
| partition | SP/DP grid + optional door | partition_frame, partition_divider, glazing_clip | face 38.1; panel − 4 sut; door leaf −2/−3 sut | founder + videos |
| z_section | openable / fixed / combo / row / grid / door | z_outer_*, z_pipe_*, z_center_*, z_clip | face 40; sash +10; glass −5/side; door −½" / +1" | founder + 13 videos |

## What is reusable for the Studio
- **Units** (`units.ts`): sut/inch/mm parse and format. Reuse as is.
- **Bar packing** (`cutting.ts`): FFD/multi-try per section. Reuse it. The only
  change is that it must accept custom sections; today `getSection()` throws on an
  unknown id.
- **Golden harness**: reuse the same idea for custom systems ("system tests").
- **Diagrams** (`components/diagrams.tsx`): sliding front views can be reused for
  the Studio preview.

## Gaps found during this audit
1. Every system is code. A shop cannot change a single constant without a deploy.
2. Sections are one fixed list with a single stock length per section. The founder
   call asked for 12/15/16 ft per profile.
3. A 4-track Normal window is built with the **2-track** top/bottom sections.
   There is no 4-track section in the master. Flag this to the founder.
4. Hardware counts (2 rollers per shutter, 1 lock, 4 cleats) are fixed for all
   sliding systems.
5. No record of *why* a number is what it is, other than code comments.
