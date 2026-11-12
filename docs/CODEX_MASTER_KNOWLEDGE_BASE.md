# FabriQ & Aluminium Fabrication Industry — Master Knowledge Base & Architecture Dossier

This document is the **single source of truth** for any AI agent, developer, or engineer (such as Codex) to gain 100% complete domain mastery over the **Aluminium Window, Door & Façade Fabrication Industry** and the **FabriQ Codebase Architecture**.

---

## 1. Executive Summary & Product Mission

- **Product Name:** FabriQ (also known as Fabricator OS)
- **Target Audience:** Aluminium workshop fabricators, mistris, small/medium fabrication contractors, architects, dealers, and aluminium extrusion distributors in India and the Global South.
- **The Core Problem:**
  - In traditional workshops, fabricators calculate cutting sizes, glass dimensions, and bar orders using mental math or rough paper notes in *sooth/sut* (1/8th inch).
  - A 1-sut calculation error ruins an aluminium profile or glass pane, resulting in ₹30,000–₹50,000+ monthly scrap losses per workshop.
  - Fabricators struggle with new systems (Domal, Sleek, Slim, Gulf, Z-Section) because each system uses different deduction constants, hardware clearances, and track allowances.
  - High-end European software (Orgadata LogiKal, SchüCal) costs ₹5,00,000+ per license, requires powerful desktop CAD workstations, and is completely inaccessible to 99% of workshops.
- **The FabriQ Solution:**
  - **Phone-First & Offline-First:** Runs 100% in mobile browsers, zero cloud database latency, data persists locally via LocalStorage.
  - **Honest Fabrication Numbers:** Formulas are derived directly from physical manufacturer extrusion dies (OMEO, Banu Hashim, Ample, Jindal). No made-up cutting constants.
  - **Self-Learning System Studio:** If a workshop fabricates a custom series or uses non-standard clearances, they enter just **one real window's cut sizes**, and FabriQ automatically learns the algebraic formulas (`teach.ts`).
  - **Photorealistic Architectural 3D & 2D CAD:** Full 360° cutaway corner visualization (Reynaers / Crystal Windows style) and 1:1 scale dimensioned profile cross-sections.
  - **1D Cutting Stock Optimizer:** Calculates the exact cutting sequence from standard 16ft/18ft commercial stock bars with kerf allowance, reducing metal offcut scrap to under 3%.

---

## 2. Master Repository Map & Document Directory

The repository is organized into three major roots: `E:\alu-tool\docs/`, `E:\alu-tool\research/`, and `E:\alu-tool\app/`.

### Root 1: Domain & System Architecture Docs (`E:\alu-tool\docs/`)
1. `00-MASTER-PLAN.md` — Strategic roadmap, core pillars, target user personas, and product phases.
2. `01-market-research.md` — Detailed analysis of Indian fabrication market, tier 1/2/3 workshops, unorganized extrusion trade, dealer commission structures.
3. `02-PRD.md` — Product Requirement Document: mobile UX, cutting list generator, glass optimizer, bill of materials (BOM), invoice generator.
4. `03-ai-architecture.md` — AI vision OCR for handwritten paper cutting lists, voice input in Hindi/Hinglish, automated formula extraction.
5. `04-rule-engine-and-estimation.md` — Mathematical foundations of deduction formulas, overlap rules, glass tolerances, and linear scrap optimization.
6. `05-database-and-profiles.md` — Extrusion catalog schemas, section weights (kg/m), standard bar lengths, and moment of inertia ($I_{xx}, I_{yy}$) for wind load.
7. `06-accuracy-testing-risks.md` — Verification protocols, edge cases (fractional inch fractions, 45° mitre cut tolerances, thermal expansion).
8. `07-business-strategy.md` — Go-to-market strategy, dealer partnerships, hardware manufacturer integrations.
9. `08-catalogue-engineering-extraction.md` — Engineering die extractions from OMEO ALTECH, ELICOAT, and Alpro catalogs.
10. `09-killer-features-and-product-vision.md` — Vision for 3D visualizers, instant client quotation generation, WhatsApp cutting list sharing.
11. `09-zsection-deep-analysis.md` — Deep engineering study of 40mm and 55mm openable casement Z-sections, friction stay clearances, and compression gaskets.
12. `10-domal-deep-analysis.md` — Complete engineering study of Domal 27×65mm Euro Groove system, corner cleat crimping, and glass rebates.
13. `11-fabricator-os-build-brief.md` — Architecture brief for modern Fabricator OS.
14. `12-premium-redesign-strategy.md` — Clean tactile industrial UI system, high-contrast dark theme, and workshop legibility.
15. `13-ux-audit-and-plan.md` — Usability audit on low-end Android mobile devices with oily workshop fingers.
16. `14-product-overhaul-strategy.md` — Complete overhaul strategy unifying window estimation, cutting list, and inventory.
17. `15-bug-hunt-2026-10-28.md` — Bug register and regression tests for track deductions.
18. `16-customer-call-2026-11-06.md` — Direct field customer interviews with fabricators in Rajasthan, Gujarat, and Maharashtra.
19. `17-fabrication-handbook.md` — 45KB complete fabrication handbook detailing workshop cutting formulas, tool setups, and cutting blade tolerances.
20. `18-custom-system-studio-and-catalogue-deep-research.md` — 279KB exhaustive research on 20+ extrusion manufacturers across India, UAE, and Europe.
21. `19-system-builder-knowledge-map.md` — Knowledge graph of profile relationships (Frames -> Sash -> Interlock -> Patti -> Clips).

