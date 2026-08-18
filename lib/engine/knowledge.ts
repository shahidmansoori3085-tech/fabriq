/**
 * How every FabriQ system is actually built — the single source of truth the
 * AI reads before it asks anything.
 *
 * WHY THIS FILE EXISTS
 * Every AI route used to carry its own hard-coded list of question ids. That
 * made the assistant a form-filler: it could only ask the questions someone
 * had thought to list, so any real-world opening outside that list either got
 * a silently-defaulted answer or a wrong one. The fix is not a longer list —
 * it is giving the model the same understanding the estimator has, so it can
 * work out for itself what is still unknown for THIS opening and ask that.
 *
 * Everything below is descriptive, not a formula the model should execute.
 * The model never calculates a measurement — the deterministic estimator does
 * (D2). The model reads this to know WHICH FACTS the estimator will need, and
 * why each one changes the build.
 *
 * KEEPING IT HONEST
 * Every number here is copied from the estimator, not invented. When a
 * deduction changes in estimator.ts it must change here too, or the model
 * will explain a build that the engine no longer produces.
 */

/**
 * The words a workshop actually uses, in the scripts they actually write.
 *
 * Two independent reasons this matters. Reading a sheet: these words ARE the
 * sheet — a heading is as likely to say "दो पट्टी" as "2 track", and a model
 * that doesn't know the word cannot carry it down to the boxes under it.
 * Talking to the fabricator: he says "palla", not "shutter leaf", and an
 * assistant that answers in textbook English reads as not knowing the trade.
 *
 * Sourced from the founder-verified system docs (09-zsection, 10-domal) and
 * from real sheets read during testing — not from a dictionary.
 */
const TRADE_VOCABULARY = `
TRADE VOCABULARY — what the words on the paper and in his speech mean

Openings and parts
- चौखट / chokhat / "outer"    = the fixed outer frame, mounted to the wall
- पल्ला / palla                = the shutter (sliding leaf, openable sash, or door leaf)
- जाली / jali / "patti jali"   = mesh (insect net). Say "mesh" in English, "jali" in Hindi.
- मुलियन / "middle" / "midal"  = mullion, the vertical divider between two shutters
- टिप / "flip" / clip          = the glazing clip that snaps in and locks the glass
- पट्टी / patti                = a strip or track. "दो पट्टी" = 2 track, "तीन पट्टी" = 3 track.
- सूत / sut                    = 1/8 inch. Always a fraction of an inch, never a whole unit.
- कट / कctar / "kaatar"        = a 45-degree mitre cut (how frames are cut)

Systems, as a shop names them
- "Normal", "normal sliding", "18mm", "Bombay" = Normal Sliding
- "Domal", "Doomal", "27mm", "29mm", "Euro"    = Domal. One system, all these names.
- "Z", "Z section", "जेड"                       = Z-Section
- "SP" / "DP"                                   = the two partition profiles (single/double groove)

Layout words on a drawing
- "fix" / "फिक्स"        = a fixed panel (does not open)
- "openable" / "खुलने वाला" = an openable panel
- "upar fix" / "ऊपर फिक्स" = a fixed glass band ABOVE the sliding portion (Domal)
`;

/**
 * The rules that hold across every system. Read this first — most of what
 * looks like a per-system special case is really one of these applied.
 */
const UNIVERSAL = `
UNIVERSAL RULES (true for every system)

1. Sizes are ALWAYS width × height, in the fabricator's own notation. Feet,
   inches, mm and ft-in-sut ("4-6-4" = 4 feet 6 inch 4 sut) are all accepted,
   as symbols (4'6", 1372mm) or spelled-out words in any order ("feet 10",
   "10 feet", "4 feet 6 inch 4 sut", "sut 4"). 1 sut = 1/8 inch. Never convert
   a size yourself — hand it over as written.

2. Every measurement in the material list comes from ONE chain:
      wall opening  →  frame  →  shutter / panel pocket  →  glass
   Each step subtracts a real, physical amount: the width of the aluminium
   face that sits in the way, plus a fitting clearance. Nothing is rounded
   for convenience. If you cannot name the thing being subtracted, you do not
   yet know enough to compute — ask.

3. A "deduction" is always a profile's SIGHT-LINE FACE (how much of the
   opening that pipe covers when looking at it straight on), sometimes plus a
   glazing/fitting clearance. Different systems use different profiles, which
   is the only reason their numbers differ.

4. Glass is ALWAYS cut smaller than the pocket it sits in, never equal to it.
   Glass that exactly fills its pocket cannot be fitted and will crack when
   the frame moves.

5. Pipes are bought in fixed bar lengths (16 ft standard, 8 ft short). The
   engine packs the cut pieces into bars and reports BARS TO BUY plus scrap —
   the fabricator orders bars, not a total length.

6. Quantity multiplies whole openings, never lengths. Two identical windows
   are two complete sets of pieces, not one set of doubled pieces.
`;

