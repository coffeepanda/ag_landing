import * as THREE from 'three'
import { breeze, Flight, type LeafBundle, type Pose } from './data'
import { leafTexture } from './leafArt'

const HOLD = 1.3      // s on the branch before it lets go
const FOLLOW_D = 0.5  // m, camera distance while following
const MOTES = 520

/** Simulation frame is z-up; everything lives in a group rotated into three's y-up. */
const toThree = (v: ArrayLike<number>, out = new THREE.Vector3()) => out.set(v[0]!, v[2]!, -v[1]!)

export type LeafTick = { t: number; playing: boolean; landed: boolean }

export class LeafScene {
  readonly flight: Flight
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private world = new THREE.Group()
  private camera = new THREE.PerspectiveCamera(34, 1, 0.01, 60)
  private raf = 0
  private last = performance.now()
  private width = 1
  private height = 1
  private ro: ResizeObserver
  private disposables: { dispose(): void }[] = []

  // Playback
  private t = 0
  private hold = HOLD
  private playing = true
  private speed = 0.25 // slow motion by default
  private clock = 0 // breeze clock for the motes

  // Leaf
  private pose: Pose = { p: [0, 0, 0], q: [1, 0, 0, 0], eta: [0, 0, 0] }
  private pivot = new THREE.Group()
  private leafGeo: THREE.BufferGeometry
  private baseXY: Float32Array
  private phi: Float32Array
  private petiole: THREE.Mesh
  private baseIndex = 0
  private trail: THREE.Line

  // Camera
  private target = new THREE.Vector3()
  private targetVel = new THREE.Vector3()
  private snap = false
  private orbit = { az: -Math.PI / 2 + 0.25, el: 0.12, d: FOLLOW_D }
  private orbitGoal = { az: -Math.PI / 2 + 0.25, el: 0.12, d: FOLLOW_D }
  private inset = { r: 0, b: 0 }
  private insetTarget = { r: 0, b: 0 }

  // Air
  private motes!: THREE.Points
  private moteVel = new THREE.Vector3()
  private sun = new THREE.DirectionalLight(0xffc690, 2.6)
  private sunDir = new THREE.Vector3(-0.55, -0.75, 0.55).normalize() // sim frame, toward the sun

