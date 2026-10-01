// Hard measurement-sheet cases for the sheet-reading eval.
// Each case is a fabricator-style handwritten sheet (with drawings) plus the
// ground truth: what the sheet really says, written as the extraction rows a
// perfect reader would return. `onSheet` lists question ids the sheet already
// answers for that opening — the app asking any of them is a miss.

const box = (w, h, cells, label = "") => {
  // cells: [{x,y,w,h,t}] in 0..1 units of the box
  const W = 220, H = Math.round(220 * h / w);
  const r = cells.map((c) =>
    `<rect x="${8 + c.x * W}" y="${8 + c.y * H}" width="${c.w * W}" height="${c.h * H}" fill="none" stroke="#1c2340" stroke-width="1.5"/>` +
    (c.t ? `<text x="${8 + (c.x + c.w / 2) * W}" y="${8 + (c.y + c.h / 2) * H + 5}" font-size="13" text-anchor="middle">${c.t}</text>` : "")).join("");
  return `<svg width="${W + 70}" height="${H + 40}" style="vertical-align:middle">` +
    `<rect x="8" y="8" width="${W}" height="${H}" fill="none" stroke="#1c2340" stroke-width="3"/>${r}` +
    (label ? `<text x="${8 + W / 2}" y="${H + 30}" font-size="14" text-anchor="middle">${label}</text>` : "") +
    `</svg>`;
};
const cols = (labels) => labels.map((t, i) => ({ x: i / labels.length, y: 0, w: 1 / labels.length, h: 1, t }));

const W = (o) => ({ type: "window", unit_guess: "feet", qty: 1, confidence: "high", ...o });
const D = (o) => ({ type: "door", unit_guess: "feet", qty: 1, confidence: "high", ...o });
const P = (o) => ({ type: "partition", unit_guess: "feet", qty: 1, confidence: "high", ...o });

