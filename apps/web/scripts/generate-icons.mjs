// Generates the PWA icon set with no image dependencies: renders the Naija
// Brief mark (bottle-green field, danfo-yellow disc, play triangle) to RGBA
// pixels and encodes PNGs using Node's built-in zlib. Run: node scripts/generate-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(OUT, { recursive: true });

const GREEN = [13, 43, 29];
const YELLOW = [255, 196, 45];

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

// Signed distance helpers give us anti-aliased edges (1px soft coverage).
function coverage(dist) {
  return Math.max(0, Math.min(1, 0.5 - dist));
}

function render(size, { rounded }) {
  const buf = Buffer.alloc(size * size * 4);
  const c = size / 2;
  const corner = rounded ? size * 0.22 : 0;
  const discR = (rounded ? 0.3 : 0.26) * size;
  const triR = discR * 0.5;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5;
      const py = y + 0.5;

      // Rounded-square field (transparent outside so the tile mask is clean).
      let fieldDist;
      if (rounded) {
        const qx = Math.abs(px - c) - (c - corner);
        const qy = Math.abs(py - c) - (c - corner);
        const ox = Math.max(qx, 0);
        const oy = Math.max(qy, 0);
        fieldDist =
          Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - corner;
      } else {
        fieldDist = -1; // full-bleed for maskable
      }
      const fieldA = coverage(fieldDist);

      // Yellow disc.
      const discDist = Math.hypot(px - c, py - c) - discR;
      const discA = coverage(discDist);

      // Play triangle knocked into the disc (points right).
      const inTriangle = (() => {
        const ax = c - triR * 0.6;
        const bx = c + triR;
        const ay1 = c - triR;
        const ay2 = c + triR;
        if (px < ax || px > bx) return 0;
        const t = (px - ax) / (bx - ax);
        const halfH = triR * (1 - t);
        return py > c - halfH && py < c + halfH ? 1 : 0;
      })();

      let rgb = GREEN;
      if (discA > 0) rgb = mix(GREEN, YELLOW, discA);
      if (inTriangle) rgb = GREEN;

      const i = (y * size + x) * 4;
      buf[i] = rgb[0];
      buf[i + 1] = rgb[1];
      buf[i + 2] = rgb[2];
      buf[i + 3] = Math.round(fieldA * 255);
    }
  }
  return buf;
}

// --- Minimal PNG encoder (RGBA, 8-bit) ---
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  // Filter 0 (none) prefixed per scanline.
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const targets = [
  { file: "icon-192.png", size: 192, rounded: true },
  { file: "icon-512.png", size: 512, rounded: true },
  { file: "icon-maskable-512.png", size: 512, rounded: false },
  { file: "apple-icon-180.png", size: 180, rounded: true },
];

for (const t of targets) {
  const png = encodePng(t.size, render(t.size, { rounded: t.rounded }));
  writeFileSync(join(OUT, t.file), png);
  console.log(`wrote ${t.file} (${png.length} bytes)`);
}
