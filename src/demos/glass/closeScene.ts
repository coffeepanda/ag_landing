import * as THREE from 'three'
import { contactAt, contactQ, RIM_VISUAL, rimBound, SLOW_RING, SLOW_STRIKE, WINDOW_US, type CloseGlass } from './closeData'
import { darkStudio, glassProfile, glowTexture } from './scene'

const NM = 10
const FOOT = 0.073
const APPROACH = 1.1 // s (display) for the mallet to reach the rim
const CONTACT_REAL = SLOW_STRIKE * WINDOW_US * 1e-6 // s (display) to replay the contact window

export type ClosePhase = 'approach' | 'strike' | 'ring'
export type CloseHud = { phase: ClosePhase; tUs: number; magnify: number; force: number }

/**
 * One glass up close: the bowl moves by the simulated mode field and is coloured by
 * its radial displacement. The mallet contact is replayed from the saved simulation,
 * then the glass rings with the released modal amplitudes, at true frequency ratios.
 */
export class CloseScene {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(30, 1, 0.005, 10)
  private raf = 0
  private last = performance.now()
  private width = 1
  private height = 1
  private ro: ResizeObserver
  private group = new THREE.Group()
  private uniforms = {
    uQ: { value: new Array(NM).fill(0) as number[] },
    uModes: { value: Array.from({ length: NM }, () => new THREE.Vector4()) },
    uMask: { value: new Array(NM).fill(1) as number[] },
    uMag: { value: 1 },
    uFoot: { value: FOOT },
    uH: { value: 0.08 },
    uFieldMax: { value: 1 }
  }
  private maskGoal = new Array(NM).fill(1) as number[]
  private glass!: CloseGlass
  private mallet = new THREE.Group()
  private glint: THREE.Sprite
  private phase: ClosePhase = 'approach'
  private clock = 0 // display seconds within the phase
  private tUs = 0 // physical time since first contact (us)
  private q = new Array(NM).fill(0) as number[]
  private orbit = { az: 0.55, el: 0.5, d: 0.36 }
  private orbitGoal = { az: 0.55, el: 0.5, d: 0.36 }
  private inset = { r: 0, b: 0 }
  private insetTarget = { r: 0, b: 0 }
  private disposables: { dispose(): void }[] = []

  constructor(private canvas: HTMLCanvasElement, glass: CloseGlass, private opts: { reducedMotion: boolean; onHud?: (h: CloseHud) => void; onStrike?: () => void }) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.scene.background = new THREE.Color(0x030303)
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    const env = pmrem.fromScene(darkStudio(), 0.02).texture
    this.scene.environment = env
    this.disposables.push(pmrem, env)

    const table = new THREE.Mesh(new THREE.CircleGeometry(1.2, 64), new THREE.MeshStandardMaterial({ color: 0x0e0b08, roughness: 0.5 }))
    table.rotation.x = -Math.PI / 2
    this.scene.add(table)
    this.scene.add(new THREE.HemisphereLight(0xb8c0cc, 0x100c08, 0.8))
    const key = new THREE.DirectionalLight(0xfff1dc, 1.6)
    key.position.set(0.4, 0.8, 0.6)
    this.scene.add(key)
    this.scene.add(this.group)

