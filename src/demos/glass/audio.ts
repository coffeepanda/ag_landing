import type { Glass } from './data'

const DURATION = 6 // seconds of ring per strike, as in the saved notes
const ATTACK = 0.002
const RELEASE = 0.1

/**
 * Plays each glass as the sum of its saved modes:
 *   w_j * exp(-gamma_j t) * sin(2 pi f_j t + phase_j)
 * One common gain for all glasses, so their relative loudness is kept.
 */
export class GlassAudio {
  readonly ctx: AudioContext
  private master: GainNode
  private buffers = new Map<number, AudioBuffer>()
  private live = new Set<AudioBufferSourceNode>()
  private gain: number
  private pans: number[]

  constructor(private glasses: Glass[], pans: number[]) {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    this.ctx = new Ctx({ latencyHint: 'interactive' })
    this.pans = pans

    // Common gain from a conservative peak bound (sum of |w|) over the whole set.
    const peak = Math.max(...glasses.map((g) => g.modes.reduce((a, m) => a + Math.abs(m.w), 0)))
    this.gain = 0.42 / peak

    const comp = this.ctx.createDynamicsCompressor()
    comp.threshold.value = -10
    comp.knee.value = 8
    comp.ratio.value = 4
    comp.attack.value = 0.003
    comp.release.value = 0.25
    comp.connect(this.ctx.destination)

    this.master = this.ctx.createGain()
    this.master.connect(comp)

    // Small room: a soft generated reverb send.
    const verb = this.ctx.createConvolver()
    verb.buffer = this.impulse(2.6)
    const send = this.ctx.createGain()
    send.gain.value = 0.22
    this.master.connect(send).connect(verb).connect(comp)

    // Build buffers in the background, one per idle slot.
    let i = 0
    const next = () => {
      if (i >= glasses.length) return
      this.buffer(i++)
      setTimeout(next, 30)
    }
    setTimeout(next, 60)
  }

  set muted(v: boolean) {
    this.master.gain.setTargetAtTime(v ? 0 : 1, this.ctx.currentTime, 0.03)
  }

  resume() {
    if (this.ctx.state !== 'running') void this.ctx.resume()
  }

  /** Schedule glass i at context time `when` (default: now). */
  strike(i: number, when = this.ctx.currentTime, velocity = 1) {
    const src = this.ctx.createBufferSource()
    src.buffer = this.buffer(i)
    const g = this.ctx.createGain()
    g.gain.value = velocity
    const pan = this.ctx.createStereoPanner()
    pan.pan.value = this.pans[i] ?? 0
    src.connect(g).connect(pan).connect(this.master)
    src.start(Math.max(when, this.ctx.currentTime))
    this.live.add(src)
    src.onended = () => this.live.delete(src)
  }

  stopAll() {
    const t = this.ctx.currentTime
    for (const s of this.live) {
      try { s.stop(t + 0.05) } catch { /* not started */ }
    }
  }

  dispose() {
    this.stopAll()
    void this.ctx.close()
  }

  private buffer(i: number): AudioBuffer {
    const cached = this.buffers.get(i)
    if (cached) return cached
    const rate = this.ctx.sampleRate
    const len = Math.round(DURATION * rate)
    const buf = this.ctx.createBuffer(1, len, rate)
    const out = buf.getChannelData(0)
    const glass = this.glasses[i]!
    for (const m of glass.modes) {
      // Recurrence for exp(-gamma t) sin(w t + phi): one complex rotation per sample.
      const w = (2 * Math.PI * m.f) / rate
      const decay = Math.exp(-m.gamma / rate)
      const cr = Math.cos(w) * decay
      const ci = Math.sin(w) * decay
      let re = Math.cos(m.phase) * m.w * this.gain
      let im = Math.sin(m.phase) * m.w * this.gain
      for (let k = 0; k < len; k++) {
        out[k]! += im
        const r = re * cr - im * ci
        im = re * ci + im * cr
        re = r
      }
    }
    const a = Math.round(ATTACK * rate)
    const r = Math.round(RELEASE * rate)
    for (let k = 0; k < a; k++) out[k]! *= 0.5 - 0.5 * Math.cos((Math.PI * k) / a)
    for (let k = 0; k < r; k++) out[len - 1 - k]! *= 0.5 - 0.5 * Math.cos((Math.PI * k) / r)
    this.buffers.set(i, buf)
    return buf
  }

  private impulse(seconds: number): AudioBuffer {
    const rate = this.ctx.sampleRate
    const len = Math.round(seconds * rate)
    const buf = this.ctx.createBuffer(2, len, rate)
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch)
      let lp = 0
      for (let k = 0; k < len; k++) {
        lp = lp * 0.6 + (Math.random() * 2 - 1) * 0.4 // darken the tail
        d[k] = lp * Math.pow(1 - k / len, 3.2)
      }
    }
    return buf
  }
}
