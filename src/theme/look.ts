import { useSyncExternalStore } from 'react'

/**
 * PROTOTYPE: three ways to carry the AG Physics brand (Instrument palette) onto the landing.
 *  a  Instrument dark   the current full-bleed layout, recoloured with Instrument's dark mode
 *  b  Bench & viewport  bone-paper page; video and scenes sit in a framed dark viewport
 *  c  Paper chrome      full-bleed dark scenes; every control is a paper card over them
 * Pick with ?look=a|b|c or the switch at the left edge. Remove once one is chosen.
 */
export type Look = 'a' | 'b' | 'c'

export const LOOKS: { id: Look; label: string }[] = [
  { id: 'a', label: 'Instrument dark' },
  { id: 'b', label: 'Bench & viewport' },
  { id: 'c', label: 'Paper chrome' }
]

const KEY = 'ag-look'
const DEFAULT: Look = 'b'
const isLook = (v: unknown): v is Look => v === 'a' || v === 'b' || v === 'c'

function initial(): Look {
  const q = new URLSearchParams(window.location.search).get('look')
  if (isLook(q)) return q
  try {
    const s = localStorage.getItem(KEY)
    if (isLook(s)) return s
  } catch {}
  return DEFAULT
}

/**
 * Colours the canvas plots read on every frame. The Behind panel is dark in look A
 * and paper in B and C, so the ink flips with the look; the accent is the live colour.
 */
export const plot = {
  ink: '236,235,230',
  accent: '240,106,60',
  mono: '"Geist Mono", ui-monospace, Consolas, monospace'
}

let current: Look = initial()
const listeners = new Set<() => void>()

function apply(look: Look) {
  const html = document.documentElement
  html.dataset.look = look
  html.dataset.agpPalette = 'instrument'
  html.dataset.agpMode = look === 'a' ? 'dark' : 'light'
  const paperPanel = look !== 'a'
  plot.ink = paperPanel ? '22,23,26' : '236,235,230'
  plot.accent = paperPanel ? '229,86,42' : '240,106,60'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', look === 'b' ? '#F5F4F0' : '#0C0D0F')
}
apply(current)

export function setLook(look: Look) {
  current = look
  apply(look)
  try {
    localStorage.setItem(KEY, look)
  } catch {}
  listeners.forEach((l) => l())
}

export function useLook(): Look {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current
  )
}