  constructor(
    private canvas: HTMLCanvasElement,
    private bundle: LeafBundle,
    private opts: { reducedMotion: boolean; onTick?: (s: LeafTick) => void }
  ) {
    this.flight = new Flight(bundle)
    const coarse = window.matchMedia('(pointer: coarse)').matches
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarse ? 1.75 : 2))
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.0
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap

    this.scene.background = new THREE.Color(0x030303)
    this.scene.fog = new THREE.FogExp2(0x0a0705, 0.16)
    this.world.rotation.x = -Math.PI / 2
    this.scene.add(this.world)

    const leafTex = leafTexture()
    this.disposables.push(leafTex)

    // ---- the leaf
    const m = bundle.mesh
    const nv = m.xy.length / 2
    this.baseXY = Float32Array.from(m.xy)
    this.phi = Float32Array.from(m.phi)
    this.leafGeo = leafGeometry(m.xy, m.faces)
    for (let i = 0, minY = Infinity; i < nv; i++) {
      if (m.xy[2 * i + 1]! < minY) { minY = m.xy[2 * i + 1]!; this.baseIndex = i }
    }
    const leafMat = new THREE.MeshStandardMaterial({ map: leafTex, side: THREE.DoubleSide, roughness: 0.62, metalness: 0, emissive: 0x3a1404, emissiveIntensity: 0.6 })
    const leaf = new THREE.Mesh(this.leafGeo, leafMat)
    leaf.castShadow = true
    this.pivot.add(leaf)
    this.petiole = petiole()
    this.pivot.add(this.petiole)
    this.world.add(this.pivot)

    // ---- ground at the flight's end clearance: the leaf touches down as the flight ends
    const groundZ = bundle.clearance
    const ground = new THREE.Mesh(new THREE.CircleGeometry(14, 72), new THREE.MeshStandardMaterial({ color: 0x1b130c, roughness: 0.96 }))
    ground.position.z = groundZ
    ground.receiveShadow = true
    this.world.add(ground)

    const end = this.flight.vec('position', this.flight.n - 1)
    this.world.add(fallenLeaves(m.xy, m.faces, leafTex, end, groundZ))

    // ---- the branch it hangs from
    this.flight.sample(0, this.pose)
    this.applyPose()
    this.pivot.updateMatrix()
    const tip = new THREE.Vector3(...this.petioleTip()).applyMatrix4(this.pivot.matrix)
    this.world.add(branch(tip, m.xy, m.faces, leafTex))

    // ---- path traced so far
    const pts = new Float32Array(this.flight.n * 3)
    for (let k = 0; k < this.flight.n; k++) pts.set(this.flight.vec('position', k), 3 * k)
    const trailGeo = new THREE.BufferGeometry()
    trailGeo.setAttribute('position', new THREE.BufferAttribute(pts, 3))
    this.trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: 0xd9b98a, transparent: true, opacity: 0.38, depthWrite: false }))
    this.trail.geometry.setDrawRange(0, 0)
    this.world.add(this.trail)

    // ---- light: low afternoon sun, soft sky
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(1024, 1024)
    const sc = this.sun.shadow.camera
    sc.left = sc.bottom = -0.45
    sc.right = sc.top = 0.45
    sc.near = 0.1
    sc.far = 8
    this.sun.shadow.bias = -0.0004
    this.sun.shadow.normalBias = 0.002
    this.scene.add(this.sun, this.sun.target)
    this.scene.add(new THREE.HemisphereLight(0x9a8670, 0x0b0705, 0.85))
    this.scene.add(sky(toThree(this.sunDir.toArray())))

    this.buildMotes()

    toThree(this.pose.p, this.target)
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(canvas.parentElement ?? canvas)
    this.resize()
    this.raf = requestAnimationFrame(this.frame)
  }

  // ---------------------------------------------------------------- controls

  get time() {
    return this.t
  }

  letGo() {
    this.t = 0
    this.hold = 0.5
    this.playing = true
    this.snap = true
  }

  setPlaying(p: boolean) {
    if (p && this.t >= this.flight.duration - 0.005) this.letGo()
    else this.playing = p
  }

  setSpeed(s: number) {
    this.speed = s
  }

  seek(t: number) {
    this.t = Math.max(0, Math.min(this.flight.duration, t))
    this.hold = 0
    this.snap = true // scrubbing should feel immediate: no camera glide
  }

  orbitBy(dx: number, dy: number) {
    this.orbitGoal.az -= dx * 0.006
    this.orbitGoal.el = Math.max(-0.25, Math.min(1.1, this.orbitGoal.el + dy * 0.004))
  }

  zoomBy(f: number) {
    this.orbitGoal.d = Math.max(0.22, Math.min(1.6, this.orbitGoal.d * f))
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

  // ---------------------------------------------------------------- frame

  private frame = () => {
    this.raf = requestAnimationFrame(this.frame)
    const nowMs = performance.now()
    const dt = Math.min(0.05, (nowMs - this.last) / 1000)
    this.last = nowMs

    const dur = this.flight.duration
    if (this.playing) {
      if (this.hold > 0) this.hold -= dt
      else this.t = Math.min(dur, this.t + dt * this.speed)
    }
    const landed = this.t >= dur - 0.005 // the scrubber snaps to 1 ms steps
    this.clock += dt * (this.playing ? this.speed : 0.25)

    this.flight.sample(this.t, this.pose)
    this.applyPose()
    this.trail.geometry.setDrawRange(0, Math.max(0, Math.floor(this.t * this.bundle.rate) + 1))

    this.updateCamera(dt, landed)
    this.updateMotes(dt)

    // Sun and its shadow camera follow the leaf.
    this.sun.target.position.copy(this.target)
    this.sun.position.copy(this.target).addScaledVector(toThree(this.sunDir.toArray()), 3)

    this.renderer.render(this.scene, this.camera)
    this.opts.onTick?.({ t: this.t, playing: this.playing && !landed, landed })
  }

  private applyPose() {
    const { p, q, eta } = this.pose
    this.pivot.position.set(p[0], p[1], p[2])
    this.pivot.quaternion.set(q[1], q[2], q[3], q[0])
    const pos = this.leafGeo.attributes.position as THREE.BufferAttribute
    const arr = pos.array as Float32Array
    const n = arr.length / 3
    for (let i = 0; i < n; i++) {
      arr[3 * i] = this.baseXY[2 * i]!
      arr[3 * i + 1] = this.baseXY[2 * i + 1]!
      arr[3 * i + 2] = this.phi[3 * i]! * eta[0] + this.phi[3 * i + 1]! * eta[1] + this.phi[3 * i + 2]! * eta[2]
    }
    pos.needsUpdate = true
    this.leafGeo.computeVertexNormals()
    const b = this.baseIndex
    this.petiole.position.set(arr[3 * b]!, arr[3 * b + 1]!, arr[3 * b + 2]!)
  }

  private petioleTip(): [number, number, number] {
    const b = this.baseIndex
    const arr = this.leafGeo.attributes.position!.array as Float32Array
    return [arr[3 * b]!, arr[3 * b + 1]! - 0.016, arr[3 * b + 2]! + 0.004]
  }

  private updateCamera(dt: number, landed: boolean) {
    // Critically damped follow: smooth, never overshooting the leaf.
    const goal = toThree(this.pose.p, new THREE.Vector3())
    if (this.snap) {
      this.target.copy(goal)
      this.targetVel.set(0, 0, 0)
      this.snap = false
    }
    const w = 5.5
    const a = new THREE.Vector3().subVectors(goal, this.target).multiplyScalar(w * w).addScaledVector(this.targetVel, -2 * w)
    this.targetVel.addScaledVector(a, dt)
    this.target.addScaledVector(this.targetVel, dt)

    if (landed) {
      this.orbitGoal.d += (Math.max(this.orbitGoal.d, 0.72) - this.orbitGoal.d) * 0.02
      this.orbitGoal.el += (Math.max(this.orbitGoal.el, 0.42) - this.orbitGoal.el) * 0.02
    }
    if (!this.opts.reducedMotion && this.playing && !landed) this.orbitGoal.az += dt * 0.035
    const k = 1 - Math.pow(0.002, dt)
    this.orbit.az += (this.orbitGoal.az - this.orbit.az) * k
    this.orbit.el += (this.orbitGoal.el - this.orbit.el) * k
    this.orbit.d += (this.orbitGoal.d - this.orbit.d) * k

    const { az, el, d } = this.orbit
    const off = [d * Math.cos(el) * Math.cos(az), d * Math.cos(el) * Math.sin(az), d * Math.sin(el)]
    this.camera.position.copy(this.target).add(toThree(off))
    this.camera.lookAt(this.target)

    // Overlay inset: ease and re-centre.
    const dr = this.insetTarget.r - this.inset.r
    const db = this.insetTarget.b - this.inset.b
    if (Math.abs(dr) > 0.5 || Math.abs(db) > 0.5 || dr !== 0 || db !== 0) {
      const kk = this.opts.reducedMotion || (Math.abs(dr) <= 0.5 && Math.abs(db) <= 0.5) ? 1 : 0.12
      this.inset.r += dr * kk
      this.inset.b += db * kk
      this.applyView()
    }
  }

  private buildMotes() {
    const pos = new Float32Array(MOTES * 3)
    const seed = new Float32Array(MOTES)
    for (let i = 0; i < MOTES; i++) {
      pos[3 * i] = (Math.random() - 0.5) * 2.4
      pos[3 * i + 1] = (Math.random() - 0.5) * 2.4
      pos[3 * i + 2] = (Math.random() - 0.5) * 2.4
      seed[i] = Math.random()
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1))
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uScale: { value: 1 }, uTime: { value: 0 } },
      vertexShader: `
        attribute float seed;
        uniform float uScale; uniform float uTime;
        varying float vA;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          float tw = 0.55 + 0.45 * sin(uTime * (0.6 + seed) + seed * 40.0);
          vA = tw * smoothstep(3.2, 0.25, -mv.z);
          gl_PointSize = uScale * (0.9 + 1.6 * seed) / -mv.z;
        }`,
      fragmentShader: `
        varying float vA;
        void main() {
          float r = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, r) * vA;
          gl_FragColor = vec4(1.0, 0.82, 0.6, a * 0.55);
        }`
    })
    this.motes = new THREE.Points(geo, mat)
    this.motes.frustumCulled = false
    this.world.add(this.motes)
  }

  /** Motes drift with the same prescribed breeze; they wrap around the leaf. */
  private updateMotes(dt: number) {
    const u = breeze(this.bundle.breeze, this.clock, [0, 0, 0])
    const s = dt * (this.playing ? this.speed : 0.25)
    const pos = this.motes.geometry.attributes.position as THREE.BufferAttribute
    const a = pos.array as Float32Array
    const c = this.pose.p
    const half = 1.2
    for (let i = 0; i < MOTES; i++) {
      for (let j = 0; j < 3; j++) {
        let v = a[3 * i + j]! + u[j]! * s
        const rel = v - c[j]!
        if (rel > half) v -= 2 * half
        else if (rel < -half) v += 2 * half
        a[3 * i + j] = v
      }
    }
    pos.needsUpdate = true
    const mat = this.motes.material as THREE.ShaderMaterial
    mat.uniforms.uTime!.value = this.clock
    mat.uniforms.uScale!.value = this.height * this.renderer.getPixelRatio() * 0.012
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
    // Narrow screens: pull back so the leaf and its swing stay in frame.
    this.camera.fov = w / h < 0.8 ? 46 : 34
    if (inset.r > 0.5 || inset.b > 0.5) this.camera.setViewOffset(w, h, inset.r / 2, inset.b * 0.45, w, h)
    else this.camera.clearViewOffset()
    this.camera.updateProjectionMatrix()
  }
}

