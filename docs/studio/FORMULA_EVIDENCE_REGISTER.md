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
Euro and Gulf: see "Windows built from the drawings" below (clip height added).

## Windows built from the drawings (2026-11-12)
`lib/studio/assemble.ts` turns each traced section into a solid at catalogue
scale, places track, clip, 24 mm roller and shutter, and finds every contact by
bisection (halve the gap until 0.005 mm). Script: `scripts/assemble-window.ts`
(picture: `docs/studio/assembled.html`); test: `evals/studio/assemble.ts`.
Rule (checked on Domal): shutter = H − top tip − bottom tip − clip + 24.

| System | Track tip | Clip stands | Shutter | Status |
|---|---|---|---|---|
| Domal OMEO 3T / 2T | 45.41 / 45.01 | — | H − 66.8 / H − 66.0 | matches engine H − 66.7 ✓ |
| Euro 26 BH 3T / 2T (6001 / 6000 + 2559) | 45.00 / 44.91 | 3.9 | H − 69.9 / H − 69.8 | suggested |
| Gulf 25 BH (2551 / 2553 + 2559) | 29.81 | 3.9 | H − 39.6 | suggested |
| Gulf 35 BH (6501 / 6503 + 6513) | 31.21 | 4.0 | H − 42.4 | suggested |
| Ample 25 (955388 / 955389 + clip 914401) | 40.0 | 2.4 | H − 58.4 | suggested |
| Mini domal Ample 22 (41083 / 41084, no clip) | 35.0 | — | H − 46.0 | suggested |
| Ample 29 sleek (914400 / 41052 + clip 914401, shutter 41055) | 47.7 | 2.4 | H − 73.8 | suggested |
| Ample 37 sleek (41015 / 41014 + round clip 41310, shutter 41068) | 49.7 | 3.8 | H − 79.1 | suggested |
| BH 31 Gulf 2T (6401 top/bottom + clip 2559; sides 6400 one groove) | 42.7 | 3.9 | H − 65.3 | suggested |
| Alucoat S-30 Gulf (Bottom Gulf 30002 top+bottom, solid rail 30101 on the U floor) | 42.5 (runs at 39.5) | — | H − 58.0 (H − 53.3 if top is AT-30016) | suggested |
| Ample 26 (955388 + clip 914401, shutter 992265) | 40.0 | 2.4 | not set | shutter channel 15 mm deep, 24 mm roller does not go in — ask how it is fitted |
| Domal 27 Ample 3T / 2T (214313 / 214314) | 45.51 / 45.01 | — | H − 67.0 / 66.0 | same cut as OMEO ✓ |
| Domal 27 Eleanor (2702 / 2701) | 45.0 | — | H − 66.0 | same cut as OMEO ✓ |
| **Domal 27 Banu Hashim 2T / 4T (6032 / 6045)** | **48.9 / 49.0** | — | **H − 73.7 / 74.0** | **~7 mm shorter than OMEO** |

**Same section, different maker — what changes the cut:**
- Domal 27 tracks: OMEO, Ample and Eleanor legs stand 45.0–45.5 mm (same cut within
  1 mm). Banu Hashim 6032 / 6045 legs stand 48.9 mm: an OMEO cut list makes its
  shutter ~7 mm too long. Template `bh-27` carries its own rule.
- "With leg" tracks: the outer leg is only design (founder); the shutter runs on
  the inner legs / U. The builder ignores a flange that stands taller only once.
- Domal 27 shutters: glass pocket OMEO 2046 18.4 mm, Ample 214315 18.5, Eleanor
  2720 18.4, Eleanor 2722 16.7, BH 6050 18.5; face 65 / 65.98 / 65 / 65 / 66 mm.
  With OMEO's glass rule (shutter − 102 ⇒ glass stops 4.4 mm short of the pocket
  bottom), Ample and BH would be shutter − 103.8 and Eleanor 2722 − 105.4.
  Not put in the templates yet — check on one window per maker.

**Not built from drawings (and why):**
- Normal / Bombay 18: CHECKED (2026-11-13). Founder: the Normal bearing roller is
  13 mm and fits in the bearing shutter's pocket. Built from the drawings
  (`buildBombay`): rail top 23.1, roller goes 7.9 into the 1051 pocket, wheel 5.1
  below → shutter up to the top channel floor = H − 40.3 (2T) / H − 40.0 (3T).
  Engine (founder job) H − 41.3: 1.0 / 1.3 mm apart ✓ (that is the top clearance).
  Open question: lifting the shutter out over the 32 mm walls needs ~4 mm, the top
  leaves ~1 mm — how do shops fit the shutter?
