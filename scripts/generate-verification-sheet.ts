import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

console.log('Generating Enhanced Section Codes & Real Catalogue Verification Sheet...');

const bhShapes = {
  ...JSON.parse(fs.readFileSync(path.resolve('lib/studio/shapes/banuhashim.json'), 'utf8')),
  ...JSON.parse(fs.readFileSync(path.resolve('lib/studio/shapes/banuhashim-euro.json'), 'utf8')),
};

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
  {
    category: "1. EURO TRACK — BH-6001 (3-track) / BH-6000 (2-track)",
    code: "Banu Hashim BH-6001 · BH-6000",
    name: "Euro track — same track on all four sides",
    hindiName: "Euro track (charo taraf ek hi track)",
    dimensions: "BH-6001: 99.30 × 45.00 mm · BH-6000: 64.30 × 45.00 mm",
    weight: "BH-6001: 5.700 – 6.200 kg / 12' · BH-6000: 3.700 – 4.100 kg / 12'",
    catalogue: "Banu Hashim Ready, printed page 39 (Domal series 26 × 65)",
    shapeKey: "BH-6001",
    imageFile: "public/sections/bh_6001.png",
    condition: "Euro me charo taraf (upar, niche, dono side) yahi ek track lagti hai, 45° par. Niche wali track ke groove me clip BH-2559 lagti hai, aur roller us clip par chalta hai.",
    features: [
      "Catalogue table BH-6001 ki height 35.00 chhapti hai, lekin drawing par 45 likha hai. Trace 45 par 99.3% baithta hai, isliye 45 sahi hai.",
      "Wall (T): BH-6001 1.12 mm · BH-6000 1.06 mm",
    ],
  },
  {
    category: "2. EURO CLIP — BH-2559",
    code: "Banu Hashim BH-2559 (track rail)",
    name: "Euro roller clip",
    hindiName: "Euro clip (roller isi par chalta hai)",
    dimensions: "11.00 × 13.47 mm · T 0.90 mm",
    weight: "0.480 – 0.550 kg / 12'",
    catalogue: "Banu Hashim Ready, printed page 38",
    shapeKey: "BH-2559",
    imageFile: "public/sections/bh_2559.png",
    condition: "Sirf Euro me: niche ki track ke groove me dab kar lagti hai, har shutter ke neeche ek. Roller (24 mm) is par chalta hai.",
    features: ["Gulf ki niche wali track roller khud uthati hai — wahan ye clip nahi lagti."],
  },
  {
    category: "3. EURO SHUTTER — BH-6003",
    code: "Banu Hashim BH-6003 (SGU shutter)",
    name: "Euro shutter 65 × 26",
    hindiName: "Euro shutter (Domal jaisa banta hai)",
    dimensions: "65.00 × 26.00 mm · T 1.08 mm",
    weight: "2.600 – 2.800 kg / 12'",
    catalogue: "Banu Hashim Ready, printed page 39",
    shapeKey: "BH-6003",
    condition: "Shutter Domal jaisa banta hai: upar, niche aur handle side par ye section. Meeting side par slim interlock lagta hai.",
    features: ["Same page ka BH-6050 / 6051 (66 × 26) Domal shutter hai, jiske upar Domal clip BH-6054 lagti hai."],
  },
  {
    category: "4. EURO SLIM INTERLOCK — chhota BH-6052 / bada BH-6053",
    code: "Banu Hashim BH-6052 · BH-6053",
    name: "Euro slim interlock — small and big",
    hindiName: "Slim interlock chhota / bada",
    dimensions: "BH-6052: 32.60 × 23.70 mm · BH-6053: 62.60 × 23.70 mm",
    weight: "BH-6052: 1.600 – 1.800 kg / 12' · BH-6053: 2.500 – 2.700 kg / 12'",
    catalogue: "Banu Hashim Ready, printed page 40",
    shapeKey: "BH-6052",
    condition: "Domal me pehle shutter ke upar clip lagti thi; Euro me us jagah slim interlock hi lagta hai. Kabhi dono shutter par chhota, kabhi ek par chhota aur ek par bada.",
    features: ["BH-6053: table 61.73 chhapta hai, drawing 62.60 — drawing ka naap liya hai."],
  },
  {
    category: "5. GULF 25 TRACK — upar + side BH-2550 / 2552, niche BH-2551 / 2553",
    code: "Banu Hashim BH-2550 · 2551 · 2552 · 2553",
    name: "Gulf slim 25 mm tracks",
    hindiName: "Gulf: niche alag track, baaki teeno side alag",
    dimensions: "2550: 75.70 × 24.80 · 2551: 71.80 × 29.80 · 2552: 112.50 × 24.80 · 2553: 108.60 × 29.80 mm",
    weight: "2550: 2.8 – 3.0 · 2551: 3.5 – 3.8 · 2552: 4.0 – 4.2 · 2553: 5.0 – 5.2 kg / 12'",
    catalogue: "Banu Hashim Ready, printed pages 35 – 36",
    shapeKey: "BH-2551",
    condition: "Gulf me sirf track badalti hai: niche ki track alag (2-track 2551, 3-track 2553), upar aur dono side ek hi track (2-track 2550, 3-track 2552). Joint 90°.",
    features: ["Shutter: upar/niche BH-2554, shutter BH-2555. Top track guide BH-2558."],
  },
  {
    category: "6. GULF 25 SLIM INTERLOCK — chhota BH-2556 / bada BH-2557",
    code: "Banu Hashim BH-2556 · BH-2557",
    name: "Gulf 25 slim interlock — small and big",
    hindiName: "Slim interlock chhota / bada",
    dimensions: "BH-2556: 35.80 × 20.30 mm · BH-2557: 80.00 × 20.20 mm",
    weight: "BH-2556: 1.800 – 2.000 kg / 12' · BH-2557: 3.400 – 3.700 kg / 12'",
    catalogue: "Banu Hashim Ready, printed page 37",
    shapeKey: "BH-2556",
    condition: "Euro jaisa hi: meeting side par har shutter ka apna slim interlock — chhota ya bada.",
    features: [],
  },
  {
    category: "7. GULF 35 TRACK — BH-6500 / 6502 aur BH-6501 / 6503",
    code: "Banu Hashim BH-6500 · 6501 · 6502 · 6503",
    name: "Gulf 35 mm tracks",
    hindiName: "Gulf 35: niche alag track, baaki teeno side alag",
    dimensions: "6500: 100.00 × 32.80 · 6501: 95.00 × 31.20 · 6502: 150.00 × 32.80 · 6503: 145.60 × 31.20 mm",
    weight: "6500: 3.4 – 3.7 · 6501: 5.1 – 5.5 · 6502: 4.7 – 5.1 · 6503: 7.35 – 7.8 kg / 12'",
    catalogue: "Banu Hashim Ready, printed pages 61 – 62",
    shapeKey: "BH-6500",
    imageFile: "public/sections/bh_6500.png",
    condition: "Upar aur dono side BH-6500 (3-track 6502); niche BH-6501 (3-track 6503). Joint 90°.",
    features: ["Catalogue BH-6501 ko \"2 track top and bottom\" kehta hai. Agar aapki dukaan upar bhi 6501 lagati hai, to app me Top piece badal dijiye."],
  },
  {
    category: "8. GULF 35 SLIM INTERLOCK — chhota BH-6506 / bada BH-6508",
    code: "Banu Hashim BH-6506 · 6508 (double glass: 6507 · 6509)",
    name: "Gulf 35 slim interlock — small and big",
    hindiName: "Slim interlock chhota / bada",
    dimensions: "BH-6506 / 6507: 47.20 × 27.50 mm · BH-6508 / 6509: 96.00 × 27.00 mm",
    weight: "6506: 2.8 – 3.1 · 6507: 2.5 – 2.7 · 6508: 5.0 – 5.5 · 6509: 4.8 – 5.2 kg / 12'",
    catalogue: "Banu Hashim Ready, printed pages 63 – 64",
    shapeKey: "BH-6506",
    condition: "Meeting side par har shutter ka apna slim interlock — chhota ya bada. Bada (reinforcement) alag se extra piece nahi hai; chhote ki jagah lagta hai.",
    features: ["31 mm series me bhi yahi: chhota BH-6408, bada BH-6409 (double glass 6410 / 6411)."],
  },
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
      <h1 class="title">Banu Hashim — Euro and Gulf Section Codes</h1>
      <div class="sub">Codes, sizes and weights exactly as printed in the Banu Hashim Ready catalogue. Drawings traced from the same pages.</div>
    </div>
    <div class="meta">
      <div><b>Corrected:</b> Euro track BH-6001, Euro clip BH-2559 (founder)</div>
      <div><b>Catalogue Source:</b> BANUHASHIM READY.pdf</div>
      <div><b>Sections:</b> 8 groups</div>
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
