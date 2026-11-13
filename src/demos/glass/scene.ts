import * as THREE from 'three'
import type { Glass } from './data'

const NM = 10           // modes per glass in the bundle
const FOOT = 0.073      // bowl foot height above the table (stem + base), m
const RIM_PEAK = 0.0022 //on-screen rim excursion of the loudest glass, m (exaggerated)
const SPACING = 0.098

type Strike = { t0: number; v: number }

type GlassView = {
  glass: Glass
  group: THREE.Group
  uniforms: { uAmp: { value: number[] }; uModes: { value: THREE.Vector4[] }; uGlow: { value: number } }
  /** Visual (slowed) frequencies; decay stays in real time so motion follows the sound. */
  fv: number[]
  strikes: Strike[]
  level: number
  proxy: THREE.Mesh
  glint: THREE.Sprite
  label: THREE.Vector3
}

export type LabelPos = { x: number; y: number; level: number }

export class GlassScene {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(26, 1, 0.01, 30)
  private views: GlassView[] = []
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2(0, 0)
  private look = new THREE.Vector2(0, 0)
  private base = { pos: new THREE.Vector3(), target: new THREE.Vector3() }
  private raf = 0
  private scale: number
  private hover = -1
  private candle!: { light: THREE.PointLight; flame: THREE.Sprite }
  private disposables: { dispose(): void }[] = []
  private ro: ResizeObserver
  private tex = { glint: glowTexture([255, 236, 205]), shadow: shadowTexture() }
  private width = 1
  private height = 1
  /** Screen area covered by an overlay (px): the view re-centres into what is left. */
  private inset = { r: 0, b: 0 }
  private insetTarget = { r: 0, b: 0 }