const NORMAL_SLIDING = `
NORMAL SLIDING (18mm) — the most common system

WHAT IT IS
A fixed outer frame with 2, 3 or 4 tracks. Shutters slide horizontally past
each other in those tracks. Each shutter is built from three DIFFERENT named
profiles (this is what separates it from Domal): a Handle section on one
vertical edge, an Interlock section on the other vertical edge, and Bearing
sections top and bottom.

PIECES AND HOW EACH LENGTH IS FOUND
• Outer frame — 4 pieces. Top and both sides are cut from the top-track
  section; the bottom is a different, heavier bottom-track section (it carries
  the shutter weight and holds the roller path). Top and bottom are cut to the
  full opening WIDTH; the two sides to the full opening HEIGHT. The frame sits
  in the wall opening, so it is NOT reduced.
• Shutter width — always the opening WIDTH ÷ 2, for every track count. This
  surprises people: a 3-track window's shutters are not one third of the
  width. Each shutter must cover half the frame so one can slide fully behind
  another; extra tracks only give more parking room. (Fabricator-verified
  against a real 3-track job.)
• Shutter height — opening HEIGHT minus 41.3mm (about 1 5/8"). This is the
  track depth the shutter sits inside, top and bottom combined.
• Handle and Interlock — one each per shutter, cut to the SHUTTER HEIGHT.
• Bearing (top and bottom of each shutter) — cut to shutter width minus 80mm,
  because the Handle and Interlock verticals already occupy that much.
• Glass — shutter width and height each minus 62mm. All three shutter profiles
  are 40mm wide with a 9mm-deep glazing groove, so the glass loses
  2 × (40 − 9) = 62mm on both axes.

WHAT CHANGES THE BUILD — so what must be known
• TRACK COUNT (2 / 3 / 4). Never infer this from the opening size. A shop
  fits 2-track on a wide window and 3-track on a narrow one all the time,
  depending on how the customer wants it to open. It must be asked.
• SHUTTER MIX — which shutters are glass and which are mesh, e.g. "GG",
  "GGJ", "GGGJ". Mesh shutters use the same aluminium sections but take mesh
  and a spline instead of glass.
• HANDLE TYPE — only Normal Sliding has this choice.

HARDWARE
2 rollers per shutter, 1 lock per window, 4 cast cleats per frame, and wool
pile running the full perimeter of every shutter.
`;

const DOMAL = `
DOMAL (27mm / 29mm) — the premium sliding system

WHAT IT IS
Also a sliding window, but built completely differently from Normal Sliding.
Each shutter is a four-sided mini-frame cut from ONE single profile — there is
no separate handle / interlock / bearing. Glass shutters and mesh shutters use
two different profiles. "Domal" covers both the 27mm and 29mm families; never
offer "Euro" as a separate system.

PIECES AND HOW EACH LENGTH IS FOUND
• Outer frame — 4 pieces from the Domal track section, cut to the full opening
  width (top, bottom) and height (sides).
• Shutter width — opening WIDTH ÷ 2, exactly as in Normal Sliding, and for the
  same reason.
• Shutter height — the SLIDING ZONE height minus 66.7mm (about 2 5/8").
  Note "sliding zone", not the whole window — see the fixed band below.
• Each shutter contributes 4 pieces of its own profile (top, bottom, left,
  right) — 2 cut to shutter width, 2 to shutter height.
• Interlock strips — 2 pieces at EVERY place two shutters meet, each cut to
  shutter height. So 2 track = 2 strips, 3 track = 4, 4 track = 6. Mesh
  shutters do not take an interlock.
• Glass — shutter width and height each minus 102mm. The Domal shutter is
  65mm wide with a 14mm glazing groove: 2 × (65 − 14) = 102mm.

THE OPTIONAL FIXED BAND ON TOP ("upar fix")
A Domal window often has a fixed glass band above the sliding portion. When it
does, the build changes in ways that are easy to get wrong:
• The fixed band is NOT framed in Domal track — it is framed in SP partition
  pipe, with an SP coupler dividing it from the sliding zone below.
• The outer left/right verticals therefore SPLIT: the lower part runs Domal
  track for the sliding zone height, the upper part runs SP pipe for the band.
• The sliding shutters get shorter, because their height is measured from the
  sliding zone only, not the full window.
• The fixed glass is held by a glazing clip on all four sides, and is cut to
  the band pocket minus 12.7mm (4 sut / half an inch).
So: whether there is a fixed band, and how tall it is, must both be known —
one cannot be guessed from the other.

WHAT MUST BE KNOWN
Track count (asked, never inferred from width — same rule as Normal Sliding),
shutter mix, whether there is a fixed top band, and if so its height in feet.
Domal has NO handle-type question.

HARDWARE
Same family as Normal Sliding: 2 rollers per shutter, 1 lock, 4 cleats, wool
pile around every shutter.
`;

