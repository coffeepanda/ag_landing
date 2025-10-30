
# AetherGraph Landing — Vite + React + TypeScript + Tailwind

A Vite project scaffolding that ports your static landing page into reusable React components with a shared Tailwind theme and React Router for future pages.

## Scripts
- `pnpm i` (or `npm i`, `yarn`) to install
- `pnpm dev` to run locally
- `pnpm build` to build for production
- `pnpm preview` to preview the build

## Tech
- **Vite** for fast dev/build
- **React + TypeScript**
- **Tailwind** for styling (theme tokens in `tailwind.config.ts` and `src/styles.css`)
- **React Router** for multiple pages (e.g., `/privacy`)

## Where things live
- `src/components/*` — Header, Hero, Sections, SvgSprite, Waitlist, Footer
- `src/pages/*` — App (home), Privacy, NotFound
- `src/styles.css` — Tailwind and small utility classes (glass, aeg-card, etc.)

## Theming
- Colors `brand` and `accent`, fonts, shadows are declared in `tailwind.config.ts`
- Global utility classes mirror the original static page

## Deploy
- Build: `pnpm build` -> output in `dist/`
- Static hosting: Netlify, Vercel, Cloudflare Pages, GitHub Pages, etc.
