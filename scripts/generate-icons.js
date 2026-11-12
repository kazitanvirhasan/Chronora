import fs from 'fs';
import zlib from 'zlib';

function crc32(buf) {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const toCrc = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(toCrc), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function generatePNG(width, height, isMaskable = false) {
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);

  const cx = width / 2;
  const cy = height / 2;
  const scale = isMaskable ? 0.72 : 0.88;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter byte: None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;

      // Base background: Slate-950 to Slate-900 gradient
      const t = (x + y) / (width + height);
      let r = Math.round(2 + t * (15 - 2));
      let g = Math.round(6 + t * (23 - 6));
      let b = Math.round(23 + t * (42 - 23));
      let a = 255;

      // Distance from center
      const dx = (x - cx) / (width * scale);
      const dy = (y - cy) / (height * scale);
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Central glowing orb
      if (dist < 0.45) {
        const glow = Math.cos(dist * Math.PI / 0.45) * 0.5 + 0.5;
        r = Math.min(255, r + Math.round(glow * 15));
        g = Math.min(255, g + Math.round(glow * 110));
        b = Math.min(255, b + Math.round(glow * 160));
      }

      // Outer Nexus Ring (radius around 0.32)
      const ringDist = Math.abs(dist - 0.32);
      if (ringDist < 0.035) {
        const ringAlpha = (1 - ringDist / 0.035);
        r = Math.min(255, r + Math.round(ringAlpha * 34));
        g = Math.min(255, g + Math.round(ringAlpha * 211));
        b = Math.min(255, b + Math.round(ringAlpha * 238));
      }

      // 6 Nexus Nodes
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        const nx = 0.32 * Math.cos(angle);
        const ny = 0.32 * Math.sin(angle);
        const nodeDist = Math.hypot(dx - nx, dy - ny);
        if (nodeDist < 0.045) {
          const nodeAlpha = (1 - nodeDist / 0.045);
          r = Math.min(255, r + Math.round(nodeAlpha * 120));
          g = Math.min(255, g + Math.round(nodeAlpha * 230));
          b = 255;
        }
      }

      // Inner Open Book Wings (Geometric)
      const inBookX = Math.abs(dx);
      const inBookY = dy;
      if (inBookX < 0.22 && Math.abs(inBookY) < 0.16) {
        // Curve of page
        const curve = 0.05 * Math.sin((inBookX / 0.22) * Math.PI);
        if (inBookY > -0.12 + curve && inBookY < 0.12 + curve) {
          r = 34;
          g = 211;
          b = 238;
        }
      }

      // Spine & Center Core
      if (Math.abs(dx) < 0.015 && Math.abs(dy) < 0.17) {
        r = 255;
        g = 255;
        b = 255;
      }
      if (dist < 0.04) {
        r = 255;
        g = 255;
        b = 255;
      }
      if (dist < 0.018) {
        r = 2;
        g = 6;
        b = 23;
      }

      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // Deflate
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // No interlace

  const compressed = zlib.deflateSync(rawData, { level: 9 });

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

if (!fs.existsSync('./public')) {
  fs.mkdirSync('./public', { recursive: true });
}

fs.writeFileSync('./public/pwa-192x192.png', generatePNG(192, 192, false));
fs.writeFileSync('./public/pwa-512x512.png', generatePNG(512, 512, false));
fs.writeFileSync('./public/pwa-maskable-512x512.png', generatePNG(512, 512, true));
fs.writeFileSync('./public/apple-touch-icon.png', generatePNG(180, 180, false));
fs.writeFileSync('./public/favicon.ico', generatePNG(64, 64, false));

console.log('All PWA icon assets generated successfully!');
