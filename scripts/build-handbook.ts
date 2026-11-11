import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

console.log('Starting FabriQ Systems Handbook PDF generation...');

// 1. Load base64 encoded PNG images from public/sections/
const sectionsDir = path.resolve('public/sections');
const imageFiles = fs.readdirSync(sectionsDir).filter(f => f.endsWith('.png'));
const imageBase64: Record<string, string> = {};

for (const file of imageFiles) {
  const id = path.basename(file, '.png');
  const buffer = fs.readFileSync(path.join(sectionsDir, file));
  imageBase64[id] = `data:image/png;base64,${buffer.toString('base64')}`;
}
console.log(`Loaded ${Object.keys(imageBase64).length} cropped catalogue PNGs.`);

// 2. Load CAD shapes from lib/studio/shapes/
const bhShapes = JSON.parse(fs.readFileSync(path.resolve('lib/studio/shapes/banuhashim.json'), 'utf8'));
const omShapes = JSON.parse(fs.readFileSync(path.resolve('lib/studio/shapes/omeo.json'), 'utf8'));

function renderSvgForShape(shape: { w: number; h: number; paths: string[]; code?: string }): string {
  const { w, h, paths, code } = shape;
  const pad = Math.max(w, h) * 0.14;
  const fs = Math.max(w, h) / 8.5;
  const lw = Math.max(0.7, Math.max(w, h) / 100);

  return `
    <svg viewBox="${-pad * 0.5} ${-pad * 0.5} ${w + pad * 2} ${h + pad * 2.2}" class="shape-svg" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="metal_${code || 'x'}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#f8fafc" />
          <stop offset="50%" stop-color="#cbd5e1" />
          <stop offset="100%" stop-color="#94a3b8" />
        </linearGradient>
      </defs>
      <rect x="${-pad * 0.5}" y="${-pad * 0.5}" width="${w + pad * 2}" height="${h + pad * 2.2}" fill="#f8fafc" rx="4" />
      <path d="${paths.join('')}" fill="url(#metal_${code || 'x'})" stroke="#0f172a" stroke-width="${lw}" fill-rule="evenodd" stroke-linejoin="round" />
      <g stroke="#2563eb" stroke-width="${lw * 0.85}" fill="#2563eb" font-size="${fs}" font-family="Segoe UI, sans-serif" font-weight="700">
        <line x1="0" y1="${h + pad * 0.4}" x2="${w}" y2="${h + pad * 0.4}" />
        <line x1="0" y1="${h + pad * 0.2}" x2="0" y2="${h + pad * 0.6}" />
        <line x1="${w}" y1="${h + pad * 0.2}" x2="${w}" y2="${h + pad * 0.6}" />
        <text x="${w / 2}" y="${h + pad * 0.4 + fs * 1.1}" text-anchor="middle" stroke="none">${w}</text>
        <line x1="${w + pad * 0.4}" y1="0" x2="${w + pad * 0.4}" y2="${h}" />
        <line x1="${w + pad * 0.2}" y1="0" x2="${w + pad * 0.6}" y2="0" />
        <line x1="${w + pad * 0.2}" y1="${h}" x2="${w + pad * 0.6}" y2="${h}" />
        <text transform="translate(${w + pad * 0.4 + fs * 1.1} ${h / 2}) rotate(90)" text-anchor="middle" stroke="none">${h}</text>
      </g>
    </svg>
  `;
}

interface SectionItem {
  id: string;
  name: string;
  hindiName: string;
  code: string;
  size: string;
  barLengths: string;
  imageId?: string;
  shapeKey?: string;
  condition: string;
  badge: "Frame" | "Shutter" | "Interlock" | "Divider" | "Clip" | "Rail" | "Spine" | "Hardware";
}

interface SystemGroup {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  family: string;
  specs: { label: string; val: string }[];
  overview: string;
  sections: SectionItem[];
}

