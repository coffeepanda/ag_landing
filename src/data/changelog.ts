// Simple local data you can edit quickly
export type Change = {
  title: string
  items: string[]
  link?: string
}

export type Release = {
  version: string // e.g. "0.0.1" or "pre-alpha"
  date: string    // ISO or "Oct 31, 2025"
  tag?: "Added" | "Changed" | "Fixed" | "Announcement"
  changes: Change[]
}

export const CHANGELOG: Release[] = [
  {
    version: "pre-alpha",
    date: "Oct 31, 2025",
    tag: "Announcement",
    changes: [
      {
        title: "AetherGraph announcement site live",
        items: [
          "Hero demo with Chat (mock) ↔ Code toggle",
          "Hello World example: ask_text → artifacts.search(kind=...) → send_text",
          "Mock chat UI tightened; inline meta timestamps",
          "Footer with LinkedIn, disabled GitHub (soon), Changelog, Privacy, Contact",
        ],
      },
      {
        title: "Roadmap (near-term)",
        items: [
          "Public repo & docs (mid-November target)",
          "Examples: memory record/recent, artifacts save/search, hello_world LLM",
          "Hosted/cloud updates page",
        ],
      },
    ],
  },
  // Add new entries at the TOP when you ship
  // {
  //   version: "0.1.0",
  //   date: "Nov 15, 2025",
  //   tag: "Added",
  //   changes: [
  //     { title: "Public alpha", items: ["Open core repo", "Quickstart docs", "Example flows"] },
  //   ],
  // },
]
