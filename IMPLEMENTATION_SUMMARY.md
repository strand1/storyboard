# UI & Agent Improvements — Implementation Summary

**Date:** March 17, 2026  
**Status:** ✅ Complete

---

## Overview

Implemented all 8 improvement areas from the UI & Agent Improvements specification (v0.1):

1. ✅ Image lightbox with click-to-expand
2. ✅ Manual prompt editing before regenerating
3. ✅ Adaptive step count on retry
4. ✅ Stricter vision checking for multi-subject scenes
5. ✅ Updated scenes.json schema with takes array
6. ✅ Regenerate button in lightbox (no retry cap)
7. ✅ Approve button for manual override
8. ✅ Improved failure display showing missing subjects

---

## Changes by File

### Core Library Changes

#### `src/lib/config.ts`
- Added `stepLadder: number[]` to Config interface (default: `[4, 6, 8]`)
- Exported `stepLadder` constant for use in orchestrator

#### `src/lib/story-agent.ts`
- Changed `Scene.subject` from `string` to `string[]`
- Updated story agent LLM prompt to request subject as JSON array
- Instruction: "JSON array of ALL required subjects that must appear in the image"

#### `src/lib/vision-agent.ts`
- Updated `VisionResult` interface:
  - `subject_ok` → `subjects_ok` (boolean)
  - Added `missing_subjects: string[]`
- Updated `SceneWithResult` interface:
  - Added `steps: number`
  - Added `manually_approved?: boolean`
  - Added `original_comfy_prompt?: string`
  - Added `takes?: Take[]`
- Added `Take` interface with take number, steps, prompt, image_path, vision_result
- Updated vision check prompt to check ALL subjects individually
- Vision agent now returns list of missing subjects when check fails

#### `src/lib/comfyui.ts`
- Added `injectPromptAndSteps()` function to set both prompt and KSampler steps
- Updated `comfyuiGenerate()` to accept optional `steps` and `samplerNodeId` parameters
- When steps provided, updates KSampler node (node 68 in z-image turbo workflow)

#### `src/lib/orchestrator.ts`
- Added `Take` type import
- Updated `OrchestratorEvent` types to include `steps` in `scene_generate` and `scene_retry`
- Modified `processScene()` to:
  - Get step count from `config.stepLadder` based on take number
  - Pass steps to `comfyuiGenerate()`
  - Track all takes in array
  - Set `original_comfy_prompt` separately from modified `comfy_prompt`
  - Include steps in event emissions
- Updated error handling to use new `subjects_ok` and `missing_subjects` fields

#### `src/lib/projects.ts`
- Added `updateProjectScenes()` function for updating project scenes on disk
- Used by approve and regenerate API endpoints

### API Endpoints

#### `src/app/api/projects/[name]/route.ts`
- Added `PUT` method to update project scenes
- Accepts `{ scenes: SceneWithResult[] }` in request body
- Updates status based on scene statuses
- Writes updated scenes.json to disk

#### `src/app/api/regenerate/route.ts` (NEW)
- POST endpoint for manual scene regeneration
- Body: `{ projectName, sceneId, prompt }`
- Generates new image with custom prompt (no retry cap)
- Runs vision check automatically
- Creates new take record and appends to takes array
- Saves image to project folder
- Returns updated scene object

#### `src/app/api/approve/route.ts` (NEW)
- POST endpoint for manual scene approval
- Body: `{ projectName, sceneId }`
- Sets scene status to "pass"
- Sets `manually_approved: true`
- Updates project on disk
- Returns updated scene object

### Component Changes

#### `src/components/SceneCard.tsx`
- Updated `Scene` interface to match new schema:
  - `subject: string[]`
  - Added `steps?: number`
  - Added `manually_approved?: boolean`
  - Added `original_comfy_prompt?: string`
  - Added `takes?: Take[]`
  - Updated `vision_result` to use new fields
- Added `onClick?: () => void` prop for lightbox integration
- Updated failure display to show missing subjects by name
- Shows step count in meta info when available

#### `src/components/StoryboardGrid.tsx`
- Added lightbox state management
- Added `onRegenerate` and `onApprove` callback props
- Wraps SceneCard in clickable div
- Renders `SceneLightbox` when scene is selected

#### `src/components/SceneLightbox.tsx` (NEW)
- Full-screen lightbox component with:
  - Large image display (65% width)
  - Info panel (35% width) with:
    - Scene description and metadata
    - Subject tags
    - Editable prompt textarea
    - Vision check failure notes (shows missing subjects)
    - Take history (all previous attempts with pass/fail status)
    - Regenerate button (unlimited uses)
    - Approve button (visible on needs_review scenes only)
  - Keyboard navigation:
    - Escape to close
    - Left/right arrows to navigate (closes lightbox, parent handles navigation)
  - Click outside to close

#### `src/app/page.tsx`
- Added `handleRegenerate()` callback:
  - Calls `/api/regenerate` endpoint
  - Updates local scene state on success
- Added `handleApprove()` callback:
  - Calls `/api/approve` endpoint
  - Updates local scene state on success
  - Refreshes projects list
- Passed callbacks to `StoryboardGrid` component

