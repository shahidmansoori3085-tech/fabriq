# Systems reference (generated — do not edit by hand)

Made by `npx tsx scripts/systems-reference.ts` from `lib/studio/templates.ts`.
If you change a system, run it again. `--check` fails when this file is stale.
Read `docs/WINDOW-KNOWLEDGE.md` first: it explains what every word here means.

Evidence: **verified** = founder's real job · **observed** = shop videos / founder said ·
**suggested** = worked out from catalogue drawings, must be checked on one real window ·
**UNKNOWN** = nobody knows yet, the app blocks the cut.

Sizes are worked top to bottom; each line may use the ones above it. The first
line whose condition matches wins. Shutter width shares (W ÷ 2, (W − K) ÷ 3 …) are
worked out by the shutter layout, so a plain `W` there means "the share".

---

## Normal 18 mm

- App id: `normal-18` · family: sliding · series: bombay 18 mm · status: verified
- In short: Top + 2 sides + bottom track at 90°; shutter from handle, interlock and 2 bearings
- Layouts: 2 track (GG, GJ, JJ); 3 track (GGJ, GGG, GJJ, GG)  (G glass, J jali/mesh)
- Choices the shop makes:
  - Shutter width (`mode`): Half each (default) · Share the width

Pieces:

| Piece | Per | Qty | Length rule | Cut | Section |
|---|---|---|---|---|---|
| Top | window | 1 | trackW | 90° | tracks=3: 3-Track Top/Side — code 1021 — 92×32 mm — track<br>always: 2-Track Top/Side — code 1000 / 1801 — 62×32 mm — track |
| Left Side | window | 1 | sideH | 90° | tracks=3: 3-Track Top/Side — code 1021 — 92×32 mm — track<br>always: 2-Track Top/Side — code 1000 / 1801 — 62×32 mm — track |
| Right Side | window | 1 | sideH | 90° | tracks=3: 3-Track Top/Side — code 1021 — 92×32 mm — track<br>always: 2-Track Top/Side — code 1000 / 1801 — 62×32 mm — track |
| Bottom | window | 1 | trackW | 90° | tracks=3: 3-Track Bottom — code 1031 / 1831 — 92×32 mm — track<br>always: 2-Track Bottom — code 1011 / 1821 — 62×32 mm — track |
| Handle | shutter | 1 | shutterH | 90° | Handle 3/4"×1.5" — code 1041 / 1841 — 40×18 mm — handle |
| Interlock | shutter | 1 | shutterH | 90° | Interlock Stile 40×18 — code 1081 — 40×18 mm — interlock |
| Bearing Top | shutter | 1 | bearing | 90° | Bottom Bearing / Rail 40×18 — code 1051 — 40×18 mm — bearing |
| Bearing Bottom | shutter | 1 | bearing | 90° | Bottom Bearing / Rail 40×18 — code 1051 — 40×18 mm — bearing |

Size rules:

| Size | When | Rule | Evidence | Why |
|---|---|---|---|---|
| Top / bottom track (`trackW`) | always | W − 19.1 | verified | Founder job: 90° frame, track sits between the sides (W − 6 sut) |
| Frame side (`sideH`) | always | H | verified | Founder job: sides run full height |
| Shutter width (`shutterW`) | mode=equal, glass=3 | (W − 190.5) ÷ 3 + 80 | observed | Shop videos: 3 glass share: (W − 7½″) ÷ 3, + 80 mm handle/interlock |
| Shutter width (`shutterW`) | mode=equal, glass=4 | (W − 279.4) ÷ 4 + 80 | observed | Shop videos: 4 glass share: (W − 11″) ÷ 4, + 80 mm |
| Shutter width (`shutterW`) | always | W ÷ 2 | verified | Founder job: every shutter is half the window |
| Shutter height (handle, interlock) (`shutterH`) | always | H − 41.3 | verified | Founder job: 72×60 3-track, handle 58⅜″ |
| Bearing (top & bottom) (`bearing`) | always | shutterW − 80 | verified | Founder job: shutter width − handle and interlock |
| Glass width (`glassW`) | always | shutterW − 64.1 | observed | Shop videos: bearing + 5 sut (5 videos) |
| Glass height (`glassH`) | always | shutterH − 66.7 | observed | Shop videos: H − 4″2 sut |

Worked example: 6′×4′ (1828.8 × 1219.2 mm), 2 track, GG, default choices:

| Piece | Length | Cut | Pieces |
|---|---|---|---|
| Top | 1809.8 mm | 90° | 1 |
| Left Side | 1219.2 mm | 90° | 1 |
| Right Side | 1219.2 mm | 90° | 1 |
| Bottom | 1809.8 mm | 90° | 1 |
| Shutter Handle | 1177.9 mm | 90° | 2 |
| Shutter Interlock | 1177.9 mm | 90° | 2 |
| Shutter Bearing Top | 834.4 mm | 90° | 2 |
| Shutter Bearing Bottom | 834.4 mm | 90° | 2 |
| Glass/mesh glass | 850.3 × 1111.2 mm | — | 2 |

---

## Normal 18 mm · 2½″ shutter

- App id: `normal-18-60` · family: sliding · series: bombay 18 mm · status: draft
- In short: Same tracks as Normal 18; handle, interlock and bearing 2½″ × ¾″ (60 × 19)
- Layouts: 2 track (GG, GJ, JJ); 3 track (GGJ, GGG, GJJ, GG)  (G glass, J jali/mesh)
- Choices the shop makes:
  - Shutter width (`mode`): Half each (default) · Share the width

Pieces:

| Piece | Per | Qty | Length rule | Cut | Section |
|---|---|---|---|---|---|
| Top | window | 1 | trackW | 90° | tracks=3: 3-Track Top/Side — code 1021 — 92×32 mm — track<br>always: 2-Track Top/Side — code 1000 / 1801 — 62×32 mm — track |
| Left Side | window | 1 | sideH | 90° | tracks=3: 3-Track Top/Side — code 1021 — 92×32 mm — track<br>always: 2-Track Top/Side — code 1000 / 1801 — 62×32 mm — track |
| Right Side | window | 1 | sideH | 90° | tracks=3: 3-Track Top/Side — code 1021 — 92×32 mm — track<br>always: 2-Track Top/Side — code 1000 / 1801 — 62×32 mm — track |
| Bottom | window | 1 | trackW | 90° | tracks=3: 3-Track Bottom — code 1031 / 1831 — 92×32 mm — track<br>always: 2-Track Bottom — code 1011 / 1821 — 62×32 mm — track |
| Handle | shutter | 1 | shutterH | 90° | Handle 2½″×¾″ — 60×19 mm — handle |
| Interlock | shutter | 1 | shutterH | 90° | Interlock 2½″×¾″ — 60×19 mm — interlock |
| Bearing Top | shutter | 1 | bearing | 90° | Bearing 2½″×¾″ — 60×19 mm — bearing |
| Bearing Bottom | shutter | 1 | bearing | 90° | Bearing 2½″×¾″ — 60×19 mm — bearing |

Size rules:

| Size | When | Rule | Evidence | Why |
|---|---|---|---|---|
| Top / bottom track (`trackW`) | always | W − 19.1 | verified | Founder job: 90° frame, track sits between the sides (W − 6 sut) |
| Frame side (`sideH`) | always | H | verified | Founder job: sides run full height |
| Shutter width (`shutterW`) | mode=equal, glass=3 | (W − 190.5) ÷ 3 + 80 | observed | Shop videos: 3 glass share: (W − 7½″) ÷ 3, + 80 mm handle/interlock |
| Shutter width (`shutterW`) | mode=equal, glass=4 | (W − 279.4) ÷ 4 + 80 | observed | Shop videos: 4 glass share: (W − 11″) ÷ 4, + 80 mm |
| Shutter width (`shutterW`) | always | W ÷ 2 | verified | Founder job: every shutter is half the window |
| Shutter height (handle, interlock) (`shutterH`) | always | H − 41.3 | verified | Founder job: 72×60 3-track, handle 58⅜″ |
| Bearing (top & bottom) (`bearing`) | always | shutterW − 120 | suggested | From the 1½″ set, 20 mm wider pieces (OMEO p.43): shutter width − handle 60 − interlock 60. Check on one window. |
| Glass width (`glassW`) | always | shutterW − 104.1 | suggested | From the 1½″ set, 20 mm wider pieces (OMEO p.43): bearing + 15.9, as the 1½″ set (bearing + 5 sut). Check on one window. |
| Glass height (`glassH`) | always | shutterH − 106.7 | suggested | From the 1½″ set, 20 mm wider pieces (OMEO p.43): two bearings 20 mm wider each than the 1½″ set (shutter − 66.7). Check on one window. |

Worked example: 6′×4′ (1828.8 × 1219.2 mm), 2 track, GG, default choices:

| Piece | Length | Cut | Pieces |
|---|---|---|---|
| Top | 1809.8 mm | 90° | 1 |
| Left Side | 1219.2 mm | 90° | 1 |
| Right Side | 1219.2 mm | 90° | 1 |
| Bottom | 1809.8 mm | 90° | 1 |
| Shutter Handle | 1177.9 mm | 90° | 2 |
| Shutter Interlock | 1177.9 mm | 90° | 2 |
| Shutter Bearing Top | 794.4 mm | 90° | 2 |
| Shutter Bearing Bottom | 794.4 mm | 90° | 2 |
| Glass/mesh glass | 810.3 × 1071.2 mm | — | 2 |

---

## Domal 27 mm

- App id: `domal-27` · family: domal-type · series: domal 27 mm · status: verified
- In short: 45° frame (2-track 2051 / 3-track 2062); one shutter profile on all 4 sides + interlock patti
- Layouts: 2 track (GG, GJ, JJ); 3 track (GGJ, GGG, GJJ, GG)  (G glass, J jali/mesh)
- Choices the shop makes:
  - Shutter width (`mode`): Half each (default) · Share the width

Pieces:

| Piece | Per | Qty | Length rule | Cut | Section |
|---|---|---|---|---|---|
| Frame Top | window | 1 | frameW | 45° | tracks=1/2: Domal 2-Track Frame — code 2051 — 45×45 mm — frame<br>always: Domal 3-Track Frame 80×45 — code 2062 — 80.5×45.4 mm — frame |
| Frame Left | window | 1 | frameH | 45° | tracks=1/2: Domal 2-Track Frame — code 2051 — 45×45 mm — frame<br>always: Domal 3-Track Frame 80×45 — code 2062 — 80.5×45.4 mm — frame |
| Frame Right | window | 1 | frameH | 45° | tracks=1/2: Domal 2-Track Frame — code 2051 — 45×45 mm — frame<br>always: Domal 3-Track Frame 80×45 — code 2062 — 80.5×45.4 mm — frame |
| Frame Bottom | window | 1 | frameW | 45° | tracks=1/2: Domal 2-Track Frame — code 2051 — 45×45 mm — frame<br>always: Domal 3-Track Frame 80×45 — code 2062 — 80.5×45.4 mm — frame |
| Shutter Top | shutter | 1 | shutterW | 45° | Domal Glass Shutter — code 2046/2047 — 65×27 mm — shutter |
| Shutter Bottom | shutter | 1 | shutterW | 45° | Domal Glass Shutter — code 2046/2047 — 65×27 mm — shutter |
| Shutter Left | shutter | 1 | shutterH | 45° | Domal Glass Shutter — code 2046/2047 — 65×27 mm — shutter |
| Shutter Right | shutter | 1 | shutterH | 45° | Domal Glass Shutter — code 2046/2047 — 65×27 mm — shutter |
| Interlock | meeting | 2 | shutterH | 90° | Domal Interlock Patti 39×28 — code 2091 — 39.4×28 mm — interlock-patti |

Size rules:

| Size | When | Rule | Evidence | Why |
|---|---|---|---|---|
| Frame top / bottom (`frameW`) | always | W | verified | Founder job: 45° frame, full width |
| Frame side (`frameH`) | always | H | verified | Founder job: 45° frame, full height |
| Shutter width (`shutterW`) | mode=equal, glass=3 | (W + 41.3) ÷ 3 | observed | Shop videos: 3 glass share: (W + 1⅝″) ÷ 3 |
| Shutter width (`shutterW`) | mode=equal, glass=4 | (W + 101.6) ÷ 4 | observed | Shop videos: 4 glass share: (W + 4″) ÷ 4 |
| Shutter width (`shutterW`) | always | W ÷ 2 | verified | Founder job: every shutter is half the window |
| Shutter height (`shutterH`) | always | H − 66.7 | verified | Founder job: 66×58 3-track, shutter side 55⅜″ |
| Glass width (`glassW`) | always | shutterW − 102 | verified | Founder job: shutter − 102 mm; videos 4″–4⅛″ |
| Glass height (`glassH`) | always | shutterH − 102 | verified | Founder job: shutter − 102 mm; videos 4″–4⅛″ |

Worked example: 6′×4′ (1828.8 × 1219.2 mm), 2 track, GG, default choices:

| Piece | Length | Cut | Pieces |
|---|---|---|---|
| Frame Top | 1828.8 mm | 45° | 1 |
| Frame Left | 1219.2 mm | 45° | 1 |
| Frame Right | 1219.2 mm | 45° | 1 |
| Frame Bottom | 1828.8 mm | 45° | 1 |
| Shutter Shutter Top | 914.4 mm | 45° | 2 |
| Shutter Shutter Bottom | 914.4 mm | 45° | 2 |
| Shutter Shutter Left | 1152.5 mm | 45° | 2 |
| Shutter Shutter Right | 1152.5 mm | 45° | 2 |
| Interlock 1 | 1152.5 mm | 90° | 1 |
| Interlock 2 | 1152.5 mm | 90° | 1 |
| Glass/mesh glass | 812.4 × 1050.5 mm | — | 2 |

---

## Euro 27 mm

- App id: `euro-27` · family: domal-type · series: euro 27 mm · status: draft
- In short: Euro 29 track (Ample 914400 / 41052 or Eleanor 2901 / 2902) with its roller clip; 27 mm shutter on all sides; interlock clip, or slim interlock
- Layouts: 2 track (GG, GJ, JJ); 3 track (GGJ, GGG, GJJ, GG)  (G glass, J jali/mesh)
- Choices the shop makes:
  - 29 track (`track`): 47.7 mm track (default) · 48.0 mm track
  - Slim Interlock (`pick_shutterMeet`): 27 mm Slim Interlock — small (default) · 27 mm Slim Interlock — big · 27 mm Slim Interlock — double glass
  - Meeting side (`meet`): Slim interlock · Shutter + interlock clip (default)