### Root 2: Field Research & Video Transcripts (`E:\alu-tool\research/`)
- `catalogue/new-series/` — Original manufacturer PDF catalogs:
  - `BANUHASHIM READY.pdf` (Banu Hashim 31mm Slim, 35mm Gulf, 2-track, 3-track dies)
  - `29MM-29MM SLEEK.pdf` & `37MM-37MM SLEEK.pdf` (Ample Sleek minimalist series)
  - `domal-section.pdf`, `z section.pdf`, `Alucoat Catelogue_2024.pdf`, `22 MM.pdf`, `25 MM.pdf`
- `transcripts/system-windows/` (65+ in-depth workshop video transcripts):
  - Real-world cutting measurement calculations, local vs Jindal differences, EPDM rubber installation, Domal 45° corner crimping, lock cutouts, and 3-track assembly walkthroughs.

### Root 3: Application Codebase (`E:\alu-tool\app/`)
- `docs/`:
  - `FABRIQ_SYSTEMS_HANDBOOK.pdf` & `systems-handbook.html` — Complete 10-page master handbook covering all 11 systems with catalogue photos, CAD shapes, and fabrication conditions.
  - `HANDOVER.md` — Handover notes, active preview URLs, and system state.
  - `SOLO-MODE.md` & `SOLO-LOG.md` — Operational rules for standalone execution and audit log of all changes.
  - `studio/` — System Studio architecture, formula evidence register, and research audits.
- `lib/engine/`:
  - `units.ts` — High-precision integer micro-meter (`Um`) arithmetic. Converts between inch, sut (1/8″), fractional sut (1/16″, 1/32″), and mm with zero floating point drift.
  - `sections.ts` — Section master registry, weights, and catalogue properties.
  - `cutting.ts` — Cutting size calculators for standard Bombay and Domal windows.
  - `optimizer.ts` — 1D cutting stock bin packing algorithm for minimum offcut waste.
- `lib/studio/`:
  - `model.ts` — Type definitions for `StudioSystem`, `PartDef`, `ProfileDef`, `CutRule`, `StudioJob`.
  - `templates.ts` — 21 built-in systems (Normal 18, Normal 25, Domal 27, Domal 35, Ample 29, Banu Hashim 31, Gulf 35, Z-40, Z-55, Partitions, Doors) and 122 verified profile definitions.
  - `geometry.ts` — 2D vector geometry solver computing bounding boxes, overlap polygons, and profile orientations.
  - `teach.ts` — Algebraic equation solver deriving formula constants (`add`, `factor`) from 1 user-provided sample window.
  - `shapes.ts` & `shapes/*.json` — Traced vector CAD profiles with true mm dimensions.
- `components/`:
  - `studio-3d.tsx` — Photorealistic Three.js / React Three Fiber architectural cutaway corner viewer (Reynaers / Crystal Windows style).
  - `studio-editor.tsx` — Main System Studio interface (Pieces list, cutting list, 2D/3D toggle, formula editor).
  - `section-sketch.tsx` & `section-profiles.tsx` — 1:1 cross-section profile viewer with cropped catalogue photos and CAD vector die paths.
  - `studio-drawing.tsx` — Parametric 2D architectural window drawing with dimension callouts.