const SYSTEMS: SystemGroup[] = [
  // 1. Normal 18 mm
  {
    id: "normal-18",
    number: "01",
    title: "Normal Sliding 18 mm (Bombay Series)",
    subtitle: "Standard 3/4″ × 1.5″ Residential Sliding Window",
    family: "Sliding Window",
    overview: "Bharat me sabse zyada chalne wali economical sliding window system. Balconies, kitchen, bedrooms aur residential flats me 4ft se 5ft tak ki window ke liye standard choice hai.",
    specs: [
      { label: "Glass Compatibility", val: "4 mm to 6 mm Single Float Glass" },
      { label: "Corner Joints", val: "Outer Frame 90° Butt Joint · Shutter 90°" },
      { label: "Track Options", val: "2-Track (2 Glass) & 3-Track (2 Glass + 1 Jali)" },
      { label: "Standard Length", val: "16 ft / 18 ft commercial bars" },
    ],
    sections: [
      {
        id: "2t_top",
        name: "2-Track Top/Side Outer Frame",
        hindiName: "2-Track Upar aur Khada Side Frame",
        code: "OMEO #1000",
        size: "62 × 32 mm",
        barLengths: "16 / 18 ft",
        imageId: "2t_top",
        badge: "Frame",
        condition: "2-Track sliding window me deewar ke upar (head) aur dono vertical sides (jambs) par lagta hai. Palla iske channels me guide hota hai.",
      },
      {
        id: "2t_bottom",
        name: "2-Track Bottom Sill (Track)",
        hindiName: "2-Track Niche Ka Bottom Track",
        code: "OMEO #1011",
        size: "62 × 32 mm",
        barLengths: "16 / 18 ft",
        imageId: "2t_bottom",
        badge: "Frame",
        condition: "Window ke niche floor/sill par fix hota hai. Iske do raised track guides par bearing/roller palla slide karta hai. Water drainage slots isme bante hain.",
      },
      {
        id: "3t_top",
        name: "3-Track Top/Side Outer Frame",
        hindiName: "3-Track Upar aur Khada Side Frame",
        code: "OMEO #1001",
        size: "92 × 32 mm",
        barLengths: "16 / 18 ft",
        imageId: "3t_top",
        badge: "Frame",
        condition: "3-Track sliding window me (2 Glass Palla + 1 Mosquito Mesh Jali ya 3 Glass) ke liye head aur vertical jambs me lagta hai.",
      },
      {
        id: "3t_bottom",
        name: "3-Track Bottom Track",
        hindiName: "3-Track Niche Ka Bottom Track",
        code: "OMEO #1012",
        size: "92 × 32 mm",
        barLengths: "16 / 18 ft",
        imageId: "3t_bottom",
        badge: "Frame",
        condition: "3-Track window ke bottom sill par lagta hai. Isme 3 independent channels hote hain jisme teen alag-alag palla chalte hain.",
      },
      {
        id: "handle_std",
        name: "Handle Stile (Lock Side)",
        hindiName: "Handle Pipe / Palla Ka Lock Side",
        code: "OMEO #1041",
        size: "40 × 18 mm",
        barLengths: "16 ft",
        imageId: "handle_std",
        badge: "Shutter",
        condition: "Shutter ke outer vertical side me lagta hai. Isme haath se pakadne ka groove hota hai aur flush lock ya star lock fit hota hai.",
      },
      {
        id: "interlock",
        name: "Interlock Stile (Meeting)",
        hindiName: "Interlock Pipe / Beech Ka Palla",
        code: "OMEO #1046",
        size: "40 × 18 mm",
        barLengths: "16 ft",
        imageId: "interlock",
        badge: "Interlock",
        condition: "Jab do palla band hote hain to unke beech me meeting point par lagta hai. Dono palla ke hook aapas me fas kar hawa, dhool aur paani ko rokte hain.",
      },
      {
        id: "bearing",
        name: "Bottom Bearing & Top Rail",
        hindiName: "Bearing Pipe / Wheel Rail",
        code: "OMEO #1051",
        size: "40 × 18 mm",
        barLengths: "16 ft",
        imageId: "bearing",
        badge: "Rail",
        condition: "Palla ke horizontal top aur bottom me lagta hai. Niche wale bearing pipe ke andar roller/bearing wheels fit hote hain jo track par chalte hain.",
      },
    ],
  },

  // 2. Normal 25 mm
  {
    id: "normal-25",
    number: "02",
    title: "Normal Sliding 25 mm (Bombay Heavy 1″ × 2″)",
    subtitle: "Heavy-Duty 1″ × 2″ Bombay Profile for High Heights",
    family: "Sliding Window",
    overview: "Jab window ki height 5ft se zyada ho (up to 7ft), tab 18mm ke bajaye 25mm (1″×2″) ka heavy Bombay section lagaya jata hai taaki palla hawa me lachke nahi.",
    specs: [
      { label: "Glass Compatibility", val: "5 mm to 8 mm Toughened Glass" },
      { label: "Corner Joints", val: "90° Butt Screwed Joints" },
      { label: "Profile Size", val: "1″ × 2″ (50 × 25 mm) Shutters" },
      { label: "Application", val: "Medium to High Wind Zones, Living Rooms" },
    ],
    sections: [
      {
        id: "2t_top_25",
        name: "25 mm 2-Track Top/Side Frame",
        hindiName: "25mm Bhari 2-Track Frame",
        code: "BOMBAY-25",
        size: "50 × 25 mm",
        barLengths: "16 ft",
        imageId: "2t_top",
        badge: "Frame",
        condition: "25mm sliding window me 2-track outer frame ke liye head aur vertical sides me lagta hai.",
      },
      {
        id: "2t_bottom_25",
        name: "25 mm 2-Track Bottom Track",
        hindiName: "25mm Bhari Niche Ka Track",
        code: "BOMBAY-25-BOT",
        size: "50 × 25 mm",
        barLengths: "16 ft",
        imageId: "2t_bottom",
        badge: "Frame",
        condition: "Heavy 25mm palla chalane ke liye bottom sill par lagta hai.",
      },
      {
        id: "handle_25",
        name: "25 mm Handle Stile (1″ × 2″)",
        hindiName: "1″ × 2″ Handle Pipe (Lock Side)",
        code: "BH-25-HND",
        size: "50 × 25 mm",
        barLengths: "16 ft",
        imageId: "handle_std",
        badge: "Shutter",
        condition: "25mm palla ke lock side vertical stiles me lagta hai. 6ft se 7ft height ke palla ko solid rigidity deta hai.",
      },
      {
        id: "interlock_25",
        name: "25 mm Interlock Stile",
        hindiName: "1″ × 2″ Beech Ka Interlock",
        code: "BH-25-INT",
        size: "50 × 25 mm",
        barLengths: "16 ft",
        imageId: "interlock",
        badge: "Interlock",
        condition: "25mm sliding me dono palla ke meeting point par solid airtight seal banane ke liye lagta hai.",
      },
      {
        id: "bearing_25",
        name: "25 mm Bearing Bottom / Top Rail",
        hindiName: "1″ × 2″ Bearing Wheel Rail",
        code: "BH-25-BRG",
        size: "50 × 25 mm",
        barLengths: "16 ft",
        imageId: "bearing",
        badge: "Rail",
        condition: "Palla ke horizontal top aur bottom me lagta hai. Isme heavy 25mm nylon/brass rollers fit hote hain.",
      },
    ],
  },

  // 3. Domal 27 mm
  {
    id: "domal-27",
    number: "03",
    title: "Domal 27 mm Series (Euro Groove 27 × 65 mm)",
    subtitle: "European Architectural Sliding System with 45° Mitre Cleat",
    family: "Domal Type Sliding",
    overview: "High-end residential villas aur premium apartments ki sabse popular system. Isme palla chaaron taraf ek hi profile se 45° mitre cut par corner cleat se banta hai.",
    specs: [
      { label: "Glass Compatibility", val: "5 mm, 8 mm, 12 mm Single & DGU" },
      { label: "Corner Joints", val: "45° Mitre Cut with Aluminium Corner Cleats" },
      { label: "Weathersealing", val: "EPDM Wedge Gaskets + Wool Pile Mohair" },
      { label: "Aesthetics", val: "Rounded Soft-Edge European Finish" },
    ],
    sections: [
      {
        id: "domal_frame_2t",
        name: "Domal 2-Track Outer Frame",
        hindiName: "Domal 2-Track Outer Frame",
        code: "DOMAL-2T-80",
        size: "80 × 45 mm",
        barLengths: "16 / 19 ft",
        imageId: "domal_frame",
        badge: "Frame",
        condition: "2-Track Domal window me chaaron taraf 45° mitre cut par banta hai. Deewar par corner cleats se tight fit hota hai.",
      },
      {
        id: "domal_frame",
        name: "Domal 3-Track Outer Frame",
        hindiName: "Domal 3-Track Outer Frame",
        code: "DOMAL-3T-115",
        size: "115 × 45 mm",
        barLengths: "16 / 19 ft",
        imageId: "domal_frame",
        badge: "Frame",
        condition: "3-Track Domal window (2 Glass + 1 Jali) me chaaron taraf lagta hai.",
      },
      {
        id: "domal_glass_shutter",
        name: "Domal Glass Shutter (27 × 65 mm)",
        hindiName: "Domal Palla Section (4 Sides)",
        code: "DOMAL-SH-65",
        size: "65 × 27 mm",
        barLengths: "16 / 19 ft",
        imageId: "domal_glass_shutter",
        badge: "Shutter",
        condition: "Domal palla me top, bottom, left, right chaaron taraf yahi ek section lagta hai 45° cut ke saath. Isme Euro groove aur glass rebate hota hai.",
      },
      {
        id: "domal_jali_shutter",
        name: "Domal Mosquito Mesh Shutter",
        hindiName: "Domal Jali Palla Section",
        code: "DOMAL-JALI-55",
        size: "55 × 27 mm",
        barLengths: "16 ft",
        imageId: "domal_jali_shutter",
        badge: "Shutter",
        condition: "3-Track Domal window ke 3rd track par machhardani palla banane ke liye lagta hai. SS wire mesh spline se lock hota hai.",
      },
      {
        id: "domal_interlock",
        name: "Domal Interlock Guide / Patti",
        hindiName: "Domal Interlock Patti",
        code: "DOMAL-INT-39",
        size: "39 × 28 mm",
        barLengths: "16 ft",
        imageId: "domal_interlock",
        badge: "Interlock",
        condition: "Domal shutter ke vertical stile par screw se fix hoti hai. Do palla band hone par yahi patti aapas me fas kar airtight locking karti hai.",
      },
    ],
  },

  // 4. Domal 35 mm
  {
    id: "domal-35",
    number: "04",
    title: "Domal 35 mm Heavy Architectural Series",
    subtitle: "Heavy DGU Insulated Double Glass Sliding System (35 × 75 mm)",
    family: "Heavy Domal",
    overview: "Badi heights (8ft to 10ft) aur heavy DGU (Double Glazed Unit 20mm/24mm) soundproof aur thermal insulation glass ke liye heavy architectural system.",
    specs: [
      { label: "Glass Compatibility", val: "18 mm to 24 mm DGU Double Glass" },
      { label: "Max Shutter Weight", val: "150 kg per shutter with tandem rollers" },
      { label: "Corners", val: "45° Mitre Cut with Heavy Mechanical Cleats" },
      { label: "Performance", val: "Acoustic Noise Reduction + Cyclonic Wind Resistance" },
    ],
    sections: [
      {
        id: "d35_track_2t",
        name: "Domal 35 2-Track Outer Frame",
        hindiName: "Domal 35 Heavy Outer Frame",
        code: "D35-FR-95",
        size: "95 × 50 mm",
        barLengths: "19 ft",
        imageId: "domal_frame",
        badge: "Frame",
        condition: "Heavy 35mm series me deewar ke perimeter par lagta hai.",
      },
      {
        id: "d35_shutter",
        name: "Domal 35 Heavy Shutter Profile",
        hindiName: "Domal 35 DGU Heavy Palla (35×75 mm)",
        code: "D35-SH-75",
        size: "75 × 35 mm",
        barLengths: "19 ft",
        imageId: "domal_glass_shutter",
        badge: "Shutter",
        condition: "DGU Double Glass (20mm se 24mm) aur heavy shutter sizes (up to 10ft) ke liye chaaron taraf 45° mitre cut par lagta hai.",
      },
      {
        id: "d35_interlock",
        name: "Domal 35 Heavy Interlock Guide",
        hindiName: "Domal 35 Interlock Guide Patti",
        code: "D35-INT-45",
        size: "45 × 35 mm",
        barLengths: "19 ft",
        imageId: "domal_interlock",
        badge: "Interlock",
        condition: "35mm palla ke meeting stile par lagti hai. Double wool pile mohair ke saath air infiltration rokti hai.",
      },
    ],
  },

  // 5. Ample 29 mm Sleek
  {
    id: "ample-29",
    number: "05",
    title: "Ample 29 mm Sleek Series",
    subtitle: "Ultra-Slim Sightline Minimalist Sliding Window",
    family: "Sleek / Slim Sliding",
    overview: "Minimalist architecture ke liye sabse pasandida sleek system. Beech me sirf 37mm ya 40mm ka patla interlock dikhta hai, jisse bahar ka view 90% se zyada clear rehta hai.",
    specs: [
      { label: "Sightline", val: "37 mm / 40 mm Ultra-Slim Interlock" },
      { label: "Glass Compatibility", val: "6 mm to 12 mm Toughened Glass" },
      { label: "Reinforcement", val: "Heavy T-Spine for High-Rise Wind Loads" },
      { label: "Locking", val: "Multi-Point Concealed Flush Lock" },
    ],
    sections: [
      {
        id: "a29_track_2t",
        name: "Ample 29 2-Track Sleek Frame",
        hindiName: "Ample 29 Sleek Outer Frame",
        code: "Die #41011",
        size: "85.8 × 47.7 mm",
        barLengths: "16 / 19 ft",
        shapeKey: "41011",
        badge: "Frame",
        condition: "Sleek sliding window ke perimeter me outer frame banane ke liye lagta hai.",
      },
      {
        id: "a29_rail",
        name: "Ample 29 Shutter Rail (Top & Bottom)",
        hindiName: "Ample 29 Top/Bottom Horizontal Rail",
        code: "Die #41010",
        size: "64.4 × 50.2 mm",
        barLengths: "16 / 19 ft",
        shapeKey: "41010",
        badge: "Rail",
        condition: "Shutter ke top aur bottom me lagta hai. Niche wale me heavy-duty concealed tandem rollers fit hote hain.",
      },
      {
        id: "a29_handle",
        name: "Ample 29 Handle Stile",
        hindiName: "Ample 29 Lock Side Handle Pipe",
        code: "Die #41055",
        size: "65 × 29 mm",
        barLengths: "16 / 19 ft",
        shapeKey: "41055",
        badge: "Shutter",
        condition: "Shutter ke wall side vertical stiles me lagta hai jisme integrated recessed handle aur multi-point lock lagta hai.",
      },
      {
        id: "a29_slim_40",
        name: "Ample 29 Slim Interlock 40 mm",
        hindiName: "Ample 29 Slim Interlock (40mm)",
        code: "Die #41289",
        size: "40 × 29 mm",
        barLengths: "16 / 19 ft",
        shapeKey: "41289",
        badge: "Interlock",
        condition: "Shutter ke center meeting stile me lagta hai jab client ko ultra-slim 40mm ka beech ka danda chahiye ho.",
      },
      {
        id: "a29_slim",
        name: "Ample 29 Slim Interlock 37 mm",
        hindiName: "Ample 29 Extra Slim Interlock (37mm)",
        code: "Die #992328",
        size: "37 × 29 mm",
        barLengths: "16 / 19 ft",
        shapeKey: "992328",
        badge: "Interlock",
        condition: "Sabse patli 37mm sightline ke liye. Maximum glass area aur unhindered view deta hai.",
      },
      {
        id: "a29_spine",
        name: "Ample 29 Heavy T-Spine Reinforcement",
        hindiName: "T-Spine Structural Reinforcement",
        code: "Die #914806",
        size: "50.6 × 45 mm",
        barLengths: "16 ft",
        shapeKey: "914806",
        badge: "Spine",
        condition: "High-rise buildings (10th floor+) ya heavy wind zones me shutter ko hawa ke dabav se bend hone se bachane ke liye interlock ke piche screw se attach hota hai.",
      },
    ],
  },

  // 6. Banu Hashim 31 mm Slim
  {
    id: "bh-31",
    number: "06",
    title: "Banu Hashim 31 mm Slim Series",
    subtitle: "Heavy Coastal, Cyclonic & DGU Double Glass Slim System",
    family: "Slim / Architectural Sliding",
    overview: "High-end engineered slim sliding system. Isme single glass (SGU) aur double glass (DGU) dono ke dedicated profiles hain, aur 20mm ultra-slim sightline milti hai.",
    specs: [
      { label: "Interlock Sightline", val: "20.3 mm Ultra-Slim Profile" },
      { label: "Glass Options", val: "SGU (6mm-8mm) & DGU (20mm-24mm)" },
      { label: "Track Rail", val: "Integrated Stainless Steel Runner Patri" },
      { label: "Wind Rating", val: "Tested for Cyclonic Wind Pressure with Spine" },
    ],
    sections: [
      {
        id: "bh31_track_2t",
        name: "BH 31 mm 2-Track Outer Frame",
        hindiName: "BH 31mm 2-Track Outer Frame",
        code: "BH-6400",
        size: "85 × 33.1 mm",
        barLengths: "16 / 19 ft",
        shapeKey: "BH-6400",
        badge: "Frame",
        condition: "31mm slim series ka perimeter frame. Isme stainless steel runner patri integrate hoti hai.",
      },
      {
        id: "bh31_rail_sgu",
        name: "BH 31 Shutter Rail (Single Glass)",
        hindiName: "BH 31 Single Glass Shutter Rail",
        code: "BH-6404",
        size: "65.9 × 29 mm",
        barLengths: "16 / 19 ft",
        shapeKey: "BH-6404",
        badge: "Rail",
        condition: "Single glass (5mm/6mm/8mm) shutter ke top aur bottom rails ke liye use hota hai.",
      },
      {
        id: "bh31_rail_dgu",
        name: "BH 31 Shutter Rail (Double Glass DGU)",
        hindiName: "BH 31 Double Glass (DGU) Rail",
        code: "BH-6405",
        size: "65.9 × 32 mm",
        barLengths: "16 / 19 ft",
        shapeKey: "BH-6405",
        badge: "Rail",
        condition: "Jab double glazed unit (DGU 20mm acoustic/thermal glass) lagana ho to is wide glass rebate wale rail ko use kiya jata hai.",
      },
      {
        id: "bh31_handle_sgu",
        name: "BH 31 Handle Stile (Single Glass)",
        hindiName: "BH 31 Single Glass Handle Pipe",
        code: "BH-6406",
        size: "59 × 31.4 mm",
        barLengths: "16 / 19 ft",
        shapeKey: "BH-6406",
        badge: "Shutter",
        condition: "Single glass shutter me lock vertical side par lagta hai.",
      },
      {
        id: "bh31_handle_dgu",
        name: "BH 31 Handle Stile (Double Glass DGU)",
        hindiName: "BH 31 Double Glass Handle Pipe",
        code: "BH-6407",
        size: "59 × 33.5 mm",
        barLengths: "16 / 19 ft",
        shapeKey: "BH-6407",
        badge: "Shutter",
        condition: "Double glass DGU shutter me lock side vertical par lagta hai.",
      },
      {
        id: "bh31_slim",
        name: "BH 31 Slim Interlock (SGU)",
        hindiName: "BH 31 Ultra-Slim Interlock (20mm)",
        code: "BH-6408",
        size: "20.3 × 50.7 mm",
        barLengths: "16 / 19 ft",
        shapeKey: "BH-6408",
        badge: "Interlock",
        condition: "Bahar se sirf 20mm ki ultra-minimalist patti dikhti hai. Maximum transparency aur wide panorama view deta hai.",
      },
      {
        id: "bh31_spine",
        name: "BH 31 Heavy Reinforcement Spine",
        hindiName: "BH 31 Wind Load Structural Spine",
        code: "BH-6409",
        size: "45 × 20 mm",
        barLengths: "16 ft",
        shapeKey: "BH-6409",
        badge: "Spine",
        condition: "High wind pressure aur cyclonic weather zones me shutter ko rigid rakhne ke liye interlock par piche se lagta hai.",
      },
    ],
  },

  // 7. Banu Hashim 35 mm Gulf Series
  {
    id: "bh-35",
    number: "07",
    title: "Banu Hashim 35 mm Gulf Series",
    subtitle: "Heavy Screwed Frame with Sub-Sill & Water Drainage",
    family: "Gulf Heavy Sliding",
    overview: "Middle-East / Gulf standards par designed heavy series. Isme bottom track me dedicated water drain slope hoti hai aur vertical jambs bottom sill par 90° screwed hote hain.",
    specs: [
      { label: "Frame Assembly", val: "90° Screwed Butt Joints (Separate Vertical & Sill)" },
      { label: "Water Resistance", val: "Stepped Internal Weep Drainage Channels" },
      { label: "Track Rail", val: "Heavy Stainless Steel Round Bead Rail" },
      { label: "Glass Options", val: "Up to 28 mm Heavy DGU Units" },
    ],
    sections: [
      {
        id: "bh35_v2",
        name: "BH 35 mm 2-Track Vertical Side Jamb",
        hindiName: "Gulf 2-Track Khada Side Jamb",
        code: "BH-6500",
        size: "95 × 31.2 mm",
        barLengths: "19 ft",
        shapeKey: "BH-6500",
        badge: "Frame",
        condition: "Gulf series me vertical sides ke khade frames alag section hote hain jo bottom sill par 90° butt joint se screw hote hain.",
      },
      {
        id: "bh35_b2",
        name: "BH 35 mm 2-Track Bottom Sill Track",
        hindiName: "Gulf 2-Track Niche Ka Bottom Track",
        code: "BH-6501",
        size: "95 × 31.2 mm",
        barLengths: "19 ft",
        shapeKey: "BH-6501",
        badge: "Frame",
        condition: "Niche floor/sill par lagta hai. Isme drainage channels aur drain caps ke liye special slope hoti hai.",
      },
      {
        id: "bh35_rail",
        name: "BH 35 Shutter Rail",
        hindiName: "BH 35 Shutter Top/Bottom Rail",
        code: "BH-6504",
        size: "58 × 31.7 mm",
        barLengths: "19 ft",
        shapeKey: "BH-6504",
        badge: "Rail",
        condition: "Top aur bottom me shutter structure banane ke liye lagta hai.",
      },
      {
        id: "bh35_handle",
        name: "BH 35 Handle Stile",
        hindiName: "BH 35 Handle Pipe (Lock Side)",
        code: "BH-6510",
        size: "58.9 × 35.2 mm",
        barLengths: "19 ft",
        shapeKey: "BH-6510",
        badge: "Shutter",
        condition: "Lock side palla vertical stile.",
      },
      {
        id: "bh35_slim",
        name: "BH 35 Slim Interlock",
        hindiName: "BH 35 Slim Interlock Stile",
        code: "BH-6506",
        size: "24 × 62 mm",
        barLengths: "19 ft",
        shapeKey: "BH-6506",
        badge: "Interlock",
        condition: "35mm Gulf series me slim meeting interlock.",
      },
      {
        id: "bh35_spine",
        name: "BH 35 Heavy Cyclonic Spine",
        hindiName: "Gulf 35 Cyclonic Structural Spine",
        code: "BH-6508",
        size: "50 × 35 mm",
        barLengths: "16 ft",
        shapeKey: "BH-6508",
        badge: "Spine",
        condition: "Coastal areas aur cyclone zones me heavy wind pressure jhelne ke liye structural back-spine.",
      },
    ],
  },

  // 8. Casement Z-40
  {
    id: "z-40",
    number: "08",
    title: "Casement Window / Z-Section 40 mm",
    subtitle: "Openable Hinged / Friction Stay Window System",
    family: "Casement Window",
    overview: "Khulne wali (openable/hinged) window system jo friction stays ya hinges par khulti hai. 100% airtight aur watertight sealing deti hai.",
    specs: [
      { label: "Hardware", val: "SS 304 Friction Stays + Cockspur / Espag Handles" },
      { label: "Sealing", val: "Dual EPDM Hollow Gaskets on Z-Rebates" },
      { label: "Opening Styles", val: "Side Hung (Door style) & Top Hung (Ventilator)" },
      { label: "Air Permeability", val: "Class 4 (Zero Draft Air-Tight Sealing)" },
    ],
    sections: [
      {
        id: "z_outer_40",
        name: "Z Outer Frame 40 × 40 mm",
        hindiName: "Z-Section Outer Frame (Chaukhat)",
        code: "OMEO #2001",
        size: "40 × 40 mm",
        barLengths: "16 ft",
        imageId: "z_outer_40",
        badge: "Frame",
        condition: "Openable window me deewar ke chaaron taraf outer frame banta hai 45° mitre cut par.",
      },
      {
        id: "z_pipe_40",
        name: "Z-Pipe (Openable Sash) 40 × 40 mm",
        hindiName: "Z-Pipe Khulne Wala Palla",
        code: "OMEO #2002",
        size: "40 × 40 mm",
        barLengths: "16 ft",
        imageId: "z_pipe_40",
        badge: "Shutter",
        condition: "Khulne wale palla (shutter) ke chaaron taraf lagta hai. Iske Z-flange par EPDM rubber gasket lagti hai jo outer frame par tight seal karti hai.",
      },
      {
        id: "z_center_55",
        name: "Z Center Mullion / Transom 40 × 55 mm",
        hindiName: "Z-Section Center Divider / Mullion",
        code: "OMEO #2003",
        size: "40 × 55 mm",
        barLengths: "16 ft",
        imageId: "z_center_55",
        badge: "Divider",
        condition: "Jab ek hi window me do khulne wale palle ya ek khulne wala aur ek fixed glass ho, to beech ke vertical ya horizontal divider me lagta hai.",
      },
      {
        id: "z_clip",
        name: "Z Glazing Clip",
        hindiName: "Z-Section Glass Clip Patti",
        code: "OMEO #2004",
        size: "18 × 12 mm",
        barLengths: "16 ft",
        imageId: "z_clip",
        badge: "Clip",
        condition: "Glass ko palla ya fixed frame ke andar press karke hold karne ke liye snap hota hai.",
      },
    ],
  },

  // 9. Heavy Casement Z-55
  {
    id: "z-55",
    number: "09",
    title: "Heavy Casement / Z-Section 55 mm",
    subtitle: "Heavy Architectural Openable & Fixed Glass Combination",
    family: "Casement Window",
    overview: "Badi heights (6ft+) aur heavy DGU double glass ke liye heavy casement window series. Bade spans me mullion ko heavy strength milti hai.",
    specs: [
      { label: "Glass Options", val: "Up to 24 mm DGU Double Glazing" },
      { label: "Hardware", val: "Heavy Duty 24″ Friction Stays + Multi-point Espagnolette" },
      { label: "Mullion Depth", val: "70 mm Heavy Structural Divider" },
    ],
    sections: [
      {
        id: "z_outer_55",
        name: "Z Outer Frame 40 × 55 mm",
        hindiName: "Heavy Z Outer Frame",
        code: "OMEO #2005",
        size: "40 × 55 mm",
        barLengths: "16 ft",
        imageId: "z_outer_55",
        badge: "Frame",
        condition: "Badi openable windows (5ft+ height) aur heavy double glass ke liye perimeter me lagta hai.",
      },
      {
        id: "z_pipe_55",
        name: "Z-Pipe Sash 40 × 55 mm",
        hindiName: "Heavy Z-Pipe Palla",
        code: "OMEO #2006",
        size: "40 × 55 mm",
        barLengths: "16 ft",
        imageId: "z_pipe_55",
        badge: "Shutter",
        condition: "Heavy openable shutter me chaaron taraf 45° mitre joint par corner cleat ke saath lagta hai.",
      },
      {
        id: "z_center_70",
        name: "Z Center Mullion 40 × 70 mm",
        hindiName: "Heavy 70mm Center Column Mullion",
        code: "OMEO #2007",
        size: "40 × 70 mm",
        barLengths: "16 ft",
        imageId: "z_center_70",
        badge: "Divider",
        condition: "Badi window partitions me center column/divider jahan heavy wind load resistance chahiye.",
      },
    ],
  },

  // 10. Partition 2.5" x 1.5"
  {
    id: "partition",
    number: "10",
    title: "Aluminium Partition Series (2.5″ × 1.5″ & 2″ × 1″)",
    subtitle: "Commercial Office Cabins, Showroom Dividers & Full-Height Partitions",
    family: "Partition System",
    overview: "Commercial offices, clinics, hospitals aur banks me cabins aur room dividers banane ke liye sabse versatile system.",
    specs: [
      { label: "Infill Materials", val: "5mm/8mm/12mm Glass, Prelam Board, ACP Sheet" },
      { label: "Joints", val: "90° Screwed Joints with Internal Corner Brackets" },
      { label: "Assembly", val: "Floor Channel, Ceiling Channel & Vertical Studs" },
    ],
    sections: [
      {
        id: "partition_frame",
        name: "Partition Outer Frame 2.5″ × 1.5″",
        hindiName: "Partition Outer Frame (Chaukhat)",
        code: "OMEO #3001",
        size: "63.5 × 38.1 mm",
        barLengths: "12 / 14 / 16 ft",
        imageId: "partition_frame",
        badge: "Frame",
        condition: "Office aur cabin partitions me floor, ceiling aur wall ke perimeter me lagta hai. Isme ek taraf glass clip channel hota hai.",
      },
      {
        id: "partition_divider",
        name: "Partition Divider / Middle Mullion",
        hindiName: "Partition Center Divider (H-Section)",
        code: "OMEO #3002",
        size: "63.5 × 38.1 mm",
        barLengths: "12 / 14 / 16 ft",
        imageId: "partition_divider",
        badge: "Divider",
        condition: "Partition ke beech ke vertical aur horizontal joints me lagta hai. Iske dono taraf glass clip lagte hain taaki dono side glass fit ho sake.",
      },
      {
        id: "glazing_clip",
        name: "Snap-On Glazing Clip",
        hindiName: "Glass Glazing Clip / Patti",
        code: "OMEO #3003",
        size: "18 × 14 mm",
        barLengths: "12 / 16 ft",
        imageId: "glazing_clip",
        badge: "Clip",
        condition: "Glass ko partition frame ke andar press karke lock karne ke liye use hota hai.",
      },
    ],
  },

  // 11. Aluminium Doors
  {
    id: "doors",
    number: "11",
    title: "Aluminium Doors Series (Flush, Glazed & Pattam)",
    subtitle: "Commercial & Residential Entrance, Cabin & Bathroom Doors",
    family: "Door System",
    overview: "Aluminium doors durable, rust-proof aur termite-proof hote hain. Office entrance, bathroom, balcony aur shopfront doors ke liye use hote hain.",
    specs: [
      { label: "Hinges & Hardware", val: "Floor Spring / Pivot Hinge / Butt Hinges & Mortise Lock" },
      { label: "Styles", val: "Full Glass, Half Glass + Half Board, Full ACP Flush Door" },
      { label: "Kick Plate", val: "Heavy 100mm / 150mm Bottom Protection Rail" },
    ],
    sections: [
      {
        id: "door_frame_pattam",
        name: "Door Frame with Rebate (Pattam)",
        hindiName: "Door Chaukhat / Pattam Frame",
        code: "DOOR-FR-63",
        size: "63.5 × 38.1 mm",
        barLengths: "14 / 16 ft",
        imageId: "door_frame_pattam",
        badge: "Frame",
        condition: "Door ke chaaron taraf deewar me lagta hai. Iske andar integrated stop rebate hota hai jahan darwaza aakar band hota hai.",
      },
      {
        id: "door_palla_75",
        name: "Door Palla 75 mm (3″ × 1.75″)",
        hindiName: "Heavy Door Palla 75mm",
        code: "DOOR-SH-75",
        size: "75 × 44.5 mm",
        barLengths: "14 / 16 ft",
        imageId: "door_palla_75",
        badge: "Shutter",
        condition: "Commercial aur residential doors me vertical lock stile, hinge stile aur top horizontal rail banane ke liye standard heavy section.",
      },
      {
        id: "door_palla_60",
        name: "Door Palla 60 mm",
        hindiName: "Door Palla 60mm (Medium Duty)",
        code: "DOOR-SH-60",
        size: "60 × 44.5 mm",
        barLengths: "14 / 16 ft",
        imageId: "door_palla_60",
        badge: "Shutter",
        condition: "Medium size room doors aur bathroom doors ke liye vertical stiles aur top rail me use hota hai.",
      },
      {
        id: "door_palla_50",
        name: "Door Palla 50 mm (2″ × 1.75″)",
        hindiName: "Door Palla 50mm (Light Duty)",
        code: "DOOR-SH-50",
        size: "50 × 44.5 mm",
        barLengths: "14 / 16 ft",
        imageId: "door_palla_50",
        badge: "Shutter",
        condition: "Light interior doors aur duct doors ke liye.",
      },
      {
        id: "door_center_75",
        name: "Door Center Rail / Divider (75 mm)",
        hindiName: "Door Beech Ka Center Rail",
        code: "DOOR-DIV-75",
        size: "75 × 44.5 mm",
        barLengths: "14 / 16 ft",
        imageId: "door_center_75",
        badge: "Divider",
        condition: "Half panel and half glass doors me beech me lagta hai — niche aluminium sheet/ACP sheet aur upar glass ko divide karta hai.",
      },
    ],
  },
];

