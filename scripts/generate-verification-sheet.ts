import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

console.log('Generating Enhanced Section Codes & Real Catalogue Verification Sheet...');

const bhShapes = JSON.parse(fs.readFileSync(path.resolve('lib/studio/shapes/banuhashim.json'), 'utf8'));

function getBase64Image(relPath: string): string {
  const fullPath = path.resolve(relPath);
  if (fs.existsSync(fullPath)) {
    const data = fs.readFileSync(fullPath);
    return `data:image/png;base64,${data.toString('base64')}`;
  }
  return '';
}

function renderSvg(shape: { w: number; h: number; paths: string[]; code?: string }): string {
  const { w, h, paths, code } = shape;
  const pad = Math.max(w, h) * 0.15;
  const fs = Math.max(w, h) / 7.5;
  const lw = Math.max(0.7, Math.max(w, h) / 95);

  return `
    <svg viewBox="${-pad * 0.5} ${-pad * 0.5} ${w + pad * 2} ${h + pad * 2.2}" class="cad-svg" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g_${code || 'x'}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="45%" stop-color="#cbd5e1" />
          <stop offset="100%" stop-color="#94a3b8" />
        </linearGradient>
      </defs>
      <rect x="${-pad * 0.5}" y="${-pad * 0.5}" width="${w + pad * 2}" height="${h + pad * 2.2}" fill="#f8fafc" rx="4" />
      <path d="${paths.join('')}" fill="url(#g_${code || 'x'})" stroke="#0f172a" stroke-width="${lw}" fill-rule="evenodd" stroke-linejoin="round" />
      <g stroke="#2563eb" stroke-width="${lw * 0.85}" fill="#2563eb" font-size="${fs}" font-family="Segoe UI, sans-serif" font-weight="700">
        <line x1="0" y1="${h + pad * 0.4}" x2="${w}" y2="${h + pad * 0.4}" />
        <line x1="0" y1="${h + pad * 0.2}" x2="0" y2="${h + pad * 0.6}" />
        <line x1="${w}" y1="${h + pad * 0.2}" x2="${w}" y2="${h + pad * 0.6}" />
        <text x="${w / 2}" y="${h + pad * 0.4 + fs * 1.1}" text-anchor="middle" stroke="none">${w} mm</text>
        <line x1="${w + pad * 0.4}" y1="0" x2="${w + pad * 0.4}" y2="${h}" />
        <line x1="${w + pad * 0.2}" y1="0" x2="${w + pad * 0.6}" y2="0" />
        <line x1="${w + pad * 0.2}" y1="${h}" x2="${w + pad * 0.6}" y2="${h}" />
        <text transform="translate(${w + pad * 0.4 + fs * 1.1} ${h / 2}) rotate(90)" text-anchor="middle" stroke="none">${h} mm</text>
      </g>
    </svg>
  `;
}

interface VerificationItem {
  category: string;
  code: string;
  name: string;
  hindiName: string;
  dimensions: string;
  weight: string;
  catalogue: string;
  condition: string;
  shapeKey?: string;
  imageFile?: string;
  features: string[];
}

