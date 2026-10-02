/**
 * Bakes the tileable paper-grain tile used by the `--paper` surface.
 *
 *   bun scripts/generate-paper-texture.ts
 *
 * The output is a 4-bit indexed PNG with a tRNS alpha palette: a transparent
 * grain overlay, not a cream image. The cream comes from `var(--paper)`
 * underneath, so the palette stays a variable swap.
 *
 * Pre-baked rather than a live `feTurbulence` filter: SVG filters are not
 * GPU-accelerated (6-15ms/frame for a 600x400 surface, worse on mobile).
 * See https://bugzilla.mozilla.org/show_bug.cgi?id=1879590
 *
 * Deterministic: fixed seed in, byte-identical file out.
 */

const SIZE = 224;
const SEED = 0x10572e;
const OUT = new URL("../public/textures/paper.png", import.meta.url);

const INK = [0x2b, 0x22, 0x18] as const;
const BLOOM = [0xff, 0xfa, 0xef] as const;
const INK_ALPHA = [0, 4, 8, 13, 19, 27, 36, 46] as const;
const BLOOM_ALPHA = [0, 3, 6, 10, 15, 21, 29, 38] as const;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Value noise on a wrapped lattice, so the tile is seamless in both axes. */
function makeWrappedNoise(
  cols: number,
  rows: number,
  rand: () => number,
): (x: number, y: number) => number {
  const grid = new Float64Array(cols * rows);
  for (let i = 0; i < grid.length; i += 1) grid[i] = rand() * 2 - 1;

  const at = (cx: number, cy: number): number => {
    const v = grid[(cy % rows) * cols + (cx % cols)];
    return v === undefined ? 0 : v;
  };

  return (x, y) => {
    const fx = (x / SIZE) * cols;
    const fy = (y / SIZE) * rows;
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const tx = smoothstep(fx - ix);
    const ty = smoothstep(fy - iy);
    const x0 = ((ix % cols) + cols) % cols;
    const y0 = ((iy % rows) + rows) % rows;
    const x1 = (x0 + 1) % cols;
    const y1 = (y0 + 1) % rows;
    const top = at(x0, y0) * (1 - tx) + at(x1, y0) * tx;
    const bottom = at(x0, y1) * (1 - tx) + at(x1, y1) * tx;
    return top * (1 - ty) + bottom * ty;
  };
}

function buildIndices(): Uint8Array {
  const rand = mulberry32(SEED);
  // Anisotropic lattice: few columns, many rows -> horizontal pulp fibres.
  const fibre = makeWrappedNoise(4, 56, rand);
  const mottle = makeWrappedNoise(7, 7, rand);
  const indices = new Uint8Array(SIZE * SIZE);

  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const speckle = rand() * 2 - 1;
      let n = speckle * 0.64 + fibre(x, y) * 0.2 + mottle(x, y) * 0.16;

      // Sparse pulp inclusions. Sparse enough to stay cheap to compress.
      if (rand() < 0.0022) n = n < 0 ? -1 : -0.92;

      const magnitude = Math.min(1, Math.abs(n));
      // Gamma > 1 biases the histogram hard toward "no change", which keeps
      // the grain subtle and lets Huffman coding shrink the IDAT stream.
      const level = Math.round(Math.pow(magnitude, 1.75) * 7);
      indices[y * SIZE + x] = n < 0 ? level : 8 + level;
    }
  }
  return indices;
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    const entry = CRC_TABLE[(c ^ (bytes[i] ?? 0)) & 0xff];
    c = (entry ?? 0) ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const body = new Uint8Array(4 + data.length);
  for (let i = 0; i < 4; i += 1) body[i] = type.charCodeAt(i);
  body.set(data, 4);

  const out = new Uint8Array(body.length + 8);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(body, 4);
  view.setUint32(out.length - 4, crc32(body));
  return out;
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < bytes.length; i += 1) {
    a = (a + (bytes[i] ?? 0)) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function zlibWrap(raw: Uint8Array<ArrayBuffer>): Uint8Array {
  const deflated = Bun.deflateSync(raw, { level: 9 });
  // Bun may already emit a zlib container; only add one if it is missing.
  const hasHeader =
    deflated.length > 1 &&
    (deflated[0] ?? 0) === 0x78 &&
    ((((deflated[0] ?? 0) << 8) | (deflated[1] ?? 0)) % 31 === 0);
  if (hasHeader) return deflated;

  const out = new Uint8Array(deflated.length + 6);
  out[0] = 0x78;
  out[1] = 0x9c;
  out.set(deflated, 2);
  new DataView(out.buffer).setUint32(out.length - 4, adler32(raw));
  return out;
}

function encodePng(indices: Uint8Array): Uint8Array {
  const stride = SIZE >> 1; // 4bpp, SIZE is even
  const raw = new Uint8Array(SIZE * (stride + 1));

  for (let y = 0; y < SIZE; y += 1) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter: None
    for (let i = 0; i < stride; i += 1) {
      const hi = indices[y * SIZE + i * 2] ?? 0;
      const lo = indices[y * SIZE + i * 2 + 1] ?? 0;
      raw[rowStart + 1 + i] = (hi << 4) | lo;
    }
  }

  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, SIZE);
  ihdrView.setUint32(4, SIZE);
  ihdr[8] = 4; // bit depth
  ihdr[9] = 3; // colour type: indexed
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const plte = new Uint8Array(48);
  const trns = new Uint8Array(16);
  for (let i = 0; i < 8; i += 1) {
    plte.set(INK, i * 3);
    trns[i] = INK_ALPHA[i] ?? 0;
    plte.set(BLOOM, (8 + i) * 3);
    trns[8 + i] = BLOOM_ALPHA[i] ?? 0;
  }

  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("PLTE", plte),
    chunk("tRNS", trns),
    chunk("IDAT", zlibWrap(raw)),
    chunk("IEND", new Uint8Array(0)),
  ];

  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const png = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    png.set(p, offset);
    offset += p.length;
  }
  return png;
}

const png = encodePng(buildIndices());
await Bun.write(OUT, png);
console.log(
  `wrote ${OUT.pathname} — ${SIZE}x${SIZE}, ${png.length} bytes (${(png.length / 1024).toFixed(1)} KB)`,
);