Pieces:

| Piece | Per | Qty | Length rule | Cut | Section |
|---|---|---|---|---|---|
| Frame Top | window | 1 | frameW | 45° | tracks=1/2, track=48: 29 mm 2-Track — code 2901 — 50×48 mm — track<br>track=48: 29 mm 3-Track — code 2902 — 86.5×48 mm — track<br>tracks=1/2: 29 mm 2-Track — code 914400 — 50×47.69 mm — track<br>always: 29 mm 3-Track — code 41052 — 85.8×47.7 mm — track |
| Frame Left | window | 1 | frameH | 45° | tracks=1/2, track=48: 29 mm 2-Track — code 2901 — 50×48 mm — track<br>track=48: 29 mm 3-Track — code 2902 — 86.5×48 mm — track<br>tracks=1/2: 29 mm 2-Track — code 914400 — 50×47.69 mm — track<br>always: 29 mm 3-Track — code 41052 — 85.8×47.7 mm — track |
| Frame Right | window | 1 | frameH | 45° | tracks=1/2, track=48: 29 mm 2-Track — code 2901 — 50×48 mm — track<br>track=48: 29 mm 3-Track — code 2902 — 86.5×48 mm — track<br>tracks=1/2: 29 mm 2-Track — code 914400 — 50×47.69 mm — track<br>always: 29 mm 3-Track — code 41052 — 85.8×47.7 mm — track |
| Frame Bottom | window | 1 | frameW | 45° | tracks=1/2, track=48: 29 mm 2-Track — code 2901 — 50×48 mm — track<br>track=48: 29 mm 3-Track — code 2902 — 86.5×48 mm — track<br>tracks=1/2: 29 mm 2-Track — code 914400 — 50×47.69 mm — track<br>always: 29 mm 3-Track — code 41052 — 85.8×47.7 mm — track |
| Track Clip | shutter | 1 | clipW | 90° | track=48: 29 mm Track Clip — code 2917 — 13×16 mm — rail<br>always: 29 mm Track Clip — code 914401 — 12.99×16.09 mm — rail |
| Shutter Top | shutter | 1 | shutterW | 45° | Domal Glass Shutter — code 2046/2047 — 65×27 mm — shutter |
| Shutter Bottom | shutter | 1 | shutterW | 45° | Domal Glass Shutter — code 2046/2047 — 65×27 mm — shutter |
| Shutter {lr} | shutter | 1 | shutterH | 45° | Domal Glass Shutter — code 2046/2047 — 65×27 mm — shutter |
| Interlock Side | shutter | 1 | shutterH | 45° | meet=clip: Domal Glass Shutter — code 2046/2047 — 65×27 mm — shutter<br>pick_shutterMeet=el27_slim: 27 mm Slim Interlock — small — code 2728 — 35.2×22.7 mm — slim-interlock<br>pick_shutterMeet=el27_slim_big: 27 mm Slim Interlock — big — code 2729 — 85.2×22.7 mm — slim-interlock<br>pick_shutterMeet=el27_slim_dgu: 27 mm Slim Interlock — double glass — code 2730 — 32.3×22.7 mm — slim-interlock<br>always: 27 mm Slim Interlock — small — code 2728 — 35.2×22.7 mm — slim-interlock |
| Interlock Clip (only if meet=clip) | meeting | 2 | shutterH | 90° | Domal Interlock Patti 39×28 — code 2091 — 39.4×28 mm — interlock-patti |

Size rules:

| Size | When | Rule | Evidence | Why |
|---|---|---|---|---|
| Frame top / bottom (`frameW`) | always | W | observed | Euro track goes round at 45°, full width |
| Frame side (`frameH`) | always | H | observed | Euro track goes round at 45°, full height |
| Track clip (`clipW`) | track=48 | W − 96 | suggested | From the drawings (window built from the sections): clear width between the side U tips (2 × 48.0, Eleanor). Check on one window. |
| Track clip (`clipW`) | always | W − 95.4 | suggested | From the drawings (window built from the sections): clear width between the side U tips (2 × 47.7). Check on one window. |
| Shutter width (`shutterW`) | always | W ÷ 2 | observed | Every shutter half the window (W/2) — the usual shop way |
| Shutter height (`shutterH`) | track=48 | H − 74.5 | suggested | From the drawings (window built from the sections): 2 × 48.0 Eleanor track + 2.5 clip 2917 − 24 roller; the 27 mm shutter runs clear. Check on one window. |
| Shutter height (`shutterH`) | always | H − 73.8 | suggested | From the drawings (window built from the sections): 2 × 47.7 track + 2.4 clip − 24 roller; the 27 mm shutter runs clear. Check on one window. |
| Glass width (`glassW`) | meet=clip | shutterW − 102 | suggested | From the drawings (window built from the sections): 27 mm shutter pocket (OMEO 2046) — as Domal 27 — the same shutter on both sides. Check on one window. |
| Glass width (`glassW`) | meet=slim, pick_shutterMeet=el27_slim | shutterW − 63 | suggested | From the drawings (window built from the sections): 2046 pocket 51.0 + small slim 2728 12.0 (glass goes 14.6 mm into its top slot). Check on one window. |
| Glass width (`glassW`) | meet=slim, pick_shutterMeet=el27_slim_big | shutterW − 62.9 | suggested | From the drawings (window built from the sections): 2046 pocket 51.0 + big slim 2729 11.9 (its drawing is not to scale: measured on the 27.00 slot and 22.70 height). Check on one window. |
| Glass width (`glassW`) | meet=slim, pick_shutterMeet=el27_slim_dgu | shutterW − 63.1 | suggested | From the drawings (window built from the sections): 2046 pocket 51.0 + double-glass slim 2730 12.1. Check on one window. |
| Glass width (`glassW`) | always | shutterW + **UNKNOWN** (app refuses to cut) | unknown | — |
| Glass height (`glassH`) | always | shutterH − 102 | observed | 27 mm shutter pocket (OMEO 2046): shutter − 102, as Domal 27 |

Worked example: 6′×4′ (1828.8 × 1219.2 mm), 2 track, GG, default choices:

| Piece | Length | Cut | Pieces |
|---|---|---|---|
| Frame Top | 1828.8 mm | 45° | 1 |
| Frame Left | 1219.2 mm | 45° | 1 |
| Frame Right | 1219.2 mm | 45° | 1 |
| Frame Bottom | 1828.8 mm | 45° | 1 |
| Track Clip | 1733.4 mm | 90° | 2 |
| Shutter Shutter Top | 914.4 mm | 45° | 2 |
| Shutter Shutter Bottom | 914.4 mm | 45° | 2 |
| Shutter Shutter Left | 1145.4 mm | 45° | 1 |
| Shutter Interlock Side | 1145.4 mm | 45° | 2 |
| Shutter Shutter Right | 1145.4 mm | 45° | 1 |
| Interlock Clip 1 | 1145.4 mm | 90° | 1 |
| Interlock Clip 2 | 1145.4 mm | 90° | 1 |
| Glass/mesh glass | 812.4 × 1043.4 mm | — | 2 |

Worked example: 6′×4′ (1828.8 × 1219.2 mm), 2 track, GG, meet=slim:

| Piece | Length | Cut | Pieces |
|---|---|---|---|
| Frame Top | 1828.8 mm | 45° | 1 |
| Frame Left | 1219.2 mm | 45° | 1 |
| Frame Right | 1219.2 mm | 45° | 1 |
| Frame Bottom | 1828.8 mm | 45° | 1 |
| Track Clip | 1733.4 mm | 90° | 2 |
| Shutter Shutter Top | 914.4 mm | 45° | 2 |
| Shutter Shutter Bottom | 914.4 mm | 45° | 2 |
| Shutter Shutter Left | 1145.4 mm | 45° | 1 |
| Shutter Interlock Side | 1145.4 mm | 45° | 2 |
| Shutter Shutter Right | 1145.4 mm | 45° | 1 |
| Glass/mesh glass | 851.4 × 1043.4 mm | — | 2 |

---

## Domal 35 mm

- App id: `domal-35` · family: domal-type · series: domal 35 mm · status: draft
- In short: One 75×35 shutter on all 4 sides + I/L clip; leg track 42.6 (BH 6701 / 6703) or 48 with 2 legs (6702 / 6704)
- Layouts: 2 track (GG, GJ, JJ); 3 track (GGJ, GGG, GJJ, GG); 4 track (GGGJ); 5 track (GGGGJ)  (G glass, J jali/mesh)
- Choices the shop makes:
  - Track (`track`): 42.6 mm, one leg (default) · 48 mm, two legs
  - Interlock (`pick_interlock`): Domal 35 I/L Clip (default) · Domal 35 Interlock

Pieces:

| Piece | Per | Qty | Length rule | Cut | Section |
|---|---|---|---|---|---|
| Frame Top | window | 1 | frameW | 45° | tracks=2, track=42: Domal 35 2-Track with Leg — code BH-6701 — 77.01×42.62 mm — frame<br>tracks=3, track=42: Domal 35 3-Track with Leg — code BH-6703 — 122×42.5 mm — frame<br>tracks=2, track=48: Domal 35 2-Track with 2 Legs — code BH-6702 — 95×48 mm — frame<br>tracks=3, track=48: Domal 35 3-Track with 2 Legs — code BH-6704 — 139.8×47.85 mm — frame<br>always: (none — no catalogue section) |
| Frame Left | window | 1 | frameH | 45° | tracks=2, track=42: Domal 35 2-Track with Leg — code BH-6701 — 77.01×42.62 mm — frame<br>tracks=3, track=42: Domal 35 3-Track with Leg — code BH-6703 — 122×42.5 mm — frame<br>tracks=2, track=48: Domal 35 2-Track with 2 Legs — code BH-6702 — 95×48 mm — frame<br>tracks=3, track=48: Domal 35 3-Track with 2 Legs — code BH-6704 — 139.8×47.85 mm — frame<br>always: (none — no catalogue section) |
| Frame Right | window | 1 | frameH | 45° | tracks=2, track=42: Domal 35 2-Track with Leg — code BH-6701 — 77.01×42.62 mm — frame<br>tracks=3, track=42: Domal 35 3-Track with Leg — code BH-6703 — 122×42.5 mm — frame<br>tracks=2, track=48: Domal 35 2-Track with 2 Legs — code BH-6702 — 95×48 mm — frame<br>tracks=3, track=48: Domal 35 3-Track with 2 Legs — code BH-6704 — 139.8×47.85 mm — frame<br>always: (none — no catalogue section) |
| Frame Bottom | window | 1 | frameW | 45° | tracks=2, track=42: Domal 35 2-Track with Leg — code BH-6701 — 77.01×42.62 mm — frame<br>tracks=3, track=42: Domal 35 3-Track with Leg — code BH-6703 — 122×42.5 mm — frame<br>tracks=2, track=48: Domal 35 2-Track with 2 Legs — code BH-6702 — 95×48 mm — frame<br>tracks=3, track=48: Domal 35 3-Track with 2 Legs — code BH-6704 — 139.8×47.85 mm — frame<br>always: (none — no catalogue section) |
| Shutter Top | shutter | 1 | shutterW | 45° | Domal 35 Shutter 75×35 — code BH-6712 — 75×35 mm — shutter |
| Shutter Bottom | shutter | 1 | shutterW | 45° | Domal 35 Shutter 75×35 — code BH-6712 — 75×35 mm — shutter |
| Shutter Left | shutter | 1 | shutterH | 45° | Domal 35 Shutter 75×35 — code BH-6712 — 75×35 mm — shutter |
| Shutter Right | shutter | 1 | shutterH | 45° | Domal 35 Shutter 75×35 — code BH-6712 — 75×35 mm — shutter |
| Interlock | meeting | 2 | shutterH | 90° | pick_interlock=d35_clip: Domal 35 I/L Clip — code BH-6711 / 3510 — 41×38.9 mm — interlock-patti<br>pick_interlock=d35_interlock: Domal 35 Interlock — code BH-6707 / 3506 — 42.55×31 mm — interlock<br>always: Domal 35 I/L Clip — code BH-6711 / 3510 — 41×38.9 mm — interlock-patti |

Size rules:

| Size | When | Rule | Evidence | Why |
|---|---|---|---|---|
| Frame top / bottom (`frameW`) | always | W | observed | 45° frame goes round, full width |
| Frame side (`frameH`) | always | H | observed | 45° frame goes round, full height |
| Shutter width (`shutterW`) | tracks=2 | (W − 9.5) ÷ 2 | observed | Shop videos: 2-track: (W − ⅜″) ÷ 2 |
| Shutter width (`shutterW`) | tracks=4 | (W + 73) ÷ 3 | observed | Shop videos: 3+1: (W + 2⅞″) ÷ 3 |
| Shutter width (`shutterW`) | tracks=5 | (W + 149.2) ÷ 4 | observed | Shop videos: 4+1: (W + 5⅞″) ÷ 4 |
| Shutter width (`shutterW`) | always | W ÷ 2 | observed | Every shutter half the window (W/2) |
| Shutter height (`shutterH`) | tracks=2, track=42 | H − 61.1 | suggested | From the drawings (window built from the sections): 2 × 42.6 track − 24 roller; the 1¾″-track videos cut H − 2⅜″ (60.3), 0.8 mm apart. Check on one window. |
| Shutter height (`shutterH`) | tracks=3, track=42 | H − 60.8 | suggested | From the drawings (window built from the sections): 2 × 42.4 track − 24 roller. Check on one window. |
| Shutter height (`shutterH`) | tracks=2/3, track=48 | H − 71.8 | suggested | From the drawings (window built from the sections): 2 × 47.9 track − 24 roller. Check on one window. |
| Shutter height (`shutterH`) | always | H − 73 | observed | Shop videos: 3+1 / 4+1: H − 2⅞″ |
| Glass width (`glassW`) | tracks=2/3 | shutterW − 118 | suggested | From the drawings (window built from the sections): glass stops 59 mm in from each shutter edge (BH-6712); the videos cut shutter − 4⅝″ (117.5). Check on one window. |
| Glass width (`glassW`) | always | shutterW − 127 | observed | Shop videos: 3+1 / 4+1: shutter − 5″ |
| Glass height (`glassH`) | tracks=2/3 | shutterH − 118 | suggested | From the drawings (window built from the sections): glass stops 59 mm in from each shutter edge (BH-6712); the videos cut shutter − 4⅝″ (117.5). Check on one window. |
| Glass height (`glassH`) | always | shutterH − 127 | observed | Shop videos: 3+1 / 4+1: shutter − 5″ |

