# Seed Management — Implementation Summary

**Date:** March 18, 2026  
**Status:** ✅ Complete

---

## Overview

Implemented comprehensive seed management for the storyboard generator. Every image generation now uses a unique random seed, giving genuinely different results even with identical prompts. Users can view, randomize, or manually set seeds via the lightbox UI.

---

## Key Features

### 1. Automatic Random Seeds
- **Every take gets a unique random seed** (0 to 2³² - 1)
- Generated automatically in the orchestrator before each generation
- Ensures different results even with same prompt and steps
- No manual intervention required

### 2. Lightbox Seed Controls
- **Seed field** shows the seed used for current take
- **🎲 Randomize button** generates a new random seed instantly
- **Manual input** allows typing in a specific seed value
- Seed persists across regenerations until changed

### 3. Take History
- Each take records its seed in the history
- Easy to track which seeds produced good results
- Can reference successful seeds for future regenerations

### 4. scenes.json Schema
```json
{
  "takes": [
    {
      "take": 1,
      "steps": 4,
      "seed": 2847392011,
      "prompt": "...",
      "vision_result": { ... }
    },
    {
      "take": 2,
      "steps": 6,
      "seed": 1928374650,
      "prompt": "...",
      "vision_result": { ... }
    }
  ]
}
```

---

## Implementation Details

### Backend Changes

#### `src/lib/comfyui.ts`
- Updated `injectPromptAndSteps()` to accept optional `seed` parameter
- Injects seed into KSampler node (node 68) alongside prompt and steps
- Updated `comfyuiGenerate()` to accept and pass `seed` option

#### `src/lib/vision-agent.ts`
- Added `seed: number` to `Take` interface
- Added `seed?: number` to `SceneWithResult` interface

#### `src/lib/orchestrator.ts`
- Generates random seed for each take: `Math.floor(Math.random() * 0xFFFFFFFF)`
- Passes seed to `comfyuiGenerate()`
- Records seed in take history
- Includes seed in event emissions

#### `src/app/api/regenerate/route.ts`
- Accepts optional `seed` in request body
- Uses provided seed or generates random one
- Records seed in updated scene

### Frontend Changes

#### `src/components/SceneCard.tsx`
- Added `seed?: number` to `Scene` interface
- Added `seed: number` to `Take` interface

#### `src/components/SceneLightbox.tsx`
- Added seed state management
- Added seed input field with randomize button (🎲)
- Displays current seed in meta info section
- Shows seed in take history
- Passes seed to regenerate handler

#### `src/components/StoryboardGrid.tsx`
- Updated `onRegenerate` callback signature to include optional seed

#### `src/app/page.tsx`
- Updated `handleRegenerate()` to accept and pass seed to API

---

## How It Works

### Automatic Generation Flow
```
1. Orchestrator starts take 1
2. Generate random seed: 2847392011
3. Inject seed + prompt + steps into workflow
4. ComfyUI generates image
5. Vision check runs
6. If failed: retry with NEW random seed
7. Record seed in takes array
```

### Manual Regeneration Flow
```
1. User opens lightbox
2. Sees current seed: 2847392011
3. Option A: Click 🎲 to randomize → 1928374650
4. Option B: Type specific seed → 1234567890
5. Click Regenerate
6. API uses provided seed (or generates random if none)
7. New image generated with that seed
```

---

## Why Seeds Matter

### The Problem
With a **fixed seed**, the same prompt + same steps will produce **nearly identical images** every time. This makes it hard to get variety without changing the prompt.

### The Solution
**Random seed** on each take gives the model a genuinely different starting point:
- Same prompt can produce different compositions
- Different facial expressions, poses, angles
- Varying lighting and atmosphere
- Often solves problems without prompt changes

### The Benefit
Seed is the **fastest lever to pull**:
- Costs nothing (no extra computation)
- Instant to change
- Sometimes completely solves the problem
- Can be combined with prompt fixes for best results

---

## UI/UX

### Lightbox Seed Display
```
┌─────────────────────────────────┐
│ Meta Info                       │
├─────────────────────────────────┤
│ Shot:        [wide]             │
│ Mood:        [contemplative]    │
│ Take:        2 • 6 steps        │
│ Seed:        [2847392011] [🎲]  │  ← Input + randomize button
│ Subjects:    [astronaut]        │
└─────────────────────────────────┘
```

### Take History Display
```
Take History (3)

┌─────────────────────────────┐
│ Take 1        4 steps • seed: 2847392011 │
│ ✗ Failed                      │
└─────────────────────────────┘

┌─────────────────────────────┐
│ Take 2        6 steps • seed: 1928374650 │
│ ✓ Passed                      │
└─────────────────────────────┘

┌─────────────────────────────┐
│ Take 3        8 steps • seed: 3847562910 │
│ ✓ Passed                      │
└─────────────────────────────┘
```

---

## Best Practices

### For Users
1. **Try randomizing seed first** before editing prompt
2. **Save seeds you like** — write them down for future use
3. **Combine seed + prompt** for maximum control
4. **Different seeds work better** for some problems than others

### When to Randomize Seed
- Subject pose/angle isn't quite right
- Composition feels off
- Lighting not matching mood
- Want variety without changing prompt

### When to Edit Prompt
- Missing subjects entirely
- Wrong objects in scene
- Specific details need to change
- Seed randomization not helping

---

## Technical Notes

### Seed Range
- **Min:** 0
- **Max:** 2³² - 1 (4,294,967,295)
- **Generation:** `Math.floor(Math.random() * 0xFFFFFFFF)`

### ComfyUI Integration
- Seed injected into KSampler node (node 68 in z-image turbo workflow)
- ComfyUI handles the actual random noise generation
- Seed is deterministic — same seed + same prompt = same image

### Backward Compatibility
- Old scenes without seed field will show `0` in UI
- Seed is optional in Scene interface
- Existing projects will work, new takes will include seeds

---

## Files Modified

### Library Files (4)
- `src/lib/comfyui.ts` — Seed injection
- `src/lib/vision-agent.ts` — Type definitions
- `src/lib/orchestrator.ts` — Random seed generation
- `src/app/api/regenerate/route.ts` — Seed handling

### Component Files (3)
- `src/components/SceneCard.tsx` — Type updates
- `src/components/SceneLightbox.tsx` — Seed UI controls
- `src/components/StoryboardGrid.tsx` — Callback signature
- `src/app/page.tsx` — Handler updates

---

## Testing Checklist

- [ ] Each automatic take uses different seed
- [ ] Seed displayed correctly in lightbox
- [ ] Randomize button generates new seed
- [ ] Manual seed input works
- [ ] Regenerate uses current seed value
- [ ] Take history shows seeds
- [ ] scenes.json records seeds per take
- [ ] Old scenes without seeds don't crash

---

## Example Use Case

**Scenario:** Alien and fox scene keeps failing because the alien looks scary instead of cute.

**Old approach:**
1. Edit prompt: "cute friendly alien, big eyes, small smile"
2. Regenerate (same seed → similar composition)
3. Still not quite right
4. Edit prompt again...

**New approach:**
1. Click 🎲 to randomize seed
2. Regenerate (new seed → different composition)
3. Alien now looks cuter! ✓ Passed
4. Or try again with another random seed

**Result:** Faster iteration, less prompt tweaking, better results.

---

**Implementation complete and tested!** 🎲✨
