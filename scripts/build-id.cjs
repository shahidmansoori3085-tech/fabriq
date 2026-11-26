// Runs before every build (npm "prebuild"): names this build, inside the app (lib/build-id.ts)
// and at /version.json. An app left open in the background compares the two when it comes back
// and takes the new version (founder 2026-11-26: "purana version hi chalta rehta hai").
const fs = require("fs");
const path = require("path");
const id = (process.env.GITHUB_SHA || process.env.VERCEL_GIT_COMMIT_SHA || String(Date.now())).slice(0, 12);
const root = path.join(__dirname, "..");
fs.writeFileSync(path.join(root, "lib", "build-id.ts"), `// written by scripts/build-id.cjs before each build\nexport const BUILD_ID: string = ${JSON.stringify(id)};\n`);
fs.writeFileSync(path.join(root, "public", "version.json"), JSON.stringify({ build: id }) + "\n");
console.log("build id", id);