  constructor(
    private canvas: HTMLCanvasElement,
    glasses: Glass[],
    private opts: { reducedMotion: boolean; onFrame?: (labels: LabelPos[]) => void }
  ) {
    const coarse = window.matchMedia('(pointer: coarse)').matches
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarse ? 1.75 : 2))
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    this.scene.background = new THREE.Color(0x000000)
    this.scene.fog = new THREE.FogExp2(0x000000, 0.55)

    const pmrem = new THREE.PMREMGenerator(this.renderer)
    const envScene = darkStudio()
    const env = pmrem.fromScene(envScene, 0.02).texture
    envScene.traverse((o) => (o as THREE.Mesh).geometry?.dispose())
    this.scene.environment = env
    this.disposables.push(pmrem, env, this.tex.glint, this.tex.shadow)

    const peak = Math.max(...glasses.map((g) => g.modes.reduce((a, m) => a + Math.hypot(m.c, m.s), 0)))
    this.scale = (RIM_PEAK / peak) * (opts.reducedMotion ? 0.5 : 1)

    this.buildRoom()
    glasses.forEach((g) => this.views.push(this.buildGlass(g)))

    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(canvas.parentElement ?? canvas)
    this.resize()
    this.raf = requestAnimationFrame(this.frame)
  }

  /** Pan position of each glass in [-1, 1], for stereo placement. */
  pans() {
    const xs = this.views.map((v) => v.group.position.x)
    const m = Math.max(...xs.map(Math.abs), 1e-6)
    return xs.map((x) => (x / m) * 0.6)
  }

  strike(i: number, velocity = 1, delay = 0) {
    const v = this.views[i]
    if (!v) return
    v.strikes.push({ t0: now() + delay, v: velocity })
    if (v.strikes.length > 4) v.strikes.shift()
  }

  clearPending() {
    const t = now()
    for (const v of this.views) v.strikes = v.strikes.filter((s) => s.t0 <= t)
  }

  /** Pointer in normalized device coordinates. */
  setPointer(clientX: number, clientY: number) {
    const r = this.canvas.getBoundingClientRect()
    this.pointer.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1)
  }

  pick(clientX: number, clientY: number): number {
    this.setPointer(clientX, clientY)
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hits = this.raycaster.intersectObjects(this.views.map((v) => v.proxy), false)
    const hit = hits[0]
    return hit ? this.views.findIndex((v) => v.proxy === hit.object) : -1
  }

  setHover(i: number) {
    this.hover = i
  }

  /** Most recent strike that has started: glass index and seconds since it. */
  latest(): { i: number; tau: number } | null {
    const t = now()
    let best: { i: number; t0: number } | null = null
    this.views.forEach((v, i) => {
      for (const s of v.strikes) if (s.t0 <= t && (!best || s.t0 > best.t0)) best = { i, t0: s.t0 }
    })
    const b = best as { i: number; t0: number } | null
    return b ? { i: b.i, tau: t - b.t0 } : null
  }

  /** Overlay coverage in px from the right / bottom edge; eased in the frame loop. */
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
    this.disposables.forEach((d) => d.dispose())
    this.renderer.dispose()
  }

  // ---------------------------------------------------------------- build

  private buildRoom() {
    const table = new THREE.Mesh(
      new THREE.CircleGeometry(6, 64),
      new THREE.MeshStandardMaterial({ color: 0x0f0b08, roughness: 0.5, metalness: 0, envMapIntensity: 0.1 })
    )
    table.rotation.x = -Math.PI / 2
    this.scene.add(table)

    // Candle at the back left: the only warm light on the table.
    const candleBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.11, 40),
      new THREE.MeshStandardMaterial({ color: 0xe9dcc6, roughness: 0.65, emissive: 0x2a1505, envMapIntensity: 0.3 })
    )
    const candle = new THREE.Group()
    candle.position.set(0.5, 0, -0.78)
    candleBody.position.y = 0.055
    candle.add(candleBody)
    const flame = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTexture([255, 196, 120]), color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
    )
    flame.scale.set(0.05, 0.08, 1)
    flame.position.y = 0.135
    candle.add(flame)
    const light = new THREE.PointLight(0xffa860, 1.6, 0, 2)
    light.position.y = 0.15
    candle.add(light)
    this.scene.add(candle)
    this.candle = { light, flame }

    // Cool fill from behind for glass silhouettes.
    const back = new THREE.DirectionalLight(0xa9b8ff, 0.5)
    back.position.set(0.4, 0.5, -1)
    this.scene.add(back)
    const key = new THREE.SpotLight(0xfff1dc, 7, 0, 0.42, 0.95, 2)
    key.position.set(0.35, 1.0, 0.8)
    key.target.position.set(0, 0.05, 0)
    this.scene.add(key, key.target)

    // A few out-of-focus lights far behind.
    const bokeh = glowTexture([255, 210, 150])
    const spots = [[-1.6, 0.55, -3.2, 0.32], [1.3, 0.75, -3.6, 0.42], [2.4, 0.4, -2.9, 0.26], [-2.6, 0.9, -4, 0.5]]
    for (const [x, y, z, s] of spots) {
      const b = new THREE.Sprite(new THREE.SpriteMaterial({ map: bokeh, blending: THREE.AdditiveBlending, opacity: 0.16, depthWrite: false, fog: false }))
      b.position.set(x!, y!, z!)
      b.scale.setScalar(s!)
      this.scene.add(b)
    }
  }

  private buildGlass(glass: Glass): GlassView {
    const R = glass.radius
    const H = glass.height
    const t = Math.max(glass.thickness, 0.0012)
    const group = new THREE.Group()

    const uniforms = {
      uAmp: { value: new Array(NM).fill(0) as number[] },
      uModes: { value: Array.from({ length: NM }, (_, k) => {
        const m = glass.modes[k]
        return m ? new THREE.Vector4(m.n, m.c, m.s, 0) : new THREE.Vector4()
      }) },
      uGlow: { value: 0 }
    }
    const bowl = { value: new THREE.Vector2(FOOT, H) }

    // Glass: thin, clear, bright at grazing angles.
    const glassMat = new THREE.MeshPhysicalMaterial({
      // Black base: clear glass shows reflections only, never a diffuse grey.
      // Additive: on a dark set, clear glass only adds reflected light.
      color: 0x000000, roughness: 0.015, metalness: 0, transparent: true, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.8, ior: 1.5, specularIntensity: 1
    })
    deform(glassMat, uniforms, bowl, { fresnel: true, edge: 0.32, additive: true })
    const body = new THREE.Mesh(new THREE.LatheGeometry(glassProfile(R, H, t), 120), glassMat)
    body.renderOrder = 3
    group.add(body)

    // Water column and surface, deforming with the wall.
    const wr = R - t - 0.0002
    const waterMat = new THREE.MeshPhysicalMaterial({
      color: 0x1d3a44, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.2,
      depthWrite: false, envMapIntensity: 0.9, side: THREE.DoubleSide
    })
    deform(waterMat, uniforms, bowl, { fresnel: true, edge: 0.3 })
    // Geometry is built in the bowl frame (y from the table) so the deformation matches the wall.
    const columnGeo = new THREE.CylinderGeometry(wr, wr, glass.depth, 96, 6, true)
    columnGeo.translate(0, FOOT + glass.depth / 2, 0)
    const column = new THREE.Mesh(columnGeo, waterMat)
    column.renderOrder = 1
    group.add(column)

    const surfMat = new THREE.MeshPhysicalMaterial({
      color: 0x2a4d58, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.3,
      depthWrite: false, envMapIntensity: 1.4, flatShading: true
    })
    deform(surfMat, uniforms, bowl, { surface: wr, fresnel: true, edge: 0.25 })
    const surfGeo = new THREE.RingGeometry(0.0002, wr, 96, 18)
    surfGeo.rotateX(-Math.PI / 2)
    surfGeo.translate(0, FOOT + glass.depth, 0)
    const surface = new THREE.Mesh(surfGeo, surfMat)
    surface.renderOrder = 2
    group.add(surface)

    // Soft contact shadow.
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.11, 0.11),
      new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: this.tex.shadow, transparent: true, opacity: 0.75, depthWrite: false })
    )
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = 0.0005
    group.add(shadow)

    // Strike glint on the rim, 20 degrees round from the front.
    const glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.glint, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }))
    const a = (20 * Math.PI) / 180
    glint.position.set(R * Math.sin(a), FOOT + H, R * Math.cos(a))
    glint.scale.setScalar(0.03)
    group.add(glint)

    // Generous invisible hit target.
    const proxy = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.006, R + 0.006, FOOT + H + 0.01, 12), new THREE.MeshBasicMaterial({ visible: false }))
    proxy.position.y = (FOOT + H) / 2
    group.add(proxy)

    this.scene.add(group)

    // Slowed visual frequencies: the oval breathes at a few Hz, higher shapes a little faster.
    const f0 = glass.modes[0]!.f
    const fv = glass.modes.map((m) => 2.4 * Math.pow(m.f / f0, 0.45) * Math.pow(f0 / 440, 0.3))
    return { glass, group, uniforms, fv, strikes: [], level: 0, proxy, glint, label: new THREE.Vector3(0, -0.012, R + 0.012) }
  }

  // ---------------------------------------------------------------- layout

  private resize() {
    const el = this.canvas.parentElement ?? this.canvas
    this.width = Math.max(1, el.clientWidth)
    this.height = Math.max(1, el.clientHeight)
    this.renderer.setSize(this.width, this.height, false)
    this.applyView()
  }

  private applyView() {
    const { width: w, height: h, inset } = this
    const aspect = w / h
    this.camera.aspect = aspect
    this.layout(aspect, Math.max(0.3, (w - inset.r) / h), inset.b / h)
    // Shift the projection so the scene centres in the uncovered region.
    // (Bottom sheets shift less than half: the band under the nav stays clear.)
    if (inset.r > 0.5 || inset.b > 0.5) this.camera.setViewOffset(w, h, inset.r / 2, inset.b * 0.47, w, h)
    else this.camera.clearViewOffset()
    this.camera.updateProjectionMatrix()
  }

  /** aspect picks the arrangement; fitAspect / bottomFrac fit it into the uncovered area. */
  private layout(aspect: number, fitAspect = aspect, bottomFrac = 0) {
    const n = this.views.length
    const tanV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))
    if (aspect >= 0.95) {
      // One gentle arc, low notes on the left, ends curving toward the viewer.
      const arcR = 1.1
      const span = (n - 1) * SPACING
      this.views.forEach((v, i) => {
        const a = (i * SPACING - span / 2) / arcR
        v.group.position.set(arcR * Math.sin(a), 0, arcR * (1 - Math.cos(a)))
        v.group.rotation.y = a * 0.6
      })
      const half = span / 2 + 0.07
      const d = Math.max(half / (tanV * fitAspect), 0.28 / tanV) * 1.04 * (1 + 0.8 * bottomFrac)
      this.base.target.set(0, 0.105, 0.04)
      this.base.pos.set(0, 0.105 + d * 0.42, 0.04 + d * 0.96)
    } else {
      // Portrait: three staggered rows of four, read like text (low notes at the back left).
      const per = 4
      const rows = Math.ceil(n / per)
      const sp = SPACING * 0.92
      const rowGap = 0.26
      this.views.forEach((v, i) => {
        const row = Math.floor(i / per)
        const col = i % per
        const x = (col - (per - 1) / 2) * sp + (row % 2 ? sp / 4 : -sp / 4)
        v.group.position.set(x, 0, (row - (rows - 1) / 2) * rowGap)
        v.group.rotation.y = 0
      })
      const half = ((per - 1) / 2) * sp + sp / 4 + 0.085
      // With a bottom sheet open, shrink the set to fit the band between nav and sheet.
      const d = (half / (tanV * fitAspect)) * (1 + 2 * bottomFrac)
      this.base.target.set(0, 0.17, 0.01)
      this.base.pos.set(0, 0.17 + d * 0.7, 0.01 + d * 0.72)
    }
  }

  // ---------------------------------------------------------------- frame

  private frame = () => {
    this.raf = requestAnimationFrame(this.frame)
    const t = now()

    // Ease the overlay inset so the scene glides aside rather than jumping.
    const dr = this.insetTarget.r - this.inset.r
    const db = this.insetTarget.b - this.inset.b
    if (Math.abs(dr) > 0.5 || Math.abs(db) > 0.5) {
      const k = this.opts.reducedMotion ? 1 : 0.12
      this.inset.r += dr * k
      this.inset.b += db * k
      this.applyView()
    } else if (dr !== 0 || db !== 0) {
      this.inset = { ...this.insetTarget }
      this.applyView()
    }

    // Camera: slight parallax toward the pointer, and a slow idle drift.
    if (!this.opts.reducedMotion) {
      this.look.lerp(this.pointer, 0.04)
      const drift = Math.sin(t * 0.13) * 0.012
      this.camera.position.set(
        this.base.pos.x + this.look.x * 0.05 + drift,
        this.base.pos.y + this.look.y * 0.025,
        this.base.pos.z
      )
    } else {
      this.camera.position.copy(this.base.pos)
    }
    this.camera.lookAt(this.base.target)

    // Candle flicker.
    const fl = 1 + 0.06 * Math.sin(t * 7.3) + 0.04 * Math.sin(t * 13.1 + 1) + 0.03 * Math.sin(t * 23.7)
    this.candle.light.intensity = 1.1 * fl
    this.candle.flame.scale.set(0.05 * (0.96 + 0.04 * fl), 0.08 * fl, 1)

    const labels: LabelPos[] = []
    const p = new THREE.Vector3()
    this.views.forEach((v, i) => {
      const amp = v.uniforms.uAmp.value
      amp.fill(0)
      let level = 0
      let flash = 0
      v.strikes = v.strikes.filter((s) => t - s.t0 < 9)
      for (const s of v.strikes) {
        const tau = t - s.t0
        if (tau < 0) continue
        // Soft 40 ms onset keeps the first frame from popping.
        const on = Math.min(1, tau / 0.04)
        v.glass.modes.forEach((m, k) => {
          const e = s.v * on * Math.exp(-m.gamma * tau)
          amp[k]! += this.scale * e * Math.sin(2 * Math.PI * v.fv[k]! * tau + m.phase)
          if (k === 0) level = Math.max(level, e)
        })
        const g = Math.max(0, 1 - tau / 0.4)
        flash = Math.max(flash, g * g * s.v)
      }
      ;(v.glint.material as THREE.SpriteMaterial).opacity = flash
      v.level = level
      const glow = Math.max(this.hover === i ? 0.45 : 0, level)
      v.uniforms.uGlow.value += (glow - v.uniforms.uGlow.value) * 0.15

      p.copy(v.label).applyMatrix4(v.group.matrixWorld).project(this.camera)
      labels.push({ x: (p.x * 0.5 + 0.5) * this.width, y: (-p.y * 0.5 + 0.5) * this.height, level: Math.max(level, this.hover === i ? 0.6 : 0) })
    })

    this.renderer.render(this.scene, this.camera)
    this.opts.onFrame?.(labels)
  }
}