const Z_SECTION = `
Z-SECTION — hinge-openable, glass only

WHAT IT IS
Nothing slides. The window is an outer frame divided into panels; panels are
either FIXED (glass sits straight in the frame, held by a clip) or OPENABLE
(a hinged sash on a friction stay). Z-section is glass-only — no mesh, no
sheet.

THE ONE RULE THAT COVERS EVERY Z-SECTION LAYOUT
A Z-section window is an outer frame divided along ONE axis into an ORDERED
ROW OF PANELS. The axis is either side-by-side (left → right, separated by
vertical MULLIONS) or stacked (top → bottom, separated by horizontal
TRANSOMS). Each panel in that row is either:
   • FIXED    — has its own explicit size, given in feet
   • OPENABLE — shares whatever space the fixed panels left over; if several
                openable panels sit together they split that space evenly
That is the whole system. The familiar named layouts are only short names for
common rows:
   "fixed on top"        = stacked:      [Fixed 2ft] [Openable]
   "fixed on one side"   = side-by-side: [Fixed 2ft] [Openable]
   "fixed on both sides" = side-by-side: [Fixed 2ft] [Openable] [Fixed 2ft]
   "fixed in the middle" = side-by-side: [Openable] [Fixed 2ft] [Openable]
   "fully fixed"         = one Fixed panel filling everything
Any other real arrangement a fabricator draws — three fixed strips, four
stacked bands, an uneven mix — is just a different panel row (zType=row) and
is fully supported. Do not try to force a drawing into one of the named
layouts; describe the actual panel order instead.

THE CRITICAL ODDITY — the sash is BIGGER than its opening
In every other system a shutter is cut smaller than the space it fills. In
Z-section the openable sash is cut LARGER, because the Z-shaped profile laps
OVER the face of the outer frame when closed instead of sitting inside it.
A sash is its opening + 10mm on both width and height (5mm of climb per side).
Getting this backwards is the classic Z-section mistake.

PIECES AND HOW EACH LENGTH IS FOUND
• Two size families, chosen by window size: LIGHT (40×40 outer and pipe, 40×55
  centre) for normal windows, HEAVY (40×55 outer and pipe, 40×70 centre) for
  large windows and doors.
• Every profile covers 40mm of the opening per side, whichever family is used.
• Outer frame — 4 pieces at the raw opening width and height (mounted flush).
• Mullions and transoms — cut from the centre section, one at each boundary
  between two panels, spanning the dimension not being divided.
• Panel share — each panel's raw share loses its own boundaries: 40mm where it
  meets the outer frame, 20mm (half the divider) where it meets another panel.
  Only the boundary decides this, never what kind of panel sits either side.
• Openable sash — 4 pieces of Z-pipe at the panel opening + 10mm, as above.
• Fixed panel — no sash pieces at all; glass sits in the frame directly.
• Glass — 5mm smaller than its pocket on every side, for both fixed panels and
  sashes.
• Glazing clip — runs the full four-side perimeter of every glass panel.

WHAT MUST BE KNOWN
The size family (light or heavy), and the panel row: the axis, the order of
panels, which are fixed, and the size of each fixed one. For a plain openable
window, how many sashes.

HARDWARE
Deliberately excluded from the Z-section material list (founder's decision) —
friction stays, handles and locks are not estimated. The list covers aluminium,
glass and clip only.
`;