- `evals/studio/`:
  - `parity.ts` (352 test cases comparing Studio engine vs legacy engine)
  - `z-parity.ts` (32 test cases for openable Z-section casements)
  - `in-job.ts`, `teach.ts`, `dxf.ts`, `tracer.ts` (Automated verification suites).

---

## 3. Aluminium Fabrication Industry Master Knowledge

### 3.1 Units of Measurement in Indian Workshops
Indian aluminium workshops operate in a hybrid measurement system:
1. **Inch & Sooth/Sut:**
   - 1 Inch = 8 Sut (or Sooth). 1 Sut = 1/8″ = 3.175 mm.
   - Half Sut = 1/16″ = 1.5875 mm. Quarter Sut = 1/32″ = 0.79375 mm.
   - Workshop notation: `48.4` means 48 inches and 4 sut (48-1/2″).
2. **Millimetre (mm):**
   - Used for European system windows (Domal, Sleek, Schuco, Reynaers, Cortizo) and glass processing plants.
3. **Internal Representation in FabriQ:**
   - Everything internally is stored as integer micro-meters (`Um = 1e-6 meter` or `1 mm = 1000 Um`).
   - This eliminates all JavaScript floating-point rounding errors (`0.1 + 0.2 !== 0.3`).

### 3.2 Aluminium Alloys, Tempers & Wall Thicknesses
- **Alloy:** Architectural Extrusions use **AA 6063** (Al-Mg-Si alloy) with **T6 temper** (solution heat-treated and artificially aged for high tensile strength and sharp extrusion corners).
- **Wall Thickness Categories:**
  - Light / Economy: 0.9 mm to 1.1 mm (local residential)
  - Medium / Commercial Standard: 1.2 mm to 1.4 mm (Jindal / Banu Hashim standard)
  - Heavy / Architectural: 1.6 mm to 2.5 mm (Domal 35, Sleek, high-rise wind loads)

### 3.3 Finishes & Coatings
1. **Anodised:** Electrochemical oxide layer (15 to 25 microns). Available in Natural Silver (EV1), Champagne, Bronze, and Black. Scratch-resistant, ideal for coastal areas.
2. **Powder-Coated:** Electrostatic thermosetting powder cured at 200°C (60 to 80 microns). Colors: Anthracite Grey (RAL 7016), Matt Noir (RAL 9005), Traffic White (RAL 9016).
3. **PVDF (Fluorocarbon):** 3-coat architectural coating for extreme weather and UV resistance.
4. **Wood-Sublimation (Wooden Finish):** Powder base coat followed by vacuum heat transfer of Italian wood grain film.

---

## 4. The 11 Core Aluminium Systems (A to Z Guide)

