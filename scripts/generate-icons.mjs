// Generates PWA icon PNGs (a chunky LED-scoreboard-style glyph on a dark
// rounded panel) with zero image-library dependencies, using Node's built-in
// zlib for PNG encoding. Run with: node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })

const BG = [11, 15, 20] // near-black panel, matches app theme
const GLOW = [255, 149, 0] // amber LED accent

function crc32(buf) {
  let c
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      t[n] = c
    }
    return t
  })())
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function encodePNG(width, height, rgba) {
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0 // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  const idat = deflateSync(raw, { level: 9 })
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

function setPx(buf, w, x, y, [r, g, b], a = 255) {
  if (x < 0 || y < 0 || x >= w) return
  const i = (y * w + x) * 4
  buf[i] = r
  buf[i + 1] = g
  buf[i + 2] = b
  buf[i + 3] = a
}

function roundedRectMask(x, y, w, h, radius, px, py) {
  const rx = Math.max(px - x, 0)
  const ry = Math.max(py - y, 0)
  const insideX = px >= x && px < x + w
  const insideY = py >= y && py < y + h
  if (!insideX || !insideY) return false
  const cx = Math.min(rx, w - 1 - rx)
  const cy = Math.min(ry, h - 1 - ry)
  if (cx >= radius || cy >= radius) return true
  const dx = radius - cx
  const dy = radius - cy
  return dx * dx + dy * dy <= radius * radius
}

// 7-segment layout for a glowing "S" (same segment pattern as digit "5")
function drawSegmentGlyph(buf, size, maskable) {
  const scale = maskable ? 0.5 : 0.62 // maskable icons need extra safe-zone padding
  const gw = size * scale
  const gh = gw * 1.55
  const gx = (size - gw) / 2
  const gy = (size - gh) / 2
  const t = gw * 0.22 // segment thickness

  const segments = []
  const addH = (cx, cy, w) => segments.push({ cx, cy, w, h: t, horiz: true })
  const addV = (cx, cy, h) => segments.push({ cx, cy, w: t, h, horiz: false })

  const midY = gy + gh / 2
  addH(gx + gw / 2, gy + t / 2, gw) // a: top
  addV(gx + t / 2, gy + gh * 0.27, gh * 0.46) // f: top-left
  addH(gx + gw / 2, midY, gw) // g: middle
  addV(gx + gw - t / 2, gy + gh * 0.73, gh * 0.46) // c: bottom-right
  addH(gx + gw / 2, gy + gh - t / 2, gw) // d: bottom

  for (let py = Math.floor(gy - t); py < Math.ceil(gy + gh + t); py++) {
    for (let px = Math.floor(gx - t); px < Math.ceil(gx + gw + t); px++) {
      for (const s of segments) {
        const halfW = s.horiz ? s.w / 2 : s.h / 2
        const withinLong = s.horiz ? Math.abs(px - s.cx) <= s.w / 2 : Math.abs(py - s.cy) <= s.h / 2
        const withinShort = s.horiz ? Math.abs(py - s.cy) <= t / 2 : Math.abs(px - s.cx) <= t / 2
        void halfW
        if (withinLong && withinShort) {
          setPx(buf, size, px, py, GLOW)
          break
        }
      }
    }
  }
}

function renderIcon(size, { maskable = false } = {}) {
  const buf = Buffer.alloc(size * size * 4)
  const radius = maskable ? 0 : size * 0.22
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const inPanel = maskable || roundedRectMask(0, 0, size, size, radius, x, y)
      setPx(buf, size, x, y, BG, inPanel ? 255 : 0)
    }
  }
  drawSegmentGlyph(buf, size, maskable)
  return buf
}

const targets = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'maskable-512.png', size: 512, maskable: true },
  { name: 'apple-touch-icon.png', size: 180 },
]

for (const t of targets) {
  const buf = renderIcon(t.size, { maskable: t.maskable })
  writeFileSync(join(outDir, t.name), encodePNG(t.size, t.size, buf))
  console.log(`wrote ${t.name}`)
}