// ---------------------------------------------------------------- helpers

const now = () => performance.now() / 1000

/** Radial wall displacement shared by glass, water column and water surface. */
function deform(
  mat: THREE.MeshPhysicalMaterial,
  u: GlassView['uniforms'],
  bowl: { value: THREE.Vector2 },
  o: { surface?: number; fresnel?: boolean; edge?: number; additive?: boolean }
) {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u, { uBowl: bowl, uSurf: { value: o.surface ?? 0 } })
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        #define NM ${NM}
        uniform float uAmp[NM];
        uniform vec4 uModes[NM];
        uniform vec2 uBowl;
        uniform float uSurf;`
      )
      .replace(
        '#include <begin_vertex>',
        `vec3 transformed = vec3(position);
        {
          float th = atan(position.x, position.z);
          float rad = length(position.xz);
          float dr = 0.0;
          float dh = 0.0;
          for (int k = 0; k < NM; k++) {
            float shape = uModes[k].y * cos(uModes[k].x * th) + uModes[k].z * sin(uModes[k].x * th);
            dr += uAmp[k] * shape;
            if (uSurf > 0.0) dh += uAmp[k] * shape * pow(rad / uSurf, uModes[k].x);
          }
          float s = clamp((position.y - uBowl.x) / uBowl.y, 0.0, 1.0);
          s *= s;
          if (rad > 1e-6) transformed.xz += (position.xz / rad) * dr * s;
          transformed.y += dh * 0.6;
        }`
      )
    if (o.fresnel) {
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\nuniform float uGlow;`)
        .replace(
          '#include <dithering_fragment>',
          `#include <dithering_fragment>
          {
            float fr = pow(1.0 - abs(dot(normalize(geometryNormal), normalize(geometryViewDir))), 3.0);
            float lum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
            gl_FragColor.rgb += fr * vec3(0.62, 0.6, 0.58) * ${(o.edge ?? 0).toFixed(3)};
            gl_FragColor.rgb += uGlow * fr * vec3(0.85, 0.7, 0.48) * 0.9;
            gl_FragColor.a = ${o.additive ? '1.0' : 'clamp(gl_FragColor.a + fr * 0.28 + lum * 0.7 + uGlow * fr * 0.4, 0.0, 1.0)'};
          }`
        )
    }
  }
}