### 01. Normal Sliding 18 mm (Bombay Series — 3/4″ × 1.5″)
- **Application:** Most common residential sliding window in India.
- **Anatomy:**
  - **Outer Frame:** 2-Track (62×32 mm) or 3-Track (92×32 mm).
  - **Top/Side Frame (Die #1000 / #1001):** Smooth U-channel guiding the top and sides of shutters.
  - **Bottom Frame (Die #1011 / #1012):** Raised rail track fins where roller bearings slide. Has weep drainage holes.
  - **Handle Stile (Die #1041, 40×18 mm):** Vertical stile on the outer lock side; houses flush lock or pop-up lock.
  - **Interlock Stile (Die #1046, 40×18 mm):** Vertical meeting stile; has a curved mating hook that interlocks with the adjacent shutter to block wind and dust.
  - **Bearing Bottom / Top Rail (Die #1051, 40×18 mm):** Horizontal rails. Bottom rail houses steel/nylon ball-bearing roller wheels.
- **Formulas:**
  - Shutter Height: $H - 38\text{ mm}$ (approx. $1\text{ inch } 2\text{ sut}$)
  - Shutter Width (2-Track 2-Shutter): $(W + 18\text{ mm}) / 2$
  - Glass Width: $\text{Shutter Width} - 48\text{ mm}$
  - Glass Height: $\text{Shutter Height} - 48\text{ mm}$

### 02. Normal Sliding 25 mm (Bombay Heavy 1″ × 2″)
- **Application:** Large windows (5ft to 7ft height) needing higher inertia against wind deflection.
- **Anatomy:** Outer frame (50×25 mm), 1″×2″ Handle (50×25 mm), 1″×2″ Interlock (50×25 mm), Heavy Bearing Bottom (50×25 mm).

### 03. Domal 27 mm Series (Euro Groove 27 × 65 mm)
- **Application:** High-end residential villas and premium apartments.
- **Anatomy:**
  - **Outer Frame:** Domal 2-Track (80×45 mm) and 3-Track (115×45 mm). 45° mitre cut on all 4 corners, joined with cast aluminium corner cleats (*L-clamps*) and set screws.
  - **Shutter Profile (27×65 mm):** Identical profile used on all 4 sides (top, bottom, left, right) with 45° mitre cuts. Features an internal Euro groove for hardware and a deep glass pocket.
  - **Interlock Patti (39×28 mm):** Separate interlocking guide screwed onto the shutter vertical stiles.
  - **Mosquito Mesh Shutter (55×27 mm):** Dedicated channel for stainless steel wire mesh locked with PVC spline.
- **Formulas:**
  - Shutter Height: $H - 70\text{ mm}$
  - Shutter Width (2-Track 2-Shutter): $(W + 48\text{ mm}) / 2$
  - Corner cut: 45° mitre cut on both ends.

### 04. Domal 35 mm Heavy Architectural Series
- **Application:** Large spans (8ft to 10ft height), floor-to-ceiling balcony sliders, acoustic soundproofing with 20mm–24mm DGU (Double Glazed Units).
- **Anatomy:** Heavy 35×75 mm shutter extrusion, heavy-duty tandem stainless steel rollers (150kg+ capacity per shutter), multi-point espagnolette locking.

### 05. Ample 29 mm Sleek Series
- **Application:** Modern minimalist architectural windows with ultra-slim sightlines.
- **Anatomy:**
  - **Outer Frame:** 2-Track (85.8×47.7 mm, Die #41011).
  - **Top/Bottom Rail (64.4×50.2 mm, Die #41010):** Heavy horizontal structural member.
  - **Handle Stile (65×29 mm, Die #41055):** Recessed flush grip handle.
  - **Slim Interlock (37 mm / 40 mm):** Ultra-slim vertical meeting stiles (Die #41289 & #992328) providing 90%+ clear glass visibility.
  - **T-Spine Reinforcement (Die #914806, 50.6×45 mm):** Structural T-shaped fin attached to the interlock to withstand high-rise wind loads.

### 06. Banu Hashim 31 mm Slim Series
- **Application:** Coastal and cyclonic wind zones with dedicated Single Glass (SGU) and Double Glass (DGU) options.
- **Anatomy:**
  - Dedicated SGU Rail (BH-6404, 29mm depth) and DGU Rail (BH-6405, 32mm depth).
  - 20.3mm ultra-slim sightline interlock (BH-6408).
  - Heavy structural wind reinforcement spine (BH-6409).
  - Stainless steel runner rail bead (SS Patri).

### 07. Banu Hashim 35 mm Gulf Series
- **Application:** Middle-East / Gulf specification heavy sliding doors.
- **Anatomy:**
  - 90° screwed butt-joint frame: Separate vertical side jambs (BH-6500) and bottom sill tracks (BH-6501).
  - Stepped internal weep drainage slots with check valves.
  - Stainless steel round runner rail bead (BH-6513) preventing aluminium wear.

### 08. Casement Window / Z-Section 40 mm (Openable System)
- **Application:** Hinged openable windows, bathroom ventilators, soundproof airtight residential windows.
- **Anatomy:**
  - **Z Outer Frame (40×40 mm, Die #2001):** Wall-mounted frame with 45° mitre cuts.
  - **Z Pipe / Sash (40×40 mm, Die #2002):** Openable shutter with double-step Z-rebates.
  - **Z Center Mullion / Transom (40×55 mm, Die #2003):** Structural divider between two shutters or fixed glass.
  - **Glazing Clip (Die #2004):** Snap-on bead locking the glass into the rebate.
  - **EPDM Gaskets:** Hollow bulb compression seals providing 100% airtight and watertight closure when locked.
  - **Hardware:** Stainless steel 304 friction stays (10″ to 24″) + Cockspur or Espag multi-point locking handles.

### 09. Heavy Casement / Z-Section 55 mm
- **Application:** Heavy commercial openable windows and high-rise curtain wall inserts.
- **Anatomy:** Outer frame (40×55 mm, Die #2005), Sash (40×55 mm, Die #2006), Heavy 70mm Mullion (Die #2007).

### 10. Aluminium Partition Series (2.5″ × 1.5″ & 2″ × 1″)
- **Application:** Office cabins, conference rooms, banks, hospitals.
- **Anatomy:**
  - **Outer Frame (63.5×38.1 mm, Die #3001):** Floor, ceiling, and wall perimeter channel.
  - **Divider / Middle Mullion (63.5×38.1 mm, Die #3002):** I-section with dual glass clip channels for center joints.
  - **Glazing Clip (Die #3003):** Snap-on clip securing 5mm to 12mm glass or pre-laminated particle boards.

### 11. Aluminium Doors Series (Flush, Glazed & Pattam)
- **Application:** Office entrance doors, bathroom doors, shopfronts.
- **Anatomy:**
  - **Pattam Frame (63.5×38.1 mm / 100×45 mm):** Door frame with integrated rebate stop.
  - **Door Palla (75 mm, 60 mm, 50 mm):** Heavy tubular stiles with deep glass/panel pockets.
  - **Center Divider (75 mm):** Horizontal middle rail for half-glass / half-sheet doors.
  - **Bottom Kick Plate (100 mm / 150 mm / 4″ & 6″):** Heavy base rail protecting the door from foot impacts and housing the floor pivot/spring.

---

## 5. Mathematical Optimization & Algorithms

### 5.1 Linear Cutting Stock Problem (1D Bin Packing)
- Extrusion bars come from the mills in standard lengths: $L = 16\text{ ft (4876.8 mm)}$ or $18\text{ ft (5486.4 mm)}$ or $19\text{ ft (5791.2 mm)}$.
- Every cut made by a tungsten carbide circular saw blade consumes kerf width ($K = 3.5\text{ mm to } 5\text{ mm}$).
- FabriQ uses a greedy best-fit / first-fit decreasing branch-and-bound algorithm:
  $$\min \sum_{j=1}^m C_j \quad \text{subject to} \quad \sum_{i} x_{ij} (l_i + K) \le L$$
- Achieves $\ge 97\%$ metal utilization with scrap offcuts grouped together for reusable inventory.

### 5.2 The Parametric Geometry Engine
- Evaluates overlap equations:
  $$W_{\text{shutter}} = \frac{W_{\text{opening}} + (N - 1) \cdot \text{Overlap} - 2 \cdot \text{FrameJamb}}{N}$$
- Automatically detects track positions ($T_1, T_2, T_3$) and computes meeting stile alignments for 2-track 2-shutter, 2-track 4-shutter, 3-track 3-shutter, and 3-track 6-shutter configurations.

---

## 6. Guidelines & Operational Rules for Codex

1. **Strict Solo Mode Protocol:**
   - **Never touch or commit to `main` branch.**
   - **Never deploy to production (`app-six-lilac-20.vercel.app`).**
   - Active work branch: `ag/<task-name>`.
   - Production staging / private preview branch: `claude/system-studio`.
   - Private Preview Deployment URL: `https://app-3pa0k75gn-indian-steels.vercel.app/studio`.
2. **Honest Fabrication Numbers Rule:**
   - If a cutting constant is unknown for a new system, keep `add: null`. Never invent fake cutting formulas. The workshop mistri will provide one real window to teach it via `teach.ts`.
3. **Verification Protocol Before Push:**
   - Must run typecheck: `npx tsc --noEmit` (0 errors).
   - Must run evals: `npx tsx evals/studio/parity.ts`, `evals/studio/in-job.ts`, `evals/studio/z-parity.ts`, `evals/studio/teach.ts`, `evals/studio/dxf.ts`, `evals/studio/tracer.ts`.
4. **Documentation:**
   - Every completed task must be logged in `docs/SOLO-LOG.md` with:
     - Branch / commits
     - Files changed and why
     - Verification / check result
     - Numbers changed (source)