- Normal 25 / 5-track: no traced sections yet.
- Founder 2026-11-13: Ample 29 / 37 run a 24 mm roller on a clip in the track; BH 31
  and Alucoat S-30 are Gulf (one-groove sides, clip in the top/bottom track). The
  roller never goes on the glass side. If one clip does not sit, try the other
  clips on the catalogue page. Antigravity's "rail" roles for 41010 / 41300 / 41069
  were wrong: 41010 is a track with leg.
- Domal 35×75, Mini domal 20×54: no section codes / drawings in the app yet.
- Z casement: no roller; engine rules are founder-checked already.

Gulf (founder): built like Euro; the left and right sides take a one-groove
track in place of the Euro track (not an extra piece). The drawings agree: BH
2550 / 2552 / 6500 and Alucoat AT-30001 have one groove; 2551 / 6501 have two.

## Full window from the drawings (2026-11-13)
`drawn()` in templates.ts; test `evals/studio/full-window.ts` (13 systems × 4 sizes).
- Frame: 45° systems W × H; Gulf 90°: sides H, top/bottom W − 2 × side track
  (BH 2550 24.8, 6500 32.8, 6400 33.1, Alucoat 30001 33). Shop may run top/bottom full.
- Shutter width W/2 (observed shop way). Meeting pieces = shutter height.
- Roller clip = clear width between side tips: Euro W − 89.9, Gulf 25 W − 49.6,
  Gulf 35 W − 65.6, BH 31 W − 66.2, Ample 25 / 29 / 37 W − 80 / 95.4 / 99.4.
- Glass: a 5 mm glass slid into each pocket; cut 3.9 mm short of where it stops
  (3.9 makes OMEO Domal = shutter − 102 exactly; Normal 18 bearing gives H − 67.8 vs
  the video rule − 66.7). Each shutter's own slim interlock sets its own glass width.
  | System | Glass W | Glass H |
  |---|---|---|
  | Ample 27 | shutter − 103.8 | shutter − 103.8 |
  | Eleanor 27 | − 105.4 | − 105.4 |
  | Gulf 25 | − 65.8 (small slim) / − 65.6 (big) | − 88.4 |
  | BH 31 | − 61.1 (6408) / − 60.5 (6409) | − 112.8 |
  | Alucoat S-30 | − 110.2 | − 110.2 |
  | Euro 26 | − 76.5 (slim 6052 or 6053: glass enters its 10.2 mm top slot, stops 13.5 from the meeting edge) | − 118.2 |
  | Gulf 35 | − 62.3 (slim 6506) / − 61.9 (6508): 15 mm top slot, stops 11.7 / 11.3 from the meeting edge | − 93.6 |
  | Mini domal 22 / Ample 29 / 37 | not known: 41085, 41050, 41289 (both sides open, H-shape), 41074, 41310 — which side holds the glass is not clear | − 94.8 / − 105.4 / − 127.0 |
  | BH 27, Ample 25 | not known | not known |

## 29 mm track across makers (2026-11-13)
Founder: 27 mm Euro uses the 29 mm Euro track; everything else is the same.
Built from the drawings (`evals/studio/assemble.ts` §3):
| Track | Height | Clip | Shutter height |
|---|---|---|---|
| Ample 914400 / 41052 | 47.7 | 914401 (stands 2.4) | H − 73.8 |
| Banu Hashim 29 | 47.8 | — | ≈ H − 74.0 (printed height only) |
| Eleanor 2901 / 2902 | 48.0 | 2917 (stands 2.5) | H − 74.5 |
| Eleanor 2904 | 48.1 | 2917 | H − 74.7 |
| Eleanor 2905 (3-track) | 48.6 | 2917 | H − 75.7 |
Ample / BH / Eleanor 2901 agree within 0.7 mm (under ½ sut). Eleanor 2905 is
1.9 mm off, so the Euro 29 Eleanor system names it and asks to teach.
- Euro 29 — Eleanor (`eleanor-29`): shutter 2903 on all sides; glass stops 54.3
  in → glass − 108.7 (2906 / 2909: − 106.3). 2909 = double glass (founder, 2026-11-13;
  switch Glass → Double glass puts 2909 on all 4 sides, glass − 106.3). Its 26 mm pocket =
  double glass. Interlock clip 2918. Roller clip W − 96.0.
- Euro 27: switch "29 track" — 47.7 (Ample / BH) H − 73.8, clip W − 95.4; 48.0
  (Eleanor) H − 74.5, clip W − 96.0 with clip 2917.

## 35 mm across makers
Euro 35 and Gulf 35: Banu Hashim = Eleanor within 0.3 mm (the two templates
say "Banu Hashim / Eleanor").

## Pipes to buy (founder, 2026-11-13)
Full pipes of the section's pipe length, plus one piece cut to the whole feet
still needed ("4 pipes + a 6 ft piece"). Replaces the half-bar rule.
Interlock clip: cut to the shutter height, any section of the series.

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
