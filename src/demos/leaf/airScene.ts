import * as THREE from 'three'
import { deltaColor, pressureColor, sampleVelocity, type Air } from './airData'
import { leafTexture } from './leafArt'

export type SliceMode = 'speed' | 'pressure' | 'off'

const toThree = (x: number, y: number, z: number, out = new THREE.Vector3()) => out.set(x, z, -y)

/**
 * Close-up of the resolved shell/air experiment: particles stream through the
 * computed air velocity at 6 ms, a slice shows speed or pressure, and the leaf
 * is the actual shell (bending optionally magnified x100).
 */
export class AirScene {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private world = new THREE.Group()
  private camera = new THREE.PerspectiveCamera(30, 1, 0.005, 20)
  private raf = 0
  private last = performance.now()
  private width = 1
  private height = 1
  private ro: ResizeObserver
  private disposables: { dispose(): void }[] = []

  private center = new THREE.Vector3() // sim frame
  private orbit = { az: -Math.PI / 2 - 0.55, el: 0.45, d: 0.3 }
  private orbitGoal = { az: -Math.PI / 2 - 0.55, el: 0.45, d: 0.3 }
  private inset = { r: 0, b: 0 }
  private insetTarget = { r: 0, b: 0 }

  private leafGeo: THREE.BufferGeometry
  private mag = 1
  private magGoal = 1

  private n: number
  private p: Float32Array // particle positions (sim)
  private age: Float32Array
  private life: Float32Array
  private streaks: THREE.LineSegments
  private slice: THREE.Mesh
  private sliceTex: { speed: THREE.DataTexture; pressure: THREE.DataTexture }
  private timeScale = 0.25
  private scaleBar: [THREE.Vector3, THREE.Vector3]