const DOOR = `
DOOR (single, hinged)

WHAT IT IS
An optional outer frame (chokhat) plus a single shutter leaf (palla). The leaf
is a four-sided frame from one profile, divided by horizontal centre rails into
zones, each zone filled with sheet or mesh.

PROFILE SIZE DRIVES THE CLEARANCE
The palla comes in three sizes, and the fitting clearance scales with it:
   75mm profile (3")   → 2.5" clearance
   60mm profile (2.5") → 2.0" clearance
   50mm profile (2")   → 1.5" clearance
The rule is (profile width in inches − 0.5"). This SAME clearance is used
twice, which is the part people miss.

PIECES AND HOW EACH LENGTH IS FOUND
• Frame (chokhat) — 4 pieces at full opening width and height. Only cut when
  the door needs a new frame; a door going into an existing frame skips these
  entirely, which is a large material difference.
• Leaf left/right — opening HEIGHT minus the clearance.
• Leaf top/bottom and every centre rail — opening WIDTH minus the clearance,
  then minus the clearance AGAIN. The second subtraction is because these
  horizontals span between the inner faces of the two verticals. (Verified on
  a real 30"×84" job: a 27.5" palla gives a 25" centre rail, the same 2.5"
  twice.)
• Centre rails — one fewer than the number of zones. They use a different,
  double-grooved die in the same size class as the palla.
• Zone infill — the leaf height divided by the zone count, then each zone
  reduced by the clearance on both axes.

WHAT MUST BE KNOWN
Whether a frame is needed or one already exists; the palla profile size; the
number of zones/rails; and the zone mix — which zones are solid sheet and
which are mesh, e.g. "SSJ" (two sheet, one mesh).

HARDWARE
3 hinges and 1 lock per door. Sheet zones take a rubber gasket, mesh zones a
spline, each running the zone perimeter.
`;

const PARTITION = `
PARTITION (SP / DP grid)

WHAT IT IS
A framed grid filling a room opening, divided into cells by vertical and
horizontal dividers. Cells are glass, optionally with a band of solid sheet
along the bottom, and the partition can include a door.

THE TWO PROFILES — and why the clip count differs
• SP (Single Partition) has ONE groove. It is the outer frame, sitting flat
  against wall, floor and ceiling. Only one side faces a panel, so it takes
  ONE run of glazing clip.
• DP (Double Partition) has TWO grooves. It is every internal divider, with a
  panel on each side, so it takes TWO runs of clip along its length.
Both have a 38.1mm (1.5") sight-line face.

PIECES AND HOW EACH LENGTH IS FOUND
• SP outer frame — top and both sides at full width/height; the BOTTOM piece
  is width minus both verticals' faces, because it fits between them.
• DP verticals — one at each bay boundary, cut to the inner height.
• DP horizontals — one at each row boundary, cut to the field width.
• Panel (glass or sheet) — the clear cell opening minus 12.7mm (4 sut / half
  an inch) on BOTH width and height. Video-confirmed as the safe value; 3 sut
  only if the frame is perfectly square.
• Door column (optional) — reserves its own width, adds a DP jamb, and a leaf
  built from the standard door palla profile with one middle rail. The door
  leaf takes NO glazing clip.

HOW THE GRID IS DECIDED — this is what must be asked
The number of dividers is NOT a fixed rule; it comes from spacing the
fabricator chooses off the drawing:
• BAY WIDTH — how far apart the vertical dividers sit (typically 2 to 3 ft).
  The engine fits a whole number of equal bays across the field.
• ROW HEIGHT — how far apart the horizontal dividers sit (typically 3 to 4 ft).
  Rows exist so no single pane of glass is oversized and dangerously heavy.
• BOTTOM SHEET BAND — how many feet of solid sheet along the bottom, 0 for
  full glass.
• DOOR — whether the partition includes one, and how wide.
A drawing showing a grid of cells is telling you the bay and row spacing —
read the cell counts off it and confirm the spacing rather than assuming.
`;

const ASKING = `
HOW TO DECIDE WHAT TO ASK

You are not filling in a fixed form. Work it out for this specific opening:

1. Read what is already known. Never re-ask it, and never ask something that
   is already implied by it (a Z-section window has no track count; a Domal
   window has no handle type).
2. From the sections above, work out what the estimator still cannot compute
   for THIS opening. Ask exactly those things.
3. Ask about REAL BUILD DECISIONS, not preferences. A good question changes
   which pieces get cut or what size they are. If the answer would not change
   the material list, do not ask it.
4. NEVER default a decision silently. If a genuine choice exists — track
   count, panel layout, whether a frame is needed, bay spacing — ask it. A
   silently defaulted answer produces a confident, wrong cutting list, which
   is worse than a question. This is the single most damaging failure mode.
5. Do not infer a choice from the size. In particular, track count does NOT
   follow from width: shops fit 2-track on wide windows and 3-track on narrow
   ones depending on the customer. You may SUGGEST a common answer as the
   first option; you may not assume it.
6. Order questions so earlier answers narrow later ones — system first, then
   what that system needs.
7. When a drawing or note describes something the standard options do not
   cover (fixed panel in the middle, an unusual panel order, a grid), describe
   what is actually there. For Z-section, express it as the panel row. Never
   force it into the nearest named layout.
8. You NEVER calculate a measurement. Gather the facts; the deterministic
   engine does every calculation.
`;

