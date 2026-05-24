// Minimal in-browser ZIP encoder. STORE method only (no compression), no deps.
// Bundles are already small (capped at 4.5 MB by lib/bundle.ts), so the size
// savings of DEFLATE are not worth pulling in a library or wiring up
// CompressionStream for the Phase C download.
//
// Spec references: PKWARE APPNOTE.TXT
//   4.3.6  Local File Header
//   4.3.12 Central Directory Header
//   4.3.16 End of Central Directory Record
//
// Safe to import from a "use client" component.

const CRC32_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c = CRC32_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(d: Date): { date: number; time: number } {
  const year = Math.max(1980, d.getFullYear()) - 1980;
  const date = (year << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const time =
    (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >>> 1);
  return { date, time };
}

export type ZipEntry = { path: string; data: Uint8Array };

export function buildZip(entries: ZipEntry[]): Uint8Array {
  const { date, time } = dosDateTime(new Date());
  const localParts: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const e of entries) {
    const name = new TextEncoder().encode(e.path);
    const crc = crc32(e.data);
    const size = e.data.length;

    const lfh = new Uint8Array(30 + name.length);
    const lv = new DataView(lfh.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, time, true);
    lv.setUint16(12, date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true);
    lfh.set(name, 30);
    localParts.push(lfh, e.data);

    const cdh = new Uint8Array(46 + name.length);
    const cv = new DataView(cdh.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, time, true);
    cv.setUint16(14, date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, name.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    cdh.set(name, 46);
    centrals.push(cdh);

    offset += lfh.length + e.data.length;
  }

  const cdSize = centrals.reduce((n, c) => n + c.length, 0);
  const cdOffset = offset;

  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, cdOffset, true);
  ev.setUint16(20, 0, true);

  const totalLen =
    localParts.reduce((n, p) => n + p.length, 0) + cdSize + eocd.length;
  const out = new Uint8Array(totalLen);
  let cursor = 0;
  for (const p of localParts) {
    out.set(p, cursor);
    cursor += p.length;
  }
  for (const c of centrals) {
    out.set(c, cursor);
    cursor += c.length;
  }
  out.set(eocd, cursor);
  return out;
}
