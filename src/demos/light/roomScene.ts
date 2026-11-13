import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import type { Face, Room, Sculpture } from './data'
import { buildRainbow, LMAX, LMIN, makeWindow, spectralTable, type RainbowBuild } from './rainbow'

const toThree = (x: number, y: number, z: number, out = new THREE.Vector3()) => out.set(x, z, -y)
const GAIN = 0.3 // display: W/m^2 -> linear radiance for the sculpture and pedestal
const SURFACE = 0.48 // display: room surfaces get a softer share, so the rainbow doesn't glare
const DEFAULT_TILT = 40
const PEDESTAL = { half: 0.15, height: 1.0 }

/**
 * The room, cut open like a dollhouse. A tall narrow window high on the far wall,
 * tilted down, carries the simulated grating; sunlight meets it straight on.
 * Room surfaces get continuous-spectrum ribbons traced to their first landing;
 * the sculpture and pedestal are lit per pixel by the same spectrum and efficiencies.
 */
export class RoomScene {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private world = new THREE.Group()
  private camera = new THREE.PerspectiveCamera(32, 1, 0.05, 80)
  private composer: EffectComposer
  private bloom: UnrealBloomPass
  private raf = 0
  private last = performance.now()
  private t = 0
  private width = 1
  private height = 1
  private ro: ResizeObserver
  private target = new THREE.Vector3()
  private orbit = { az: -Math.PI / 2 - 0.42, el: 0.42, d: 8.2 }
  private orbitGoal = { az: -Math.PI / 2 - 0.42, el: 0.42, d: 8.2 }
  private inset = { r: 0, b: 0 }
  private insetTarget = { r: 0, b: 0 }

  private shared = {
    uSel: { value: -1 },
    uSelAmt: { value: 0 },
    uReveal: { value: LMIN - 30 },
    uGain: { value: GAIN },
    uSurface: { value: SURFACE },
    uTime: { value: 0 },
    uShow: { value: 1 }
  }
  private beam = {
    uC: { value: new THREE.Vector3() },
    uN: { value: new THREE.Vector3() },
    uA: { value: new THREE.Vector3() },
    uG: { value: new THREE.Vector3() },
    uL: { value: 0.6 },
    uW: { value: 0.02 },
    uP: { value: 1000 },
    uSpec: { value: null as THREE.DataTexture | null },
    uZero: { value: new THREE.Vector3() },
    uToRoom: { value: new THREE.Matrix4() } // three world -> room frame (z up)
  }
  private selGoal = -1
  private ribbons: THREE.Mesh
  private rays: THREE.LineSegments
  private slit: THREE.Mesh
  private occluders: Face[] = []
  private tilt = DEFAULT_TILT