Worked example: 6′×4′ (1828.8 × 1219.2 mm), 2 track, GG, default choices:

| Piece | Length | Cut | Pieces |
|---|---|---|---|
| Frame Top | 1828.8 mm | 45° | 1 |
| Frame Left | 1219.2 mm | 45° | 1 |
| Frame Right | 1219.2 mm | 45° | 1 |
| Frame Bottom | 1828.8 mm | 45° | 1 |
| Shutter Shutter Top | 909.6 mm | 45° | 2 |
| Shutter Shutter Bottom | 909.6 mm | 45° | 2 |
| Shutter Shutter Left | 1158.1 mm | 45° | 2 |
| Shutter Shutter Right | 1158.1 mm | 45° | 2 |
| Interlock 1 | 1158.1 mm | 90° | 1 |
| Interlock 2 | 1158.1 mm | 90° | 1 |
| Glass/mesh glass | 791.6 × 1040.1 mm | — | 2 |

---

## Domal 20 mm

- App id: `mini-domal-20` · family: domal-type · series: domal 20 mm · status: draft
- In short: Track 2504 / 2505, shutter 2507 on all 4 sides, interlock clip 2509 (slim 2503)
- Layouts: 2 track (GG, GJ); 3 track (GGJ, GGG)  (G glass, J jali/mesh)
- Choices the shop makes:
  - Meeting side (`meet`): Slim interlock · Shutter + interlock clip (default)

Pieces:

| Piece | Per | Qty | Length rule | Cut | Section |
|---|---|---|---|---|---|
| Frame Top | window | 1 | frameW | 45° | tracks=1/2: 20 mm 2-Track — code BH-2504 — 56.3×31.4 mm — track<br>always: 20 mm 3-Track — code BH-2505 — 86.8×31.4 mm — track |
| Frame Left | window | 1 | frameH | 45° | tracks=1/2: 20 mm 2-Track — code BH-2504 — 56.3×31.4 mm — track<br>always: 20 mm 3-Track — code BH-2505 — 86.8×31.4 mm — track |
| Frame Right | window | 1 | frameH | 45° | tracks=1/2: 20 mm 2-Track — code BH-2504 — 56.3×31.4 mm — track<br>always: 20 mm 3-Track — code BH-2505 — 86.8×31.4 mm — track |
| Frame Bottom | window | 1 | frameW | 45° | tracks=1/2: 20 mm 2-Track — code BH-2504 — 56.3×31.4 mm — track<br>always: 20 mm 3-Track — code BH-2505 — 86.8×31.4 mm — track |
| Shutter Top | shutter | 1 | shutterW | 45° | 20 mm Shutter — code BH-2507 — 54.4×20.7 mm — shutter |
| Shutter Bottom | shutter | 1 | shutterW | 45° | 20 mm Shutter — code BH-2507 — 54.4×20.7 mm — shutter |
| Shutter {lr} | shutter | 1 | shutterH | 45° | 20 mm Shutter — code BH-2507 — 54.4×20.7 mm — shutter |
| Interlock Side | shutter | 1 | shutterH | 45° | meet=clip: 20 mm Shutter — code BH-2507 — 54.4×20.7 mm — shutter<br>always: 20 mm Slim Interlock — code BH-2503 — 27.4×25 mm — slim-interlock |
| Interlock Clip (only if meet=clip) | meeting | 2 | shutterH | 90° | 20 mm Interlock Clip (mini clip) — code BH-2509 — 34×24.5 mm — interlock-patti |

Size rules:

| Size | When | Rule | Evidence | Why |
|---|---|---|---|---|
| Frame top / bottom (`frameW`) | always | W | observed | 45° frame goes round, full width |
| Frame side (`frameH`) | always | H | observed | 45° frame goes round, full height |
| Shutter width (`shutterW`) | always | W ÷ 2 | observed | Every shutter half the window (W/2) — the usual shop way |
| Shutter height (`shutterH`) | always | H − 38.8 | suggested | From the drawings (window built from the sections): 2 × 31.4 track (2504 / 2505) − 24 roller; shutter 2507 runs on the U tops. Check on one window. |
| Glass width (`glassW`) | meet=clip | shutterW − 95 | suggested | From the drawings (window built from the sections): glass stops 47.5 mm in (2507) — the same shutter on both sides. Check on one window. |
| Glass width (`glassW`) | meet=slim | shutterW − 66.1 | suggested | From the drawings (window built from the sections): 2507 pocket 47.5 + slim 2503 18.6 (glass slot 10.3 mm deep, measured on the drawing). Check on one window. |
| Glass width (`glassW`) | always | shutterW + **UNKNOWN** (app refuses to cut) | unknown | — |
| Glass height (`glassH`) | always | shutterH − 95 | suggested | From the drawings (window built from the sections): glass goes 10.8 mm into the 2507 pocket: stops 47.5 mm in from each shutter edge. Check on one window. |

Worked example: 6′×4′ (1828.8 × 1219.2 mm), 2 track, GG, default choices:

| Piece | Length | Cut | Pieces |
|---|---|---|---|
| Frame Top | 1828.8 mm | 45° | 1 |
| Frame Left | 1219.2 mm | 45° | 1 |
| Frame Right | 1219.2 mm | 45° | 1 |
| Frame Bottom | 1828.8 mm | 45° | 1 |
| Shutter Shutter Top | 914.4 mm | 45° | 2 |
| Shutter Shutter Bottom | 914.4 mm | 45° | 2 |
| Shutter Shutter Left | 1180.4 mm | 45° | 1 |
| Shutter Interlock Side | 1180.4 mm | 45° | 2 |
| Shutter Shutter Right | 1180.4 mm | 45° | 1 |
| Interlock Clip 1 | 1180.4 mm | 90° | 1 |
| Interlock Clip 2 | 1180.4 mm | 90° | 1 |
| Glass/mesh glass | 819.4 × 1085.4 mm | — | 2 |

Worked example: 6′×4′ (1828.8 × 1219.2 mm), 2 track, GG, meet=slim:

| Piece | Length | Cut | Pieces |
|---|---|---|---|
| Frame Top | 1828.8 mm | 45° | 1 |
| Frame Left | 1219.2 mm | 45° | 1 |
| Frame Right | 1219.2 mm | 45° | 1 |
| Frame Bottom | 1828.8 mm | 45° | 1 |
| Shutter Shutter Top | 914.4 mm | 45° | 2 |
| Shutter Shutter Bottom | 914.4 mm | 45° | 2 |
| Shutter Shutter Left | 1180.4 mm | 45° | 1 |
| Shutter Interlock Side | 1180.4 mm | 45° | 2 |
| Shutter Shutter Right | 1180.4 mm | 45° | 1 |
| Glass/mesh glass | 848.3 × 1085.4 mm | — | 2 |

---

## Mini domal 22 mm

- App id: `ample-22` · family: domal-type · series: domal 22 mm · status: draft
- In short: 35 mm track (41083 / 41084), no clip; shutter 41082 on all sides; jali shutter 41085
- Layouts: 2 track (GG, GJ); 3 track (GGJ, GGG)  (G glass, J jali/mesh)

Pieces:

| Piece | Per | Qty | Length rule | Cut | Section |
|---|---|---|---|---|---|
| Frame Top | window | 1 | frameW | 45° | tracks=1/2: 22 mm 2-Track — code 41083 — 53.9×35 mm — track<br>always: 22 mm 3-Track — code 41084 — 83.9×35 mm — track |
| Frame Left | window | 1 | frameH | 45° | tracks=1/2: 22 mm 2-Track — code 41083 — 53.9×35 mm — track<br>always: 22 mm 3-Track — code 41084 — 83.9×35 mm — track |
| Frame Right | window | 1 | frameH | 45° | tracks=1/2: 22 mm 2-Track — code 41083 — 53.9×35 mm — track<br>always: 22 mm 3-Track — code 41084 — 83.9×35 mm — track |
| Frame Bottom | window | 1 | frameW | 45° | tracks=1/2: 22 mm 2-Track — code 41083 — 53.9×35 mm — track<br>always: 22 mm 3-Track — code 41084 — 83.9×35 mm — track |
| Shutter Top | shutter | 1 | shutterW | 45° | 22 mm Shutter — code 41082 — 55.8×22 mm — shutter |
| Shutter Bottom | shutter | 1 | shutterW | 45° | 22 mm Shutter — code 41082 — 55.8×22 mm — shutter |
| Shutter {lr} | shutter | 1 | shutterH | 45° | 22 mm Shutter — code 41082 — 55.8×22 mm — shutter |
| Interlock Side | shutter | 1 | shutterH | 45° | 22 mm Shutter — code 41082 — 55.8×22 mm — shutter |

Size rules:

| Size | When | Rule | Evidence | Why |
|---|---|---|---|---|
| Frame top / bottom (`frameW`) | always | W | observed | 45° frame goes round, full width |
| Frame side (`frameH`) | always | H | observed | 45° frame goes round, full height |
| Shutter width (`shutterW`) | always | W ÷ 2 | observed | Every shutter half the window (W/2) — the usual shop way |
| Shutter height (`shutterH`) | always | H − 46 | suggested | From the drawings (window built from the sections): 2 × 35.0 track − 24 roller; roller on the pointed track, no clip. Check on one window. |
| Glass width (`glassW`) | always | shutterW − 94.8 | suggested | From the drawings (window built from the sections): Ample 41082 pocket (shutter on all 4 sides): glass stops 47.4 mm in from each shutter edge. Check on one window. |
| Glass height (`glassH`) | always | shutterH − 94.8 | suggested | From the drawings (window built from the sections): Ample 41082 pocket (shutter on all 4 sides): glass stops 47.4 mm in from each shutter edge. Check on one window. |

Worked example: 6′×4′ (1828.8 × 1219.2 mm), 2 track, GG, default choices:

| Piece | Length | Cut | Pieces |
|---|---|---|---|
| Frame Top | 1828.8 mm | 45° | 1 |
| Frame Left | 1219.2 mm | 45° | 1 |
| Frame Right | 1219.2 mm | 45° | 1 |
| Frame Bottom | 1828.8 mm | 45° | 1 |
| Shutter Shutter Top | 914.4 mm | 45° | 2 |
| Shutter Shutter Bottom | 914.4 mm | 45° | 2 |
| Shutter Shutter Left | 1173.2 mm | 45° | 1 |
| Shutter Interlock Side | 1173.2 mm | 45° | 2 |
| Shutter Shutter Right | 1173.2 mm | 45° | 1 |
| Glass/mesh glass | 819.6 × 1078.4 mm | — | 2 |

---

## Euro 29 mm

- App id: `ample-29` · family: domal-type · series: euro 29 mm · status: draft
- In short: 47.7 mm U track with roller clip 914401; shutter 41055 on all sides + interlock clip 41054, or slim interlock; jali 41050
- Layouts: 2 track (GG, GJ); 3 track (GGJ, GGG)  (G glass, J jali/mesh)
- Choices the shop makes:
  - Interlock Side (`pick_shutterMeet`): 29 mm Slim Interlock — small (default) · 29 mm Slim Interlock — big · 29 mm Slim Interlock — light · 29 mm Slim Interlock — double glass
  - Meeting side (`meet`): Slim interlock · Shutter + interlock clip (default)

Pieces:

| Piece | Per | Qty | Length rule | Cut | Section |
|---|---|---|---|---|---|
| Frame Top | window | 1 | frameW | 45° | tracks=1/2: 29 mm 2-Track — code 914400 — 50×47.69 mm — track<br>always: 29 mm 3-Track — code 41052 — 85.8×47.7 mm — track |
| Frame Left | window | 1 | frameH | 45° | tracks=1/2: 29 mm 2-Track — code 914400 — 50×47.69 mm — track<br>always: 29 mm 3-Track — code 41052 — 85.8×47.7 mm — track |
| Frame Right | window | 1 | frameH | 45° | tracks=1/2: 29 mm 2-Track — code 914400 — 50×47.69 mm — track<br>always: 29 mm 3-Track — code 41052 — 85.8×47.7 mm — track |
| Frame Bottom | window | 1 | frameW | 45° | tracks=1/2: 29 mm 2-Track — code 914400 — 50×47.69 mm — track<br>always: 29 mm 3-Track — code 41052 — 85.8×47.7 mm — track |
| Track Clip | shutter | 1 | clipW | 90° | 29 mm Track Clip — code 914401 — 12.99×16.09 mm — rail |
| Shutter Top | shutter | 1 | shutterW | 45° | 29 mm Shutter — code 41055 — 65×29 mm — shutter |
| Shutter Bottom | shutter | 1 | shutterW | 45° | 29 mm Shutter — code 41055 — 65×29 mm — shutter |
| Shutter {lr} | shutter | 1 | shutterH | 45° | 29 mm Shutter — code 41055 — 65×29 mm — shutter |
| Interlock Side | shutter | 1 | shutterH | 45° | meet=clip: 29 mm Shutter — code 41055 — 65×29 mm — shutter<br>pick_shutterMeet=el29_slim: 29 mm Slim Interlock — small — code 2913 — 34.3×25 mm — slim-interlock<br>pick_shutterMeet=el29_slim_big: 29 mm Slim Interlock — big — code 2914 — 80×25 mm — slim-interlock<br>pick_shutterMeet=el29_slim_light: 29 mm Slim Interlock — light — code 2915 — 35×17.5 mm — slim-interlock<br>pick_shutterMeet=el29_slim_dgu: 29 mm Slim Interlock — double glass — code 2916 — 34.1×25 mm — slim-interlock<br>always: 29 mm Slim Interlock — small — code 2913 — 34.3×25 mm — slim-interlock |
| Interlock Clip (only if meet=clip) | meeting | 2 | shutterH | 90° | 29 mm Interlock Clip — code 41054 — 33.63×38.89 mm — interlock-patti |

Size rules:

