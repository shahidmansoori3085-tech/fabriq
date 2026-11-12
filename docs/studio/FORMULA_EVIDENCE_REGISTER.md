# Formula evidence register

Status words used in the app:
- **verified**: matches a measured real job.
- **observed**: seen in shop videos or practice, not yet measured by us.
- **suggested**: learned from the shop's own jobs, waiting for a check job.
- **unknown**: no evidence. The app asks for a real job.

1 sut = 1/8" = 3.175 mm. W, H = window outer size.

## Normal / Bombay 18 mm sliding (built-in template `normal-18`)
| Rule | Value | Evidence | Status |
|---|---|---|---|
| shutter H | H − 41.3 mm (≈ 1⅝") | founder job 72×60 3T, handle 58.375" | verified |
| top / bottom track | W − 6 sut | founder 2026-11-08 + Aluminium center point ×3 | verified |
| sides | H | founder (90° frame) | verified |
| shutter W (half mode) | W/2 | founder 2026-07-27 | verified |
| shutter W (equal, 3 / 4 glass) | (W − 7½")/3 + 80 mm, (W − 11")/4 + 80 mm | videos | observed |
| bearing | shutter W − 80 mm | founder | verified |
| glass W | shutter W − 64.125 mm (bearing + 5 sut) | videos ×5, founder decision | observed |
| glass H | shutter H − 66.675 mm | videos | observed |

## Domal 27×65 (built-in template `domal-27`)
| Rule | Value | Evidence | Status |
|---|---|---|---|
| shutter H | H − 66.7 mm (≈ 2⅝") | founder job 66×58 3T | verified |
| frame 4 sides | W, H | founder | verified |
| shutter W (half) | W/2 | founder | verified |
| shutter W (equal 3 / 4) | (W + 1⅝")/3, (W + 4")/4 | Ramhans, Smart Aluminium ×2 | observed |
| glass | shutter − 102 mm both ways | founder + video (− 4" to − 4⅛") | verified |
| interlock patti | shutter H, 2 per glass–glass meeting | founder ×2 | verified |

## Series drafts (from transcripts we read ourselves, never from doc 18)
| Series | Rule | Value | Source | Status |
|---|---|---|---|---|
| 25×50 / 25×65 sliding | shutter H | H − 1⅛" | system-windows video notes | observed |
| | bearing (2T) | (W − 7½")/2 | same | observed |
| | glass H / W | shutter H − 4⅛" / bearing + ¾" | same | observed |
| Domal 35×75, 1¾" track | shutter H | H − 2⅜" | Ramhans 35×75 videos | observed |
| Domal 35×75, 2" track | shutter H | H − 3" | same | observed |
| | shutter W 2T / 3+1 / 4+1 | (W − ⅜")/2, (W + 2⅞")/3, (W + 5⅞")/4 | same | observed |
| | glass | shutter − 4⅝" (2T), − 5" (3+1, 4+1) | same | observed |
| 5-track 50 mm | shutter H | H − 1½" | video | observed |
| | bearing | (W − 13¾")/5 | video | observed |
| 22 mm (Ample) | parts | 41083/41084 track, 41082 shutter 4 sides, 41085 interlock | catalogue | parts only |
| 22 mm, mini domal 20, 29/31/37 sleek, Euro 26, Gulf 25/30/31/35 | every cutting rule (Euro frame: 45°, full W/H — founder) | — | — | **unknown** |

## From the section drawings (founder method, 2026-11-12)
Every sliding roller is **24 mm** high (founder). Domal shutter height =
**H − 2 × frame height + 24 mm** (the shutter fills the space between the leg
tips, plus the roller). Code: `lib/studio/derive.ts`; test: `evals/studio/derive.ts`.

| System | Frame | Drawing gives | Real rule | Apart |
|---|---|---|---|---|
| OMEO Domal 3-track | 2062, 45.4 mm | H − 66.8 mm | H − 66.7 mm (founder job) | 0.1 mm ✓ |
| OMEO Domal 2-track | 2051, 45.0 mm | H − 66.0 mm | H − 66.7 mm | 0.7 mm ✓ |
| Ample 27 3-track | 214313, 45.51 mm | H − 67.0 mm | (same shape as OMEO) | 0.3 mm ✓ |

Status in the Studio: **suggested** ("From the drawing … check on one window").
Shutter width (half / equal share) and glass are not from this rule.
Euro and Gulf: roller runs on a clip / inside a channel, so this rule is NOT used
for them yet — their shutter height is taught from one real window.

## Banu Hashim catalogue misprints (drawing wins; trace scale agrees)
- BH-6001 (Euro 3-track): table H 35.00, drawing 45 → **45** (trace 99.3%).
- BH-6053 (Euro big slim interlock): table W 61.73, drawing 62.60 → 62.60.

## Rejected (doc 18, no source; contradicts itself or real data)
- Domal 27 2T width (W + 22)/2, W/2 + 20, (W + 50.8)/2: three versions in one
  document.
- Gulf H − 55/65/75, (W + 20/24/28)/2, glass − 85/90/98.
- Normal "height − 30 to 35 mm"; 25 mm "H − 1¾"".
- Casement S = W − 68, glass S − 55/68; French (W − 74)/2; doors − 55/84/145.
- Partition glass + 18/+ 22; door leaf − 8/− 18 (and − 19/− 38, − 6/− 6 in the
  same document); Z-partition sash = bay + 2.
- Bifold jamb 65 mm and hinge gap 6 mm.