  constructor(
    private canvas: HTMLCanvasElement,
    private room: Room,
    private sculpture: Sculpture | null,
    private opts: { reducedMotion: boolean; onBuild?: (b: RainbowBuild) => void }
  ) {
    const coarse = window.matchMedia('(pointer: coarse)').matches
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarse ? 1.75 : 2))
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.scene.background = new THREE.Color(0x020202)
    this.world.rotation.x = -Math.PI / 2
    this.scene.add(this.world)
    this.world.updateMatrixWorld()
    this.beam.uToRoom.value.copy(this.world.matrixWorld).invert()

    const [L, W, H] = room.size
    this.target.copy(toThree(L * 0.52, W * 0.5, H * 0.36))

    for (const f of room.faces) {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(2 * f.half[0]!, 2 * f.half[1]!),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(...(room.materials[f.material] ?? [0.5, 0.5, 0.5])), roughness: 0.95 })
      )
      mesh.matrixAutoUpdate = false
      mesh.matrix.copy(basis(f.origin, f.u, f.v, f.normal))
      this.world.add(mesh)
    }
    const box = new THREE.Box3Helper(new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(L, W, H)), new THREE.Color(0xd9b98a))
    ;(box.material as THREE.LineBasicMaterial).transparent = true
    ;(box.material as THREE.LineBasicMaterial).opacity = 0.12
    this.world.add(box)
    this.scene.add(new THREE.HemisphereLight(0x9aa4b0, 0x1a120c, 0.62))

    // Spectral table for per-pixel lighting (rgb * source * efficiency per nm, orders -2..2).
    const input = 1000 * room.window.width * room.window.height
    const tab = spectralTable(room, input)
    const half = new Uint16Array(tab.data.length)
    for (let i = 0; i < half.length; i++) half[i] = THREE.DataUtils.toHalfFloat(tab.data[i]!)
    const spec = new THREE.DataTexture(half, tab.n, 5, THREE.RGBAFormat, THREE.HalfFloatType)
    spec.magFilter = spec.minFilter = THREE.LinearFilter
    spec.needsUpdate = true
    this.beam.uSpec.value = spec
    const dl = (LMAX - LMIN) / tab.n
    const zero = [0, 0, 0]
    for (let i = 0; i < tab.n; i++) for (let c = 0; c < 3; c++) zero[c]! += tab.data[4 * (2 * tab.n + i) + c]! * dl
    this.beam.uZero.value.set(zero[0]!, zero[1]!, zero[2]!)
    this.beam.uP.value = room.period * 1e9
    this.beam.uL.value = room.window.width
    this.beam.uW.value = room.window.height

    // ---- the sculpture on its pedestal, in the +1 order's path
    if (sculpture) this.addSculpture(sculpture)

    // ---- window slit (glowing), ribbons and rays: rebuilt when the sun height changes
    this.slit = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.2, 2.0), toneMapped: false, side: THREE.DoubleSide }))
    this.slit.matrixAutoUpdate = false
    this.world.add(this.slit)

    this.ribbons = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2,
      uniforms: this.shared,
      vertexShader: `
        attribute vec3 tint; attribute float energy; attribute float lam;
        uniform float uSel; uniform float uSelAmt; uniform float uReveal; uniform float uGain; uniform float uSurface;
        varying vec3 vCol;
        float mask(float l) {
          float m = mix(1.0, mix(0.04, 1.0, exp(-pow((l - uSel) / 16.0, 2.0))), uSelAmt);
          return m * smoothstep(uReveal, uReveal - 25.0, l);
        }
        void main() {
          vCol = tint * energy * uGain * uSurface * mask(lam);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `varying vec3 vCol; void main() { gl_FragColor = vec4(vCol, 1.0); }`
    }))
    this.world.add(this.ribbons)

    this.rays = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: this.shared,
      vertexShader: `
        attribute vec3 tint; attribute float s; attribute float lam; attribute float phase;
        uniform float uSel; uniform float uSelAmt; uniform float uReveal;
        varying vec3 vCol; varying float vS; varying float vPhase; varying float vM;
        void main() {
          float m = mix(1.0, mix(0.03, 1.0, exp(-pow((lam - uSel) / 16.0, 2.0))), uSelAmt);
          vM = m * smoothstep(uReveal, uReveal - 25.0, lam);
          vCol = tint; vS = s; vPhase = phase;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform float uTime; uniform float uShow;
        varying vec3 vCol; varying float vS; varying float vPhase; varying float vM;
        void main() {
          float p = fract(uTime * 0.18 - vS + vPhase);
          float pulse = smoothstep(0.0, 0.03, p) * (1.0 - smoothstep(0.03, 0.16, p));
          gl_FragColor = vec4(vCol * (0.02 + 0.32 * pulse) * vM * uShow, 1.0);
        }`
    }))
    this.rays.frustumCulled = false
    this.world.add(this.rays)

    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.36, 0.5, 0.55)
    this.composer.addPass(this.bloom)
    this.composer.addPass(new OutputPass())

    this.setTilt(DEFAULT_TILT)
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(canvas.parentElement ?? canvas)
    this.resize()
    if (opts.reducedMotion) this.shared.uReveal.value = LMAX + 40
    this.raf = requestAnimationFrame(this.frame)
  }

  // ---------------------------------------------------------------- controls

  /** Show one simulated band's colour (index) or all (null). */
  setBand(band: number | null) {
    this.selGoal = band === null ? -1 : this.room.bands[band]!.nm
    if (band !== null) this.shared.uSel.value = this.selGoal
  }

  setRays(on: boolean) {
    this.shared.uShow.value = on ? 1 : 0
  }

  /** Sun height = window tilt: light always meets the grating straight on. */
  setTilt(deg: number) {
    this.tilt = deg
    const b = buildRainbow(this.room, deg, this.occluders)
    const w = b.window
    this.beam.uC.value.set(...w.center)
    this.beam.uN.value.set(...w.n)
    this.beam.uA.value.set(...w.a)
    this.beam.uG.value.set(...w.g)
    this.slit.matrix.copy(basis(w.center, w.g, w.a, w.n)).multiply(new THREE.Matrix4().makeScale(w.width, w.length, 1))

    const rg = new THREE.BufferGeometry()
    rg.setAttribute('position', new THREE.BufferAttribute(b.ribbons.pos, 3))
    rg.setAttribute('tint', new THREE.BufferAttribute(b.ribbons.tint, 3))
    rg.setAttribute('energy', new THREE.BufferAttribute(b.ribbons.energy, 1))
    rg.setAttribute('lam', new THREE.BufferAttribute(b.ribbons.lam, 1))
    rg.setIndex(new THREE.BufferAttribute(b.ribbons.index, 1))
    this.ribbons.geometry.dispose()
    this.ribbons.geometry = rg

    const ray = new THREE.BufferGeometry()
    ray.setAttribute('position', new THREE.BufferAttribute(b.rays.pos, 3))
    ray.setAttribute('tint', new THREE.BufferAttribute(b.rays.tint, 3))
    ray.setAttribute('s', new THREE.BufferAttribute(b.rays.s, 1))
    ray.setAttribute('lam', new THREE.BufferAttribute(b.rays.lam, 1))
    ray.setAttribute('phase', new THREE.BufferAttribute(b.rays.phase, 1))
    this.rays.geometry.dispose()
    this.rays.geometry = ray
    this.opts.onBuild?.(b)
  }

  orbitBy(dx: number, dy: number) {
    this.orbitGoal.az -= dx * 0.005
    this.orbitGoal.el = Math.max(0.05, Math.min(1.25, this.orbitGoal.el + dy * 0.004))
  }

  zoomBy(f: number) {
    this.orbitGoal.d = Math.max(3.2, Math.min(13, this.orbitGoal.d * f))
  }

  setInset(right: number, bottom: number) {
    this.insetTarget = { r: Math.max(0, right), b: Math.max(0, bottom) }
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    this.ro.disconnect()
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh
      m.geometry?.dispose()
      const mat = m.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
      else mat?.dispose()
    })
    this.beam.uSpec.value?.dispose()
    this.composer.dispose()
    this.renderer.dispose()
  }

  // ---------------------------------------------------------------- sculpture

  private addSculpture(s: Sculpture) {
    // Place it in the +1 order's path for the default sun height, ~1.7 m from the window.
    const w = makeWindow(this.room, DEFAULT_TILT)
    const sn = 555 / (this.room.period * 1e9), cn = Math.sqrt(1 - sn * sn)
    const d = [cn * w.n[0] + sn * w.g[0], cn * w.n[1] + sn * w.g[1], cn * w.n[2] + sn * w.g[2]]
    const at = [w.center[0] + 1.7 * d[0]!, w.center[1] + 1.7 * d[1]!, 0]
    const top = PEDESTAL.height
    const ph = PEDESTAL.half

    const plaster = (color: number) => {
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85 })
      mat.onBeforeCompile = (sh) => this.beamLighting(sh)
      return mat
    }
    const ped = new THREE.Mesh(new THREE.BoxGeometry(2 * ph, 2 * ph, top), plaster(0x8a8580))
    ped.position.set(at[0]!, at[1]!, top / 2)
    this.world.add(ped)
    this.occluders = boxFaces('pedestal', [at[0]! - ph, at[1]! - ph, 0], [at[0]! + ph, at[1]! + ph, top])

    const g = new THREE.BufferGeometry()
    // Scan is y-up; the room frame is z-up: (x, y, z)_scan -> (x, -z, y)_room.
    const p = new Float32Array(s.positions.length)
    for (let i = 0; i < p.length; i += 3) {
      p[i] = s.positions[i]!
      p[i + 1] = -s.positions[i + 2]!
      p[i + 2] = s.positions[i + 1]!
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3))
    g.setIndex(new THREE.BufferAttribute(s.index, 1))
    g.computeVertexNormals()
    const head = new THREE.Mesh(g, plaster(0xd8d0c4))
    head.position.set(at[0]!, at[1]!, top)
    head.rotation.z = -Math.PI / 3 // face turned toward the window side, three-quarters to the camera
    this.world.add(head)
  }

  /** Per-pixel continuous-spectrum light from the slit, added as emitted radiance. */
  private beamLighting(sh: THREE.WebGLProgramParametersWithUniforms) {
    Object.assign(sh.uniforms, this.beam, this.shared)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRoom; varying vec3 vRoomN; uniform mat4 uToRoom;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRoom = (uToRoom * modelMatrix * vec4(position, 1.0)).xyz;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvRoomN = normalize(mat3(uToRoom) * mat3(modelMatrix) * objectNormal);')
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vRoom; varying vec3 vRoomN;
        uniform vec3 uC; uniform vec3 uN; uniform vec3 uA; uniform vec3 uG;
        uniform float uL; uniform float uW; uniform float uP;
        uniform sampler2D uSpec; uniform vec3 uZero;
        uniform float uSel; uniform float uSelAmt; uniform float uReveal; uniform float uGain;
        vec3 spec(int row, float l) { return texture2D(uSpec, vec2((l - 400.0) / 300.0, (float(row) + 0.5) / 5.0)).rgb; }
        float lmask(float l) {
          float m = mix(1.0, mix(0.04, 1.0, exp(-pow((l - uSel) / 16.0, 2.0))), uSelAmt);
          return m * smoothstep(uReveal, uReveal - 25.0, l);
        }
        // Irradiance (rgb-weighted W/m^2) at x with normal nn. For each order, the slit's width
        // admits a narrow wavelength interval, found exactly from the grating equation.
        vec3 beam(vec3 x, vec3 nn) {
          vec3 r = x - uC;
          float rn = dot(r, uN);
          if (rn <= 0.0) return vec3(0.0);
          float ra = dot(r, uA), rg = dot(r, uG);
          float along = 1.0 - smoothstep(0.5 * uL - 0.006, 0.5 * uL + 0.006, abs(ra));
          vec3 E = vec3(0.0);
          float in0 = 1.0 - smoothstep(0.5 * uW - 0.002, 0.5 * uW + 0.002, abs(rg));
          vec3 z0 = mix(uZero * clamp((uReveal - 400.0) / 300.0, 0.0, 1.0), spec(2, uSel) * 32.0, uSelAmt);
          E += z0 * in0 * max(0.0, dot(nn, -uN)) / (uL * uW);
          for (int k = 0; k < 5; k++) {
            if (k == 2) continue;
            float m = float(k - 2);
            float t1 = (rg - 0.5 * uW) / rn, t2 = (rg + 0.5 * uW) / rn;
            float l1 = uP * (t1 / sqrt(1.0 + t1 * t1)) / m, l2 = uP * (t2 / sqrt(1.0 + t2 * t2)) / m;
            float la = max(min(l1, l2), 400.0), lb = min(max(l1, l2), 700.0);
            if (lb <= la) continue;
            float lm = 0.5 * (la + lb);
            float sm = m * lm / uP, cm = sqrt(max(1e-4, 1.0 - sm * sm));
            vec3 d = cm * uN + sm * uG;
            E += spec(k, lm) * (lb - la) * lmask(lm) * max(0.0, dot(nn, -d)) / (cm * uL * uW);
          }
          return E * along;
        }`
      )
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * beam(vRoom, normalize(vRoomN)) * uGain;'
      )
  }

  // ---------------------------------------------------------------- frame

  private frame = () => {
    this.raf = requestAnimationFrame(this.frame)
    const now = performance.now()
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    this.t += dt
    this.shared.uTime.value = this.t
    // Colours arrive blue to red, then follow the selection.
    this.shared.uReveal.value = Math.min(LMAX + 40, this.shared.uReveal.value + dt * 120)
    const goal = this.selGoal < 0 ? 0 : 1
    this.shared.uSelAmt.value += (goal - this.shared.uSelAmt.value) * Math.min(1, dt * 6)

    if (!this.opts.reducedMotion) this.orbitGoal.az += dt * 0.012
    const k = 1 - Math.pow(0.004, dt)
    this.orbit.az += (this.orbitGoal.az - this.orbit.az) * k
    this.orbit.el += (this.orbitGoal.el - this.orbit.el) * k
    this.orbit.d += (this.orbitGoal.d - this.orbit.d) * k
    const { az, el, d } = this.orbit
    this.camera.position.copy(this.target).add(toThree(d * Math.cos(el) * Math.cos(az), d * Math.cos(el) * Math.sin(az), d * Math.sin(el)))
    this.camera.lookAt(this.target)

    const dr = this.insetTarget.r - this.inset.r
    const db = this.insetTarget.b - this.inset.b
    if (dr !== 0 || db !== 0) {
      const kk = this.opts.reducedMotion || (Math.abs(dr) <= 0.5 && Math.abs(db) <= 0.5) ? 1 : 0.12
      this.inset.r += dr * kk
      this.inset.b += db * kk
      this.applyView()
    }
    this.composer.render()
  }

  private resize() {
    const el = this.canvas.parentElement ?? this.canvas
    this.width = Math.max(1, el.clientWidth)
    this.height = Math.max(1, el.clientHeight)
    this.renderer.setSize(this.width, this.height, false)
    this.composer.setPixelRatio(this.renderer.getPixelRatio())
    this.composer.setSize(this.width, this.height)
    this.bloom.resolution.set(this.width / 2, this.height / 2)
    this.applyView()
  }

  private applyView() {
    const { width: w, height: h, inset } = this
    this.camera.aspect = w / h
    const fitAspect = Math.max(0.35, (w - inset.r) / h)
    this.camera.fov = fitAspect < 0.8 ? 66 + 20 * (inset.b / h) : fitAspect < 1.2 ? 40 : 32
    if (inset.r > 0.5 || inset.b > 0.5) this.camera.setViewOffset(w, h, inset.r / 2, inset.b * 0.45, w, h)
    else this.camera.clearViewOffset()
    this.camera.updateProjectionMatrix()
  }
}