// ---------------------------------------------------------------- builders

function leafGeometry(xy: number[], faces: number[]) {
  const n = xy.length / 2
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  for (let i = 0; i < n; i++) {
    x0 = Math.min(x0, xy[2 * i]!); x1 = Math.max(x1, xy[2 * i]!)
    y0 = Math.min(y0, xy[2 * i + 1]!); y1 = Math.max(y1, xy[2 * i + 1]!)
  }
  const pos = new Float32Array(n * 3)
  const uv = new Float32Array(n * 2)
  for (let i = 0; i < n; i++) {
    pos[3 * i] = xy[2 * i]!
    pos[3 * i + 1] = xy[2 * i + 1]!
    uv[2 * i] = (xy[2 * i]! - x0) / (x1 - x0)
    uv[2 * i + 1] = (xy[2 * i + 1]! - y0) / (y1 - y0)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setIndex(faces)
  g.computeVertexNormals()
  return g
}

function petiole() {
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0, 0.002, 0),
    new THREE.Vector3(0, -0.009, 0),
    new THREE.Vector3(0, -0.016, 0.004)
  )
  const m = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 10, 0.0007, 6, false),
    new THREE.MeshStandardMaterial({ color: 0x6b4a22, roughness: 0.7 })
  )
  m.castShadow = true
  return m
}