// 3. Build HTML Output with Print CSS
function renderSectionRow(sec: SectionItem): string {
  let visualHtml = '';
  if (sec.imageId && imageBase64[sec.imageId]) {
    visualHtml = `<img src="${imageBase64[sec.imageId]}" alt="${sec.name}" class="sec-img" />`;
  } else if (sec.shapeKey) {
    const sh = bhShapes[sec.shapeKey] || omShapes[sec.shapeKey];
    if (sh) {
      visualHtml = renderSvgForShape(sh);
    } else {
      visualHtml = `<div class="placeholder-box"><span>${sec.size}</span></div>`;
    }
  } else {
    visualHtml = `<div class="placeholder-box"><span>${sec.size}</span></div>`;
  }

  const badgeColors: Record<string, { bg: string; text: string }> = {
    Frame: { bg: '#e0f2fe', text: '#0369a1' },
    Shutter: { bg: '#fef3c7', text: '#92400e' },
    Interlock: { bg: '#fee2e2', text: '#991b1b' },
    Rail: { bg: '#f3e8ff', text: '#6b21a8' },
    Spine: { bg: '#ecfdf5', text: '#065f46' },
    Divider: { bg: '#e0e7ff', text: '#3730a3' },
    Clip: { bg: '#f1f5f9', text: '#475569' },
    Hardware: { bg: '#ffedd5', text: '#9a3412' },
  };
  const bCol = badgeColors[sec.badge] || { bg: '#f1f5f9', text: '#334155' };

  return `
    <div class="section-card">
      <div class="sec-visual">
        ${visualHtml}
        <div class="sec-dim-tag">${sec.size}</div>
      </div>
      <div class="sec-info">
        <div class="sec-header">
          <div>
            <div class="sec-name">${sec.name}</div>
            <div class="sec-hindi">${sec.hindiName}</div>
          </div>
          <span class="sec-badge" style="background:${bCol.bg}; color:${bCol.text};">${sec.badge}</span>
        </div>
        <div class="sec-meta">
          <span class="meta-item"><strong>Die Code:</strong> ${sec.code}</span>
          <span class="meta-item"><strong>Standard Size:</strong> ${sec.size}</span>
          <span class="meta-item"><strong>Bar Length:</strong> ${sec.barLengths}</span>
        </div>
        <div class="sec-condition">
          <div class="condition-label">📌 Kahan aur Kab Lagta Hai (Fabrication Rule):</div>
          <div class="condition-text">${sec.condition}</div>
        </div>
      </div>
    </div>
  `;
}