| Size | When | Rule | Evidence | Why |
|---|---|---|---|---|
| Frame top / bottom (`frameW`) | always | W | observed | 45° frame goes round, full width |
| Frame side (`frameH`) | always | H | observed | 45° frame goes round, full height |
| Track clip (`clipW`) | always | W − 95.4 | suggested | From the drawings (window built from the sections): clear width between the side tips: W − 95.4 (2 × 47.7). Check on one window. |
| Shutter width (`shutterW`) | always | W ÷ 2 | observed | Every shutter half the window (W/2) — the usual shop way |
| Shutter height (`shutterH`) | always | H − 73.8 | suggested | From the drawings (window built from the sections): 2 × 47.7 track + 2.4 clip − 24 roller. Check on one window. |
| Glass width (`glassW`) | meet=clip | shutterW − 105.4 | suggested | From the drawings (window built from the sections): glass stops 52.7 mm in (Ample 41055) — the same shutter on both sides. Check on one window. |
| Glass width (`glassW`) | meet=slim, pick_shutterMeet=el29_slim | shutterW − 65.6 | suggested | From the drawings (window built from the sections): 41055 pocket 52.7 + small slim 2913 12.9 (where the glass stops in its top slot, + 3.9). Check on one window. |
| Glass width (`glassW`) | meet=slim, pick_shutterMeet=el29_slim_big | shutterW − 65.5 | suggested | From the drawings (window built from the sections): 41055 pocket 52.7 + big slim 2914 12.8 (where the glass stops in its top slot, + 3.9). Check on one window. |
| Glass width (`glassW`) | meet=slim, pick_shutterMeet=el29_slim_light | shutterW − 63.4 | suggested | From the drawings (window built from the sections): 41055 pocket 52.7 + light slim 2915 10.7 (where the glass stops in its top slot, + 3.9). Check on one window. |
| Glass width (`glassW`) | meet=slim, pick_shutterMeet=el29_slim_dgu | shutterW − 65.6 | suggested | From the drawings (window built from the sections): 41055 pocket 52.7 + double-glass slim 2916 12.9 (where the glass stops in its top slot, + 3.9). Check on one window. |
| Glass width (`glassW`) | always | shutterW + **UNKNOWN** (app refuses to cut) | unknown | — |
| Glass height (`glassH`) | always | shutterH − 105.4 | suggested | From the drawings (window built from the sections): Ample 41055 pocket (shutter on all 4 sides): glass stops 52.7 mm in from each shutter edge. Check on one window. |

Worked example: 6′×4′ (1828.8 × 1219.2 mm), 2 track, GG, default choices:

| Piece | Length | Cut | Pieces |
|---|---|---|---|
| Frame Top | 1828.8 mm | 45° | 1 |
| Frame Left | 1219.2 mm | 45° | 1 |
| Frame Right | 1219.2 mm | 45° | 1 |
| Frame Bottom | 1828.8 mm | 45° | 1 |
| Track Clip | 1733.4 mm | 90° | 2 |
| Shutter Shutter Top | 914.4 mm | 45° | 2 |
| Shutter Shutter Bottom | 914.4 mm | 45° | 2 |
| Shutter Shutter Left | 1145.4 mm | 45° | 1 |
| Shutter Interlock Side | 1145.4 mm | 45° | 2 |
| Shutter Shutter Right | 1145.4 mm | 45° | 1 |
| Interlock Clip 1 | 1145.4 mm | 90° | 1 |
| Interlock Clip 2 | 1145.4 mm | 90° | 1 |
| Glass/mesh glass | 809 × 1040 mm | — | 2 |

Worked example: 6′×4′ (1828.8 × 1219.2 mm), 2 track, GG, meet=slim:

| Piece | Length | Cut | Pieces |
|---|---|---|---|
| Frame Top | 1828.8 mm | 45° | 1 |
| Frame Left | 1219.2 mm | 45° | 1 |
| Frame Right | 1219.2 mm | 45° | 1 |
| Frame Bottom | 1828.8 mm | 45° | 1 |
| Track Clip | 1733.4 mm | 90° | 2 |
| Shutter Shutter Top | 914.4 mm | 45° | 2 |
| Shutter Shutter Bottom | 914.4 mm | 45° | 2 |
| Shutter Shutter Left | 1145.4 mm | 45° | 1 |
| Shutter Interlock Side | 1145.4 mm | 45° | 2 |
| Shutter Shutter Right | 1145.4 mm | 45° | 1 |
| Glass/mesh glass | 848.8 × 1040 mm | — | 2 |

---

## Euro 25 mm

- App id: `euro-25` · family: domal-type · series: euro 25 mm · status: draft
- In short: BH-2551 / 2553 track on all 4 sides at 45°, roller clip 2559; slim interlock small (2556) or big (2557), or interlock clip
- Layouts: 2 track (GG, GJ); 3 track (GGJ, GGG)  (G glass, J jali/mesh)
- Choices the shop makes:
  - Slim Interlock (`pick_shutterMeet`): Gulf 25 Slim Interlock — small (default) · Gulf 25 Slim Interlock — big (reinforcement)
  - Meeting side (`meet`): Slim interlock (default) · Shutter + interlock clip

Pieces:

| Piece | Per | Qty | Length rule | Cut | Section |
|---|---|---|---|---|---|
| Frame Top | window | 1 | frameW | 45° | tracks=1/2: Gulf 25 2-Track (top and bottom) — code BH-2551 — 71.8×29.8 mm — track<br>always: Gulf 25 3-Track (top and bottom) — code BH-2553 — 108.6×29.8 mm — track |
| Frame Left | window | 1 | frameH | 45° | tracks=1/2: Gulf 25 2-Track (top and bottom) — code BH-2551 — 71.8×29.8 mm — track<br>always: Gulf 25 3-Track (top and bottom) — code BH-2553 — 108.6×29.8 mm — track |
| Frame Right | window | 1 | frameH | 45° | tracks=1/2: Gulf 25 2-Track (top and bottom) — code BH-2551 — 71.8×29.8 mm — track<br>always: Gulf 25 3-Track (top and bottom) — code BH-2553 — 108.6×29.8 mm — track |
| Frame Bottom | window | 1 | frameW | 45° | tracks=1/2: Gulf 25 2-Track (top and bottom) — code BH-2551 — 71.8×29.8 mm — track<br>always: Gulf 25 3-Track (top and bottom) — code BH-2553 — 108.6×29.8 mm — track |
| Track Clip | shutter | 1 | clipW | 90° | Euro Track Clip — code BH-2559 — 11×13.47 mm — rail |
| Shutter Top | shutter | 1 | shutterW | 45° | Gulf 25 Shutter — code BH-2555 — 62.37×25.5 mm — handle |
| Shutter Bottom | shutter | 1 | shutterW | 45° | Gulf 25 Shutter — code BH-2555 — 62.37×25.5 mm — handle |
| Shutter {lr} | shutter | 1 | shutterH | 45° | Gulf 25 Shutter — code BH-2555 — 62.37×25.5 mm — handle |
| Interlock Side | shutter | 1 | shutterH | 45° | meet=clip: Gulf 25 Shutter — code BH-2555 — 62.37×25.5 mm — handle<br>pick_shutterMeet=bh_2556: Gulf 25 Slim Interlock — small — code BH-2556 — 35.8×20.3 mm — slim-interlock<br>pick_shutterMeet=bh_2557: Gulf 25 Slim Interlock — big (reinforcement) — code BH-2557 — 80×20.2 mm — slim-interlock<br>always: Gulf 25 Slim Interlock — small — code BH-2556 — 35.8×20.3 mm — slim-interlock |
| Interlock Clip (only if meet=clip) | meeting | 2 | shutterH | 90° | Interlock Clip — code BH-6054 — 38×30.3 mm — interlock-patti |

Size rules:

| Size | When | Rule | Evidence | Why |
|---|---|---|---|---|
| Frame top / bottom (`frameW`) | always | W | observed | Euro track goes round at 45°, full width |
| Frame side (`frameH`) | always | H | observed | Euro track goes round at 45°, full height |
| Track clip (`clipW`) | always | W − 59.6 | suggested | From the drawings (window built from the sections): clear width between the side tips: W − 59.6 (2 × 29.8, BH-2551 on the sides). Check on one window. |
| Shutter width (`shutterW`) | always | W ÷ 2 | observed | Every shutter half the window (W/2) — the usual shop way |
| Shutter height (`shutterH`) | always | H − 39.6 | suggested | From the drawings (window built from the sections): 2 × 29.8 track + 3.9 clip − 24 roller. Check on one window. |
| Glass width (`glassW`) | meet=clip | shutterW − 108.2 | suggested | From the drawings (window built from the sections): glass stops 54.1 mm in (BH-2555) — the same shutter on both sides. Check on one window. |
| Glass width (`glassW`) | pick_shutterMeet=bh_2556 | shutterW − 65.8 | suggested | From the drawings (window built from the sections): BH-2555 pocket 54.1 mm + slim 2556 pocket 11.7 mm. Check on one window. |
| Glass width (`glassW`) | pick_shutterMeet=bh_2557 | shutterW − 65.6 | suggested | From the drawings (window built from the sections): BH-2555 pocket 54.1 mm + slim 2557 pocket 11.5 mm. Check on one window. |
| Glass width (`glassW`) | always | shutterW + **UNKNOWN** (app refuses to cut) | unknown | — |
| Glass height (`glassH`) | always | shutterH − 108.2 | suggested | From the drawings (window built from the sections): BH-2555 pocket (2555 on all 4 sides, founder): glass stops 54.1 mm in from the top and bottom edges. Check on one window. |

Worked example: 6′×4′ (1828.8 × 1219.2 mm), 2 track, GG, default choices:

| Piece | Length | Cut | Pieces |
|---|---|---|---|
| Frame Top | 1828.8 mm | 45° | 1 |
| Frame Left | 1219.2 mm | 45° | 1 |
| Frame Right | 1219.2 mm | 45° | 1 |
| Frame Bottom | 1828.8 mm | 45° | 1 |
| Track Clip | 1769.2 mm | 90° | 2 |
| Shutter Shutter Top | 914.4 mm | 45° | 2 |
| Shutter Shutter Bottom | 914.4 mm | 45° | 2 |
| Shutter Shutter Left | 1179.6 mm | 45° | 1 |
| Shutter Interlock Side | 1179.6 mm | 45° | 2 |
| Shutter Shutter Right | 1179.6 mm | 45° | 1 |
| Glass/mesh glass | 848.6 × 1071.4 mm | — | 2 |

Worked example: 6′×4′ (1828.8 × 1219.2 mm), 2 track, GG, meet=clip:

| Piece | Length | Cut | Pieces |
|---|---|---|---|
| Frame Top | 1828.8 mm | 45° | 1 |
| Frame Left | 1219.2 mm | 45° | 1 |
| Frame Right | 1219.2 mm | 45° | 1 |
| Frame Bottom | 1828.8 mm | 45° | 1 |
| Track Clip | 1769.2 mm | 90° | 2 |
| Shutter Shutter Top | 914.4 mm | 45° | 2 |
| Shutter Shutter Bottom | 914.4 mm | 45° | 2 |
| Shutter Shutter Left | 1179.6 mm | 45° | 1 |
| Shutter Interlock Side | 1179.6 mm | 45° | 2 |
| Shutter Shutter Right | 1179.6 mm | 45° | 1 |
| Interlock Clip 1 | 1179.6 mm | 90° | 1 |
| Interlock Clip 2 | 1179.6 mm | 90° | 1 |
| Glass/mesh glass | 806.2 × 1071.4 mm | — | 2 |

---

## Euro 26 mm

- App id: `euro-26` · family: domal-type · series: euro 26 mm · status: draft
- In short: BH-6000 / 6001 track on all 4 sides, BH-2559 roller clip; shutter BH-6003, slim interlock small (6052) or big (6053)
- Layouts: 2 track (GG, GJ); 3 track (GGJ, GGG)  (G glass, J jali/mesh)
- Choices the shop makes:
  - Slim Interlock (`pick_shutterMeet`): Euro Slim Interlock — small (default) · Euro Slim Interlock — big (reinforcement)
  - Meeting side (`meet`): Slim interlock (default) · Shutter + interlock clip

Pieces:

| Piece | Per | Qty | Length rule | Cut | Section |
|---|---|---|---|---|---|
| Frame Top | window | 1 | frameW | 45° | tracks=1/2: Euro 2-Track — code BH-6000 — 64.3×45 mm — frame<br>always: Euro 3-Track — code BH-6001 — 99.3×45 mm — frame |
| Frame Left | window | 1 | frameH | 45° | tracks=1/2: Euro 2-Track — code BH-6000 — 64.3×45 mm — frame<br>always: Euro 3-Track — code BH-6001 — 99.3×45 mm — frame |
| Frame Right | window | 1 | frameH | 45° | tracks=1/2: Euro 2-Track — code BH-6000 — 64.3×45 mm — frame<br>always: Euro 3-Track — code BH-6001 — 99.3×45 mm — frame |
| Frame Bottom | window | 1 | frameW | 45° | tracks=1/2: Euro 2-Track — code BH-6000 — 64.3×45 mm — frame<br>always: Euro 3-Track — code BH-6001 — 99.3×45 mm — frame |
| Track Clip | shutter | 1 | clipW | 90° | Euro Track Clip — code BH-2559 — 11×13.47 mm — rail |
| Shutter Top | shutter | 1 | shutterW | 45° | Euro Shutter 65×26 — code BH-6003 — 65×26 mm — shutter |
| Shutter Bottom | shutter | 1 | shutterW | 45° | Euro Shutter 65×26 — code BH-6003 — 65×26 mm — shutter |
| Shutter {lr} | shutter | 1 | shutterH | 45° | Euro Shutter 65×26 — code BH-6003 — 65×26 mm — shutter |
| Interlock Side | shutter | 1 | shutterH | 45° | meet=clip: Euro Shutter 65×26 — code BH-6003 — 65×26 mm — shutter<br>pick_shutterMeet=bh_6052: Euro Slim Interlock — small — code BH-6052 — 32.6×23.7 mm — slim-interlock<br>pick_shutterMeet=bh_6053: Euro Slim Interlock — big (reinforcement) — code BH-6053 — 62.6×23.7 mm — slim-interlock<br>always: Euro Slim Interlock — small — code BH-6052 — 32.6×23.7 mm — slim-interlock |
| Interlock Clip (only if meet=clip) | meeting | 2 | shutterH | 90° | Interlock Clip — code BH-6054 — 38×30.3 mm — interlock-patti |

Size rules:

| Size | When | Rule | Evidence | Why |
|---|---|---|---|---|
| Frame top / bottom (`frameW`) | always | W | observed | Founder: Euro track goes round like Domal — 45°, full width |
| Frame side (`frameH`) | always | H | observed | Founder: Euro track goes round like Domal — 45°, full height |
| Track clip (`clipW`) | always | W − 89.9 | suggested | From the drawings (window built from the sections): clear width between the side U tips (2 × 45.0). Check on one window. |
| Shutter width (`shutterW`) | always | W ÷ 2 | observed | Every shutter half the window (W/2) — the usual shop way |
| Shutter height (`shutterH`) | tracks=2 | H − 69.8 | suggested | From the drawings (window built from the sections): 2 × 44.9 track + 3.9 clip − 24 roller. Check on one window. |
| Shutter height (`shutterH`) | always | H − 69.9 | suggested | From the drawings (window built from the sections): 2 × 45.0 track + 3.9 clip − 24 roller. Check on one window. |
| Glass width (`glassW`) | meet=clip | shutterW − 118.2 | suggested | From the drawings (window built from the sections): glass stops 59.1 mm in (BH-6003) — the same shutter on both sides. Check on one window. |
| Glass width (`glassW`) | pick_shutterMeet=bh_6052 | shutterW − 76.5 | suggested | From the drawings (window built from the sections): BH-6003 pocket 59.1 mm + slim 6052 pocket (glass enters its 10.2 mm top slot) 17.4 mm. Check on one window. |
| Glass width (`glassW`) | pick_shutterMeet=bh_6053 | shutterW − 76.5 | suggested | From the drawings (window built from the sections): BH-6003 pocket 59.1 mm + slim 6053 pocket 17.4 mm. Check on one window. |
| Glass width (`glassW`) | always | shutterW + **UNKNOWN** (app refuses to cut) | unknown | — |
| Glass height (`glassH`) | always | shutterH − 118.2 | suggested | From the drawings (window built from the sections): BH-6003 pocket: glass stops 59.1 mm in from the top and bottom edges. Check on one window. |

Worked example: 6′×4′ (1828.8 × 1219.2 mm), 2 track, GG, default choices:

| Piece | Length | Cut | Pieces |
|---|---|---|---|
| Frame Top | 1828.8 mm | 45° | 1 |
| Frame Left | 1219.2 mm | 45° | 1 |
| Frame Right | 1219.2 mm | 45° | 1 |
| Frame Bottom | 1828.8 mm | 45° | 1 |
| Track Clip | 1738.9 mm | 90° | 2 |
| Shutter Shutter Top | 914.4 mm | 45° | 2 |
| Shutter Shutter Bottom | 914.4 mm | 45° | 2 |
| Shutter Shutter Left | 1149.4 mm | 45° | 1 |
| Shutter Interlock Side | 1149.4 mm | 45° | 2 |
| Shutter Shutter Right | 1149.4 mm | 45° | 1 |
| Glass/mesh glass | 837.9 × 1031.2 mm | — | 2 |

Worked example: 6′×4′ (1828.8 × 1219.2 mm), 2 track, GG, meet=clip:

| Piece | Length | Cut | Pieces |
|---|---|---|---|
| Frame Top | 1828.8 mm | 45° | 1 |
| Frame Left | 1219.2 mm | 45° | 1 |
| Frame Right | 1219.2 mm | 45° | 1 |
| Frame Bottom | 1828.8 mm | 45° | 1 |
| Track Clip | 1738.9 mm | 90° | 2 |
| Shutter Shutter Top | 914.4 mm | 45° | 2 |
| Shutter Shutter Bottom | 914.4 mm | 45° | 2 |
| Shutter Shutter Left | 1149.4 mm | 45° | 1 |
| Shutter Interlock Side | 1149.4 mm | 45° | 2 |
| Shutter Shutter Right | 1149.4 mm | 45° | 1 |
| Interlock Clip 1 | 1149.4 mm | 90° | 1 |
| Interlock Clip 2 | 1149.4 mm | 90° | 1 |
| Glass/mesh glass | 796.2 × 1031.2 mm | — | 2 |

---

## Euro 35 mm

- App id: `euro-35` · family: domal-type · series: euro 35 mm · status: draft
- In short: U-groove track 6705 / 6706 (= Eleanor 3501 / 3502) all round with roller clip; shutter 6712; slim interlock small (6707) or big (6709)
- Layouts: 2 track (GG, GJ, JJ); 3 track (GGJ, GGG, GJJ, GG)  (G glass, J jali/mesh)
- Choices the shop makes:
  - Slim Interlock (`pick_shutterMeet`): Euro 35 Slim Interlock — small (default) · Euro 35 Slim Interlock — big (reinforcement)
  - Meeting side (`meet`): Slim interlock (default) · Shutter + interlock clip

Pieces:

| Piece | Per | Qty | Length rule | Cut | Section |
|---|---|---|---|---|---|
| Frame Top | window | 1 | frameW | 45° | tracks=1/2: Euro 35 2-Track — code BH-6705 / 3501 — 77.71×46.3 mm — frame<br>always: Euro 35 3-Track — code BH-6706 / 3502 — 124.09×46.3 mm — frame |
| Frame Left | window | 1 | frameH | 45° | tracks=1/2: Euro 35 2-Track — code BH-6705 / 3501 — 77.71×46.3 mm — frame<br>always: Euro 35 3-Track — code BH-6706 / 3502 — 124.09×46.3 mm — frame |
| Frame Right | window | 1 | frameH | 45° | tracks=1/2: Euro 35 2-Track — code BH-6705 / 3501 — 77.71×46.3 mm — frame<br>always: Euro 35 3-Track — code BH-6706 / 3502 — 124.09×46.3 mm — frame |
| Frame Bottom | window | 1 | frameW | 45° | tracks=1/2: Euro 35 2-Track — code BH-6705 / 3501 — 77.71×46.3 mm — frame<br>always: Euro 35 3-Track — code BH-6706 / 3502 — 124.09×46.3 mm — frame |
| Track Clip | shutter | 1 | clipW | 90° | Euro 35 Track Clip — code BH-6513 — 14.5×17.96 mm — rail |
| Shutter Top | shutter | 1 | shutterW | 45° | Euro 35 Shutter 75×35 — code BH-6712 / 3503 — 75×35 mm — shutter |
| Shutter Bottom | shutter | 1 | shutterW | 45° | Euro 35 Shutter 75×35 — code BH-6712 / 3503 — 75×35 mm — shutter |
| Shutter {lr} | shutter | 1 | shutterH | 45° | Euro 35 Shutter 75×35 — code BH-6712 / 3503 — 75×35 mm — shutter |
| Interlock Side | shutter | 1 | shutterH | 45° | meet=clip: Euro 35 Shutter 75×35 — code BH-6712 / 3503 — 75×35 mm — shutter<br>pick_shutterMeet=e35_slim: Euro 35 Slim Interlock — small — code BH-6707 / 3506 — 42.55×31 mm — slim-interlock<br>pick_shutterMeet=e35_big: Euro 35 Slim Interlock — big (reinforcement) — code BH-6709 — 89.86×31.1 mm — slim-interlock<br>always: Euro 35 Slim Interlock — small — code BH-6707 / 3506 — 42.55×31 mm — slim-interlock |
| Interlock Clip (only if meet=clip) | meeting | 2 | shutterH | 90° | Domal 35 I/L Clip — code BH-6711 / 3510 — 41×38.9 mm — interlock-patti |

Size rules:

| Size | When | Rule | Evidence | Why |
|---|---|---|---|---|
| Frame top / bottom (`frameW`) | always | W | observed | Euro track goes round at 45°, full width |
| Frame side (`frameH`) | always | H | observed | Euro track goes round at 45°, full height |
| Track clip (`clipW`) | always | W − 92.6 | suggested | From the drawings (window built from the sections): clear width between the side U tips (2 × 46.3). Check on one window. |
| Shutter width (`shutterW`) | always | W ÷ 2 | observed | Every shutter half the window (W/2) |
| Shutter height (`shutterH`) | always | H − 72.6 | suggested | From the drawings (window built from the sections): 2 × 46.3 track + 4.0 clip − 24 roller. Check on one window. |
| Glass width (`glassW`) | meet=clip | shutterW − 118 | suggested | From the drawings (window built from the sections): glass stops 59.0 mm in (BH-6712) — the same shutter on both sides. Check on one window. |
| Glass width (`glassW`) | pick_shutterMeet=e35_slim | shutterW − 73.1 | suggested | From the drawings (window built from the sections): shutter pocket 59.0 + slim 6707 pocket 14.1. Check on one window. |
| Glass width (`glassW`) | pick_shutterMeet=e35_big | shutterW − 73.6 | suggested | From the drawings (window built from the sections): shutter pocket 59.0 + slim 6709 pocket 14.6. Check on one window. |
| Glass width (`glassW`) | always | shutterW + **UNKNOWN** (app refuses to cut) | unknown | — |
| Glass height (`glassH`) | always | shutterH − 118 | suggested | From the drawings (window built from the sections): glass stops 59 mm in from the top and bottom edges (6712). Check on one window. |

Worked example: 6′×4′ (1828.8 × 1219.2 mm), 2 track, GG, default choices:

| Piece | Length | Cut | Pieces |
|---|---|---|---|
| Frame Top | 1828.8 mm | 45° | 1 |
| Frame Left | 1219.2 mm | 45° | 1 |
| Frame Right | 1219.2 mm | 45° | 1 |
| Frame Bottom | 1828.8 mm | 45° | 1 |
| Track Clip | 1736.2 mm | 90° | 2 |
| Shutter Shutter Top | 914.4 mm | 45° | 2 |
| Shutter Shutter Bottom | 914.4 mm | 45° | 2 |
| Shutter Shutter Left | 1146.6 mm | 45° | 1 |
| Shutter Interlock Side | 1146.6 mm | 45° | 2 |
| Shutter Shutter Right | 1146.6 mm | 45° | 1 |
| Glass/mesh glass | 841.3 × 1028.6 mm | — | 2 |

Worked example: 6′×4′ (1828.8 × 1219.2 mm), 2 track, GG, meet=clip:

| Piece | Length | Cut | Pieces |
|---|---|---|---|
| Frame Top | 1828.8 mm | 45° | 1 |
| Frame Left | 1219.2 mm | 45° | 1 |
| Frame Right | 1219.2 mm | 45° | 1 |
| Frame Bottom | 1828.8 mm | 45° | 1 |
| Track Clip | 1736.2 mm | 90° | 2 |
| Shutter Shutter Top | 914.4 mm | 45° | 2 |
| Shutter Shutter Bottom | 914.4 mm | 45° | 2 |
| Shutter Shutter Left | 1146.6 mm | 45° | 1 |
| Shutter Interlock Side | 1146.6 mm | 45° | 2 |
| Shutter Shutter Right | 1146.6 mm | 45° | 1 |
| Interlock Clip 1 | 1146.6 mm | 90° | 1 |
| Interlock Clip 2 | 1146.6 mm | 90° | 1 |
| Glass/mesh glass | 796.4 × 1028.6 mm | — | 2 |

---

## Gulf 25 mm

- App id: `gulf-25` · family: domal-type · series: gulf 25 mm · status: draft
- In short: Like Euro: BH-2551 / 2553 top and bottom with roller clip 2559; left and right one-groove BH-2550 / 2552; slim interlock small (2556) or big (2557)
- Layouts: 2 track (GG, GJ); 3 track (GGJ, GGG)  (G glass, J jali/mesh)
- Choices the shop makes:
  - Slim Interlock (`pick_shutterMeet`): Gulf 25 Slim Interlock — small (default) · Gulf 25 Slim Interlock — big (reinforcement)
  - Meeting side (`meet`): Slim interlock (default) · Shutter + interlock clip

Pieces:

| Piece | Per | Qty | Length rule | Cut | Section |
|---|---|---|---|---|---|
| Top Track | window | 1 | frameW | 90° | tracks=1/2: Gulf 25 2-Track (top and bottom) — code BH-2551 — 71.8×29.8 mm — track<br>always: Gulf 25 3-Track (top and bottom) — code BH-2553 — 108.6×29.8 mm — track |
| Bottom Track | window | 1 | frameW | 90° | tracks=1/2: Gulf 25 2-Track (top and bottom) — code BH-2551 — 71.8×29.8 mm — track<br>always: Gulf 25 3-Track (top and bottom) — code BH-2553 — 108.6×29.8 mm — track |
| Left Side (one groove) | window | 1 | frameH | 90° | tracks=1/2: Gulf 25 Side Track, one groove (2-track) — code BH-2550 — 75.7×24.8 mm — track<br>always: Gulf 25 Side Track, one groove (3-track) — code BH-2552 — 112.5×24.8 mm — track |
| Right Side (one groove) | window | 1 | frameH | 90° | tracks=1/2: Gulf 25 Side Track, one groove (2-track) — code BH-2550 — 75.7×24.8 mm — track<br>always: Gulf 25 Side Track, one groove (3-track) — code BH-2552 — 112.5×24.8 mm — track |
| Track Clip | shutter | 1 | clipW | 90° | Euro Track Clip — code BH-2559 — 11×13.47 mm — rail |
| Shutter Top | shutter | 1 | shutterW | 45° | Gulf 25 Shutter — code BH-2555 — 62.37×25.5 mm — handle |
| Shutter Bottom | shutter | 1 | shutterW | 45° | Gulf 25 Shutter — code BH-2555 — 62.37×25.5 mm — handle |
| Shutter {lr} | shutter | 1 | shutterH | 45° | Gulf 25 Shutter — code BH-2555 — 62.37×25.5 mm — handle |
| Interlock Side | shutter | 1 | shutterH | 45° | meet=clip: Gulf 25 Shutter — code BH-2555 — 62.37×25.5 mm — handle<br>pick_shutterMeet=bh_2556: Gulf 25 Slim Interlock — small — code BH-2556 — 35.8×20.3 mm — slim-interlock<br>pick_shutterMeet=bh_2557: Gulf 25 Slim Interlock — big (reinforcement) — code BH-2557 — 80×20.2 mm — slim-interlock<br>always: Gulf 25 Slim Interlock — small — code BH-2556 — 35.8×20.3 mm — slim-interlock |
| Interlock Clip (only if meet=clip) | meeting | 2 | shutterH | 90° | Interlock Clip — code BH-6054 — 38×30.3 mm — interlock-patti |

Size rules:

| Size | When | Rule | Evidence | Why |
|---|---|---|---|---|
| Frame top / bottom (`frameW`) | always | W − 49.6 | suggested | From the drawings (window built from the sections): top and bottom fit between the BH-2550 sides (24.8 mm each, 90°); if your shop runs them full width, set this to W. Check on one window. |
| Frame side (`frameH`) | always | H | observed | Gulf: sides run full height (90°) |
| Track clip (`clipW`) | always | W − 49.6 | suggested | From the drawings (window built from the sections): clear width between the side tips: W − 49.6 (BH-2550 sides). Check on one window. |
| Shutter width (`shutterW`) | always | W ÷ 2 | observed | Every shutter half the window (W/2) — the usual shop way |
| Shutter height (`shutterH`) | always | H − 39.6 | suggested | From the drawings (window built from the sections): 2 × 29.8 track + 3.9 clip − 24 roller. Check on one window. |
| Glass width (`glassW`) | meet=clip | shutterW − 108.2 | suggested | From the drawings (window built from the sections): glass stops 54.1 mm in (BH-2555) — the same shutter on both sides. Check on one window. |
| Glass width (`glassW`) | pick_shutterMeet=bh_2556 | shutterW − 65.8 | suggested | From the drawings (window built from the sections): BH-2555 pocket 54.1 mm + slim 2556 pocket 11.7 mm. Check on one window. |
| Glass width (`glassW`) | pick_shutterMeet=bh_2557 | shutterW − 65.6 | suggested | From the drawings (window built from the sections): BH-2555 pocket 54.1 mm + slim 2557 pocket 11.5 mm. Check on one window. |
| Glass width (`glassW`) | always | shutterW + **UNKNOWN** (app refuses to cut) | unknown | — |
| Glass height (`glassH`) | always | shutterH − 108.2 | suggested | From the drawings (window built from the sections): BH-2555 pocket (2555 on all 4 sides, founder): glass stops 54.1 mm in from the top and bottom edges. Check on one window. |

Worked example: 6′×4′ (1828.8 × 1219.2 mm), 2 track, GG, default choices:

| Piece | Length | Cut | Pieces |
|---|---|---|---|
| Top Track | 1779.2 mm | 90° | 1 |
| Bottom Track | 1779.2 mm | 90° | 1 |
| Left Side (one groove) | 1219.2 mm | 90° | 1 |
| Right Side (one groove) | 1219.2 mm | 90° | 1 |
| Track Clip | 1779.2 mm | 90° | 2 |
| Shutter Shutter Top | 914.4 mm | 45° | 2 |
| Shutter Shutter Bottom | 914.4 mm | 45° | 2 |
| Shutter Shutter Left | 1179.6 mm | 45° | 1 |
| Shutter Interlock Side | 1179.6 mm | 45° | 2 |
| Shutter Shutter Right | 1179.6 mm | 45° | 1 |
| Glass/mesh glass | 848.6 × 1071.4 mm | — | 2 |

Worked example: 6′×4′ (1828.8 × 1219.2 mm), 2 track, GG, meet=clip:

| Piece | Length | Cut | Pieces |
|---|---|---|---|
| Top Track | 1779.2 mm | 90° | 1 |
| Bottom Track | 1779.2 mm | 90° | 1 |
| Left Side (one groove) | 1219.2 mm | 90° | 1 |
| Right Side (one groove) | 1219.2 mm | 90° | 1 |
| Track Clip | 1779.2 mm | 90° | 2 |
| Shutter Shutter Top | 914.4 mm | 45° | 2 |
| Shutter Shutter Bottom | 914.4 mm | 45° | 2 |
| Shutter Shutter Left | 1179.6 mm | 45° | 1 |
| Shutter Interlock Side | 1179.6 mm | 45° | 2 |
| Shutter Shutter Right | 1179.6 mm | 45° | 1 |
| Interlock Clip 1 | 1179.6 mm | 90° | 1 |
| Interlock Clip 2 | 1179.6 mm | 90° | 1 |
| Glass/mesh glass | 806.2 × 1071.4 mm | — | 2 |

---

## Gulf 31 mm

- App id: `bh-31` · family: domal-type · series: gulf 31 mm · status: draft
- In short: Gulf: BH-6401 / 6403 top and bottom with roller clip; left and right one-groove BH-6400 / 6402; slim interlock small (6408) or big (6409)
- Layouts: 2 track (GG, GJ); 3 track (GGJ, GGG)  (G glass, J jali/mesh)
- Choices the shop makes:
  - Slim Interlock (`pick_shutterMeet`): 31 mm Slim Interlock — small (default) · 31 mm Slim Interlock — big (reinforcement) · 31 mm Slim Interlock — small, double glass · 31 mm Slim Interlock — big, double glass
  - Meeting side (`meet`): Slim interlock (default) · Shutter + interlock clip

Pieces:

| Piece | Per | Qty | Length rule | Cut | Section |
|---|---|---|---|---|---|
| Top Track | window | 1 | frameW | 90° | tracks=1/2: 31 mm 2-Track (top and bottom) — code BH-6401 — 80.8×47.6 mm — track<br>always: 31 mm 3-Track (top and bottom) — code BH-6403 — 120.5×47.6 mm — track |
| Bottom Track | window | 1 | frameW | 90° | tracks=1/2: 31 mm 2-Track (top and bottom) — code BH-6401 — 80.8×47.6 mm — track<br>always: 31 mm 3-Track (top and bottom) — code BH-6403 — 120.5×47.6 mm — track |
| Left Side (one groove) | window | 1 | frameH | 90° | tracks=1/2: 31 mm Side Track, one groove (2-track) — code BH-6400 — 85×33.1 mm — track<br>always: 31 mm Side Track, one groove (3-track) — code BH-6402 — 124.7×33.1 mm — track |
| Right Side (one groove) | window | 1 | frameH | 90° | tracks=1/2: 31 mm Side Track, one groove (2-track) — code BH-6400 — 85×33.1 mm — track<br>always: 31 mm Side Track, one groove (3-track) — code BH-6402 — 124.7×33.1 mm — track |
| Track Clip | shutter | 1 | clipW | 90° | Track Clip — code BH-2559 — 11×13.47 mm — rail |
| Shutter Top | shutter | 1 | shutterW | 45° | 31 mm Shutter (single glass) — code BH-6406 — 59×31.4 mm — handle |
| Shutter Bottom | shutter | 1 | shutterW | 45° | 31 mm Shutter (single glass) — code BH-6406 — 59×31.4 mm — handle |
| Shutter {lr} | shutter | 1 | shutterH | 45° | 31 mm Shutter (single glass) — code BH-6406 — 59×31.4 mm — handle |
| Interlock Side | shutter | 1 | shutterH | 45° | meet=clip: 31 mm Shutter (single glass) — code BH-6406 — 59×31.4 mm — handle<br>pick_shutterMeet=bh31_slim: 31 mm Slim Interlock — small — code BH-6408 — 38.1×20.2 mm — slim-interlock<br>pick_shutterMeet=bh31_spine: 31 mm Slim Interlock — big (reinforcement) — code BH-6409 — 80.1×20.2 mm — slim-interlock<br>pick_shutterMeet=bh31_slim_dgu: 31 mm Slim Interlock — small, double glass — code BH-6410 — 38.1×20.2 mm — slim-interlock<br>pick_shutterMeet=bh31_spine_dgu: 31 mm Slim Interlock — big, double glass — code BH-6411 — 80.1×20.2 mm — slim-interlock<br>always: 31 mm Slim Interlock — small — code BH-6408 — 38.1×20.2 mm — slim-interlock |
| Interlock Clip (only if meet=clip) | meeting | 2 | shutterH | 90° | Interlock Clip — code BH-6054 — 38×30.3 mm — interlock-patti |

Size rules:

| Size | When | Rule | Evidence | Why |
|---|---|---|---|---|
| Frame top / bottom (`frameW`) | always | W − 66.2 | suggested | From the drawings (window built from the sections): top and bottom fit between the BH-6400 sides (33.1 mm each, 90°); if your shop runs them full width, set this to W. Check on one window. |
| Frame side (`frameH`) | always | H | observed | Gulf: sides run full height (90°) |
| Track clip (`clipW`) | always | W − 66.2 | suggested | From the drawings (window built from the sections): clear width between the side tips: W − 66.2 (BH-6400 sides). Check on one window. |
| Shutter width (`shutterW`) | always | W ÷ 2 | observed | Every shutter half the window (W/2) — the usual shop way |
| Shutter height (`shutterH`) | tracks=2 | H − 65.3 | suggested | From the drawings (window built from the sections): 2 × 42.7 track + 3.9 clip − 24 roller. Check on one window. |
| Shutter height (`shutterH`) | tracks=3 | H − 65.9 | suggested | From the drawings: 3-track BH-6403 with clip 2559 and shutter 6404 — shutter runs H − 65.9. Check on one window. |
| Shutter height (`shutterH`) | always | H + **UNKNOWN** (app refuses to cut) | unknown | — |
| Glass width (`glassW`) | meet=clip | shutterW − 99.6 | suggested | From the drawings (window built from the sections): glass stops 49.8 mm in (BH-6406) — the same shutter on both sides. Check on one window. |
| Glass width (`glassW`) | pick_shutterMeet=bh31_slim | shutterW − 61.1 | suggested | From the drawings (window built from the sections): BH-6406 pocket 49.8 mm + slim 6408 pocket 11.3 mm. Check on one window. |
| Glass width (`glassW`) | pick_shutterMeet=bh31_spine | shutterW − 60.5 | suggested | From the drawings (window built from the sections): BH-6406 pocket 49.8 mm + slim 6409 pocket 10.7 mm. Check on one window. |
| Glass width (`glassW`) | always | shutterW + **UNKNOWN** (app refuses to cut) | unknown | — |
| Glass height (`glassH`) | always | shutterH − 99.6 | suggested | From the drawings (window built from the sections): BH-6406 pocket (6406 on all 4 sides, founder): glass stops 49.8 mm in from the top and bottom edges. Check on one window. |

Worked example: 6′×4′ (1828.8 × 1219.2 mm), 2 track, GG, default choices:

| Piece | Length | Cut | Pieces |
|---|---|---|---|
| Top Track | 1762.6 mm | 90° | 1 |
| Bottom Track | 1762.6 mm | 90° | 1 |
| Left Side (one groove) | 1219.2 mm | 90° | 1 |
| Right Side (one groove) | 1219.2 mm | 90° | 1 |
| Track Clip | 1762.6 mm | 90° | 2 |
| Shutter Shutter Top | 914.4 mm | 45° | 2 |
| Shutter Shutter Bottom | 914.4 mm | 45° | 2 |
| Shutter Shutter Left | 1153.9 mm | 45° | 1 |
| Shutter Interlock Side | 1153.9 mm | 45° | 2 |
| Shutter Shutter Right | 1153.9 mm | 45° | 1 |
| Glass/mesh glass | 853.3 × 1054.3 mm | — | 2 |

Worked example: 6′×4′ (1828.8 × 1219.2 mm), 2 track, GG, meet=clip:

| Piece | Length | Cut | Pieces |
|---|---|---|---|
| Top Track | 1762.6 mm | 90° | 1 |
| Bottom Track | 1762.6 mm | 90° | 1 |
| Left Side (one groove) | 1219.2 mm | 90° | 1 |
| Right Side (one groove) | 1219.2 mm | 90° | 1 |
| Track Clip | 1762.6 mm | 90° | 2 |
| Shutter Shutter Top | 914.4 mm | 45° | 2 |
| Shutter Shutter Bottom | 914.4 mm | 45° | 2 |
| Shutter Shutter Left | 1153.9 mm | 45° | 1 |
| Shutter Interlock Side | 1153.9 mm | 45° | 2 |
| Shutter Shutter Right | 1153.9 mm | 45° | 1 |
| Interlock Clip 1 | 1153.9 mm | 90° | 1 |
| Interlock Clip 2 | 1153.9 mm | 90° | 1 |
| Glass/mesh glass | 814.8 × 1054.3 mm | — | 2 |

---

## Gulf 35 mm

- App id: `bh-35` · family: domal-type · series: gulf 35 mm · status: draft
- In short: Like Euro: BH-6501 / 6503 top and bottom with track rail 6513; left and right one-groove BH-6500 / 6502; slim interlock small (6506) or big (6508)
- Layouts: 2 track (GG, GJ); 3 track (GGJ, GGG)  (G glass, J jali/mesh)
- Choices the shop makes:
  - Slim Interlock (`pick_shutterMeet`): 35 mm Slim Interlock — small (default) · 35 mm Slim Interlock — big (reinforcement) · 35 mm Slim Interlock — small, double glass · 35 mm Slim Interlock — big, double glass
  - Meeting side (`meet`): Slim interlock (default) · Shutter + interlock clip

Pieces:

| Piece | Per | Qty | Length rule | Cut | Section |
|---|---|---|---|---|---|
| Top Track | window | 1 | frameW | 90° | tracks=1/2: 35 mm 2-Track (top and bottom) — code BH-6501 — 95×31.2 mm — track<br>always: 35 mm 3-Track (top and bottom) — code BH-6503 — 145.6×31.2 mm — track |
| Bottom Track | window | 1 | frameW | 90° | tracks=1/2: 35 mm 2-Track (top and bottom) — code BH-6501 — 95×31.2 mm — track<br>always: 35 mm 3-Track (top and bottom) — code BH-6503 — 145.6×31.2 mm — track |
| Left Side (one groove) | window | 1 | frameH | 90° | tracks=1/2: 35 mm Side Track, one groove (2-track) — code BH-6500 — 100×32.8 mm — track<br>always: 35 mm Side Track, one groove (3-track) — code BH-6502 — 150×32.8 mm — track |
| Right Side (one groove) | window | 1 | frameH | 90° | tracks=1/2: 35 mm Side Track, one groove (2-track) — code BH-6500 — 100×32.8 mm — track<br>always: 35 mm Side Track, one groove (3-track) — code BH-6502 — 150×32.8 mm — track |
| Track Clip | shutter | 1 | clipW | 90° | 35 mm Track Clip — code BH-6513 — 14.5×17.96 mm — rail |
| Shutter Top | shutter | 1 | shutterW | 45° | 35 mm Shutter (single glass) — code BH-6510 — 58.9×35.2 mm — shutter |
| Shutter Bottom | shutter | 1 | shutterW | 45° | 35 mm Shutter (single glass) — code BH-6510 — 58.9×35.2 mm — shutter |
| Shutter {lr} | shutter | 1 | shutterH | 45° | 35 mm Shutter (single glass) — code BH-6510 — 58.9×35.2 mm — shutter |
| Interlock Side | shutter | 1 | shutterH | 45° | meet=clip: 35 mm Shutter (single glass) — code BH-6510 — 58.9×35.2 mm — shutter<br>pick_shutterMeet=bh35_slim: 35 mm Slim Interlock — small — code BH-6506 — 47.2×27.5 mm — slim-interlock<br>pick_shutterMeet=bh35_spine: 35 mm Slim Interlock — big (reinforcement) — code BH-6508 — 96×27 mm — slim-interlock<br>pick_shutterMeet=bh35_slim_dgu: 35 mm Slim Interlock — small, double glass — code BH-6507 — 47.2×27.5 mm — slim-interlock<br>pick_shutterMeet=bh35_spine_dgu: 35 mm Slim Interlock — big, double glass — code BH-6509 — 96×27 mm — slim-interlock<br>always: 35 mm Slim Interlock — small — code BH-6506 — 47.2×27.5 mm — slim-interlock |
| Interlock Clip (only if meet=clip) | meeting | 2 | shutterH | 90° | Domal 35 I/L Clip — code BH-6711 / 3510 — 41×38.9 mm — interlock-patti |