/** Bark branch through the petiole's tip, with two leaves still holding on. */
function branch(tip: THREE.Vector3, xy: number[], faces: number[], tex: THREE.Texture) {
  const g = new THREE.Group()
  const curve = new THREE.CatmullRomCurve3([
    tip.clone().add(new THREE.Vector3(-0.85, 0.35, 0.32)),
    tip.clone().add(new THREE.Vector3(-0.42, 0.16, 0.12)),
    tip.clone().add(new THREE.Vector3(-0.08, 0.02, 0.02)),
    tip.clone().add(new THREE.Vector3(0, 0, 0.003)),
    tip.clone().add(new THREE.Vector3(0.14, 0.03, -0.015)),
    tip.clone().add(new THREE.Vector3(0.26, 0.07, 0.02))
  ])
  const seg = 80
  const geo = new THREE.TubeGeometry(curve, seg, 1, 10, false)
  // Taper: thick at the trunk end, thin at the twig.
  const p = geo.attributes.position as THREE.BufferAttribute
  for (let i = 0; i <= seg; i++) {
    const c = curve.getPointAt(i / seg)
    const r = 0.016 * Math.pow(1 - i / seg, 1.3) + 0.0018
    for (let j = 0; j <= 10; j++) {
      const k = i * 11 + j
      const v = new THREE.Vector3().fromBufferAttribute(p, k).sub(c).multiplyScalar(r).add(c)
      p.setXYZ(k, v.x, v.y, v.z)
    }
  }
  geo.computeVertexNormals()
  const bark = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x2a1d14, roughness: 0.92 }))
  bark.castShadow = true
  g.add(bark)

  const leafGeo = leafGeometry(xy, faces)
  // Neighbours on the far part of the branch, away from the camera.
  const spots: [number, number, number, number][] = [
    [0.16, 0.9, 0.4, 0xffffff],
    [0.3, -0.6, 1.1, 0xd8b07a],
    [0.42, 2.2, 0.7, 0xc89a6a]
  ]
  for (const [u, rz, tilt, tint] of spots) {
    const at = curve.getPointAt(u)
    const l = new THREE.Mesh(leafGeo, new THREE.MeshStandardMaterial({ map: tex, color: tint, side: THREE.DoubleSide, roughness: 0.65 }))
    l.position.copy(at).add(new THREE.Vector3(0, 0.03, -0.046))
    l.rotation.set(tilt, 0.3, rz)
    l.castShadow = true
    g.add(l)
  }
  return g
}

