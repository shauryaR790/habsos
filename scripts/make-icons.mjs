import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcBuf]);
}

function isSand(nx, ny) {
  const dune = 0.62 + Math.sin(nx * Math.PI * 1.7) * 0.1 + Math.sin(nx * Math.PI * 3.4 + 0.6) * 0.045;
  const far = 0.5 + Math.sin(nx * Math.PI * 2.2 + 1.2) * 0.06;
  return ny > dune || (ny > far && ny < far + 0.035);
}

function png(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const ny = y / size;
      const sand = isSand(nx, ny);
      const o = row + 1 + x * 4;
      if (sand) {
        raw[o] = 231;
        raw[o + 1] = 213;
        raw[o + 2] = 187;
      } else {
        raw[o] = 61;
        raw[o + 1] = 42;
        raw[o + 2] = 28;
      }
      raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const dir = path.resolve('public/icons');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'icon-192.png'), png(192));
fs.writeFileSync(path.join(dir, 'icon-512.png'), png(512));
console.log('wrote icons');