/**
 * Concrete right/wrong calls, all taken from real mistakes this app actually
 * made in front of the fabricator. Rules alone kept being read too loosely —
 * "ask what's missing" sounds obvious and was still getting violated in both
 * directions (asking what the sheet already said, AND skipping something
 * genuinely unknown), so the judgement calls are spelled out as examples.
 */
const ASKING_WORKED_EXAMPLES = `
JUDGEMENT CALLS — real ones, right and wrong

WRONG: a sheet has 2 Normal windows, 2 Z-section windows and a partition,
and the app asks "Which system for all 5 windows?"
RIGHT: ask nothing about system. Every window on that sheet already carries
its own system from the heading above it. A job may freely mix systems;
"they are not all the same" is not the same as "it is unknown".

WRONG: the sheet says fix 22" | openable | fix 22", and the app still asks
"What is the panel layout for this window?"
RIGHT: the layout AND both sizes are already given — ask neither. The only
thing genuinely still unknown for that window is the pipe size family
(zSize), which the sheet never states. Ask exactly that.

WRONG: the sheet says openable | fix | openable with no size on the fixed
panel, and the app assumes a common 2ft and computes.
RIGHT: ask for that one width. The order is known, the size is not, and a
guessed width produces a confident wrong cutting list.

WRONG: an 8-foot-wide Normal Sliding window, and the app decides "wide, so
3 track" and moves on.
RIGHT: ask. Shops fit 2-track on wide windows and 3-track on narrow ones
depending on what the customer wants. Offer 3 track FIRST as the likely
answer if you like — but it is an offer, not an assumption.

WRONG: a Z-section window whose layout is fully known, and the app asks
"how many openable sashes?"
RIGHT: don't ask. For a known panel row the sash count is already implied by
the row itself (each openable panel is one sash). A question whose answer
cannot change any cut piece is a question not worth the fabricator's time.

WRONG: a partition drawn with a 4x3 grid, and the app asks "what bay spacing
do you want?"
RIGHT: the drawing already answers it — 4 columns across the width, 3 rows
up the height. Read the spacing off the grid.
`;

/**
 * The full briefing — every system, plus how to reason about what to ask.
 * Injected into the question-generation and Copilot prompts.
 */
export const ENGINE_KNOWLEDGE = [
  UNIVERSAL, TRADE_VOCABULARY, NORMAL_SLIDING, DOMAL, Z_SECTION, DOOR, PARTITION,
  ASKING, ASKING_WORKED_EXAMPLES,
].join("\n");

/**
 * The same understanding, condensed for reading a hand-drawn sheet. A vision
 * model does not need the deduction values — it needs to know which
 * distinctions on the paper actually matter to the build, so it reports them
 * instead of flattening them.
 */