Size rules:

| Size | When | Rule | Evidence | Why |
|---|---|---|---|---|
| Frame top / bottom (`frameW`) | always | W − 65.6 | suggested | From the drawings (window built from the sections): top and bottom fit between the BH-6500 sides (32.8 mm each, 90°); if your shop runs them full width, set this to W. Check on one window. |
| Frame side (`frameH`) | always | H | observed | Gulf: sides run full height (90°) |
| Track clip (`clipW`) | always | W − 65.6 | suggested | From the drawings (window built from the sections): clear width between the side tips: W − 65.6 (BH-6500 sides). Check on one window. |
| Shutter width (`shutterW`) | always | W ÷ 2 | observed | Every shutter half the window (W/2) — the usual shop way |
| Shutter height (`shutterH`) | always | H − 42.4 | suggested | From the drawings (window built from the sections): 2 × 31.2 track + 4.0 clip − 24 roller. Check on one window. |
| Glass width (`glassW`) | meet=clip | shutterW − 93.4 | suggested | From the drawings (window built from the sections): glass stops 46.7 mm in (BH-6510) — the same shutter on both sides. Check on one window. |
| Glass width (`glassW`) | pick_shutterMeet=bh35_slim | shutterW − 62.3 | suggested | From the drawings (window built from the sections): BH-6510 pocket 46.7 mm + slim 6506 pocket (15 mm top slot) 15.6 mm. Check on one window. |
| Glass width (`glassW`) | pick_shutterMeet=bh35_spine | shutterW − 61.9 | suggested | From the drawings (window built from the sections): BH-6510 pocket 46.7 mm + slim 6508 pocket 15.2 mm. Check on one window. |
| Glass width (`glassW`) | always | shutterW + **UNKNOWN** (app refuses to cut) | unknown | — |
| Glass height (`glassH`) | always | shutterH − 93.4 | suggested | From the drawings (window built from the sections): BH-6510 pocket (6510 on all 4 sides, founder): glass stops 46.7 mm in from the top and bottom edges. Check on one window. |

Worked example: 6′×4′ (1828.8 × 1219.2 mm), 2 track, GG, default choices:

| Piece | Length | Cut | Pieces |
|---|---|---|---|
| Top Track | 1763.2 mm | 90° | 1 |
| Bottom Track | 1763.2 mm | 90° | 1 |
| Left Side (one groove) | 1219.2 mm | 90° | 1 |
| Right Side (one groove) | 1219.2 mm | 90° | 1 |
| Track Clip | 1763.2 mm | 90° | 2 |
| Shutter Shutter Top | 914.4 mm | 45° | 2 |
| Shutter Shutter Bottom | 914.4 mm | 45° | 2 |
| Shutter Shutter Left | 1176.8 mm | 45° | 1 |
| Shutter Interlock Side | 1176.8 mm | 45° | 2 |
| Shutter Shutter Right | 1176.8 mm | 45° | 1 |
| Glass/mesh glass | 852.1 × 1083.4 mm | — | 2 |

Worked example: 6′×4′ (1828.8 × 1219.2 mm), 2 track, GG, meet=clip:

| Piece | Length | Cut | Pieces |
|---|---|---|---|
| Top Track | 1763.2 mm | 90° | 1 |
| Bottom Track | 1763.2 mm | 90° | 1 |
| Left Side (one groove) | 1219.2 mm | 90° | 1 |
| Right Side (one groove) | 1219.2 mm | 90° | 1 |
| Track Clip | 1763.2 mm | 90° | 2 |
| Shutter Shutter Top | 914.4 mm | 45° | 2 |
| Shutter Shutter Bottom | 914.4 mm | 45° | 2 |
| Shutter Shutter Left | 1176.8 mm | 45° | 1 |
| Shutter Interlock Side | 1176.8 mm | 45° | 2 |
| Shutter Shutter Right | 1176.8 mm | 45° | 1 |
| Interlock Clip 1 | 1176.8 mm | 90° | 1 |
| Interlock Clip 2 | 1176.8 mm | 90° | 1 |
| Glass/mesh glass | 821 × 1083.4 mm | — | 2 |

---

## Gulf 30 mm

- App id: `gulf-s30` · family: domal-type · series: gulf 30 mm · status: draft
- In short: Vertical Gulf top and sides, separate bottom Gulf track, 90° screwed; glass or DGU shutter with interlock clip
- Layouts: 2 track (GG, GJ); 3 track (GGJ, GGG)  (G glass, J jali/mesh)
- Choices the shop makes:
  - Track clip (`rollerClip`): U groove (AT-35020) (default) · V groove (AT-35026)
  - Interlock Clip (`pick_interlock`): Interlock Clip (default) · Double Interlock

Pieces:

| Piece | Per | Qty | Length rule | Cut | Section |
|---|---|---|---|---|---|
| Top Track | window | 1 | frameW | 90° | tracks=1/2: 2 Track Bottom Gulf — code AT-30002 — 81.8×47 mm — track<br>always: 3 Track Bottom Gulf — code AT-30004 — 120.6×47 mm — track |
| Left Side (one groove) | window | 1 | frameH | 90° | tracks=1/2: 2 Track Vertical Gulf — code AT-30001 — 85×33 mm — track<br>always: 3 Track Vertical Gulf — code AT-30003 — 124×33 mm — track |
| Right Side (one groove) | window | 1 | frameH | 90° | tracks=1/2: 2 Track Vertical Gulf — code AT-30001 — 85×33 mm — track<br>always: 3 Track Vertical Gulf — code AT-30003 — 124×33 mm — track |
| Bottom Gulf Track | window | 1 | frameW | 90° | tracks=1/2: 2 Track Bottom Gulf — code AT-30002 — 81.8×47 mm — track<br>always: 3 Track Bottom Gulf — code AT-30004 — 120.6×47 mm — track |
| Track Clip | shutter | 1 | clipW | 90° | rollerClip=v: Track Clip, V groove — code AT-35026 — 13×16.5 mm — rail<br>always: Track Clip, U groove — code AT-35020 — 14.5×18 mm — rail |
| Shutter Top | shutter | 1 | shutterW | 45° | Single Glass Shutter — code AT-30005 — 67.4×30 mm — shutter |
| Shutter Bottom | shutter | 1 | shutterW | 45° | Single Glass Shutter — code AT-30005 — 67.4×30 mm — shutter |
| Shutter Left | shutter | 1 | shutterH | 45° | Single Glass Shutter — code AT-30005 — 67.4×30 mm — shutter |
| Shutter Right | shutter | 1 | shutterH | 45° | Single Glass Shutter — code AT-30005 — 67.4×30 mm — shutter |
| Interlock Clip | meeting | 2 | shutterH | 90° | pick_interlock=at_clip: Interlock Clip — code AT-30007 — 37.1×35.1 mm — interlock-patti<br>pick_interlock=at_dbl: Double Interlock — code AT-30008 — 37.1×41.62 mm — interlock<br>always: Interlock Clip — code AT-30007 — 37.1×35.1 mm — interlock-patti |

Size rules:

| Size | When | Rule | Evidence | Why |
|---|---|---|---|---|
| Frame top / bottom (`frameW`) | always | W − 66 | suggested | From the drawings (window built from the sections): top and bottom fit between the AT-30001 sides (33 mm each, 90°); if your shop runs them full width, set this to W. Check on one window. |
| Frame side (`frameH`) | always | H | observed | Gulf: sides run full height (90°) |
| Track clip (`clipW`) | always | W − 66 | suggested | From the drawings (window built from the sections): clear width between the AT-30001 side tips (2 × 33). Check on one window. |
| Shutter width (`shutterW`) | always | W ÷ 2 | observed | Every shutter half the window (W/2) — the usual shop way |
| Shutter height (`shutterH`) | tracks=2, rollerClip=v | H − 64.3 | suggested | From the drawings (window built from the sections): 2-track Bottom Gulf AT-30002 top and bottom, V-groove clip AT-35026 standing 3.3 mm, shutter AT-30005, 24 mm roller. Check on one window. |
| Shutter height (`shutterH`) | tracks=2 | H − 65.7 | suggested | From the drawings (window built from the sections): 2-track Bottom Gulf AT-30002 top and bottom, U-groove clip AT-35020 standing 4.7 mm, shutter AT-30005, 24 mm roller. Check on one window. |
| Shutter height (`shutterH`) | rollerClip=v | H − 64.8 | suggested | From the drawings (window built from the sections): 3-track Bottom Gulf AT-30004 top and bottom, V-groove clip AT-35026 standing 3.3 mm, shutter AT-30005, 24 mm roller. Check on one window. |
| Shutter height (`shutterH`) | always | H − 66.2 | suggested | From the drawings (window built from the sections): 3-track Bottom Gulf AT-30004 top and bottom, U-groove clip AT-35020 standing 4.7 mm, shutter AT-30005, 24 mm roller. Check on one window. |
| Glass width (`glassW`) | always | shutterW − 110.2 | suggested | From the drawings (window built from the sections): AT-30005 pocket: glass stops 55.1 mm in from each shutter edge. Check on one window. |
| Glass height (`glassH`) | always | shutterH − 110.2 | suggested | From the drawings (window built from the sections): AT-30005 pocket: glass stops 55.1 mm in from each shutter edge. Check on one window. |

Worked example: 6′×4′ (1828.8 × 1219.2 mm), 2 track, GG, default choices:

| Piece | Length | Cut | Pieces |
|---|---|---|---|
| Top Track | 1762.8 mm | 90° | 1 |
| Left Side (one groove) | 1219.2 mm | 90° | 1 |
| Right Side (one groove) | 1219.2 mm | 90° | 1 |
| Bottom Gulf Track | 1762.8 mm | 90° | 1 |
| Track Clip | 1762.8 mm | 90° | 2 |
| Shutter Shutter Top | 914.4 mm | 45° | 2 |
| Shutter Shutter Bottom | 914.4 mm | 45° | 2 |
| Shutter Shutter Left | 1153.5 mm | 45° | 2 |
| Shutter Shutter Right | 1153.5 mm | 45° | 2 |
| Interlock Clip 1 | 1153.5 mm | 90° | 1 |
| Interlock Clip 2 | 1153.5 mm | 90° | 1 |
| Glass/mesh glass | 804.2 × 1043.3 mm | — | 2 |

---

## Casement Z 40 mm

- App id: `z-40` · family: casement · series: casement 40 mm · status: verified
- In short: Openable windows: Z outer frame and Z-pipe sash at 45°, center mullion between sashes, glass held by clip
- Layouts: 1 track (G, J); 2 track (GG, GJ); 3 track (GGG); 4 track (GGGG)  (G glass, J jali/mesh)

Pieces:

| Piece | Per | Qty | Length rule | Cut | Section |
|---|---|---|---|---|---|
| Outer Top | window | 1 | frameW | 45° | Z Outer Frame 40×40 — code 2076 — 40×40 mm — frame |
| Outer Bottom | window | 1 | frameW | 45° | Z Outer Frame 40×40 — code 2076 — 40×40 mm — frame |
| Outer Left | window | 1 | frameH | 45° | Z Outer Frame 40×40 — code 2076 — 40×40 mm — frame |
| Outer Right | window | 1 | frameH | 45° | Z Outer Frame 40×40 — code 2076 — 40×40 mm — frame |
| Mullion | between | 1 | mullionH | 90° | Z Center / Mullion 40×55 — code 2086 — 54.3×40.3 mm — mullion |
| Shutter Top | shutter | 1 | sashW | 45° | Z-Pipe (sash) 40×40 — code 2077 — 40×40 mm — shutter |
| Shutter Bottom | shutter | 1 | sashW | 45° | Z-Pipe (sash) 40×40 — code 2077 — 40×40 mm — shutter |
| Shutter Left | shutter | 1 | sashH | 45° | Z-Pipe (sash) 40×40 — code 2077 — 40×40 mm — shutter |
| Shutter Right | shutter | 1 | sashH | 45° | Z-Pipe (sash) 40×40 — code 2077 — 40×40 mm — shutter |
| Clip Top | shutter | 1 | pocketW | 90° | Z Glazing Clip — code 2078 — 22.2×17.9 mm — bead |
| Clip Bottom | shutter | 1 | pocketW | 90° | Z Glazing Clip — code 2078 — 22.2×17.9 mm — bead |
| Clip Left | shutter | 1 | pocketH | 90° | Z Glazing Clip — code 2078 — 22.2×17.9 mm — bead |
| Clip Right | shutter | 1 | pocketH | 90° | Z Glazing Clip — code 2078 — 22.2×17.9 mm — bead |

Size rules:

| Size | When | Rule | Evidence | Why |
|---|---|---|---|---|
| Outer top / bottom (`frameW`) | always | W | verified | Founder job: outer frame full width, 45° |
| Outer sides (`frameH`) | always | H | verified | Founder job: outer frame full height, 45° |
| Sash width (`sashW`) | shutters=1 | (W − 80) + 10 | verified | Founder job: 1 sash: W − 80 + 10 mm overlap |
| Sash width (`sashW`) | shutters=2 | (W − 120) ÷ 2 + 10 | verified | Founder job: 2 sashes: (W − 80 − 40) ÷ 2 + 10 |
| Sash width (`sashW`) | shutters=3 | (W − 160) ÷ 3 + 10 | verified | Founder job: 3 sashes: (W − 80 − 80) ÷ 3 + 10 |
| Sash width (`sashW`) | shutters=4 | (W − 200) ÷ 4 + 10 | verified | Founder job: 4 sashes: (W − 80 − 120) ÷ 4 + 10 |
| Sash height (`sashH`) | always | H − 70 | verified | Founder job: H − 80 + 10 mm overlap |
| Mullion (`mullionH`) | always | H − 80 | verified | Founder job: between outer top and bottom: H − 2 × 40 |
| Glass pocket width (clip) (`pocketW`) | always | sashW − 80 | verified | Founder job: sash − 2 × 40 |
| Glass pocket height (clip) (`pocketH`) | always | sashH − 80 | verified | Founder job: sash − 2 × 40 |
| Glass width (`glassW`) | always | pocketW − 10 | verified | Founder job: pocket − 5 mm each side |
| Glass height (`glassH`) | always | pocketH − 10 | verified | Founder job: pocket − 5 mm each side |