const ITEMS: VerificationItem[] = [
  // 1. Euro Track 29mm / Domal Track
  {
    category: "1. EURO TRACK (BH-6001 & BH-6000 / BH-6400)",
    code: "Die BH-6001 (3-Track) & BH-6000 (2-Track) / BH-6400 (Euro 31mm)",
    name: "Euro Track 3-Track Outer Frame with Leg (Banu Hashim Domal/Euro)",
    hindiName: "Euro Track Chaukhat (3-Track & 2-Track Outer Frame)",
    dimensions: "BH-6001: 99.30 × 35.00 mm (BH-6000: 64.30 × 45.00 mm | BH-6400: 85.00 × 33.10 mm)",
    weight: "BH-6001: 5.700 – 6.200 kg / 12' | BH-6000: 3.700 – 4.100 kg / 12'",
    catalogue: "Banu Hashim Ready Catalogue Page 42 (Printed 39) & Page 56",
    shapeKey: "BH-6001",
    imageFile: "public/sections/bh_6001.png",
    condition: "Euro track sliding window ke charo taraf outer frame (top head, bottom sill aur vertical sides) par lagta hai. BH-6001 me 3 track legs aur 3 separate sliding channels hote hain. Iske runner channel par snap clip (BH-2559) fit hoti hai jispar palla smooth slide karta hai.",
    features: [
      "Banu Hashim verified Die BH-6001: 99.30mm width, 35.00mm height, 1.12mm wall gauge",
      "Sibling 2-Track Die BH-6000: 64.30mm width, 45.00mm height, 1.06mm wall gauge",
      "Carries 3 glass shutters (GGG) or 2 glass + 1 mosquito wire mesh shutter (GGJ)"
    ]
  },

  // 2. Slim Interlock Single Glass
  {
    category: "2. SLIM INTERLOCK (SINGLE GLASS)",
    code: "Die BH-6408 (Banu Hashim) / Ample 41289 (Sleek 40) / 992328 (Sleek 37)",
    name: "Slim Interlock Stile for Single Glass (SGU 5mm - 8mm)",
    hindiName: "Slim Interlock Chhota Wala (Single Glass)",
    dimensions: "38.10 × 20.20 mm (Visible sightline: 20.20 mm!)",
    weight: "2.500 kg per 12ft bar (Gauge: 1.25 mm)",
    catalogue: "Banu Hashim Ready Catalogue Page 61 (Printed 58)",
    shapeKey: "BH-6408",
    imageFile: "public/sections/bh_6408.png",
    condition: "Single Glass (5mm, 6mm, 8mm Toughened Glass) wale palla ke center meeting stile me lagta hai. Bahar se room me sirf 20mm ki ultra-patli patti dikhti hai. Dono palla band hone par hooks aapas me airtight interlocking banate hain.",
    features: [
      "Ultra-minimalist 20.2mm visible profile face for 90%+ clear panoramic glass view",
      "Single glass rebate with EPDM U-rubber / wedge gasket locking pocket",
      "Double wool-pile mohair groove for 100% dust, acoustic, and wind barrier"
    ]
  },

  // 3. Slim Interlock Double Glass
  {
    category: "3. SLIM INTERLOCK (DOUBLE GLASS DGU)",
    code: "Die BH-6410 (Banu Hashim 31mm DGU) / Die BH-6507 (Gulf 35mm DGU)",
    name: "Slim Interlock Stile for Double Glass (DGU 20mm / 24mm)",
    hindiName: "Slim Interlock Chhota Wala (Double Glass DGU)",
    dimensions: "38.10 × 24.00 mm (BH-6410) / 47.20 × 27.50 mm (BH-6507)",
    weight: "2.100 kg per 12ft bar (BH-6410) / 2.600 kg per 12ft bar (BH-6507)",
    catalogue: "Banu Hashim Ready Catalogue Page 62 (Printed 59)",
    shapeKey: "BH-6410",
    imageFile: "public/sections/bh_6410.png",
    condition: "DGU Double Glazed Unit (20mm ya 24mm soundproof/acoustic double glass) wale palla me center meeting stile par lagta hai. Isme wider 24mm glass pocket hota hai jisme outer glass, warm spacer bar aur inner glass rubber seal ke saath baithte hain.",
    features: [
      "Deep 24.0mm pocket for 20mm/24mm insulated double glass units (DGU)",
      "High thermal insulation & acoustic rating (up to 35 dB noise reduction)",
      "Retains ultra-slim sightline while accommodating heavy double glazing"
    ]
  },

  // 4. Slim Interlock Bada Vala Single Glass
  {
    category: "4. SLIM INTERLOCK BADA VALA (SINGLE GLASS)",
    code: "Die BH-6409 (Banu Hashim 31mm) / Die BH-6508 (Gulf 35mm) / Ample 914806",
    name: "Heavy Structural Reinforcement Spine for Single Glass",
    hindiName: "Slim Interlock Bada Wala (Single Glass Heavy Wind Spine)",
    dimensions: "80.10 × 20.20 mm (BH-6409) / 96.00 × 27.00 mm (BH-6508)",
    weight: "4.500 kg per 12ft bar (Gauge: 1.50 mm)",
    catalogue: "Banu Hashim Ready Catalogue Page 62 (Printed 59) & Page 64",
    shapeKey: "BH-6409",
    imageFile: "public/sections/bh_6409.png",
    condition: "Single glass wale palla me interlock ke piche screw se attach hota hai. Jab window 7ft se 10ft unchi ho ya high-rise building (10th floor+) me ho, to yeh 80.1mm ki massive aluminium fin palla ko hawa ke dabav se lachakne (bend) se 100% rok leti hai.",
    features: [
      "Massive 80.1mm deep aerodynamic structural fin (Moment of Inertia Ixx > 18 cm4)",
      "Direct dovetail screw mounting on BH-6408 slim interlock",
      "Tested for high wind pressures and coastal cyclonic gusts without vibration"
    ]
  },

  // 5. Slim Interlock Bada Vala Double Glass
  {
    category: "5. SLIM INTERLOCK BADA VALA (DOUBLE GLASS DGU)",
    code: "Die BH-6411 (Banu Hashim 31mm DGU) / Die BH-6509 (Gulf 35mm DGU)",
    name: "Heavy Structural Reinforcement Spine for Double Glass (DGU)",
    hindiName: "Slim Interlock Bada Wala (Double Glass DGU Heavy Wind Spine)",
    dimensions: "80.10 × 24.00 mm (BH-6411) / 96.00 × 27.00 mm (BH-6509)",
    weight: "4.200 kg per 12ft bar (BH-6411) / 5.250 kg per 12ft bar (BH-6509)",
    catalogue: "Banu Hashim Ready Catalogue Page 62 (Printed 59)",
    shapeKey: "BH-6411",
    imageFile: "public/sections/bh_6411.png",
    condition: "Heavy DGU Double Glass wale oversized balcony shutters (8ft to 11ft height) ke meeting stiles par lagta hai. Double glass ke 100kg+ bhari vajan aur high-altitude wind suction dono ko withstand karta hai.",
    features: [
      "Heavy 80.1mm depth with 24mm wide DGU glass rebate integration",
      "Heavy 1.70mm wall thickness for industrial structural rigidity",
      "Zero deflection under 1500 Pascal cyclonic wind tunnel pressure"
    ]
  },

  // 6. Euro Track Ki Clip / Track Rail
  {
    category: "6. EURO TRACK KI CLIP / TRACK RAIL (BH-2559)",
    code: "Die BH-2559 (Banu Hashim) / Die BH-6513 (SS Patri) / Die BH-6512",
    name: "Euro Track Rail Snap Clip / Track Runner (Banu Hashim)",
    hindiName: "Euro Track Ki Clip / Runner Rail Patri Clip",
    dimensions: "11.00 × 13.47 mm (BH-2559) | Thickness: 0.90 mm",
    weight: "0.480 – 0.550 kg per 12ft bar (Die BH-2559)",
    catalogue: "Banu Hashim Ready Catalogue Page 41 (Printed 38)",
    shapeKey: "BH-2559",
    imageFile: "public/sections/bh_2559.png",
    condition: "Euro track ke runner fin channel par press karke 'tak' se snap fit hoti hai. Iske rounded runner top par shutter ke roller wheels daudte hain. Is clip ki wajah se main outer frame ka track kabhi ghisata nahi hai aur palla smooth chalta hai.",
    features: [
      "Banu Hashim verified Die BH-2559: 11.00mm width, 13.47mm height, 0.90mm gauge",
      "Snap-fit dovetail locking teeth that grip the track fin securely without screws",
      "Prevents aluminium-on-aluminium friction and roller wheel grinding"
    ]
  },

  // 7. Gulf Series Niche Ki Track
  {
    category: "7. GULF SERIES NICHE KI TRACK",
    code: "Die BH-6501 (2-Track Bottom Sill) / Die BH-6503 (3-Track Bottom Sill)",
    name: "Gulf 35mm Bottom Sill Track (Horizontal Floor Sill)",
    hindiName: "Gulf 35 Niche Ka Bottom Track (Floor Sill)",
    dimensions: "95.00 × 31.20 mm (BH-6501 2T) / 145.60 × 31.20 mm (BH-6503 3T)",
    weight: "5.300 kg / 12' (BH-6501 2T) / 7.600 kg / 12' (BH-6503 3T)",
    catalogue: "Banu Hashim Ready Catalogue Page 64 (Printed 61) & Page 65",
    shapeKey: "BH-6501",
    imageFile: "public/sections/bh_6501.png",
    condition: "Gulf series me window ke niche floor/sill par horizontally lagta hai. Isme internal water drainage slope channels, weeping slots aur stainless steel round runner rail (BH-6513 SS patri) fit hoti hai jahan heavy rollers smooth slide karte hain.",
    features: [
      "Heavy 1.40mm bottom slab carrying massive glass weight (5.30 kg/12ft)",
      "Internal water drainage slope channels preventing rain water back-flow into the room",
      "Houses stainless steel cylindrical track patri (BH-6513) for zero aluminium track wear"
    ]
  },

  // 8. Gulf Series Sido Ki Track
  {
    category: "8. GULF SERIES SIDO KI TRACK",
    code: "Die BH-6500 (2-Track Vertical Jamb) / Die BH-6502 (3-Track Vertical Jamb)",
    name: "Gulf 35mm Vertical Side Jamb (Wall Frame)",
    hindiName: "Gulf 35 Sido Ka Khada Track (Vertical Jamb)",
    dimensions: "100.00 × 32.80 mm (BH-6500 2T) / 150.00 × 32.80 mm (BH-6502 3T)",
    weight: "3.550 kg / 12' (BH-6500 2T) / 4.900 kg / 12' (BH-6502 3T)",
    catalogue: "Banu Hashim Ready Catalogue Page 64 (Printed 61) & Page 65",
    shapeKey: "BH-6500",
    imageFile: "public/sections/bh_6500.png",
    condition: "Deewar ke dono vertical khade sides (left aur right jambs) par 90° lagta hai. Gulf system me vertical khada jamb aur niche ka bottom track alag section hote hain — vertical jamb bottom sill par 90° butt joint se baith kar heavy stainless steel screws se tight hota hai.",
    features: [
      "Deep 100.0mm frame depth accommodating heavy 35mm sliding shutters",
      "90° butt screw-port bosses engineered for high-strength mechanical assembly",
      "Integrated interlock locking pocket and wall anchor grooves"
    ]
  }
];

