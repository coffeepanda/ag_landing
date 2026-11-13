// Convert the CC0 "Head of Doryphoros" plaster-cast scan (Draco GLB) into a compact
// display mesh for the Room of Light: int16 positions + uint16 triangle indices.
//
// Source: Zenodo record 21530396, "The head of 'Doryphoros' - a plaster cast",
// Wirtualne Muzea Malopolski, CC0 (also on Sketchfab, model 59c2a8477e0945d7817b61d5088a97fd).
// File used: 59c2a8477e0945d7817b61d5088a97fd_normalized-0.250.glb (md5 e80a7dc8cd5f8733eae6ec617d31fca9).
//
// Decoding uses the Draco decoder bundled with three.js (node_modules). Textures are
// dropped: the page renders the head as plaster lit by the simulated light.
//
// Usage: node tools/export_sculpture.mjs <file.glb> [--height 0.32]

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
// three's package is ESM-typed, so load its CommonJS-style decoder script with an explicit module object.
const decoderPath = resolve(here, '../node_modules/three/examples/jsm/libs/draco/draco_decoder.js')
const decoderModule = { exports: {} }
new Function('module', 'exports', '__filename', '__dirname', 'require', readFileSync(decoderPath, 'utf8'))(
  decoderModule, decoderModule.exports, decoderPath, dirname(decoderPath), require)
const DracoDecoderModule = decoderModule.exports

const file = process.argv[2]
if (!file) throw new Error('usage: node tools/export_sculpture.mjs <file.glb> [--height 0.32]')
const hIdx = process.argv.indexOf('--height')
const HEIGHT = hIdx > 0 ? Number(process.argv[hIdx + 1]) : 0.32
const EXPECTED_MD5 = 'e80a7dc8cd5f8733eae6ec617d31fca9'

const buf = readFileSync(file)
const md5 = createHash('md5').update(buf).digest('hex')
if (md5 !== EXPECTED_MD5) throw new Error(`unexpected file (md5 ${md5}); expected the archived ${EXPECTED_MD5}`)

// ---- GLB container
const jsonLen = buf.readUInt32LE(12)
const gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'))
const binStart = 20 + jsonLen + 8
const bin = buf.subarray(binStart, binStart + buf.readUInt32LE(20 + jsonLen))

const prim = gltf.meshes[0].primitives[0]
const ext = prim.extensions.KHR_draco_mesh_compression
const view = gltf.bufferViews[ext.bufferView]
const draco = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)

// Node transform (matrix or TRS) applied to the mesh.
const node = gltf.nodes.find((n) => n.mesh === 0) ?? {}
const M = node.matrix ?? trs(node.translation ?? [0, 0, 0], node.rotation ?? [0, 0, 0, 1], node.scale ?? [1, 1, 1])

// ---- Draco decode
const D = await DracoDecoderModule()
const decoder = new D.Decoder()
const db = new D.DecoderBuffer()
db.Init(new Int8Array(draco), draco.length)
const mesh = new D.Mesh()
const status = decoder.DecodeBufferToMesh(db, mesh)
if (!status.ok()) throw new Error('draco: ' + status.error_msg())
const nv = mesh.num_points(), nf = mesh.num_faces()
const posAttr = decoder.GetAttributeByUniqueId(mesh, ext.attributes.POSITION)
const pa = new D.DracoFloat32Array()
decoder.GetAttributeFloatForAllPoints(mesh, posAttr, pa)
const pos = new Float32Array(nv * 3)
for (let i = 0; i < nv * 3; i++) pos[i] = pa.GetValue(i)
const fa = new D.DracoInt32Array()
const index = new Uint16Array(nf * 3)
if (nv > 65535) throw new Error('too many vertices for uint16 indices')
for (let f = 0; f < nf; f++) {
  decoder.GetFaceFromMesh(mesh, f, fa)
  index[3 * f] = fa.GetValue(0); index[3 * f + 1] = fa.GetValue(1); index[3 * f + 2] = fa.GetValue(2)
}

// ---- transform (glTF is y-up), then normalise: base on y=0, centred in x/z, life-size height
for (let i = 0; i < nv; i++) {
  const x = pos[3 * i], y = pos[3 * i + 1], z = pos[3 * i + 2]
  pos[3 * i] = M[0] * x + M[4] * y + M[8] * z + M[12]
  pos[3 * i + 1] = M[1] * x + M[5] * y + M[9] * z + M[13]
  pos[3 * i + 2] = M[2] * x + M[6] * y + M[10] * z + M[14]
}
const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]
for (let i = 0; i < nv; i++) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], pos[3 * i + k]); hi[k] = Math.max(hi[k], pos[3 * i + k]) }
const s = HEIGHT / (hi[1] - lo[1])
const c = [(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2]
const ext3 = [(hi[0] - lo[0]) * s, HEIGHT, (hi[2] - lo[2]) * s]
const q = new Int16Array(nv * 3)
for (let i = 0; i < nv; i++)
  for (let k = 0; k < 3; k++) {
    const v = (pos[3 * i + k] - c[k]) * s // metres; y in [0, HEIGHT]
    q[3 * i + k] = Math.round((v / (k === 1 ? HEIGHT : ext3[k] / 2)) * 32767 * (k === 1 ? 1 : 0.999))
  }

const out = resolve(here, '../public/demos/light')
mkdirSync(out, { recursive: true })
writeFileSync(resolve(out, 'sculpture.bin'), Buffer.concat([Buffer.from(q.buffer), Buffer.from(index.buffer)]))
writeFileSync(resolve(out, 'sculpture.json'), JSON.stringify({
  version: 1, vertices: nv, triangles: nf,
  size: ext3.map((v) => +v.toFixed(5)), // metres: x width, y height, z depth (y up, base at 0)
  layout: 'int16 positions (x,z scaled by size/2, y by height) then uint16 indices',
  source: 'Head of Doryphoros, plaster cast; Museum of the Academy of Fine Arts in Krakow; Wirtualne Muzea Malopolski; CC0 (Zenodo 21530396)'
}))
console.log(`sculpture: ${nv} vertices, ${nf} triangles, size ${ext3.map((v) => v.toFixed(3)).join(' x ')} m; node transform ${node.matrix ? 'matrix' : 'TRS'}`)

function trs(t, r, sc) {
  const [x, y, z, w] = r
  const m = [
    1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0,
    2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0,
    2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0,
    t[0], t[1], t[2], 1
  ]
  for (let k = 0; k < 3; k++) for (let j = 0; j < 3; j++) m[4 * k + j] *= sc[k]
  return m
}
