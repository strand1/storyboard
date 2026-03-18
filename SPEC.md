# SPEC.md

**Project:** storyboard
**Status:** STUB — Lead agent should complete this on first run.

## Overview
A local web app that orchestrates Ollama and ComfyUI to turn a one-line story idea into a visual storyboard. A Python backend handles the LLM and ComfyUI calls; a browser UI shows the storyboard grid with live generation status and per-scene controls.

## Goals
- [ ] TBD — Lead to define with user on first run

## Non-Goals
- [ ] TBD — Lead to define with user on first run

## Stack & Design System
**Formula:** magic (Next.js + Tailwind + shadcn/ui)

### Stack
- Framework: Next.js 14 (App Router)
- Styling: Tailwind CSS + shadcn/ui components
- Font: Inter
- Deployment: Vercel

### Design Rules
- Palette: Neutral grays (slate/zinc scale) + one accent color used sparingly
- Spacing: 8px scale (8, 16, 24, 32, 48, 64px) — no exceptions
- Borders: 1px, rgba(0,0,0,0.08) — subtle always
- Radius: 8px everywhere, consistent
- Shadows: Minimal — prefer borders over shadows
- Typography: Hierarchy through size/weight, not color
- Whitespace: ~40% empty screen — whitespace over decoration
- Components: Build 5–7 core components perfectly, compose everything from those

### What This Means in Practice
- 90% of design decisions are already made — follow the rules, don't invent
- No custom CSS unless shadcn/ui genuinely can't do it
- If it looks busy, add whitespace before adding anything else

## Technical Decisions
| Decision | Choice | Notes |
|----------|--------|-------|
| Stack | magic | User-selected |
| Language | TypeScript (Next.js 14) | From stack |
| Database | none | User-selected |
| Auth | none | User-selected |
| Deployment | local | User-selected |

## Open Questions
- [ ] Lead: Complete Goals and Non-Goals with user before starting implementation
- [ ] Lead: Clarify any TBD answers from initialization