export const SHEET_READING_KNOWLEDGE = `
WHAT MATTERS ON A MEASUREMENT SHEET (because it changes the build)

• SYSTEM — Normal Sliding, Domal or Z-Section are three completely different
  builds, not variations. A heading like "Normal 3 track" or "Z section" is
  the single most important thing on the page.
• TRACK COUNT — for sliding systems only. Written as "2 track", "3 track",
  "do patti", "teen patti". It must never be guessed from the window size.
• PANEL LAYOUT — for Z-section, a box divided into parts labelled "fix" and
  "openable" is describing the panel row. The ORDER matters and so does each
  fixed part's size: fix|openable|fix is a different window from
  openable|fix|openable. Report the order and the labelled widths as written.
• GRID — a partition drawn with internal lines is showing its bay and row
  spacing. Count the columns and rows as best you can and report them.
• GLASS vs MESH — diagonal strokes mean glass; "jali" / "जाली" means mesh.
• FIXED BAND — a Domal window may be drawn with a separate band above the
  sliding portion. That band's height is a real, separate measurement.

${TRADE_VOCABULARY}

HOW SIZES ARE ACTUALLY WRITTEN (all of these are real, from real sheets)
The app's parser accepts every form below — copy what is written, never
convert it, and never "tidy" it into a form it wasn't written in.
  36"           inches
  4'6"          feet + inches
  4-6-4         4 feet 6 inch 4 sut (three dash-separated parts)
  33" 5sut      inches + sut, sut spelled out. NOT feet — there is no feet
                term here at all. Keep BOTH parts: dropping the 33" and
                reporting only "5sut" is a real mistake that has happened.
  57"2sut       the same thing with no space
  15 fit        feet, spelled the way it is often written/read ("fit" for
                "feet"). Also seen: 15 ft, 15 feet, फुट.
  1372mm        millimetres
Rule of thumb for a BARE number with no unit at all: 2–12 is feet, 24–96 is
inches, 300+ is millimetres. Set unit_guess accordingly, but still copy the
raw number as written.

────────────────────────────────────────────────────────────────────────
WORKED EXAMPLE — a complete real sheet, and exactly what it should produce
This is a real fabricator's sheet, verified end to end. Match this shape.

What is on the paper:

    Normal  3 track
      [box]  36"  ...  60"
      [box]  33" 5sut  ...  57" 2sut

    Z section openable+fix window
      [box]  fix 22" | fix 30" openable | fix 22"      86"  ...  66"
      [box]  openable |  fix  | openable               54"  ...  76"

    Partition
      [box]  15 fit  ...  10 fit,  ruled into a grid of cells

The correct extraction, item by item — note WHY each field is set or left out:

1. { type:"window", width_raw:"36\\"", height_raw:"60\\"",
     unit_guess:"inches", qty:1, tracks:"3", system:"Normal",
     confidence:"high" }
   The "Normal 3 track" heading is written ONCE but governs BOTH boxes under
   it. Carrying it down is the whole job — this box has no system written on
   it at all.

2. { type:"window", width_raw:"33\\" 5sut", height_raw:"57\\" 2sut",
     unit_guess:"ft-in-sut", qty:1, tracks:"3", system:"Normal",
     confidence:"high" }
   Same heading carried down again. Both parts of each size kept intact.

3. { type:"window", width_raw:"86\\"", height_raw:"66\\"",
     unit_guess:"inches", qty:1, system:"Z section",
     z_axis:"cols", z_panels:"F1.83,O,F1.83",
     notes:"fix 22\\" | top fix 30\\" openable | fix 22\\"",
     confidence:"high" }
   Panels run left-to-right, so z_axis "cols". Each fixed panel is 22 inches
   = 1.83 feet, so "F1.83,O,F1.83" — sizes go into z_panels in FEET.
   The stray "fix 30\\"" label sits on part of the openable zone and does not
   fit the simple panel row, so it stays quoted in notes for the fabricator
   to check rather than being forced into z_panels or guessed at.

4. { type:"window", width_raw:"54\\"", height_raw:"76\\"",
     unit_guess:"inches", qty:1, system:"Z section",
     z_axis:"cols", z_order:"O,F,O",
     notes:"openable | fix | openable", confidence:"high" }
   The order is legible but NO size is written against the fixed panel. So
   the ORDER still gets recorded — in z_order, which carries just the
   sequence — while z_panels stays EMPTY because a size is genuinely
   missing. The app then asks only "how wide is the fixed panel?" instead of
   asking what the layout is, which the sheet already showed. Two things
   would both be wrong here: inventing a width to fill z_panels (a
   confident, wrong cutting list), and dropping the order entirely (the app
   would then have to ask about a layout the sheet already gave, and its
   preset layouts cannot even express openable|fix|openable).

5. { type:"partition", width_raw:"15 fit", height_raw:"10 fit",
     unit_guess:"feet", qty:1, part_columns:4, part_rows:3,
     notes:"grid ~4 columns x 3 rows", confidence:"high" }
   The ruled grid is data, not decoration — counting it lets the app work
   out bay and row spacing itself instead of asking for a spacing the
   drawing already shows.

────────────────────────────────────────────────────────────────────────
MISTAKES THAT HAVE ACTUALLY HAPPENED ON THIS SHEET — do not repeat them
• Reading the group heading for only the FIRST box under it and leaving the
  rest with no system/track count.
• Keeping only part of a two-part size ("5sut" without its "33\\"").
• Filling z_panels from a guess when the sheet gave the order but not the
  sizes. Empty is correct there; a guess is not.
• Collapsing a fix|openable|fix window into a plain openable one by dropping
  the panel breakdown. The order IS the build.
• Treating a partition's internal grid lines as decoration and not counting
  them.
`;
