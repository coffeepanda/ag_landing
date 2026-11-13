import type { ComponentType } from 'react'

export const CONTACT = 'contact@aiperture.io'

/** Top-level sections. `soon` tabs render dimmed and are not clickable. */
export type Section = { id: string; label: string; soon?: boolean }

export const PHENOMENA = 'phenomena'

export const SECTIONS: Section[] = [
  { id: '', label: 'Unknown' },
  { id: PHENOMENA, label: 'Phenomena' },
  { id: 'platform', label: 'Platform', soon: true },
  { id: 'company', label: 'Company', soon: true }
]

/**
 * Demo registry. Order follows the "day" arc: dawn → afternoon → evening.
 * Adding a demo = one entry here plus its module under src/demos/<id>/.
 */
export type Demo = {
  id: string
  num: string
  label: string
  /** Title split so the second part renders in the serif accent. */
  title: [string, string, string?]
  line: string
  load?: () => Promise<{ default: ComponentType }>
}

export const DEMOS: Demo[] = [
  {
    id: 'light',
    num: '01',
    label: 'Light',
    title: ['A Room Made of ', 'Light'],
    line: 'A sunbeam passes a fine grating and comes apart into colour.'
  },
  {
    id: 'leaf',
    num: '02',
    label: 'Leaf',
    title: ['The Last ', 'Leaf'],
    line: 'A leaf lets go, and the air decides how it falls.',
    load: () => import('./demos/leaf/LeafDemo')
  },
  {
    id: 'glass',
    num: '03',
    label: 'Glass',
    title: ['The ', 'Singing', ' Glass'],
    line: 'Twelve glasses, tuned with water. Strike one.',
    load: () => import('./demos/glass/GlassDemo')
  }
]

export const DEFAULT_DEMO = 'glass'
