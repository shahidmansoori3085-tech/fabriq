# Solo log

Work done while Claude Code was out of usage (see `docs/SOLO-MODE.md`). Newest
first. Claude Code reviews every entry when it is back.

Entry format:

```
## YYYY-MM-DD — <task in the founder's words>
- Branch / commits:
- Files changed (why):
- GitHub check: <conclusion + link>
- Preview: <link>
- Numbers changed (source):
- Unsure / skipped:
```

---

## 2026-11-11 — Section Names & Photo/Drawing Accuracy Overhaul in "New System" & Studio
- Branch / commits: `ag/solo-20261111-section-photos` -> fast-forward merged into `claude/system-studio`
- Files changed (why):
  - `components/section-sketch.tsx`:
    - Integrated real catalogue engineering cropped photos (`/public/sections/*.png`) via `hasImage(p.id)` so official manufacturer profile photos render directly.
    - Upgraded `RealSection` vector CAD renderer: tightened padding from 0.3 to 0.12 so profile drawings render 2.5× larger and fill the thumbnail clearly; added high-contrast dark slate outline with metallic aluminium gradient fill and sharp mm dimension callouts.
    - Upgraded `GuideSketch` architectural fallback: multi-chamber walls, screw flutes, runner rail beads, glass pockets, and mating interlock hooks instead of bare wireframe boxes.
    - Elegant placeholder when no section is selected, avoiding confusing red broken boxes.
  - `components/section-profiles.tsx`: Registered `domal_frame_2t: "domal_frame"` in `IMAGE_OF`.
  - `lib/studio/shapes/banuhashim.json` & `scripts/sections/banuhashim.json`: Traced 24 official dies from `BANUHASHIM READY.pdf` (pages 56-68) with 98%-100% scale agreement (`BH-6400` to `BH-6413` and `BH-6500` to `BH-6513`).
  - `lib/studio/shapes/omeo.json` & `scripts/sections/omeo.json`: Traced OMEO 1081 Interlock profile from page 51.
  - `lib/studio/templates.ts`:
    - Verified all section names, dimensions, and codes across all templates.
    - Populated real profiles and default parts for `NORMAL_25` (Bombay 1"×2"), `DOMAL_35` (35×75), `MINI_DOMAL_20` (20×54), `BLANK_DOMAL_TYPE`, `BLANK_SLIDING`, and `GULF`.
- GitHub check: All evals passed (parity 352 cases, in-job, z-parity 32 cases, teach, dxf, tracer), tsc 0 errors.
- Preview: https://app-3pa0k75gn-indian-steels.vercel.app/studio
- Numbers changed (source):
  - Traced from `BANUHASHIM READY.pdf` (pp. 56-68) and OMEO Catalogue (p. 51). No cutting constants invented.
- Unsure / skipped: None.

## 2026-11-11 — Verification of sections, templates (Handle, Slim Interlock, Rails, T-Spine) & 3D Architectural Cutaway Overhaul
- Branch / commits: `ag/solo-20261111-templates-and-3d` -> merged into `claude/system-studio`
- Files changed (why):
  - `lib/studio/templates.ts`: Corrected section assignments for:
    - **Ample 29 mm Sleek**: Separated Top & Bottom Rail (41010, 64.4×50.2mm heavy rail), Handle Stile (41055, 65×29mm), Slim Interlock 40mm (41289), Slim Interlock 37mm (992328), Standard Interlock (41050), and heavy T-Spine Reinforcement (914806, 45×50.6mm).
    - **Ample 37 mm Sleek**: Separated Top Rail (41069, 52.2×44.9mm), Bottom Rail with roller pocket (41300, 52.2×57.1mm), Handle Stile (41068, 82.7×37mm), Slim Interlock (41310-37), Standard Interlock (41074), and heavy T-Spine Reinforcement (914806, 45×50.6mm).
    - **Banu Hashim 31 mm Slim**: Added dedicated outer frame tracks (BH-6400 / BH-6402), Top & Bottom Rails (BH-6404 / BH-6405), Handle Stiles (BH-6406 / BH-6407), Slim Interlock (BH-6408), and structural Reinforcement Spine (BH-6409).
    - **Banu Hashim 35 mm Gulf Series**: Added ready system with BH-6500 vertical jambs, BH-6501 bottom tracks, BH-6504 rails, BH-6510 handles, BH-6506 slim interlock, and BH-6508 structural spine for cyclonic wind loads.
    - Updated `PART_KIND` and `TEMPLATES` to register all parts and systems.
  - `components/studio-3d.tsx`: Complete overhaul into a photorealistic architectural 3D viewer matching Reynaers and Crystal Windows cutaway corner models (sent by user):
    - Added 360° Architectural Corner Cutaway mode with true multi-chamber profile extrusions, exposed profile cutfaces, DGU double insulated glass panes, warm-edge spacer bar, EPDM rubber wedge gaskets, and stainless steel runner rail (patri).
    - Added Architectural PBR Finishes: Titanium Grey (default), Silver Anodised, Matt Black, and Champagne Bronze.
    - Added Full Window 3D view toggle and interactive part inspection.
  - `lib/studio/runtime.ts`: Preserved custom switches and studioSwitches from item.meta.
  - `lib/studio/teach.ts`: Sorted keys before stringifying when matching size cases to prevent false duplicate rules.
- GitHub check: Evaluated locally and verified passing all parity (352 cases), in-job, z-parity (32 cases), teach, dxf, and tracer tests.
- Preview: https://app-3pa0k75gn-indian-steels.vercel.app (deployed on push to claude/system-studio)
- Numbers changed (source):
  - Profile codes and dimensions verified against Ample Extrusions 29mm & 37mm catalogues, Banu Hashim Ready catalogue p. 56-65, and research doc 18. No cutting constants invented (remained null where unknown).
- Unsure / skipped: None.