function fallenLeaves(xy: number[], faces: number[], tex: THREE.Texture, at: number[], z: number) {
  const count = 110
  const geo = leafGeometry(xy, faces)
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.85 }), count)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const e = new THREE.Euler()
  const tints = [0xffffff, 0xe0b48a, 0xb88a62, 0x8f6f52, 0x6e5640]
  let rnd = 7
  const rand = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < count; i++) {
    const r = 0.13 + Math.pow(rand(), 0.7) * 1.9
    const a = rand() * Math.PI * 2
    e.set((rand() - 0.5) * 0.12, (rand() - 0.5) * 0.12, rand() * Math.PI * 2)
    q.setFromEuler(e)
    const s = 0.7 + rand() * 0.7
    m.compose(new THREE.Vector3(at[0]! + r * Math.cos(a), at[1]! + r * Math.sin(a), z + 0.0012 + i * 0.00002), q, new THREE.Vector3(s, s, s))
    mesh.setMatrixAt(i, m)
    mesh.setColorAt(i, new THREE.Color(tints[Math.floor(rand() * tints.length)]!))
  }
  mesh.receiveShadow = true
  return mesh
}

function sky(sunDir: THREE.Vector3) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { uSun: { value: sunDir.clone().normalize() } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vDir; uniform vec3 uSun;
      void main(){
        float h = vDir.y;
        vec3 top = vec3(0.012, 0.012, 0.016);
        vec3 horizon = vec3(0.10, 0.055, 0.03);
        vec3 c = mix(horizon, top, smoothstep(-0.05, 0.55, h));
        float s = max(dot(vDir, uSun), 0.0);
        c += vec3(0.55, 0.32, 0.14) * pow(s, 18.0) * 0.6 + vec3(0.25, 0.13, 0.05) * pow(s, 3.0) * 0.25;
        gl_FragColor = vec4(c, 1.0);
      }`
  })
  const m = new THREE.Mesh(new THREE.SphereGeometry(30, 32, 16), mat)
  m.frustumCulled = false
  return m
}