Worked example: 6′×4′ (1828.8 × 1219.2 mm), 2 track, GG, default choices:

| Piece | Length | Cut | Pieces |
|---|---|---|---|
| Outer Top | 1828.8 mm | 45° | 1 |
| Outer Bottom | 1828.8 mm | 45° | 1 |
| Outer Left | 1219.2 mm | 45° | 1 |
| Outer Right | 1219.2 mm | 45° | 1 |
| Shutter Shutter Top | 864.4 mm | 45° | 2 |
| Shutter Shutter Bottom | 864.4 mm | 45° | 2 |
| Shutter Shutter Left | 1149.2 mm | 45° | 2 |
| Shutter Shutter Right | 1149.2 mm | 45° | 2 |
| Shutter Clip Top | 784.4 mm | 90° | 2 |
| Shutter Clip Bottom | 784.4 mm | 90° | 2 |
| Shutter Clip Left | 1069.2 mm | 90° | 2 |
| Shutter Clip Right | 1069.2 mm | 90° | 2 |
| Mullion 1 | 1139.2 mm | 90° | 1 |
| Glass/mesh glass | 774.4 × 1059.2 mm | — | 2 |

---

## Casement Z 55 mm

- App id: `z-55` · family: casement · series: casement 55 mm · status: verified
- In short: Large windows and doors: heavy Z frame, Z-pipe and 70 mm center
- Layouts: 1 track (G, J); 2 track (GG, GJ); 3 track (GGG); 4 track (GGGG)  (G glass, J jali/mesh)

Pieces:

| Piece | Per | Qty | Length rule | Cut | Section |
|---|---|---|---|---|---|
| Outer Top | window | 1 | frameW | 45° | Z Outer Frame 40×55 — code 2088 — 55.6×40.4 mm — frame |
| Outer Bottom | window | 1 | frameW | 45° | Z Outer Frame 40×55 — code 2088 — 55.6×40.4 mm — frame |
| Outer Left | window | 1 | frameH | 45° | Z Outer Frame 40×55 — code 2088 — 55.6×40.4 mm — frame |
| Outer Right | window | 1 | frameH | 45° | Z Outer Frame 40×55 — code 2088 — 55.6×40.4 mm — frame |
| Mullion | between | 1 | mullionH | 90° | Z Center / Mullion 40×70 — code 2079 — 70.6×40.4 mm — mullion |
| Shutter Top | shutter | 1 | sashW | 45° | Z-Pipe (sash) 40×55 — code 20610 — 55.6×40.2 mm — shutter |
| Shutter Bottom | shutter | 1 | sashW | 45° | Z-Pipe (sash) 40×55 — code 20610 — 55.6×40.2 mm — shutter |
| Shutter Left | shutter | 1 | sashH | 45° | Z-Pipe (sash) 40×55 — code 20610 — 55.6×40.2 mm — shutter |
| Shutter Right | shutter | 1 | sashH | 45° | Z-Pipe (sash) 40×55 — code 20610 — 55.6×40.2 mm — shutter |
| Clip Top | shutter | 1 | pocketW | 90° | Z Glazing Clip — code 2078 — 22.2×17.9 mm — bead |
| Clip Bottom | shutter | 1 | pocketW | 90° | Z Glazing Clip — code 2078 — 22.2×17.9 mm — bead |
| Clip Left | shutter | 1 | pocketH | 90° | Z Glazing Clip — code 2078 — 22.2×17.9 mm — bead |
| Clip Right | shutter | 1 | pocketH | 90° | Z Glazing Clip — code 2078 — 22.2×17.9 mm — bead |

Size rules:

| Size | When | Rule | Evidence | Why |
|---|---|---|---|---|
| Outer top / bottom (`frameW`) | always | W | verified | Founder job: outer frame full width, 45° |
| Outer sides (`frameH`) | always | H | verified | Founder job: outer frame full height, 45° |
| Sash width (`sashW`) | shutters=1 | (W − 80) + 10 | verified | Founder job: 1 sash: W − 80 + 10 mm overlap |
| Sash width (`sashW`) | shutters=2 | (W − 120) ÷ 2 + 10 | verified | Founder job: 2 sashes: (W − 80 − 40) ÷ 2 + 10 |
| Sash width (`sashW`) | shutters=3 | (W − 160) ÷ 3 + 10 | verified | Founder job: 3 sashes: (W − 80 − 80) ÷ 3 + 10 |
| Sash width (`sashW`) | shutters=4 | (W − 200) ÷ 4 + 10 | verified | Founder job: 4 sashes: (W − 80 − 120) ÷ 4 + 10 |
| Sash height (`sashH`) | always | H − 70 | verified | Founder job: H − 80 + 10 mm overlap |
| Mullion (`mullionH`) | always | H − 80 | verified | Founder job: between outer top and bottom: H − 2 × 40 |
| Glass pocket width (clip) (`pocketW`) | always | sashW − 80 | verified | Founder job: sash − 2 × 40 |
| Glass pocket height (clip) (`pocketH`) | always | sashH − 80 | verified | Founder job: sash − 2 × 40 |
| Glass width (`glassW`) | always | pocketW − 10 | verified | Founder job: pocket − 5 mm each side |
| Glass height (`glassH`) | always | pocketH − 10 | verified | Founder job: pocket − 5 mm each side |

Worked example: 6′×4′ (1828.8 × 1219.2 mm), 2 track, GG, default choices:

| Piece | Length | Cut | Pieces |
|---|---|---|---|
| Outer Top | 1828.8 mm | 45° | 1 |
| Outer Bottom | 1828.8 mm | 45° | 1 |
| Outer Left | 1219.2 mm | 45° | 1 |
| Outer Right | 1219.2 mm | 45° | 1 |
| Shutter Shutter Top | 864.4 mm | 45° | 2 |
| Shutter Shutter Bottom | 864.4 mm | 45° | 2 |
| Shutter Shutter Left | 1149.2 mm | 45° | 2 |
| Shutter Shutter Right | 1149.2 mm | 45° | 2 |
| Shutter Clip Top | 784.4 mm | 90° | 2 |
| Shutter Clip Bottom | 784.4 mm | 90° | 2 |
| Shutter Clip Left | 1069.2 mm | 90° | 2 |
| Shutter Clip Right | 1069.2 mm | 90° | 2 |
| Mullion 1 | 1139.2 mm | 90° | 1 |
| Glass/mesh glass | 774.4 × 1059.2 mm | — | 2 |

---

## New — one shutter section on 4 sides

- App id: `blank-domal-type` · family: domal-type · series: other 0 mm · status: draft
- In short: Any series where one shutter profile goes round (domal, sleek, mini domal…)
- Layouts: 2 track (GG, GJ); 3 track (GGJ, GGG)  (G glass, J jali/mesh)

Pieces:

| Piece | Per | Qty | Length rule | Cut | Section |
|---|---|---|---|---|---|
| Frame Top | window | 1 | frameW | 45° | tracks=1/2: Domal 2-Track Frame — code 2051 — 45×45 mm — frame<br>always: Domal 3-Track Frame 80×45 — code 2062 — 80.5×45.4 mm — frame |
| Frame Left | window | 1 | frameH | 45° | tracks=1/2: Domal 2-Track Frame — code 2051 — 45×45 mm — frame<br>always: Domal 3-Track Frame 80×45 — code 2062 — 80.5×45.4 mm — frame |
| Frame Right | window | 1 | frameH | 45° | tracks=1/2: Domal 2-Track Frame — code 2051 — 45×45 mm — frame<br>always: Domal 3-Track Frame 80×45 — code 2062 — 80.5×45.4 mm — frame |
| Frame Bottom | window | 1 | frameW | 45° | tracks=1/2: Domal 2-Track Frame — code 2051 — 45×45 mm — frame<br>always: Domal 3-Track Frame 80×45 — code 2062 — 80.5×45.4 mm — frame |
| Shutter Top | shutter | 1 | shutterW | 45° | Domal Glass Shutter — code 2046/2047 — 65×27 mm — shutter |
| Shutter Bottom | shutter | 1 | shutterW | 45° | Domal Glass Shutter — code 2046/2047 — 65×27 mm — shutter |
| Shutter Left | shutter | 1 | shutterH | 45° | Domal Glass Shutter — code 2046/2047 — 65×27 mm — shutter |
| Shutter Right | shutter | 1 | shutterH | 45° | Domal Glass Shutter — code 2046/2047 — 65×27 mm — shutter |
| Interlock | meeting | 2 | shutterH | 90° | Domal Interlock Patti 39×28 — code 2091 — 39.4×28 mm — interlock-patti |

Size rules:

| Size | When | Rule | Evidence | Why |
|---|---|---|---|---|
| Frame top / bottom (`frameW`) | always | W + **UNKNOWN** (app refuses to cut) | unknown | — |
| Frame side (`frameH`) | always | H + **UNKNOWN** (app refuses to cut) | unknown | — |
| Shutter width (`shutterW`) | always | W ÷ 2 + **UNKNOWN** (app refuses to cut) | unknown | — |
| Shutter height (`shutterH`) | always | H + **UNKNOWN** (app refuses to cut) | unknown | — |
| Glass width (`glassW`) | always | shutterW + **UNKNOWN** (app refuses to cut) | unknown | — |
| Glass height (`glassH`) | always | shutterH + **UNKNOWN** (app refuses to cut) | unknown | — |

Worked example: 6′×4′ (1828.8 × 1219.2 mm), 2 track, GG, default choices:

| Piece | Length | Cut | Pieces |
|---|---|---|---|
| Frame Top | 0 mm | 45° | 1 |
| Frame Left | 0 mm | 45° | 1 |
| Frame Right | 0 mm | 45° | 1 |
| Frame Bottom | 0 mm | 45° | 1 |
| Shutter Shutter Top | 0 mm | 45° | 2 |
| Shutter Shutter Bottom | 0 mm | 45° | 2 |
| Shutter Shutter Left | 0 mm | 45° | 2 |
| Shutter Shutter Right | 0 mm | 45° | 2 |
| Interlock 1 | 0 mm | 90° | 1 |
| Interlock 2 | 0 mm | 90° | 1 |
| Glass/mesh glass | 0 × 0 mm | — | 2 |

Still unknown here: Frame top / bottom, Frame side, Shutter width, Shutter height, Glass width, Glass height — the app will not cut these.

---

## New — handle, interlock, bearing

- App id: `blank-sliding` · family: sliding · series: other 0 mm · status: verified
- In short: Any Bombay-type series with a 4-profile shutter
- Layouts: 2 track (GG, GJ, JJ); 3 track (GGJ, GGG, GJJ, GG)  (G glass, J jali/mesh)
- Choices the shop makes:
  - Shutter width (`mode`): Half each (default) · Share the width

Pieces:

| Piece | Per | Qty | Length rule | Cut | Section |
|---|---|---|---|---|---|
| Top | window | 1 | trackW | 90° | tracks=3: 3-Track Top/Side — code 1021 — 92×32 mm — track<br>always: 2-Track Top/Side — code 1000 / 1801 — 62×32 mm — track |
| Left Side | window | 1 | sideH | 90° | tracks=3: 3-Track Top/Side — code 1021 — 92×32 mm — track<br>always: 2-Track Top/Side — code 1000 / 1801 — 62×32 mm — track |
| Right Side | window | 1 | sideH | 90° | tracks=3: 3-Track Top/Side — code 1021 — 92×32 mm — track<br>always: 2-Track Top/Side — code 1000 / 1801 — 62×32 mm — track |
| Bottom | window | 1 | trackW | 90° | tracks=3: 3-Track Bottom — code 1031 / 1831 — 92×32 mm — track<br>always: 2-Track Bottom — code 1011 / 1821 — 62×32 mm — track |
| Handle | shutter | 1 | shutterH | 90° | Handle 3/4"×1.5" — code 1041 / 1841 — 40×18 mm — handle |
| Interlock | shutter | 1 | shutterH | 90° | Interlock Stile 40×18 — code 1081 — 40×18 mm — interlock |
| Bearing Top | shutter | 1 | bearing | 90° | Bottom Bearing / Rail 40×18 — code 1051 — 40×18 mm — bearing |
| Bearing Bottom | shutter | 1 | bearing | 90° | Bottom Bearing / Rail 40×18 — code 1051 — 40×18 mm — bearing |

Size rules:

| Size | When | Rule | Evidence | Why |
|---|---|---|---|---|
| Top / bottom track (`trackW`) | always | W + **UNKNOWN** (app refuses to cut) | unknown | — |
| Frame side (`sideH`) | always | H + **UNKNOWN** (app refuses to cut) | unknown | — |
| Shutter height (handle, interlock) (`shutterH`) | always | H + **UNKNOWN** (app refuses to cut) | unknown | — |
| Bearing (top & bottom) (`bearing`) | always | W ÷ 2 + **UNKNOWN** (app refuses to cut) | unknown | — |
| Shutter width (`shutterW`) | always | W ÷ 2 + **UNKNOWN** (app refuses to cut) | unknown | — |
| Glass width (`glassW`) | always | bearing + **UNKNOWN** (app refuses to cut) | unknown | — |
| Glass height (`glassH`) | always | shutterH + **UNKNOWN** (app refuses to cut) | unknown | — |

Worked example: 6′×4′ (1828.8 × 1219.2 mm), 2 track, GG, default choices:

| Piece | Length | Cut | Pieces |
|---|---|---|---|
| Top | 0 mm | 90° | 1 |
| Left Side | 0 mm | 90° | 1 |
| Right Side | 0 mm | 90° | 1 |
| Bottom | 0 mm | 90° | 1 |
| Shutter Handle | 0 mm | 90° | 2 |
| Shutter Interlock | 0 mm | 90° | 2 |
| Shutter Bearing Top | 0 mm | 90° | 2 |
| Shutter Bearing Bottom | 0 mm | 90° | 2 |
| Glass/mesh glass | 0 × 0 mm | — | 2 |

Still unknown here: Top / bottom track, Frame side, Shutter height (handle, interlock), Bearing (top & bottom), Glass width, Glass height — the app will not cut these.