const htmlContent = `<!DOCTYPE html>
<html lang="hi">
<head>
  <meta charset="UTF-8">
  <title>Section Codes & Image Verification Sheet — Banu Hashim Euro & Gulf Systems</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 10mm 12mm 10mm;
      @bottom-right {
        content: counter(page);
        font-size: 9pt;
        color: #64748b;
      }
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 11px;
      line-height: 1.45;
    }
    .header {
      border-bottom: 2.5px solid #0f172a;
      padding-bottom: 10px;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .badge {
      background: #2563eb;
      color: #ffffff;
      font-size: 9px;
      font-weight: 800;
      padding: 3px 8px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: inline-block;
      margin-bottom: 4px;
    }
    .title {
      font-size: 20px;
      font-weight: 900;
      color: #0f172a;
      margin: 0;
      line-height: 1.1;
    }
    .sub {
      font-size: 11.5px;
      color: #475569;
      font-weight: 600;
      margin-top: 3px;
    }
    .meta {
      font-size: 9.5px;
      color: #64748b;
      text-align: right;
    }

    .item-card {
      border: 1.5px solid #cbd5e1;
      border-radius: 8px;
      margin-bottom: 12px;
      background: #ffffff;
      overflow: hidden;
      break-inside: avoid;
    }
    .item-header {
      background: #0f172a;
      color: #ffffff;
      padding: 6px 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .item-cat {
      font-size: 11px;
      font-weight: 900;
      color: #60a5fa;
      letter-spacing: 0.5px;
    }
    .item-die-badge {
      background: #2563eb;
      color: #ffffff;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 10.5px;
      font-weight: 800;
      font-family: monospace;
    }

    .item-body {
      display: flex;
      padding: 10px;
      gap: 12px;
    }
    .visual-duo {
      display: flex;
      gap: 8px;
      min-width: 250px;
      width: 250px;
    }
    .item-visual {
      flex: 1;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 6px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #f8fafc;
    }
    .cat-img {
      width: 100%;
      height: 95px;
      object-fit: contain;
      background: #ffffff;
      border-radius: 4px;
    }
    .cad-svg {
      width: 100%;
      height: 95px;
    }
    .dim-tag {
      margin-top: 4px;
      font-size: 9px;
      font-weight: 800;
      color: #1e293b;
      background: #e2e8f0;
      padding: 2px 6px;
      border-radius: 3px;
      text-align: center;
      width: 100%;
    }

    .item-details {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .item-title-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 4px;
    }
    .item-name {
      font-size: 13px;
      font-weight: 800;
      color: #0f172a;
    }
    .item-hindi {
      font-size: 11.5px;
      font-weight: 700;
      color: #0284c7;
    }

    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin: 2px 0;
      font-size: 10px;
    }
    .info-table td {
      padding: 2px 4px;
      vertical-align: top;
    }
    .info-lbl {
      color: #64748b;
      font-weight: 700;
      width: 80px;
    }
    .info-val {
      color: #0f172a;
      font-weight: 600;
    }
    .info-val.mono {
      font-family: monospace;
      font-weight: 700;
      color: #1d4ed8;
    }

    .condition-box {
      background: #eff6ff;
      border-left: 3px solid #2563eb;
      padding: 6px 8px;
      border-radius: 0 4px 4px 0;
      margin-top: 2px;
    }
    .cond-title {
      font-size: 10px;
      font-weight: 800;
      color: #1e40af;
      margin-bottom: 2px;
    }
    .cond-text {
      font-size: 10.5px;
      color: #1e293b;
      line-height: 1.35;
    }

    .features-list {
      margin: 3px 0 0 16px;
      padding: 0;
      color: #334155;
      font-size: 9.5px;
    }
    .features-list li {
      margin-bottom: 1px;
    }
  </style>
</head>
<body>

  <div class="header">
    <div>
      <div class="badge">FabriQ Fabrication Verification Document</div>
      <h1 class="title">Banu Hashim Die Numbers & Authentic Catalogue Verification</h1>
      <div class="sub">Verified against Official Banu Hashim Ready Catalogue with Real Cropped Drawings & CAD Die Vectors</div>
    </div>
    <div class="meta">
      <div><b>Target AI:</b> Claude Code & Codex</div>
      <div><b>Catalogue Source:</b> BANUHASHIM READY.pdf</div>
      <div><b>Total Sections:</b> 8 Categories (Verified)</div>
      <div><b>Timestamp:</b> ${new Date().toLocaleDateString('en-GB')}</div>
    </div>
  </div>

  ${ITEMS.map((item) => {
    const shape = item.shapeKey ? bhShapes[item.shapeKey] : null;
    const base64Img = item.imageFile ? getBase64Image(item.imageFile) : '';

    return `
      <div class="item-card">
        <div class="item-header">
          <div class="item-cat">${item.category}</div>
          <div class="item-die-badge">${item.code}</div>
        </div>
        <div class="item-body">
          <div class="visual-duo">
            ${base64Img ? `
              <div class="item-visual">
                <img src="${base64Img}" class="cat-img" alt="${item.code}" />
                <div class="dim-tag">Catalogue Scan</div>
              </div>
            ` : ''}
            ${shape ? `
              <div class="item-visual">
                ${renderSvg(shape)}
                <div class="dim-tag">CAD ${shape.w}×${shape.h}mm</div>
              </div>
            ` : ''}
          </div>
          <div class="item-details">
            <div class="item-title-row">
              <span class="item-name">${item.name}</span>
              <span class="item-hindi">(${item.hindiName})</span>
            </div>

            <table class="info-table">
              <tr>
                <td class="info-lbl">Exact Size:</td>
                <td class="info-val mono">${item.dimensions}</td>
                <td class="info-lbl">Weight / 12':</td>
                <td class="info-val mono">${item.weight}</td>
              </tr>
              <tr>
                <td class="info-lbl">Catalogue:</td>
                <td class="info-val" colspan="3">${item.catalogue}</td>
              </tr>
            </table>

            <div class="condition-box">
              <div class="cond-title">FABRICATION CONDITION (Kahan aur Kyon Lagta Hai):</div>
              <div class="cond-text">${item.condition}</div>
            </div>

            <ul class="features-list">
              ${item.features.map(f => `<li>${f}</li>`).join('')}
            </ul>
          </div>
        </div>
      </div>
    `;
  }).join('')}

</body>
</html>`;

const outHtml = path.resolve('docs/section-codes-verification.html');
const outPdf = path.resolve('docs/SECTION_CODES_VERIFICATION_SHEET.pdf');

fs.writeFileSync(outHtml, htmlContent, 'utf8');
console.log('Written HTML to:', outHtml);

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
if (fs.existsSync(chromePath)) {
  console.log('Rendering PDF with Chrome headless...');
  const cmd = `"${chromePath}" --headless --disable-gpu --run-all-compositor-stages-before-draw --print-to-pdf="${outPdf}" --no-pdf-header-footer "file://${outHtml.replace(/\\/g, '/')}"`;
  execSync(cmd, { stdio: 'inherit' });
  console.log('Generated PDF at:', outPdf);
} else {
  console.log('Chrome not found at standard path, skipped PDF');
}