  constructor(
    private canvas: HTMLCanvasElement,
    private air: Air,
    private opts: { reducedMotion: boolean; onFrame?: (hud: { bar: [number, number, number, number] }) => void }
  ) {
    const coarse = window.matchMedia('(pointer: coarse)').matches
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarse ? 1.75 : 2))
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.scene.background = new THREE.Color(0x020304)
    this.world.rotation.x = -Math.PI / 2
    this.scene.add(this.world)

    const m = air.meta
    const { lo, hi } = m.box
    const pts = m.leaf.points[m.leaf.points.length - 1]!
    for (let i = 0; i < pts.length; i += 3) this.center.add(new THREE.Vector3(pts[i], pts[i + 1], pts[i + 2]))
    this.center.multiplyScalar(3 / pts.length)

    // ---- chamber outline: the simulated air box
    const box = new THREE.Box3(new THREE.Vector3(lo[0], lo[1], lo[2]), new THREE.Vector3(hi[0], hi[1], hi[2]))
    const outline = new THREE.Box3Helper(box, new THREE.Color(0xd9b98a))
    ;(outline.material as THREE.LineBasicMaterial).transparent = true
    ;(outline.material as THREE.LineBasicMaterial).opacity = 0.16
    this.world.add(outline)

    // Inflow face hint: a faint grid where the breeze enters.
    const inflow = new THREE.GridHelper(1, 10, 0x6f8fa0, 0x6f8fa0)
    ;(inflow.material as THREE.LineBasicMaterial).transparent = true
    ;(inflow.material as THREE.LineBasicMaterial).opacity = 0.08
    inflow.scale.set(hi[1]! - lo[1]!, 1, hi[2]! - lo[2]!)
    inflow.rotation.z = Math.PI / 2
    inflow.position.set(lo[0]!, (lo[1]! + hi[1]!) / 2, (lo[2]! + hi[2]!) / 2)
    this.world.add(inflow)

    // ---- leaf shell
    const tex = leafTexture()
    this.disposables.push(tex)
    this.leafGeo = new THREE.BufferGeometry()
    this.leafGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts.length), 3))
    this.leafGeo.setAttribute('uv', new THREE.BufferAttribute(Float32Array.from(m.leaf.uv), 2))
    this.leafGeo.setIndex(m.leaf.triangles)
    const leaf = new THREE.Mesh(this.leafGeo, new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.6, emissive: 0x3a1404, emissiveIntensity: 0.5 }))
    this.world.add(leaf)
    this.updateLeaf()

    // ---- slice through the leaf
    const [sx, sz] = m.slice.n
    this.sliceTex = { speed: this.sliceTexture('speed'), pressure: this.sliceTexture('pressure') }
    this.disposables.push(this.sliceTex.speed, this.sliceTex.pressure)
    const plane = new THREE.PlaneGeometry(hi[0]! - lo[0]!, hi[2]! - lo[2]!)
    plane.rotateX(Math.PI / 2)
    this.slice = new THREE.Mesh(
      plane,
      new THREE.MeshBasicMaterial({ map: this.sliceTex.speed, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, opacity: 0.9 })
    )
    this.slice.position.set((lo[0]! + hi[0]!) / 2, m.slice.y, (lo[2]! + hi[2]!) / 2)
    this.world.add(this.slice)
    void sx; void sz

    // ---- particles drawn as short streaks coloured by speed
    this.n = coarse ? 900 : 1700
    this.p = new Float32Array(this.n * 3)
    this.age = new Float32Array(this.n)
    this.life = new Float32Array(this.n)
    for (let i = 0; i < this.n; i++) this.spawn(i, true)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.n * 6), 3))
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.n * 8), 4))
    this.streaks = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))
    this.streaks.frustumCulled = false
    this.world.add(this.streaks)

    // ---- light
    this.scene.add(new THREE.HemisphereLight(0xb8c4d0, 0x100c08, 1.1))
    const key = new THREE.DirectionalLight(0xffd6a8, 2.2)
    key.position.copy(toThree(-0.3, -0.5, 0.6))
    this.scene.add(key)

    // 2 cm scale bar just under the leaf, along the breeze.
    const bx = this.center.x - 0.01, by = this.center.y, bz = this.center.z - 0.04
    this.scaleBar = [new THREE.Vector3(bx, by, bz), new THREE.Vector3(bx + 0.02, by, bz)]

    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(canvas.parentElement ?? canvas)
    this.resize()
    this.raf = requestAnimationFrame(this.frame)
  }

  // ---------------------------------------------------------------- controls

  setSlice(mode: SliceMode) {
    this.slice.visible = mode !== 'off'
    if (mode !== 'off') {
      const mat = this.slice.material as THREE.MeshBasicMaterial
      mat.map = this.sliceTex[mode]
      mat.needsUpdate = true
    }
  }

  setMagnified(on: boolean) {
    this.magGoal = on ? 100 : 1
  }

  setSlow(slow: boolean) {
    this.timeScale = slow ? 0.25 : 1
  }

  orbitBy(dx: number, dy: number) {
    this.orbitGoal.az -= dx * 0.006
    this.orbitGoal.el = Math.max(-0.6, Math.min(1.35, this.orbitGoal.el + dy * 0.004))
  }

  zoomBy(f: number) {
    this.orbitGoal.d = Math.max(0.12, Math.min(0.8, this.orbitGoal.d * f))
  }

  setInset(right: number, bottom: number) {
    this.insetTarget = { r: Math.max(0, right), b: Math.max(0, bottom) }
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    this.ro.disconnect()
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh
      mesh.geometry?.dispose()
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
      else mat?.dispose()
    })
    this.disposables.forEach((d) => d.dispose())
    this.renderer.dispose()
  }

  // ---------------------------------------------------------------- internals

  private updateLeaf() {
    const L = this.air.meta.leaf
    const pts = L.points[L.points.length - 1]!
    const el = L.elastic[L.elastic.length - 1]!
    const arr = (this.leafGeo.attributes.position as THREE.BufferAttribute).array as Float32Array
    const k = this.mag - 1
    for (let i = 0; i < arr.length; i++) arr[i] = pts[i]! + k * el[i]!
    this.leafGeo.attributes.position!.needsUpdate = true
    this.leafGeo.computeVertexNormals()
  }

  private sliceTexture(kind: 'speed' | 'pressure') {
    const s = this.air.meta.slice
    const [sx, sz] = s.n
    const data = new Uint8Array(sx * sz * 4)
    const c = [0, 0, 0]
    const pmax = Math.max(Math.abs(s.pressure_range[0]), Math.abs(s.pressure_range[1]))
    for (let i = 0; i < sx * sz; i++) {
      let a: number
      if (kind === 'speed') {
        deltaColor(this.air.speed[i]! * s.speed_scale, this.air.meta.wind, s.speed_max, c)
        a = 0.8
      } else {
        const v = (this.air.pressure[i]! * s.pressure_scale) / pmax
        pressureColor(Math.sign(v) * Math.pow(Math.abs(v), 0.6), c)
        a = 1
      }
      data[4 * i] = Math.round(255 * c[0]! * a)
      data[4 * i + 1] = Math.round(255 * c[1]! * a)
      data[4 * i + 2] = Math.round(255 * c[2]! * a)
      data[4 * i + 3] = 255
    }
    const tex = new THREE.DataTexture(data, sx, sz, THREE.RGBAFormat)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.magFilter = THREE.LinearFilter
    tex.minFilter = THREE.LinearFilter
    tex.needsUpdate = true
    return tex
  }

  /**
   * The simulated leaf is a zero-thickness shell inside the air mesh; a display
   * particle whose step crosses it (inside an ellipse fitted to its outline) is retired.
   */
  private hitsLeaf(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
    const f = this.air.meta.leaf.frame
    const c = f.center, n = f.normal
    const d0 = (x0 - c[0]!) * n[0]! + (y0 - c[1]!) * n[1]! + (z0 - c[2]!) * n[2]!
    const d1 = (x1 - c[0]!) * n[0]! + (y1 - c[1]!) * n[1]! + (z1 - c[2]!) * n[2]!
    if (d0 * d1 > 0) return false
    const t = d0 / (d0 - d1 || 1e-12)
    const qx = x0 + t * (x1 - x0) - c[0]!, qy = y0 + t * (y1 - y0) - c[1]!, qz = z0 + t * (z1 - z0) - c[2]!
    const s = (qx * f.span[0]! + qy * f.span[1]! + qz * f.span[2]!) / f.half_span
    const w = (qx * f.chord[0]! + qy * f.chord[1]! + qz * f.chord[2]!) / f.half_chord
    return s * s + w * w < 1
  }

  /** New particle: mostly in the band that meets the leaf, some anywhere upstream. */
  private spawn(i: number, anywhere = false) {
    const { lo, hi } = this.air.meta.box
    const near = Math.random() < 0.65
    const c = this.center
    const y = near ? c.y + (Math.random() - 0.5) * 0.11 : lo[1]! + Math.random() * (hi[1]! - lo[1]!)
    const z = near ? c.z + (Math.random() - 0.5) * 0.07 : lo[2]! + Math.random() * (hi[2]! - lo[2]!)
    const x = anywhere ? lo[0]! + Math.random() * (hi[0]! - lo[0]!) : lo[0]! + Math.random() * 0.004
    this.p[3 * i] = x
    this.p[3 * i + 1] = Math.min(hi[1]!, Math.max(lo[1]!, y))
    this.p[3 * i + 2] = Math.min(hi[2]!, Math.max(lo[2]!, z))
    this.age[i] = 0
    this.life[i] = 2.5 + Math.random() * 2.5
  }

  private frame = () => {
    this.raf = requestAnimationFrame(this.frame)
    const now = performance.now()
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    const h = dt * this.timeScale

    // Leaf magnification eases between x1 and x100.
    if (Math.abs(this.magGoal - this.mag) > 0.05) {
      this.mag += (this.magGoal - this.mag) * (this.opts.reducedMotion ? 1 : 1 - Math.pow(0.02, dt))
      this.updateLeaf()
    }

    // Particles: midpoint (RK2) steps through the frozen 6 ms field.
    const pos = (this.streaks.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array
    const col = (this.streaks.geometry.attributes.color as THREE.BufferAttribute).array as Float32Array
    const v = [0, 0, 0], v2 = [0, 0, 0], c = [0, 0, 0]
    const smax = this.air.meta.field.speed_max
    for (let i = 0; i < this.n; i++) {
      const x = this.p[3 * i]!, y = this.p[3 * i + 1]!, z = this.p[3 * i + 2]!
      let ok = sampleVelocity(this.air, x, y, z, v)
      if (ok) ok = sampleVelocity(this.air, x + v[0]! * h * 0.5, y + v[1]! * h * 0.5, z + v[2]! * h * 0.5, v2)
      this.age[i] = this.age[i]! + dt
      if (!ok || this.age[i]! > this.life[i]!) {
        this.spawn(i)
        pos.fill(0, 6 * i, 6 * i + 6)
        col.fill(0, 8 * i, 8 * i + 8)
        continue
      }
      const nx = x + v2[0]! * h, ny = y + v2[1]! * h, nz = z + v2[2]! * h
      if (this.hitsLeaf(x, y, z, nx, ny, nz)) {
        this.spawn(i)
        pos.fill(0, 6 * i, 6 * i + 6)
        col.fill(0, 8 * i, 8 * i + 8)
        continue
      }
      this.p[3 * i] = nx; this.p[3 * i + 1] = ny; this.p[3 * i + 2] = nz
      // Streak length shows speed: ~22 ms of travel at true scale.
      const L = 0.022
      pos[6 * i] = nx; pos[6 * i + 1] = ny; pos[6 * i + 2] = nz
      pos[6 * i + 3] = nx - v2[0]! * L; pos[6 * i + 4] = ny - v2[1]! * L; pos[6 * i + 5] = nz - v2[2]! * L
      // Undisturbed air: dim cool white; slowed air: teal; sped-up air: gold.
      const spd = Math.hypot(v2[0]!, v2[1]!, v2[2]!)
      deltaColor(spd, this.air.meta.wind, smax, c)
      const fade = Math.min(1, this.age[i]! * 2) * Math.min(1, (this.life[i]! - this.age[i]!) * 2)
      const a = 0.85 * fade
      col[8 * i] = (0.16 + c[0]!) * a; col[8 * i + 1] = (0.17 + c[1]!) * a; col[8 * i + 2] = (0.2 + c[2]!) * a; col[8 * i + 3] = 1
      col[8 * i + 4] = 0; col[8 * i + 5] = 0; col[8 * i + 6] = 0; col[8 * i + 7] = 1
    }
    this.streaks.geometry.attributes.position!.needsUpdate = true
    this.streaks.geometry.attributes.color!.needsUpdate = true

    // Camera orbit around the leaf.
    if (!this.opts.reducedMotion) this.orbitGoal.az += dt * 0.025
    const k = 1 - Math.pow(0.002, dt)
    this.orbit.az += (this.orbitGoal.az - this.orbit.az) * k
    this.orbit.el += (this.orbitGoal.el - this.orbit.el) * k
    this.orbit.d += (this.orbitGoal.d - this.orbit.d) * k
    const { az, el, d } = this.orbit
    const target = toThree(this.center.x, this.center.y, this.center.z)
    this.camera.position.copy(target).add(toThree(d * Math.cos(el) * Math.cos(az), d * Math.cos(el) * Math.sin(az), d * Math.sin(el)))
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

    if (this.opts.onFrame) {
      const a = toThree(this.scaleBar[0].x, this.scaleBar[0].y, this.scaleBar[0].z).project(this.camera)
      const b = toThree(this.scaleBar[1].x, this.scaleBar[1].y, this.scaleBar[1].z).project(this.camera)
      const sx = (u: number) => (u * 0.5 + 0.5) * this.width
      const sy = (u: number) => (-u * 0.5 + 0.5) * this.height
      this.opts.onFrame({ bar: [sx(a.x), sy(a.y), sx(b.x), sy(b.y)] })
    }
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
    this.camera.fov = w / h < 0.8 ? 44 : 30
    if (inset.r > 0.5 || inset.b > 0.5) this.camera.setViewOffset(w, h, inset.r / 2, inset.b * 0.45, w, h)
    else this.camera.clearViewOffset()
    this.camera.updateProjectionMatrix()
  }
}
