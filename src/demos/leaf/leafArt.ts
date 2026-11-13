import * as THREE from 'three'

/** Painted autumn colour and a few soft veins. Art only: the simulated blade has no veins. */
export function leafTexture() {
  const S = 256
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')!
  // v = 0 is the base (wider end, petiole); canvas y grows downward, so flip.
  const grd = g.createLinearGradient(0, S, 0, 0)
  grd.addColorStop(0, '#8a7a2a')
  grd.addColorStop(0.32, '#c98a2a')
  grd.addColorStop(0.7, '#c2521f')
  grd.addColorStop(1, '#8e2a17')
  g.fillStyle = grd
  g.fillRect(0, 0, S, S)
  // mottling
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * S, y = Math.random() * S, r = 2 + Math.random() * 9
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '60,20,5' : '240,170,70'},${0.03 + Math.random() * 0.05})`
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill()
  }
  // veins
  g.strokeStyle = 'rgba(245,205,140,0.55)'
  g.lineWidth = 2.2
  g.beginPath(); g.moveTo(S * 0.5, S); g.quadraticCurveTo(S * 0.52, S * 0.5, S * 0.49, 0); g.stroke()
  g.lineWidth = 1.1
  g.strokeStyle = 'rgba(245,205,140,0.28)'
  for (let k = 1; k <= 7; k++) {
    const y = S * (1 - k / 8.2)
    for (const side of [-1, 1]) {
      g.beginPath()
      g.moveTo(S * 0.505, y)
      g.quadraticCurveTo(S * (0.5 + side * 0.2), y - S * 0.05, S * (0.5 + side * 0.46), y - S * 0.13)
      g.stroke()
    }
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}