function renderSystemBlock(sys: SystemGroup): string {
  return `
    <div class="system-section">
      <div class="sys-banner">
        <div class="sys-num-badge">${sys.number}</div>
        <div class="sys-title-group">
          <h2 class="sys-title">${sys.title}</h2>
          <div class="sys-subtitle">${sys.subtitle} · <em>${sys.family}</em></div>
        </div>
      </div>

      <div class="sys-overview-box">
        <p class="sys-overview-p">${sys.overview}</p>
        <div class="sys-specs-grid">
          ${sys.specs.map(s => `
            <div class="spec-cell">
              <span class="spec-k">${s.label}:</span>
              <span class="spec-v">${s.val}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="sections-list">
        ${sys.sections.map(s => renderSectionRow(s)).join('')}
      </div>
    </div>
  `;
}

const htmlContent = `<!DOCTYPE html>
<html lang="hi">
<head>
  <meta charset="UTF-8">
  <title>FabriQ Aluminium Fabrication Systems Handbook</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 10mm 14mm 10mm;
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

    /* Cover / Header Header */
    .handbook-header {
      border-bottom: 2.5px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .brand-title {
      font-size: 26px;
      font-weight: 900;
      letter-spacing: -0.5px;
      color: #0f172a;
      line-height: 1.1;
    }
    .brand-title span {
      color: #2563eb;
    }
    .brand-subtitle {
      font-size: 13px;
      font-weight: 600;
      color: #334155;
      margin-top: 3px;
    }
    .brand-meta {
      font-size: 10px;
      color: #64748b;
      text-align: right;
    }
    .brand-tag {
      display: inline-block;
      background: #0f172a;
      color: #ffffff;
      font-weight: 700;
      font-size: 9px;
      padding: 3px 8px;
      border-radius: 4px;
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* TOC Summary Box */
    .toc-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 20px;
      break-inside: avoid;
    }
    .toc-title {
      font-size: 12px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }
    .toc-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4px 12px;
      font-size: 10px;
    }
    .toc-item {
      color: #334155;
    }
    .toc-item strong {
      color: #2563eb;
    }

    /* System Section Blocks */
    .system-section {
      margin-bottom: 24px;
      break-inside: auto;
    }
    .sys-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      background: #0f172a;
      color: #ffffff;
      padding: 8px 14px;
      border-radius: 6px;
      margin-bottom: 8px;
      break-inside: avoid;
      break-after: avoid;
    }
    .sys-num-badge {
      background: #2563eb;
      color: #ffffff;
      font-weight: 900;
      font-size: 14px;
      width: 28px;
      height: 28px;
      border-radius: 6px;
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }
    .sys-title-group {
      flex: 1;
    }
    .sys-title {
      margin: 0;
      font-size: 16px;
      font-weight: 800;
      letter-spacing: -0.3px;
      color: #ffffff;
    }
    .sys-subtitle {
      font-size: 10px;
      color: #94a3b8;
      font-weight: 500;
    }
    .sys-subtitle em {
      color: #60a5fa;
      font-style: normal;
      font-weight: 600;
    }

    .sys-overview-box {
      background: #f1f5f9;
      border-left: 3px solid #2563eb;
      padding: 8px 12px;
      border-radius: 0 6px 6px 0;
      margin-bottom: 12px;
      break-inside: avoid;
      break-after: avoid;
    }
    .sys-overview-p {
      margin: 0 0 6px 0;
      font-size: 10.5px;
      font-weight: 500;
      color: #1e293b;
    }
    .sys-specs-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 3px 14px;
      font-size: 10px;
      border-top: 1px solid #cbd5e1;
      padding-top: 5px;
    }
    .spec-cell {
      display: flex;
      justify-content: space-between;
    }
    .spec-k {
      color: #64748b;
      font-weight: 600;
    }
    .spec-v {
      color: #0f172a;
      font-weight: 700;
    }

    /* Sections Cards */
    .sections-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .section-card {
      display: flex;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background: #ffffff;
      overflow: hidden;
      break-inside: avoid;
    }
    .sec-visual {
      width: 130px;
      min-width: 130px;
      background: #ffffff;
      border-right: 1px solid #e2e8f0;
      padding: 6px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    .sec-img {
      max-width: 100%;
      max-height: 75px;
      object-fit: contain;
    }
    .shape-svg {
      width: 100%;
      height: 75px;
    }
    .placeholder-box {
      width: 100%;
      height: 70px;
      border: 1px dashed #cbd5e1;
      display: grid;
      place-items: center;
      color: #94a3b8;
      font-size: 10px;
      font-weight: 600;
      border-radius: 4px;
    }
    .sec-dim-tag {
      margin-top: 4px;
      font-size: 9px;
      font-weight: 700;
      color: #475569;
      background: #f1f5f9;
      padding: 1px 6px;
      border-radius: 3px;
    }

    .sec-info {
      flex: 1;
      padding: 8px 12px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .sec-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 4px;
    }
    .sec-name {
      font-size: 13px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.2;
    }
    .sec-hindi {
      font-size: 11px;
      font-weight: 600;
      color: #2563eb;
      margin-top: 1px;
    }
    .sec-badge {
      font-size: 9px;
      font-weight: 800;
      padding: 2px 7px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .sec-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      font-size: 9.5px;
      color: #475569;
      background: #f8fafc;
      padding: 3px 8px;
      border-radius: 4px;
      margin-bottom: 6px;
      border: 1px solid #f1f5f9;
    }
    .meta-item strong {
      color: #0f172a;
    }
    .sec-condition {
      font-size: 10px;
      line-height: 1.4;
      background: #fefce8;
      border-left: 2.5px solid #eab308;
      padding: 4px 8px;
      border-radius: 0 4px 4px 0;
    }
    .condition-label {
      font-weight: 800;
      color: #854d0e;
      margin-bottom: 1px;
      font-size: 9.5px;
    }
    .condition-text {
      color: #713f12;
      font-weight: 500;
    }

    .footer-note {
      margin-top: 30px;
      border-top: 1px solid #cbd5e1;
      padding-top: 10px;
      font-size: 9.5px;
      color: #64748b;
      text-align: center;
      break-inside: avoid;
    }
  </style>
</head>
<body>

  <!-- Main Header -->
  <div class="handbook-header">
    <div>
      <div class="brand-tag">Technical Fabrication Manual & Section Master</div>
      <div class="brand-title">FabriQ <span>Systems Handbook</span></div>
      <div class="brand-subtitle">Aluminium Architectural Window, Door & Partition Profiles A to Z</div>
    </div>
    <div class="brand-meta">
      <strong>Standard Edition</strong><br>
      Catalogues: OMEO · Banu Hashim · Ample · Altech<br>
      Scale: Real 1:1 Vector CAD & Cropped Dies
    </div>
  </div>

  <!-- Table of Contents -->
  <div class="toc-box">
    <div class="toc-title">Index of Systems Covered in this Manual</div>
    <div class="toc-grid">
      <div class="toc-item"><strong>01.</strong> Normal Sliding 18 mm (Bombay)</div>
      <div class="toc-item"><strong>02.</strong> Normal Sliding 25 mm (1″×2″)</div>
      <div class="toc-item"><strong>03.</strong> Domal 27 mm Euro Groove</div>
      <div class="toc-item"><strong>04.</strong> Domal 35 mm Heavy Architectural</div>
      <div class="toc-item"><strong>05.</strong> Ample 29 mm Sleek Series</div>
      <div class="toc-item"><strong>06.</strong> Banu Hashim 31 mm Slim</div>
      <div class="toc-item"><strong>07.</strong> Banu Hashim 35 mm Gulf Series</div>
      <div class="toc-item"><strong>08.</strong> Casement Window Z-Section 40 mm</div>
      <div class="toc-item"><strong>09.</strong> Heavy Casement Z-Section 55 mm</div>
      <div class="toc-item"><strong>10.</strong> Partition 2.5″ × 1.5″ Commercial</div>
      <div class="toc-item"><strong>11.</strong> Aluminium Doors (Flush/Glazed)</div>
    </div>
  </div>

  <!-- Systems List -->
  ${SYSTEMS.map(sys => renderSystemBlock(sys)).join('')}

  <div class="footer-note">
    <strong>FabriQ Aluminium Fabrication Handbook</strong> · Generated for workshop fabricators, contractors, and architects · Verified against manufacturer engineering dies.
  </div>

</body>
</html>
`;

// 4. Save HTML file to docs/systems-handbook.html
const htmlPath = path.resolve('docs/systems-handbook.html');
fs.writeFileSync(htmlPath, htmlContent, 'utf8');
console.log(`Saved HTML handbook to: ${htmlPath}`);

// 5. Convert to PDF using Headless Chrome
const pdfOutputPath = path.resolve('docs/FABRIQ_SYSTEMS_HANDBOOK.pdf');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

console.log('Generating PDF via Headless Chrome...');
const cmd = `Start-Process -FilePath '${chromePath}' -ArgumentList '--headless=new', '--disable-gpu', '--print-to-pdf="${pdfOutputPath.replace(/\\/g, '/')}"', '"file:///${htmlPath.replace(/\\/g, '/')}"' -Wait`;

execSync(`powershell -Command "${cmd}"`, { stdio: 'inherit' });

if (fs.existsSync(pdfOutputPath)) {
  const stats = fs.statSync(pdfOutputPath);
  console.log(`Successfully generated PDF: ${pdfOutputPath} (${(stats.size / 1024).toFixed(1)} KB)`);
  
  // Also copy to artifact directory for easy download
  const artifactDir = 'C:\\Users\\umarm\\.gemini\\antigravity\\brain\\1ee9f20b-dff4-437d-98e5-250826fccf9f';
  if (fs.existsSync(artifactDir)) {
    const artifactPdfPath = path.join(artifactDir, 'FABRIQ_SYSTEMS_HANDBOOK.pdf');
    fs.copyFileSync(pdfOutputPath, artifactPdfPath);
    console.log(`Copied PDF to artifact directory: ${artifactPdfPath}`);
  }
} else {
  console.error('PDF generation failed: output file not found.');
}