function basis(o: number[], u: number[], v: number[], n: number[]) {
  return new THREE.Matrix4().set(
    u[0]!, v[0]!, n[0]!, o[0]!,
    u[1]!, v[1]!, n[1]!, o[1]!,
    u[2]!, v[2]!, n[2]!, o[2]!,
    0, 0, 0, 1
  )
}

/** Outward faces of an axis-aligned box, in the same form as the room's faces. */
function boxFaces(name: string, lo: number[], hi: number[]): Face[] {
  const faces: Face[] = []
  const c = [0, 1, 2].map((k) => (lo[k]! + hi[k]!) / 2)
  for (let axis = 0; axis < 3; axis++) {
    const u = [0, 0, 0]; u[(axis + 1) % 3] = 1
    for (const side of [0, 1]) {
      const n = [0, 0, 0]; n[axis] = side ? 1 : -1
      const v = [n[1]! * u[2]! - n[2]! * u[1]!, n[2]! * u[0]! - n[0]! * u[2]!, n[0]! * u[1]! - n[1]! * u[0]!]
      const o = [...c]; o[axis] = side ? hi[axis]! : lo[axis]!
      const span = [0, 1, 2].map((k) => (hi[k]! - lo[k]!) / 2)
      faces.push({ name: `${name}_${axis}_${side}`, material: 'plaster', origin: o, normal: n, u, v: v.map(Math.abs), half: [span[(axis + 1) % 3]!, span[(axis + 2) % 3]!] })
    }
  }
  return faces
}
