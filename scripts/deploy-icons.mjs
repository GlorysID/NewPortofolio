import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

// Helper to create valid ICO file containing PNG streams (modern standard ICO format)
async function createIco(pngBuffers, outPath) {
  // ICO Header: 2 bytes reserved (0), 2 bytes type (1 for icon), 2 bytes count
  const count = pngBuffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // icon type
  header.writeUInt16LE(count, 4); // number of images

  const dirEntries = [];
  let offset = 6 + count * 16;

  for (const { buffer, size } of pngBuffers) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size === 256 ? 0 : size, 0); // width
    entry.writeUInt8(size === 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // color palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bpp
    entry.writeUInt32LE(buffer.length, 8); // image size
    entry.writeUInt32LE(offset, 12); // offset
    dirEntries.push(entry);
    offset += buffer.length;
  }

  const icoBuffer = Buffer.concat([
    header,
    ...dirEntries,
    ...pngBuffers.map(p => p.buffer)
  ]);

  fs.writeFileSync(outPath, icoBuffer);
  console.log(`Generated ${outPath} (${icoBuffer.length} bytes)`);
}

// Master icon buffer
const masterBuf = fs.readFileSync('scripts/master-icon-512.png');
const letterBuf = fs.readFileSync('scripts/extracted-letter.png');

// 1. Output app/icon.png (512x512)
fs.copyFileSync('scripts/master-icon-512.png', 'app/icon.png');
console.log('Saved app/icon.png');

// 2. Output app/apple-icon.png (180x180)
await sharp(masterBuf)
  .resize(180, 180)
  .png({ quality: 100 })
  .toFile('app/apple-icon.png');
console.log('Saved app/apple-icon.png');

// 3. Output public/favicon.ico with 16, 32, 48 sizes
const [p16, p32, p48] = await Promise.all([
  sharp(masterBuf).resize(16, 16).png().toBuffer(),
  sharp(masterBuf).resize(32, 32).png().toBuffer(),
  sharp(masterBuf).resize(48, 48).png().toBuffer(),
]);

await createIco([
  { size: 16, buffer: p16 },
  { size: 32, buffer: p32 },
  { size: 48, buffer: p48 },
], 'public/favicon.ico');

// Also place in app/favicon.ico
fs.copyFileSync('public/favicon.ico', 'app/favicon.ico');
console.log('Saved app/favicon.ico');

// 4. Output public/favicon.png
await sharp(masterBuf).resize(32, 32).png().toFile('public/favicon.png');
console.log('Saved public/favicon.png');

// 5. Output app/icon.svg
// Base64 encoded letter image for vector container
const letterBase64 = letterBuf.toString('base64');
const letterMeta = await sharp(letterBuf).metadata();
const targetLetterWidth = 268;
const targetLetterHeight = Math.round(targetLetterWidth * (letterMeta.height / letterMeta.width));
const letterLeft = Math.round(256 - targetLetterWidth / 2 + 3);
const letterTop = Math.round(256 - targetLetterHeight / 2 - 2);

const iconSvg = `<!-- Generated HD Tab Favicon for Anjali Saputra Portfolio -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <!-- Crisp white circle with subtle luxury border -->
  <circle cx="256" cy="256" r="246" fill="#FFFFFF" stroke="#C8C6C0" stroke-width="4" />
  <circle cx="256" cy="256" r="230" fill="none" stroke="#E2E0DB" stroke-width="2.5" />
  <!-- Elegant Calligraphic Script Monogram A -->
  <image href="data:image/png;base64,${letterBase64}" x="${letterLeft}" y="${letterTop}" width="${targetLetterWidth}" height="${targetLetterHeight}" />
</svg>
`;

fs.writeFileSync('app/icon.svg', iconSvg.trim() + '\n', 'utf8');
console.log('Saved app/icon.svg');
