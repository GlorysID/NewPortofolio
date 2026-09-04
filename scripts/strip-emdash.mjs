// One-shot sweep: remove all U+2014 (em-dash) from user-facing files.
// Label separators → " · ", prose → ": ", catch-all → " · ".
import fs from "node:fs";

const edits = [
  ["app/layout.tsx", [
    ["mandiri — mengeksplorasi", "mandiri, mengeksplorasi"],
    ["Anjali Saputra — Portfolio", "Anjali Saputra · Portfolio"],
    ["Anjali Saputra — AI agents", "Anjali Saputra · AI agents"],
    ["AI × Automation × Software — pengalaman", "AI × Automation × Software · pengalaman"],
  ]],
  ["sections/Hero.tsx", [
    ["mandiri — mengeksplorasi", "mandiri, mengeksplorasi"],
  ]],
  ["components/ContentCards.tsx", [
    ["Kodak Portra 400 — Frame 01", "Kodak Portra 400 · Frame 01"],
    ["Roll 01 — Contact Sheet", "Roll 01 · Contact Sheet"],
    ["Roll 02 — School Records", "Roll 02 · School Records"],
    ["Studio Card — Cetak 2026", "Studio Card · Cetak 2026"],
    ["School Records — SD ke SMK", "School Records · SD ke SMK"],
    ["Sekolah dasar — fondasi", "Sekolah dasar: fondasi"],
    ["Sekolah menengah pertama — awal", "Sekolah menengah pertama: awal"],
    ["Sekolah menengah kejuruan — multimedia", "Sekolah menengah kejuruan: multimedia"],
  ]],
  ["components/ProjectOverlay.tsx", [
    ["Quest Board — {project.year}", "Quest Board · {project.year}"],
  ]],
  ["content/projects/01-interactive-data-atlas.mdx", [
    ["WebGL — ribuan titik data", "WebGL: ribuan titik data"],
    ["via WebGL — satu draw call", "via WebGL: satu draw call"],
  ]],
  ["content/projects/02-generative-brand-studio.mdx", [
    ["brand kecil — logo dan aset", "brand kecil: logo dan aset"],
  ]],
  ["content/projects/03-spatial-ui-prototype.mdx", [
    ["di WebXR — panel mengikuti", "di WebXR: panel mengikuti"],
  ]],
  ["content/projects/04-portfolio-engine.mdx", [
    ["papan quest — dibangun dari nol", "papan quest: dibangun dari nol"],
    ["di-bake sekali — 1M+ vertex", "di-bake sekali: 1M+ vertex"],
  ]],
  ["content/projects/_template.mdx", []],
  ["content/projects/README.md", []],
];

let total = 0;
for (const [file, rules] of edits) {
  if (!fs.existsSync(file)) {
    console.log(`SKIP (missing): ${file}`);
    continue;
  }
  let src = fs.readFileSync(file, "utf8");
  const before = (src.match(/\u2014/g) || []).length;
  for (const [from, to] of rules) {
    src = src.split(from).join(to);
  }
  // Catch-all: sisa em-dash ber-spasi → " · ", tanpa spasi → " · "
  src = src.split(" \u2014 ").join(" \u00b7 ");
  src = src.split("\u2014 ").join("\u00b7 ");
  src = src.split(" \u2014").join(" \u00b7 ");
  src = src.split("\u2014").join("\u00b7 ");
  const after = (src.match(/\u2014/g) || []).length;
  fs.writeFileSync(file, src, "utf8");
  console.log(`${file}: ${before} → ${after} em-dash`);
  total += before - after;
}
console.log(`TOTAL removed: ${total}`);