/** Half-section of a stemmed glass, outside then inside; y up from the table. */
function glassProfile(R: number, H: number, t: number) {
  const y0 = FOOT
  const pts: [number, number][] = [
    [0.0, 0.0], [0.031, 0.0], [0.034, 0.0008], [0.0345, 0.0018], [0.032, 0.0026],
    [0.014, 0.0036], [0.0068, 0.0058], [0.0045, 0.011], [0.0039, 0.03], [0.004, 0.052],
    [0.0048, 0.061], [0.0078, y0 - 0.0055], [R * 0.48, y0 - 0.0032], [R * 0.82, y0 - 0.0012],
    [R - 0.0006, y0 + 0.004], [R, y0 + 0.011], [R, y0 + H - 0.0008],
    [R - t * 0.15, y0 + H - 0.0001], [R - t * 0.5, y0 + H + 0.0002], [R - t * 0.85, y0 + H - 0.0001],
    [R - t, y0 + H - 0.0008], [R - t, y0 + 0.011], [R - t - 0.0006, y0 + 0.004 + t * 0.3],
    [R * 0.8, y0 + 0.0005], [0.0, y0]
  ]
  return pts.map(([x, y]) => new THREE.Vector2(x, y))
}

/** Reflection environment: a black room with a few soft panels, for crisp highlights on glass. */
function darkStudio() {
  const s = new THREE.Scene()
  s.background = new THREE.Color(0x020202)
  const panel = (w: number, h: number, color: number, k: number, pos: [number, number, number]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }))
    m.position.set(...pos)
    m.lookAt(0, 0, 0)
    s.add(m)
  }
  // Tall narrow strips give clean vertical highlights on the bowls.
  panel(0.45, 5, 0xffd6a8, 3.2, [-3.2, 1.2, 3])  // warm strip, front left
  panel(0.3, 5, 0xc4d2ff, 2.2, [3.6, 1.2, 1.2])  // cool strip, right
  panel(0.25, 5, 0xffffff, 1.4, [1.2, 1.2, 3.8]) // thin front kicker
  panel(2, 2, 0xffffff, 0.18, [0, 6, 0])          // faint top
  panel(1.2, 0.4, 0xffb070, 2.4, [-3, 0.4, -4])   // candle glow behind
  return s
}

function glowTexture(rgb: [number, number, number]) {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  const [r, gg, b] = rgb
  grd.addColorStop(0, `rgba(255,255,255,1)`)
  grd.addColorStop(0.18, `rgba(${r},${gg},${b},0.85)`)
  grd.addColorStop(0.5, `rgba(${r},${gg},${b},0.18)`)
  grd.addColorStop(1, `rgba(${r},${gg},${b},0)`)
  g.fillStyle = grd
  g.fillRect(0, 0, 128, 128)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function shadowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grd.addColorStop(0, '#fff')
  grd.addColorStop(0.45, '#888')
  grd.addColorStop(1, '#000')
  g.fillStyle = grd
  g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}