    // Mallet: a small felt-tipped head on a slim handle.
    const tipTex = glowTexture([255, 220, 170])
    this.disposables.push(tipTex)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 24, 16), new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.7 }))
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.0016, 0.14, 10), new THREE.MeshStandardMaterial({ color: 0x3a2818, roughness: 0.6 }))
    handle.rotation.z = Math.PI / 2
    handle.position.x = 0.0065 + 0.07
    this.mallet.add(head, handle)
    this.scene.add(this.mallet)
    this.glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: tipTex, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }))
    this.glint.scale.setScalar(0.03)
    this.scene.add(this.glint)

    this.setGlass(glass)
    this.orbit.az = this.orbitGoal.az
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(canvas.parentElement ?? canvas)
    this.resize()
    this.raf = requestAnimationFrame(this.frame)
  }

  // ---------------------------------------------------------------- controls

  setGlass(g: CloseGlass) {
    this.glass = g
    this.group.traverse((o) => (o as THREE.Mesh).geometry?.dispose())
    this.group.clear()
    const R = g.radius, H = g.height, t = Math.max(g.thickness, 0.0012)
    g.modes.forEach((m, k) => this.uniforms.uModes.value[k]!.set(m.n, m.c, m.s, 0))
    this.uniforms.uH.value = H
    const bound = rimBound(g)
    this.uniforms.uMag.value = RIM_VISUAL / bound
    this.uniforms.uFieldMax.value = bound * 0.22 // typical excursion is well below the all-modes bound

    const bowl = new THREE.Mesh(new THREE.LatheGeometry(glassProfile(R, H, t), 160), this.fieldMaterial())
    bowl.renderOrder = 2
    this.group.add(bowl)
    const wr = R - t - 0.0003
    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(wr, wr, g.depth, 96, 1, false),
      new THREE.MeshPhysicalMaterial({ color: 0x24434e, transparent: true, opacity: 0.28, roughness: 0.05, depthWrite: false })
    )
    water.position.y = FOOT + g.depth / 2
    water.renderOrder = 1
    this.group.add(water)
    // View from ~70 degrees round the rim, so the mallet comes in from the side.
    this.orbitGoal.az = g.strike_angle + 1.25
    this.strike()
  }

  /** Restart: approach, replay the simulated contact, then ring. */
  strike() {
    this.phase = 'approach'
    this.clock = this.opts.reducedMotion ? APPROACH : 0
    this.tUs = 0
    this.q.fill(0)
  }

  /** Show only one ring family (n = 2..6), or all (null). */
  setFamily(n: number | null) {
    this.glass.modes.forEach((m, k) => (this.maskGoal[k] = n === null || m.n === n ? 1 : 0))
  }

  orbitBy(dx: number, dy: number) {
    this.orbitGoal.az -= dx * 0.006
    this.orbitGoal.el = Math.max(0.05, Math.min(1.35, this.orbitGoal.el + dy * 0.004))
  }

  zoomBy(f: number) {
    this.orbitGoal.d = Math.max(0.16, Math.min(0.8, this.orbitGoal.d * f))
  }

  setInset(right: number, bottom: number) {
    this.insetTarget = { r: Math.max(0, right), b: Math.max(0, bottom) }
  }

  get time() {
    return { phase: this.phase, tUs: this.tUs }
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

  // ---------------------------------------------------------------- internals

  private fieldMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: `
        #define NM ${NM}
        uniform float uQ[NM]; uniform vec4 uModes[NM]; uniform float uMask[NM];
        uniform float uMag; uniform float uFoot; uniform float uH;
        varying float vField; varying vec3 vNormalW; varying vec3 vWorld;
        void main() {
          vec3 p = position;
          float th = atan(p.x, p.z);
          float rad = length(p.xz);
          float sh = clamp((p.y - uFoot) / uH, 0.0, 1.0); sh *= sh;
          float r = 0.0, t = 0.0;
          for (int k = 0; k < NM; k++) {
            float n = uModes[k].x;
            if (n < 1.0) continue;
            float a = uQ[k] * uMask[k];
            r += a * (uModes[k].y * cos(n * th) + uModes[k].z * sin(n * th));
            t += a * (-uModes[k].y * sin(n * th) + uModes[k].z * cos(n * th)) / n;
          }
          vField = r * sh;
          if (rad > 1e-6) {
            vec2 er = p.xz / rad;
            vec2 et = vec2(er.y, -er.x);
            p.xz += (er * r + et * t) * sh * uMag;
          }
          vec4 w = modelMatrix * vec4(p, 1.0);
          vWorld = w.xyz;
          vNormalW = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: `
        uniform float uFieldMax;
        varying float vField; varying vec3 vNormalW; varying vec3 vWorld;
        void main() {
          vec3 N = normalize(vNormalW);
          if (!gl_FrontFacing) N = -N;
          vec3 V = normalize(cameraPosition - vWorld);
          float fr = pow(1.0 - abs(dot(N, V)), 3.0);
          float f = clamp(vField / uFieldMax, -1.0, 1.0);
          float m = pow(abs(f), 0.8);
          vec3 field = f > 0.0 ? vec3(0.98, 0.62, 0.28) : vec3(0.3, 0.58, 1.0);
          vec3 col = vec3(0.02, 0.025, 0.03) + fr * vec3(0.5, 0.5, 0.52) + field * m * 1.25;
          gl_FragColor = vec4(col, clamp(0.22 + fr * 0.55 + m * 0.7, 0.0, 1.0));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    })
  }

  private frame = () => {
    this.raf = requestAnimationFrame(this.frame)
    const now = performance.now()
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    const g = this.glass
    this.clock += dt

    const R = g.radius, H = g.height
    const th = g.strike_angle
    const rimY = FOOT + H - 0.004
    const er = new THREE.Vector3(Math.sin(th), 0, Math.cos(th)) // lathe: x = r sin, z = r cos
    let gap = 0
    let force = 0

    if (this.phase === 'approach') {
      const u = Math.min(1, this.clock / APPROACH)
      gap = 0.05 * Math.pow(1 - u, 2)
      if (u >= 1) {
        this.phase = 'strike'
        this.clock = 0
        this.opts.onStrike?.()
      }
    } else if (this.phase === 'strike') {
      this.tUs = Math.min(WINDOW_US, (this.clock / CONTACT_REAL) * WINDOW_US)
      contactQ(g, this.tUs, this.q)
      force = contactAt(g.contact.force, g.contact.t_us, this.tUs)
      // After release the mallet drifts back (its rebound is micrometres; shown slowly).
      gap = Math.max(0, (this.tUs - g.contact.end_us) / WINDOW_US) * 0.004
      if (this.tUs >= WINDOW_US) {
        this.phase = 'ring'
        this.clock = 0
      }
    } else {
      const tPhys = WINDOW_US * 1e-6 + this.clock / SLOW_RING
      this.tUs = tPhys * 1e6
      const ts = tPhys - g.contact.end_us * 1e-6 // since final release
      g.modes.forEach((m, k) => (this.q[k] = m.amp * Math.exp(-m.gamma * ts) * Math.sin(2 * Math.PI * m.f * ts + m.phase)))
      gap = 0.004 + 0.04 * (1 - Math.exp(-this.clock * 1.5))
    }
    for (let k = 0; k < NM; k++) {
      this.uniforms.uQ.value[k] = this.q[k]!
      const mv = this.uniforms.uMask.value
      mv[k] = mv[k]! + (this.maskGoal[k]! - mv[k]!) * Math.min(1, dt * 6)
    }

    // Mallet sits just outside the rim at the strike angle; handle points away.
    const reach = R + 0.0065 + gap
    this.mallet.position.set(er.x * reach, rimY, er.z * reach)
    this.mallet.rotation.set(0, Math.atan2(-er.z, er.x), 0.35)
    const glintMat = this.glint.material as THREE.SpriteMaterial
    glintMat.opacity = Math.min(1, force / g.contact.peak_force)
    this.glint.position.set(er.x * R, rimY, er.z * R)
    this.glint.scale.setScalar(0.015 + 0.03 * glintMat.opacity)

    // Camera
    if (!this.opts.reducedMotion && this.phase === 'ring') this.orbitGoal.az += dt * 0.05
    const k = 1 - Math.pow(0.003, dt)
    this.orbit.az += (this.orbitGoal.az - this.orbit.az) * k
    this.orbit.el += (this.orbitGoal.el - this.orbit.el) * k
    this.orbit.d += (this.orbitGoal.d - this.orbit.d) * k
    const target = new THREE.Vector3(0, FOOT + H * 0.55, 0)
    const { az, el, d } = this.orbit
    this.camera.position.set(target.x + d * Math.cos(el) * Math.sin(az), target.y + d * Math.sin(el), target.z + d * Math.cos(el) * Math.cos(az))
    this.camera.lookAt(target)

    const dr = this.insetTarget.r - this.inset.r
    const db = this.insetTarget.b - this.inset.b
    if (dr !== 0 || db !== 0) {
      const kk = this.opts.reducedMotion || (Math.abs(dr) <= 0.5 && Math.abs(db) <= 0.5) ? 1 : 0.12
      this.inset.r += dr * kk
      this.inset.b += db * kk
      this.applyView()
    }
    this.renderer.render(this.scene, this.camera)
    this.opts.onHud?.({ phase: this.phase, tUs: this.tUs, magnify: this.uniforms.uMag.value, force })
  }

  private resize() {
    const el = this.canvas.parentElement ?? this.canvas
    this.width = Math.max(1, el.clientWidth)
    this.height = Math.max(1, el.clientHeight)
    this.renderer.setSize(this.width, this.height, false)
    this.applyView()
  }

  private applyView() {
    const { width: w, height: h, inset } = this
    this.camera.aspect = w / h
    this.camera.fov = w / h < 0.8 ? 44 + 20 * (inset.b / h) : 30
    if (inset.r > 0.5 || inset.b > 0.5) this.camera.setViewOffset(w, h, inset.r / 2, inset.b * 0.45, w, h)
    else this.camera.clearViewOffset()
    this.camera.updateProjectionMatrix()
  }
}
