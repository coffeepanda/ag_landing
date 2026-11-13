import * as THREE from 'three'
import type { Band, Wave } from './data'

const NB = 7
const F0 = 0.55 // display oscillation (Hz) at 555 nm; real light is ~5.4e14 Hz

export type WaveHud = { x: number; y: number; label: string }[]

/**
 * The grating up close. The field is the saved RCWA solution for TE light (E along
 * the grooves): Re(Ey * exp(-i w t)) over one period, tiled sideways. Silica is
 * below (light enters from there), the ridged layer in the middle, air above.
 */
export class WaveScene {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10)
  private raf = 0
  private last = performance.now()
  private t = 0
  private width = 1
  private height = 1
  private ro: ResizeObserver
  private mat: THREE.ShaderMaterial
  private tex: THREE.DataTexture
  private orders = new THREE.Group()
  private inset = { r: 0, b: 0 }
  private insetTarget = { r: 0, b: 0 }
  private mode = -1 // -1 = white light, else band index
  private z0: number
  private z1: number
  private P: number
  private d: number

  constructor(
    private canvas: HTMLCanvasElement,
    private wave: Wave,
    private bands: Band[],
    private opts: { reducedMotion: boolean; onHud?: (hud: WaveHud) => void }
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.scene.background = new THREE.Color(0x020203)

    const m = wave.meta
    const um = 1e6
    this.P = m.period * um
    this.d = m.depth * um
    this.z0 = m.z[0] * um
    this.z1 = m.z[1] * um

    // Field texture: width nx (one period), height nz * bands, RG = Re, Im (half float, filterable).
    const n = m.nx * m.nz * NB
    const data = new Uint16Array(n * 2)
    for (let i = 0; i < n * 2; i++) data[i] = THREE.DataUtils.toHalfFloat(wave.field[i]! * m.scale)
    this.tex = new THREE.DataTexture(data, m.nx, m.nz * NB, THREE.RGFormat, THREE.HalfFloatType)
    this.tex.wrapS = THREE.RepeatWrapping
    this.tex.wrapT = THREE.ClampToEdgeWrapping
    this.tex.magFilter = this.tex.minFilter = THREE.LinearFilter
    this.tex.needsUpdate = true

    const omega = m.bands.map((b) => 2 * Math.PI * F0 * (555 / b.nm))
    const colors = bands.map((b) => new THREE.Vector3(...b.rgb))
    let amp = 0
    for (let i = 0; i < n; i++) amp = Math.max(amp, Math.hypot(wave.field[2 * i]!, wave.field[2 * i + 1]!) * m.scale)

    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uTex: { value: this.tex },
        uTime: { value: 0 },
        uMode: { value: -1 },
        uOmega: { value: omega },
        uColor: { value: colors },
        uAmp: { value: amp },
        uP: { value: this.P },
        uD: { value: this.d },
        uFill: { value: m.fill },
        uZ: { value: new THREE.Vector2(this.z0, this.z1) },
        uNz: { value: m.nz }
      },
      vertexShader: `
        varying vec2 vPos;
        void main() {
          vPos = (modelMatrix * vec4(position, 1.0)).xy; // world units: x and z in micrometres
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        #define NB ${NB}
        uniform sampler2D uTex; uniform float uTime; uniform int uMode;
        uniform float uOmega[NB]; uniform vec3 uColor[NB]; uniform float uAmp;
        uniform float uP; uniform float uD; uniform float uFill; uniform vec2 uZ; uniform float uNz;
        varying vec2 vPos;

        vec2 field(int b, float u, float v) {
          float row = clamp(v * uNz, 0.5, uNz - 0.5);
          return texture2D(uTex, vec2(u, (float(b) * uNz + row) / (uNz * float(NB)))).rg;
        }

        void main() {
          float x = vPos.x, z = vPos.y;
          float u = fract(x / uP + 0.5);
          float v = (z - uZ.x) / (uZ.y - uZ.x);
          vec3 col = vec3(0.0);
          if (v >= 0.0 && v <= 1.0) {
            if (uMode < 0) {
              for (int b = 0; b < NB; b++) {
                vec2 e = field(b, u, v);
                float w = uOmega[b] * uTime;
                float s = (e.x * cos(w) + e.y * sin(w)) / uAmp;
                col += uColor[b] * pow(max(s, 0.0), 2.6) * 0.42;
              }
            } else {
              for (int b = 0; b < NB; b++) {
                if (b != uMode) continue;
                vec2 e = field(b, u, v);
                float w = uOmega[b] * uTime;
                float s = (e.x * cos(w) + e.y * sin(w)) / uAmp;
                float mag = length(e) / uAmp;
                col = uColor[b] * (pow(0.5 + 0.5 * s, 3.0) * 0.72 + 0.04 * mag);
              }
            }
            // Fade the top and bottom of the computed window.
            col *= smoothstep(0.0, 0.08, v) * smoothstep(1.0, 0.92, v);
          }
          // Material: silica below z=0 and in the ridges.
          float xr = (u - 0.5) * uP;
          bool ridge = abs(xr) < 0.5 * uFill * uP;
          bool glass = z < 0.0 || (z <= uD && ridge);
          if (glass) col += vec3(0.004, 0.006, 0.008);
          // Outline of the relief.
          float px = fwidth(z) * 1.2;
          float edge = 1e3;
          if (!ridge) edge = min(edge, abs(z));
          if (ridge) edge = min(edge, abs(z - uD));
          if (z > 0.0 && z < uD) edge = min(edge, abs(abs(xr) - 0.5 * uFill * uP));
          col += vec3(0.85, 0.72, 0.5) * (1.0 - smoothstep(0.0, px, edge)) * 0.55;
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`
    })
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(60, this.z1 - this.z0 + 2), this.mat)
    plane.position.y = (this.z0 + this.z1) / 2
    this.scene.add(plane)
    this.scene.add(this.orders)

    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(canvas.parentElement ?? canvas)
    this.resize()
    this.setBand(null)
    this.raf = requestAnimationFrame(this.frame)
  }

  /** null = white light (all seven colours), else one band. */
  setBand(band: number | null) {
    this.mode = band ?? -1
    this.mat.uniforms.uMode!.value = this.mode
    // Order directions for the chosen colour (grating equation), from the grating's top.
    this.orders.clear()
    const shown = band === null ? [] : [band]
    for (const b of shown) {
      const nm = this.wave.meta.bands[b]!.nm
      for (let m = -3; m <= 3; m++) {
        const s = (m * nm * 1e-3) / this.P
        if (Math.abs(s) >= 1) continue
        const dir = new THREE.Vector3(s, Math.sqrt(1 - s * s), 0)
        const a = new THREE.Vector3(0, this.d + 0.05, 0.1)
        const g = new THREE.BufferGeometry().setFromPoints([a, a.clone().addScaledVector(dir, this.z1 - this.d - 0.25)])
        const line = new THREE.Line(g, new THREE.LineDashedMaterial({ color: 0xf4efe6, transparent: true, opacity: 0.4, dashSize: 0.06, gapSize: 0.06 }))
        line.computeLineDistances()
        line.userData = { m }
        this.orders.add(line)
      }
    }
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
      ;(m.material as THREE.Material | undefined)?.dispose?.()
    })
    this.tex.dispose()
    this.renderer.dispose()
  }

  private frame = () => {
    this.raf = requestAnimationFrame(this.frame)
    const now = performance.now()
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    this.t += dt * (this.opts.reducedMotion ? 0.3 : 1)
    this.mat.uniforms.uTime!.value = this.t

    const dr = this.insetTarget.r - this.inset.r
    const db = this.insetTarget.b - this.inset.b
    if (dr !== 0 || db !== 0) {
      const kk = this.opts.reducedMotion || (Math.abs(dr) <= 0.5 && Math.abs(db) <= 0.5) ? 1 : 0.12
      this.inset.r += dr * kk
      this.inset.b += db * kk
      this.applyView()
    }
    this.renderer.render(this.scene, this.camera)
    this.hud()
  }

  private hud() {
    if (!this.opts.onHud) return
    const p = (x: number, z: number) => {
      const v = new THREE.Vector3(x, z, 0).project(this.camera)
      return { x: (v.x * 0.5 + 0.5) * this.width, y: (-v.y * 0.5 + 0.5) * this.height }
    }
    const hud: WaveHud = [
      { ...p(0, this.z0 + 0.35), label: 'glass · light enters ↑' },
      { ...p(0, this.z1 - 0.3), label: 'air' },
      { ...p(this.P * 1.5, this.d / 2), label: `ridges ${Math.round(this.d * 1000)} nm tall` }
    ]
    for (const line of this.orders.children) {
      const m = line.userData.m as number
      const pos = (line as THREE.Line).geometry.attributes.position!
      hud.push({ ...p(pos.getX(1), pos.getY(1) + 0.08), label: m === 0 ? '0' : m > 0 ? `+${m}` : `${m}` })
    }
    // 1 µm scale bar endpoints, encoded as two entries.
    const a = p(-this.P * 2.5, this.z0 + 0.12), b = p(-this.P * 1.5, this.z0 + 0.12)
    hud.push({ x: a.x, y: a.y, label: '|bar' }, { x: b.x, y: b.y, label: '|bar' })
    this.opts.onHud(hud)
  }

  private resize() {
    const el = this.canvas.parentElement ?? this.canvas
    this.width = Math.max(1, el.clientWidth)
    this.height = Math.max(1, el.clientHeight)
    this.renderer.setSize(this.width, this.height, false)
    this.applyView()
  }

  /**
   * Fit the computed window (z range) into the band between the nav and the
   * controls, and left of an open panel; x extends to fill the screen.
   */
  private applyView() {
    const { width: w, height: h, inset } = this
    const phone = w < 720
    const top = phone ? 150 : 96
    const bottom = inset.b > 0 ? inset.b + 8 : phone ? 170 : 140
    const availW = Math.max(1, w - inset.r)
    const availH = Math.max(80, h - top - bottom)
    const zSpan = (this.z1 - this.z0) * 1.04
    const unitsPerPx = zSpan / availH
    const halfW = (w * unitsPerPx) / 2
    const halfH = (h * unitsPerPx) / 2
    // Centre of the free area in px, converted to a world offset.
    const cx = (availW / 2 - w / 2) * unitsPerPx
    const cy = -(top + availH / 2 - h / 2) * unitsPerPx
    const zMid = (this.z0 + this.z1) / 2
    this.camera.left = -halfW - cx
    this.camera.right = halfW - cx
    this.camera.top = halfH + zMid - cy
    this.camera.bottom = -halfH + zMid - cy
    this.camera.updateProjectionMatrix()
  }
}