export const CASES = [
  {
    id: "01-mm-sheet", title: "Shree Ram Glass", sub: "Builder site, all sizes in mm",
    body: `<div>1. bedroom 1200 x 1500 mm, 2 track, jali 1</div>${box(1200, 1500, cols(["G", "J"]), "1200 x 1500")}
<div>2. kitchen 900x1200mm 2trk, dono glass</div>
<div>3. main door 900 x 2100 mm, 3 patti, chokhat banana hai</div>`,
    truth: [
      { ...W({ width_raw: "1200", height_raw: "1500", unit_guess: "mm", tracks: "2", mix: "GJ" }), onSheet: ["tracks", "mix"] },
      { ...W({ width_raw: "900", height_raw: "1200", unit_guess: "mm", tracks: "2", mix: "GG" }), onSheet: ["tracks", "mix"] },
      { ...D({ width_raw: "900", height_raw: "2100", unit_guess: "mm", rails: 3, frame_needed: true }), onSheet: ["rails"] },
    ],
  },
  {
    id: "02-inch-sut", title: "Royal Aluminium", sub: "Sizes in inch + sut",
    body: `<div>1. 57"2s x 47"4s &mdash; 2 trk, jali 1</div>
<div>2. 4-6-4 x 3-0-0 &mdash; 3 trk, jali 1</div>
<div>3. 54 x 42 (inch) &mdash; 2 trk glass glass</div>${box(54, 42, cols(["G", "G"]), "54 x 42")}`,
    truth: [
      { ...W({ width_raw: "57\"2s", height_raw: "47\"4s", unit_guess: "ft-in-sut", tracks: "2", mix: "GJ" }), onSheet: ["tracks", "mix"] },
      { ...W({ width_raw: "4-6-4", height_raw: "3-0-0", unit_guess: "ft-in-sut", tracks: "3", mix: "GGJ" }), onSheet: ["tracks", "mix"] },
      { ...W({ width_raw: "54", height_raw: "42", unit_guess: "inches", tracks: "2", mix: "GG" }), onSheet: ["tracks", "mix"] },
    ],
  },
  {
    id: "03-devanagari", title: "गुप्ता एल्युमिनियम", sub: "साइट – शिव नगर",
    body: `<div>1. खिड़की 4x5 दो पट्टी, जाली 1</div>
<div>2. खिड़की 3x4 दो पट्टी, जाली नहीं</div>
<div>3. दरवाजा 3x7, चौखट लगी हुई है, 2 पट्टी</div>`,
    truth: [
      { ...W({ width_raw: "4", height_raw: "5", tracks: "2", mix: "GJ" }), onSheet: ["tracks", "mix"] },
      { ...W({ width_raw: "3", height_raw: "4", tracks: "2", mix: "GG" }), onSheet: ["tracks", "mix"] },
      { ...D({ width_raw: "3", height_raw: "7", rails: 2, frame_needed: false }), onSheet: ["rails"] },
    ],
  },
  {
    id: "04-group-heading", title: "Saini Windows", sub: "Heading applies to the boxes below it",
    body: `<div style="font-weight:bold;text-decoration:underline">DOMAL 2 TRACK (jali 1 sabme)</div>
<div>a) 4x5 &nbsp; b) 5x5 &nbsp; c) 3x4</div>
<div style="font-weight:bold;text-decoration:underline;margin-top:8px">NORMAL 3 TRACK</div>
<div>d) 6x5 jali 1 &nbsp; e) 7x5 jali 1</div>${box(6, 5, cols(["G", "G", "J"]), "6 x 5")}`,
    truth: [
      { ...W({ width_raw: "4", height_raw: "5", system: "Domal", tracks: "2", mix: "GJ" }), onSheet: ["system", "tracks", "mix"] },
      { ...W({ width_raw: "5", height_raw: "5", system: "Domal", tracks: "2", mix: "GJ" }), onSheet: ["system", "tracks", "mix"] },
      { ...W({ width_raw: "3", height_raw: "4", system: "Domal", tracks: "2", mix: "GJ" }), onSheet: ["system", "tracks", "mix"] },
      { ...W({ width_raw: "6", height_raw: "5", system: "Normal", tracks: "3", mix: "GGJ" }), onSheet: ["system", "tracks", "mix"] },
      { ...W({ width_raw: "7", height_raw: "5", system: "Normal", tracks: "3", mix: "GGJ" }), onSheet: ["system", "tracks", "mix"] },
    ],
  },
  {
    id: "05-qty-notation", title: "Kumar Fab", sub: "Quantity written every way",
    body: `<div>1. 4x4 2trk jali 1 &mdash; x3</div>
<div>2. 3x3 2trk jali 1 &mdash; 2 nos</div>
<div>3. 5x4 3trk jali 1 (4)</div>
<div>4. bathroom 2x2 2trk glass, do pcs</div>`,
    truth: [
      { ...W({ width_raw: "4", height_raw: "4", qty: 3, tracks: "2", mix: "GJ" }), onSheet: ["tracks", "mix"] },
      { ...W({ width_raw: "3", height_raw: "3", qty: 2, tracks: "2", mix: "GJ" }), onSheet: ["tracks", "mix"] },
      { ...W({ width_raw: "5", height_raw: "4", qty: 4, tracks: "3", mix: "GGJ" }), onSheet: ["tracks", "mix"] },
      { ...W({ width_raw: "2", height_raw: "2", qty: 2, tracks: "2", mix: "GG" }), onSheet: ["tracks", "mix"] },
    ],
  },
  {
    id: "06-z-sized-row", title: "Bharat Z-Section", sub: "Z windows with panel sizes",
    body: `<div>1. Z window 6x4 &mdash; fix 22" | openable | fix 22"</div>${box(6, 4, [{ x: 0, y: 0, w: 0.31, h: 1, t: "fix 22\"" }, { x: 0.31, y: 0, w: 0.38, h: 1, t: "open" }, { x: 0.69, y: 0, w: 0.31, h: 1, t: "fix 22\"" }])}
<div>2. Z window 4x5 &mdash; upar fix 18", niche openable</div>${box(4, 5, [{ x: 0, y: 0, w: 1, h: 0.3, t: "fix 18\"" }, { x: 0, y: 0.3, w: 1, h: 0.7, t: "open" }])}`,
    truth: [
      { ...W({ width_raw: "6", height_raw: "4", system: "Z section", z_axis: "cols", z_panels: "F1.83,O,F1.83" }), onSheet: ["system", "zType"] },
      { ...W({ width_raw: "4", height_raw: "5", system: "Z section", z_axis: "rows", z_panels: "F1.5,O" }), onSheet: ["system", "zType"] },
    ],
  },
  {
    id: "07-partition-grid", title: "Office Interiors", sub: "Partition drawn as grid",
    body: `<div>Cabin partition 12x8, door right side 3ft, baaki glass</div>${box(12, 8, [
      ...[0, 1, 2].flatMap((c) => [0, 1].map((r) => ({ x: c * 0.25, y: r * 0.5, w: 0.25, h: 0.5, t: "glass" }))),
      { x: 0.75, y: 0, w: 0.25, h: 1, t: "DOOR 3'" }])}`,
    truth: [
      { ...P({ width_raw: "12", height_raw: "8", part_columns: 3, part_rows: 2, part_door: true, part_door_ft: 3 }), onSheet: ["partDoor", "partDoorW", "partBayFt", "partRowFt"] },
    ],
  },
  {
    id: "08-corrections", title: "Mehta & Sons", sub: "Sizes corrected on site",
    body: `<div>1. khidki <s style="color:#888">6x4</s> <b>5x4</b> 2trk jali 1</div>
<div>2. khidki 4x<s style="color:#888">4</s><b>4.5</b> 2trk jali 1</div>
<div>3. darwaza <s style="color:#888">3x6.5</s> 3x7 2 patti, chokhat hai</div>`,
    truth: [
      { ...W({ width_raw: "5", height_raw: "4", tracks: "2", mix: "GJ" }), onSheet: ["tracks", "mix"] },
      { ...W({ width_raw: "4", height_raw: "4.5", tracks: "2", mix: "GJ" }), onSheet: ["tracks", "mix"] },
      { ...D({ width_raw: "3", height_raw: "7", rails: 2, frame_needed: false }), onSheet: ["rails"] },
    ],
  },
  {
    id: "09-negations", title: "Ansari Aluminium", sub: "Hinglish negation traps",
    body: `<div>1. darwaza 3x7 &mdash; chokhat nahi hai, banana padega, 2 patti</div>
<div>2. darwaza 2.5x7 &mdash; chokhat already laga hai, 3 patti</div>
<div>3. khidki 4x5 2trk &mdash; jali nahi chahiye</div>
<div>4. partition 8x8 &mdash; door nahi, full glass</div>`,
    truth: [
      { ...D({ width_raw: "3", height_raw: "7", rails: 2, frame_needed: true }), onSheet: ["rails"] },
      { ...D({ width_raw: "2.5", height_raw: "7", rails: 3, frame_needed: false }), onSheet: ["rails"] },
      { ...W({ width_raw: "4", height_raw: "5", tracks: "2", mix: "GG" }), onSheet: ["tracks", "mix"] },
      { ...P({ width_raw: "8", height_raw: "8", part_door: false }), onSheet: ["partDoor"] },
    ],
  },
  {
    id: "10-mesh-count", title: "Verma Windows", sub: "Mesh written as a count",
    body: `<div>1. hall 7x5 3trk jali 2</div>${box(7, 5, cols(["G", "J", "J"]), "7 x 5")}
<div>2. bed 5x5 3trk jali 1</div>
<div>3. small 3x3 2trk, jali dono me</div>`,
    truth: [
      { ...W({ width_raw: "7", height_raw: "5", tracks: "3", mix: "GJJ" }), onSheet: ["tracks", "mix"] },
      { ...W({ width_raw: "5", height_raw: "5", tracks: "3", mix: "GGJ" }), onSheet: ["tracks", "mix"] },
      { ...W({ width_raw: "3", height_raw: "3", tracks: "2", mix: "JJ" }), onSheet: ["tracks", "mix"] },
    ],
  },
  {
    id: "11-same-as-chain", title: "Lakshmi Fab", sub: "References to other rows",
    body: `<div>1. 4x5 2trk jali 1</div>
<div>2. same as 1</div>
<div>3. upar wala jaisa, but 3 nos</div>
<div>4. 6x5 3trk jali 1</div>`,
    truth: [
      { ...W({ width_raw: "4", height_raw: "5", tracks: "2", mix: "GJ" }), onSheet: ["tracks", "mix"] },
      { ...W({ width_raw: "4", height_raw: "5", tracks: "2", mix: "GJ" }), onSheet: ["tracks", "mix"] },
      { ...W({ width_raw: "4", height_raw: "5", qty: 3, tracks: "2", mix: "GJ" }), onSheet: ["tracks", "mix"] },
      { ...W({ width_raw: "6", height_raw: "5", tracks: "3", mix: "GGJ" }), onSheet: ["tracks", "mix"] },
    ],
  },
  {
    id: "12-dense-12-rows", title: "Kapoor Aluminium", sub: "Full flat, 12 openings",
    body: [
      "W1 4x5 2trk J1", "W2 4x5 2trk J1", "W3 3x4 2trk J1", "W4 6x5 3trk J1", "W5 2x2 2trk G",
      "W6 5x4 2trk J1", "W7 3x3 2trk J1", "W8 4x4 2trk J1", "D1 3x7 2 patti chokhat banana", "D2 2.5x7 2 patti chokhat hai",
      "D3 3x7 3 patti chokhat banana", "W9 8x5 3trk J1",
    ].map((t) => `<div style="font-size:18px;line-height:28px">${t}</div>`).join(""),
    truth: [
      W({ width_raw: "4", height_raw: "5", tracks: "2", mix: "GJ" }), W({ width_raw: "4", height_raw: "5", tracks: "2", mix: "GJ" }),
      W({ width_raw: "3", height_raw: "4", tracks: "2", mix: "GJ" }), W({ width_raw: "6", height_raw: "5", tracks: "3", mix: "GGJ" }),
      W({ width_raw: "2", height_raw: "2", tracks: "2", mix: "GG" }), W({ width_raw: "5", height_raw: "4", tracks: "2", mix: "GJ" }),
      W({ width_raw: "3", height_raw: "3", tracks: "2", mix: "GJ" }), W({ width_raw: "4", height_raw: "4", tracks: "2", mix: "GJ" }),
      D({ width_raw: "3", height_raw: "7", rails: 2, frame_needed: true }), D({ width_raw: "2.5", height_raw: "7", rails: 2, frame_needed: false }),
      D({ width_raw: "3", height_raw: "7", rails: 3, frame_needed: true }), W({ width_raw: "8", height_raw: "5", tracks: "3", mix: "GGJ" }),
    ].map((t) => ({ ...t, onSheet: t.type === "window" ? ["tracks", "mix"] : ["rails"] })),
  },
  {
    id: "13-drawing-only", title: "", sub: "No list — sizes written on the boxes",
    body: `${box(5, 4, cols(["glass", "glass", "jali"]), "5' x 4'  (3 trk)")} ${box(3, 7, [{ x: 0, y: 0, w: 1, h: 0.33 }, { x: 0, y: 0.33, w: 1, h: 0.33 }, { x: 0, y: 0.66, w: 1, h: 0.34 }], "darwaza 3' x 7'  2 patti")}
<br>${box(4, 4, cols(["glass", "jali"]), "4' x 4'")}`,
    truth: [
      { ...W({ width_raw: "5", height_raw: "4", tracks: "3", mix: "GGJ" }), onSheet: ["tracks", "mix"] },
      { ...D({ width_raw: "3", height_raw: "7", rails: 2 }), onSheet: ["rails"] },
      { ...W({ width_raw: "4", height_raw: "4", tracks: "2", mix: "GJ" }), onSheet: ["tracks", "mix"] },
    ],
  },
  {
    id: "14-fixed-bands", title: "Prime Domal", sub: "Fixed bands on top",
    body: `<div>1. Domal 5x6, top 1.5' fix, 2 trk jali 1</div>${box(5, 6, [{ x: 0, y: 0, w: 1, h: 0.25, t: "FIX 1.5'" }, { x: 0, y: 0.25, w: 0.5, h: 0.75, t: "G" }, { x: 0.5, y: 0.25, w: 0.5, h: 0.75, t: "J" }])}
<div>2. Domal 4x6 upar 2ft fix, glass glass</div>`,
    truth: [
      { ...W({ width_raw: "5", height_raw: "6", system: "Domal", tracks: "2", mix: "GJ", fixed_top_ft: 1.5 }), onSheet: ["system", "tracks", "mix", "domalFix", "domalFixFt"] },
      { ...W({ width_raw: "4", height_raw: "6", system: "Domal", tracks: "2", mix: "GG", fixed_top_ft: 2 }), onSheet: ["system", "tracks", "mix", "domalFix", "domalFixFt"] },
    ],
  },
  {
    id: "15-mixed-units-row", title: "City Glass House", sub: "Units mixed inside one row",
    body: `<div>1. 4ft x 54in, 2trk jali 1</div>
<div>2. 1500mm x 4ft, 3trk jali 1</div>
<div>3. 36" x 5', 2trk dono glass</div>`,
    truth: [
      { ...W({ width_raw: "4'", height_raw: "54\"", unit_guess: "ft-in-sut", tracks: "2", mix: "GJ" }), onSheet: ["tracks", "mix"] },
      { ...W({ width_raw: "1500mm", height_raw: "4'", unit_guess: "ft-in-sut", tracks: "3", mix: "GGJ" }), onSheet: ["tracks", "mix"] },
      { ...W({ width_raw: "36\"", height_raw: "5'", unit_guess: "ft-in-sut", tracks: "2", mix: "GG" }), onSheet: ["tracks", "mix"] },
    ],
  },
  {
    id: "16-sheet-shutters", title: "Store & Utility", sub: "Aluminium sheet instead of glass",
    body: `<div>1. store room 3x3 2trk, dono sheet</div>${box(3, 3, cols(["SHEET", "SHEET"]))}
<div>2. bathroom 2x2 2trk, 1 sheet 1 jali</div>
<div>3. utility 4x4 3trk, 1 sheet 1 glass 1 jali</div>`,
    truth: [
      { ...W({ width_raw: "3", height_raw: "3", tracks: "2", mix: "SS" }), onSheet: ["tracks", "mix"] },
      { ...W({ width_raw: "2", height_raw: "2", tracks: "2", mix: "SJ" }), onSheet: ["tracks", "mix"] },
      { ...W({ width_raw: "4", height_raw: "4", tracks: "3", mix: "SGJ" }), onSheet: ["tracks", "mix"] },
    ],
  },
  {
    id: "17-noisy-photo", title: "Rajput Aluminium", sub: "Faded, rotated, stained",
    noisy: true,
    body: `<div>1. 4x5 2trk jali 1</div><div>2. 3x4 2trk jali 1</div><div>3. darwaza 3x7 2 patti chokhat banana</div>`,
    truth: [
      { ...W({ width_raw: "4", height_raw: "5", tracks: "2", mix: "GJ" }), onSheet: ["tracks", "mix"] },
      { ...W({ width_raw: "3", height_raw: "4", tracks: "2", mix: "GJ" }), onSheet: ["tracks", "mix"] },
      { ...D({ width_raw: "3", height_raw: "7", rails: 2, frame_needed: true }), onSheet: ["rails"] },
    ],
  },
  {
    id: "18-z-door-openable", title: "Z Systems", sub: "Z door and openable sashes",
    body: `<div>1. Z door 3x7, ek palla, hinge</div>
<div>2. Z openable 4x4, 2 sash dono khulne wale</div>${box(4, 4, cols(["open", "open"]))}`,
    truth: [
      { ...W({ width_raw: "3", height_raw: "7", system: "Z section", notes: "Z door" }), onSheet: ["system", "zType"] },
      { ...W({ width_raw: "4", height_raw: "4", system: "Z section", z_axis: "cols", z_order: "O,O" }), onSheet: ["system", "zType"] },
    ],
  },
  {
    id: "19-flats-repeat", title: "Green Valley Flats", sub: "Same windows per flat",
    body: `<div style="font-weight:bold">Flat A</div><div>bedroom 4x5 2trk jali 1 &nbsp; hall 6x5 3trk jali 1</div>
<div style="font-weight:bold">Flat B</div><div>bedroom 4x5 2trk jali 1 &nbsp; hall 6x5 3trk jali 1</div>
<div style="font-weight:bold">Flat C</div><div>bedroom 4x5 2trk jali 1 &nbsp; hall 6x5 3trk jali 1</div>`,
    truth: [
      W({ width_raw: "4", height_raw: "5", tracks: "2", mix: "GJ" }), W({ width_raw: "6", height_raw: "5", tracks: "3", mix: "GGJ" }),
      W({ width_raw: "4", height_raw: "5", tracks: "2", mix: "GJ" }), W({ width_raw: "6", height_raw: "5", tracks: "3", mix: "GGJ" }),
      W({ width_raw: "4", height_raw: "5", tracks: "2", mix: "GJ" }), W({ width_raw: "6", height_raw: "5", tracks: "3", mix: "GGJ" }),
    ].map((t) => ({ ...t, onSheet: ["tracks", "mix"] })),
    // the reader may legitimately collapse repeats into qty — score by total units
    totalsOnly: true,
  },
  {
    id: "20-illegible", title: "Quick sheet", sub: "One size not readable",
    body: `<div>1. 4x5 2trk jali 1</div>
<div>2. <span style="filter:blur(3px)">7x?</span> 2trk jali 1 <span style="font-size:13px">(height mita hua)</span></div>
<div>3. 3x4 2trk jali 1</div>`,
    truth: [
      { ...W({ width_raw: "4", height_raw: "5", tracks: "2", mix: "GJ" }), onSheet: ["tracks", "mix"] },
      { ...W({ width_raw: "", height_raw: "", tracks: "2", mix: "GJ" }), unreadable: true },
      { ...W({ width_raw: "3", height_raw: "4", tracks: "2", mix: "GJ" }), onSheet: ["tracks", "mix"] },
    ],
  },

  // ——— round 2: cases written to break what round 1 no longer catches ———
  {
    id: "21-devanagari-digits", title: "शर्मा फैब्रिकेशन", sub: "अंक भी देवनागरी में",
    body: `<div>१. खिड़की ४x५ दो पट्टी, जाली १</div>
<div>२. खिड़की ६x५ तीन पट्टी, जाली १</div>
<div>३. दरवाजा ३x७, २ पट्टी, चौखट बनानी है</div>`,
    truth: [
      { ...W({ width_raw: "4", height_raw: "5", tracks: "2", mix: "GJ" }), onSheet: ["tracks", "mix"] },
      { ...W({ width_raw: "6", height_raw: "5", tracks: "3", mix: "GGJ" }), onSheet: ["tracks", "mix"] },
      { ...D({ width_raw: "3", height_raw: "7", rails: 2, frame_needed: true }), onSheet: ["rails"] },
    ],
  },
  {
    id: "22-fractions", title: "Modern Aluminium", sub: "Half feet written as fractions",
    body: `<div>1. 4½ x 5 &mdash; 2trk jali 1</div>
<div>2. 3 1/2' x 4' &mdash; 2trk jali 1</div>
<div>3. 5'-6" x 4'-3" &mdash; 3trk jali 1</div>`,
    truth: [
      { ...W({ width_raw: "4.5", height_raw: "5", tracks: "2", mix: "GJ" }), onSheet: ["tracks", "mix"] },
      { ...W({ width_raw: "3.5", height_raw: "4", tracks: "2", mix: "GJ" }), onSheet: ["tracks", "mix"] },
      { ...W({ width_raw: "5'6\"", height_raw: "4'3\"", unit_guess: "ft-in-sut", tracks: "3", mix: "GGJ" }), onSheet: ["tracks", "mix"] },
    ],
  },
  {
    id: "23-height-first", title: "Pooja Glass", sub: "Labelled H and W, height written first",
    body: `<div>1. H 5' &nbsp; W 4' &mdash; 2trk jali 1</div>${box(4, 5, cols(["G", "J"]), "H 5'  W 4'")}
<div>2. height 4 / width 6 &mdash; 3trk jali 1</div>`,
    truth: [
      { ...W({ width_raw: "4", height_raw: "5", tracks: "2", mix: "GJ" }), onSheet: ["tracks", "mix"] },
      { ...W({ width_raw: "6", height_raw: "4", tracks: "3", mix: "GGJ" }), onSheet: ["tracks", "mix"] },
    ],
  },
  {
    id: "24-qty-words", title: "Hussain Fab", sub: "Quantity in words",
    body: `<div>1. teen khidki 4x4, 2trk jali 1</div>
<div>2. do darwaze 3x7, 2 patti, chokhat banana</div>
<div>3. char khidki bathroom 2x2, 2trk glass</div>`,
    truth: [
      { ...W({ width_raw: "4", height_raw: "4", qty: 3, tracks: "2", mix: "GJ" }), onSheet: ["tracks", "mix"] },
      { ...D({ width_raw: "3", height_raw: "7", qty: 2, rails: 2, frame_needed: true }), onSheet: ["rails"] },
      { ...W({ width_raw: "2", height_raw: "2", qty: 4, tracks: "2", mix: "GG" }), onSheet: ["tracks", "mix"] },
    ],
  },
  {
    id: "25-mesh-synonyms", title: "Green Home", sub: "Mesh called by other names",
    body: `<div>1. 4x5 2trk, 1 net</div>
<div>2. 5x5 3trk, machhardani 1</div>
<div>3. 4x4 2trk, mosquito wala 1</div>`,
    truth: [
      { ...W({ width_raw: "4", height_raw: "5", tracks: "2", mix: "GJ" }), onSheet: ["tracks", "mix"] },
      { ...W({ width_raw: "5", height_raw: "5", tracks: "3", mix: "GGJ" }), onSheet: ["tracks", "mix"] },
      { ...W({ width_raw: "4", height_raw: "4", tracks: "2", mix: "GJ" }), onSheet: ["tracks", "mix"] },
    ],
  },
  {
    id: "26-partition-sheet-band", title: "Corporate Interiors", sub: "Partition with solid sheet at the bottom",
    body: `<div>1. partition 10x8, neeche 3ft sheet upar glass, door nahi</div>${box(10, 8, [{ x: 0, y: 0, w: 1, h: 0.62, t: "glass" }, { x: 0, y: 0.62, w: 1, h: 0.38, t: "sheet 3'" }])}
<div>2. partition 8x8 full glass, door nahi</div>`,
    truth: [
      { ...P({ width_raw: "10", height_raw: "8", part_door: false, part_sheet_ft: 3 }), onSheet: ["partDoor"] },
      { ...P({ width_raw: "8", height_raw: "8", part_door: false, part_sheet_ft: 0 }), onSheet: ["partDoor"] },
    ],
  },
  {
    id: "27-table-format", title: "Ashok Aluminium — Quotation sheet", sub: "Typed-style table",
    body: `<table style="border-collapse:collapse;font-size:18px" border="1" cellpadding="6">
<tr><th>Sr</th><th>Location</th><th>W</th><th>H</th><th>Qty</th><th>Type</th></tr>
<tr><td>1</td><td>Bed</td><td>48"</td><td>60"</td><td>2</td><td>2 trk, 1 jali</td></tr>
<tr><td>2</td><td>Hall</td><td>72"</td><td>60"</td><td>1</td><td>3 trk, 1 jali</td></tr>
<tr><td>3</td><td>Main door</td><td>36"</td><td>84"</td><td>1</td><td>door 3 patti, frame new</td></tr></table>`,
    truth: [
      { ...W({ width_raw: "48", height_raw: "60", unit_guess: "inches", qty: 2, tracks: "2", mix: "GJ" }), onSheet: ["tracks", "mix"] },
      { ...W({ width_raw: "72", height_raw: "60", unit_guess: "inches", tracks: "3", mix: "GGJ" }), onSheet: ["tracks", "mix"] },
      { ...D({ width_raw: "36", height_raw: "84", unit_guess: "inches", rails: 3, frame_needed: true }), onSheet: ["rails"] },
    ],
  },
  {
    id: "28-z-combo-side-fix", title: "Bharat Z-Section", sub: "Fix on one side, rest opens",
    body: `<div>1. Z 6x4 &mdash; left side 2ft fix, baaki 2 sash khulne wale</div>${box(6, 4, [{ x: 0, y: 0, w: 0.33, h: 1, t: "fix 2'" }, { x: 0.33, y: 0, w: 0.335, h: 1, t: "open" }, { x: 0.665, y: 0, w: 0.335, h: 1, t: "open" }])}`,
    truth: [
      { ...W({ width_raw: "6", height_raw: "4", system: "Z section", z_axis: "cols", z_panels: "F2,O,O" }), onSheet: ["system", "zType"] },
    ],
  },
  {
    id: "29-overwritten-qty", title: "Raj Glass", sub: "Quantity changed on site",
    body: `<div>1. 4x5 2trk jali 1 &mdash; qty <s style="color:#888">2</s> <b>3</b></div>
<div>2. 3x4 2trk jali 1 &mdash; <s style="color:#888">x4</s> x2</div>`,
    truth: [
      { ...W({ width_raw: "4", height_raw: "5", qty: 3, tracks: "2", mix: "GJ" }), onSheet: ["tracks", "mix"] },
      { ...W({ width_raw: "3", height_raw: "4", qty: 2, tracks: "2", mix: "GJ" }), onSheet: ["tracks", "mix"] },
    ],
  },
  {
    id: "30-two-photos-one-job", title: "Site — page 2 of 2", sub: "Continued from page 1 (page 1 not attached)",
    body: `<div>(...continued)</div><div>7. 4x5 2trk jali 1</div><div>8. 6x5 3trk jali 1</div><div>9. darwaza 3x7 2 patti chokhat hai</div>`,
    truth: [
      { ...W({ width_raw: "4", height_raw: "5", tracks: "2", mix: "GJ" }), onSheet: ["tracks", "mix"] },
      { ...W({ width_raw: "6", height_raw: "5", tracks: "3", mix: "GGJ" }), onSheet: ["tracks", "mix"] },
      { ...D({ width_raw: "3", height_raw: "7", rails: 2, frame_needed: false }), onSheet: ["rails"] },
    ],
  },
];

export function pageHtml(c) {
  const noisy = c.noisy
    ? `filter:contrast(0.55) brightness(1.08) blur(0.6px);transform:rotate(-3.5deg);`
    : `transform:rotate(${(c.id.charCodeAt(1) % 5 - 2) * 0.3}deg);`;
  const stains = c.noisy
    ? `<div style="position:absolute;left:520px;top:60px;width:180px;height:180px;border-radius:50%;background:rgba(150,110,40,.18)"></div>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;padding:46px 56px;width:900px;position:relative;background:repeating-linear-gradient(#fbf9ee 0 36px,#d8e2ea 36px 37px);
font-family:'Segoe Print','Comic Sans MS',cursive,sans-serif;color:#1c2340;font-size:21px;line-height:36px;${noisy}}
.t{font-size:26px;font-weight:bold;text-decoration:underline}.s{font-size:15px;color:#333;line-height:20px;margin-bottom:10px}
</style></head><body>${stains}<div class="t">${c.title}</div><div class="s">${c.sub}</div>${c.body}</body></html>`;
}
