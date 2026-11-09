# FabriQ research audit — for the System Studio (2026-11-09)

What was actually opened and read, and what each source is good for.
"Read" means its contents were inspected in this project. Nothing is listed
from memory alone.

## Sources read

| Source | Where | Read how | Good for | Not good for |
|---|---|---|---|---|
| Founder jobs (72×60 Normal 3T, 66×58 Domal 3T, 30×84 door) | engine comments, golden tests | measured cuts | **verified constants** | other series |
| Founder decisions (calls, chat) | docs 16, 17; memory | written down same day | rules, scope, preferences | — |
| Customer call 2026-11-06 (Indore) | docs/16 | 2 recordings, word by word | what buyers need: stock lengths per profile, hardware, login | numbers |
| Indian videos (65 system-window + 31 earlier) | research/transcripts, video-findings, system-windows-industry-map | transcripts read one by one (NotebookLM + direct) | **observed practice**: heights, width splits, glass rules per series | exact values for one shop |
| International videos (202, 127 with transcripts) | research/international-findings | NotebookLM | universal sliding model (sashH = H − c, bearing = (W − K_N)/N) | Indian constants |
| OMEO catalogue (158 pp) | research/catalogue/omeo-* | page by page | section codes, sizes, kg | cutting rules (none printed) |
| ELICOAT, Jindal, Hindalco, Geeta, Unique, MAC, Aluka, Intelligent, National | research/catalogue/* | pages read | sections, slim/KPA interlocks, Gulf, rail clips | cutting rules |
| Ample 22 mm catalogue | new-series/22 MM.pdf | both pages viewed 2026-11-09 | 22 mm = 2T track 41083 (53.9×35), 3T track 41084 (83.9×35), 4-side shutter 41082 (55.8×22), interlock 41085 (65×22), clip 992134; **two different drawings are both printed as 41085** | cutting rules |
| Banu Hashim (127 pp) | new-series/BANUHASHIM READY.pdf | spot-checked p.58–61 (31 mm) | BH-6406/6407/6408 sizes and kg match doc 18 | the 29 mm codes in doc 18 do not match the PDF |
| Doc 18 (Antigravity, 2,649 lines) | docs/18 | fully read | names of parts and when each is used | **any cutting number** (see 18-REVIEW, 19 §6) |

## Not yet inspected (do not cite as read)
- Ample 25, 26, 27, 29, 30, 32, 37, 40, 50 mm, domal and Z PDFs: only the INDEX
  summary (written by Antigravity) has been seen, not the pages.
- Eleanor (63 pp) and Alucoat (63 pp) catalogues.
- Banu Hashim beyond pages 58–61.

## Key findings that shape the Studio
1. **No Indian catalogue prints a cutting formula.** Cutting rules exist only in
   fabricators' heads, videos and our founder's jobs. The Studio must *learn
   them from the shop*. It must not look them up.
2. **The same series name means different things at different shops.** For
   example, "27 mm" is a domal sash at one shop and a sleek system at another, and
   track widths differ. A series name can never decide the parts.
3. **Every sliding system follows one model:** frame pieces follow W or H at
   slope 1, shutter width follows W at slope 1/N (or ½ in "half each" mode),
   shutter height = H − c, glass = shutter − d. Only the constants change. That
   lets one engine hold all of them.
4. **Constants depend on choices.** Roller height, rubber type, glass thickness,
   interlock type, and layout (2/3/3+1/4/4+1/5) each move one known set of cuts.
5. **Shops differ by preference, not only by profile.** Examples: shutter W/2 vs
   equal share, and 90° vs 45° frame. These must be switches.
