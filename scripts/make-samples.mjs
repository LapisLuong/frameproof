// Generates the two sample posters used by the sample project and the end-to-end tests.
// Original artwork made for FrameProof; no third-party imagery. Run: npm run samples
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const out = new URL("../public/samples/", import.meta.url);
await mkdir(out, { recursive: true });

// Reference: ISO A proportions, warm paper, one red block, large serif title, generous space.
const reference = `
<svg xmlns="http://www.w3.org/2000/svg" width="1240" height="1754" viewBox="0 0 1240 1754">
  <rect width="1240" height="1754" fill="#F4F1EA"/>
  <rect x="96" y="96" width="1048" height="760" fill="#C65A42"/>
  <text x="140" y="560" font-family="Lora" font-weight="600" font-size="188" fill="#F4F1EA" letter-spacing="-4">Chợ Đêm</text>
  <text x="140" y="760" font-family="Lora" font-style="italic" font-size="150" fill="#F4F1EA">Sinh Viên</text>
  <text x="140" y="1040" font-family="Lora" font-size="64" fill="#1F2121">Thứ Bảy, 23 tháng 11</text>
  <text x="140" y="1130" font-family="Lora" font-size="64" fill="#1F2121">18:00 – 23:00</text>
  <line x1="140" y1="1220" x2="560" y2="1220" stroke="#1F2121" stroke-width="3"/>
  <text x="140" y="1300" font-family="Be Vietnam Pro, sans-serif" font-size="40" fill="#1F2121">Sân trung tâm, Ký túc xá khu B</text>
  <text x="140" y="1360" font-family="Be Vietnam Pro, sans-serif" font-size="40" fill="#1F2121">Ẩm thực, đồ thủ công, nhạc sống</text>
  <text x="140" y="1620" font-family="Be Vietnam Pro, sans-serif" font-size="30" fill="#5E605A">CLB Thiết kế — vào cửa tự do</text>
</svg>`;

// Current: 4:5 social format, smaller title, grey-on-grey copy, a new teal colour, busier lower half.
const rows = Array.from({ length: 9 }, (_, i) => `<rect x="80" y="${760 + i * 52}" width="${560 + ((i * 97) % 300)}" height="18" fill="#9C9A94"/>`).join("");
const dots = Array.from({ length: 40 }, (_, i) => `<circle cx="${120 + (i % 10) * 92}" cy="${1250 + Math.floor(i / 10) * 26}" r="7" fill="#2E8C8C"/>`).join("");
const current = `
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <rect width="1080" height="1350" fill="#E9E7E2"/>
  <rect x="0" y="0" width="1080" height="250" fill="#2E8C8C"/>
  <text x="80" y="170" font-family="Be Vietnam Pro, sans-serif" font-weight="600" font-size="76" fill="#E9E7E2">Chợ Đêm Sinh Viên</text>
  <rect x="80" y="330" width="920" height="360" fill="#C9C6BF"/>
  <rect x="80" y="330" width="300" height="360" fill="#C65A42"/>
  <text x="420" y="470" font-family="Be Vietnam Pro, sans-serif" font-size="44" fill="#8E8C86">Thứ Bảy 23/11</text>
  <text x="420" y="540" font-family="Be Vietnam Pro, sans-serif" font-size="44" fill="#8E8C86">18:00 – 23:00</text>
  <text x="420" y="610" font-family="Be Vietnam Pro, sans-serif" font-size="32" fill="#8E8C86">Sân trung tâm, KTX khu B</text>
  ${rows}
  ${dots}
</svg>`;

for (const [name, svg] of [
  ["reference-poster.png", reference],
  ["current-poster.png", current],
]) {
  const info = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(new URL(name, out).pathname);
  process.stdout.write(`${name} ${info.width}x${info.height} ${(info.size / 1024).toFixed(0)} KB\n`);
}