### Test Files

#### `src/lib/test-orchestrator.ts`
- Updated test scenes to use `subject: string[]` format
- Fixed vision check test to use new `subjects_ok` field name

### Configuration

#### `config.json` (NEW)
- Added step ladder configuration: `[4, 6, 8]`
- Documents all configurable parameters
- Can be used as reference for environment variable setup

#### `SPEC.md`
- Updated with full specification for all improvements
- Updated data schemas to reflect new fields
- Updated story agent and vision agent prompts
- Added step ladder documentation

---

## Data Schema Changes

### Scene Object (Before)
```json
{
  "subject": "astronaut",
  "take": 2,
  "vision_result": {
    "subject_ok": true,
    "mood_ok": true,
    "shot_ok": true,
    "prompt_fix": null
  }
}
```

### Scene Object (After)
```json
{
  "subject": ["astronaut"],
  "original_comfy_prompt": "cinematic still, ...",
  "comfy_prompt": "cinematic still, ..., Make astronaut more prominent",
  "take": 2,
  "steps": 6,
  "manually_approved": false,
  "takes": [
    {
      "take": 1,
      "steps": 4,
      "prompt": "cinematic still, ...",
      "image_path": "scene_01_take_1.png",
      "vision_result": {
        "subjects_ok": false,
        "missing_subjects": [],
        "mood_ok": true,
        "shot_ok": false,
        "prompt_fix": "Make astronaut more prominent"
      }
    },
    {
      "take": 2,
      "steps": 6,
      "prompt": "cinematic still, ..., Make astronaut more prominent",
      "image_path": "scene_01_take_2.png",
      "vision_result": {
        "subjects_ok": true,
        "missing_subjects": [],
        "mood_ok": true,
        "shot_ok": true,
        "prompt_fix": null
      }
    }
  ],
  "vision_result": {
    "subjects_ok": true,
    "missing_subjects": [],
    "mood_ok": true,
    "shot_ok": true,
    "prompt_fix": null
  }
}
```

---

## Key Behaviors

### Adaptive Step Count
- Take 1: 4 steps (fast draft)
- Take 2: 6 steps (medium quality)
- Take 3+: 8 steps (highest quality, clamped to last value)
- Steps recorded in each take for transparency

### Multi-Subject Vision Checking
- Story agent now returns `subject: ["alien", "fox"]` for multi-subject scenes
- Vision agent checks ALL subjects individually
- Returns `missing_subjects: ["alien"]` if any subject is missing
- UI shows exactly which subjects are missing in failure message

### Manual Regeneration
- Unlimited regenerations from lightbox (no retry cap)
- User can edit prompt before regenerating
- Edited prompt used as-is (style prefix not re-prepended)
- Original prompt preserved in `original_comfy_prompt`
- Each regeneration creates new take record

### Manual Approval
- Approve button visible only on `needs_review` scenes
- Overrides vision verdict and sets status to "pass"
- Sets `manually_approved: true` flag
- Useful when vision agent is overly strict

---

## Testing

Build completed successfully:
```
✓ Compiled successfully
✓ Generating static pages (6/6)
```

All TypeScript type errors resolved.

---

## Migration Notes

### Existing Projects
- Old scenes.json files will need to be regenerated or manually updated
- Key changes:
  - `subject` field must be array
  - `vision_result.subject_ok` → `subjects_ok`
  - `vision_result` now includes `missing_subjects`
  - Scenes should include `steps` and `takes` array

### Backward Compatibility
- Vision agent gracefully handles single-subject scenes: `["astronaut"]`
- UI shows step count only when available (optional field)
- Takes array optional for legacy scenes

---

## Next Steps (Optional Enhancements)

1. **Lightbox navigation** — Currently closes on arrow key press; could be enhanced to keep lightbox open and load next/prev scene
2. **Config file loading** — Currently step ladder is hardcoded in config.ts defaults; could load from config.json
3. **Take comparison** — Side-by-side view of different takes for same scene
4. **Prompt history** — Show full prompt evolution across takes
5. **Export** — Download approved scenes as ZIP or PDF

---

## Files Created

- `src/components/SceneLightbox.tsx` (330 lines)
- `src/app/api/regenerate/route.ts` (105 lines)
- `src/app/api/approve/route.ts` (60 lines)
- `config.json` (reference configuration)

## Files Modified

- `SPEC.md` (full spec update)
- `src/lib/config.ts` (step ladder)
- `src/lib/story-agent.ts` (subject array)
- `src/lib/vision-agent.ts` (new schema, multi-subject check)
- `src/lib/comfyui.ts` (steps injection)
- `src/lib/orchestrator.ts` (adaptive steps, takes tracking)
- `src/lib/projects.ts` (update function)
- `src/lib/test-orchestrator.ts` (type fixes)
- `src/components/SceneCard.tsx` (new schema, click handler)
- `src/components/StoryboardGrid.tsx` (lightbox integration)
- `src/app/page.tsx` (regenerate/approve handlers)
- `src/app/api/projects/[name]/route.ts` (PUT method)

---

**Total Lines Added:** ~600  
**Total Lines Modified:** ~150
