# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ Next.js 16 Warning

This project uses Next.js 16.2.9 which has breaking changes from earlier versions. **Always read the relevant guide in `node_modules/next/dist/docs/` before writing any code.** APIs, conventions, and file structure may differ from training data. Heed deprecation notices.

## Commands

- `npm run dev` — Start development server
- `npm run build` — Production build
- `npm run start` — Start production server
- `npm run lint` — Run ESLint

## Tech Stack

- **Next.js 16** with App Router (not Pages Router)
- **React 19** 
- **TypeScript** (strict mode)
- **Tailwind CSS v4** — uses `@import "tailwindcss"` syntax, configured via `@tailwindcss/postcss`
- **ESLint 9** — flat config format (`eslint.config.mjs`), extends `core-web-vitals` and `typescript`

## Architecture

- `app/` — App Router directory (layouts, pages, routes)
- `app/layout.tsx` — Root layout with Geist fonts and global CSS
- `app/globals.css` — Tailwind imports + CSS custom properties for light/dark theming
- `public/` — Static assets
- Path alias: `@/*` maps to project root

## Conventions

- Dark mode via CSS variables and `prefers-color-scheme` media query
- Fonts: Geist Sans (variable) and Geist Mono (variable) applied as CSS custom properties
