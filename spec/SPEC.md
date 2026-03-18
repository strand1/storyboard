# SPEC.md

**Project:** storyboard
**Status:** READY FOR IMPLEMENTATION

## Overview

A local Next.js web app that orchestrates llama-server and ComfyUI to turn a one-line story idea into a visual storyboard. The app provides a browser UI with live generation status and a storyboard grid view. Everything runs locally — no cloud services.

---

## 1. Purpose

A web app that takes a one-sentence story idea, breaks it into scenes, generates a ComfyUI image prompt for each scene, renders the images via ComfyUI, and uses a vision-capable LLM to verify each image matches its scene spec. The output is an interactive storyboard grid with live status updates as each scene completes.

---

## 2. Goals — MVP

### Must-Haves
| Feature | Description |
|---------|-------------|
| Idea input | Text field for one-line story idea |
| Scene generation | LLM breaks idea into 4–6 scenes with ComfyUI prompts |
| Image generation | ComfyUI generates one image per scene |
| Vision check | Vision LLM verifies image matches scene spec (max 2 retries) |
| Storyboard grid | Interactive grid view showing all scenes with status |
| Live status | Real-time updates via WebSocket or SSE as scenes complete |

### Nice-to-Haves (Not MVP)
- Per-scene regenerate button
- PDF export
- Character consistency across shots
- Per-scene style overrides
- Batch queuing / parallel generation

### Non-Goals
- Cloud services or APIs
- User authentication
- Database persistence
- Multiple ComfyUI workflows (use one z-image turbo workflow)

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Next.js 14 App                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │   Story Input   │  │  Storyboard     │  │   Live      │ │
│  │     Page        │  │  Grid Page      │  │   Status    │ │
│  └────────┬────────┘  └────────┬────────┘  └──────┬──────┘ │
│           │                    │                   │        │
│           └────────────────────┼───────────────────┘        │
│                                │                             │
│                    ┌───────────▼───────────┐                │
│                    │   API Routes /        │                │
│                    │   Server Actions      │                │
│                    │  (orchestration)      │                │
│                    └───────────┬───────────┘                │
└────────────────────────────────┼────────────────────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
     ┌────────▼────────┐ ┌───────▼───────┐ ┌───────▼───────┐
     │  llama-cpp-     │ │   ComfyUI     │ │   WebSocket   │
     │  server         │ │   (localhost) │ │   / SSE       │
     │  (Qwen3 VL 8B)  │ │   :11820      │ │   (live UI)   │
     │  :8080          │ │               │ │               │
     └─────────────────┘ └───────────────┘ └───────────────┘
```

### Pipeline Flow

1. User submits story idea via web form
2. API route calls llama-server to generate scene breakdown (4–6 scenes)
3. For each scene:
   - Inject prompt into ComfyUI workflow
   - POST to ComfyUI `/prompt` endpoint
   - Poll `/history/{prompt_id}` for completion
   - Download generated image
   - Call vision LLM to verify image matches spec
   - If check fails and retries remain: append fix to prompt, regenerate
4. Stream status updates to UI via WebSocket/SSE
5. Display completed storyboard grid

---

## 4. Components

### 4.1 Story Generator (Text LLM)

- **Model:** Configurable via `config.json` or env var (default: `Qwen3-VL-8B-Instruct`)
- **Endpoint:** llama-server at `http://localhost:11434/v1` (OpenAI-compatible API)
- **Input:** User idea + style prefix + scene count (default 6)
- **Output:** JSON array of scene objects

**System Prompt:**
```
You are a storyboard writer. Given a story idea, break it into {N} scenes.
For each scene output a JSON object with these fields:
  scene_id     : integer (1-based)
  description  : one sentence describing what happens
  subject      : JSON array of ALL required subjects that must appear in the image
                 (e.g. ["alien", "fox"] or ["astronaut"] for single-subject scenes)
  action       : what the subject is doing
  mood         : emotional tone (e.g. tense, joyful, eerie)
  shot_type    : one of [wide, medium, close-up, overhead]
  comfy_prompt : a ComfyUI text prompt ready for txt2img

Prepend this style prefix to every comfy_prompt:
  {STYLE_PREFIX}

Return ONLY a JSON array. No explanation, no markdown fences.

Story idea: {IDEA}
```

### 4.2 ComfyUI Integration

- **Endpoint:** `http://localhost:11820` (configurable)
- **Method:** `POST /prompt` with workflow JSON; `GET /history/{prompt_id}` to poll
- **Workflow:** z-image turbo workflow (square, landscape, portrait support)
- **Prompt Node:** Configurable node ID for CLIPTextEncode injection
- **Steps:** Controlled by step ladder in config (adaptive quality on retry)

**Workflow Structure:**
```json
{
  "3": { "class_type": "CLIPTextEncode", "inputs": { "text": "{INJECT_HERE}", "steps": 4 } },
  "4": { "class_type": "CLIPTextEncode", "inputs": { "text": "negative prompt" } },
  "5": { "class_type": "KSampler", ... },
  "6": { "class_type": "VAEDecode", ... },
  "7": { "class_type": "SaveImage", ... }
}
```

**File Naming:**
```
output/scene_01_take_1.png
output/scene_02_take_1.png
output/scene_02_take_2.png   ← after retry
```

### 4.3 Vision Checker (Vision LLM)

- **Model:** Same as text model (Qwen3 VL 8B) — vision-capable
- **Input:** Generated image (base64) + scene spec
- **Output:** JSON with pass/fail per criterion + optional `prompt_fix`

**Vision Prompt:**
```
Given this scene spec:
  Required subjects: {subjects_list}   ← e.g. "alien, fox"
  Action:    {action}
  Mood:      {mood}
  Shot type: {shot_type}

Look at the attached image and answer:
  subjects_ok  : true ONLY if ALL required subjects are clearly visible.
                 If any single subject is missing, this is false.
  mood_ok      : true/false — does the lighting/color match the mood?
  shot_ok      : true/false — does the framing match the shot type?

If subjects_ok is false, list which subjects are missing in missing_subjects.
If mood_ok or shot_ok is false, describe what needs to change.
Set prompt_fix to null only if all three are true.

Return ONLY JSON. No explanation.
```

**Retry Logic:**
- Max 2 retries per scene (configurable)
- If any check fails: append `prompt_fix` to original `comfy_prompt` (never discard)
- If retries exhausted: mark as `needs_review` and continue
- Step count increases on each retry per step ladder

### 4.4 Live Status (WebSocket / SSE)

- **Option A:** Server-Sent Events (simpler, one-way server→client)
- **Option B:** WebSocket (bidirectional, more complex)

**Recommendation:** Start with SSE for MVP — simpler to implement in Next.js App Router.

**Event Stream Format:**
```
event: scene_start
data: {"scene_id": 1, "status": "generating"}

event: scene_complete
data: {"scene_id": 1, "status": "pass", "image_path": "/output/scene_01_take_1.png"}

event: scene_retry
data: {"scene_id": 1, "status": "retrying", "take": 2, "reason": "subject_ok failed"}

event: generation_complete
data: {"total_scenes": 6, "passed": 5, "needs_review": 1}
```

### 4.5 UI Components

| Component | Description |
|-----------|-------------|
| `StoryInputForm` | Text input for story idea, submit button |
| `StoryboardGrid` | Responsive grid displaying all scenes |
| `SceneCard` | Individual scene: image, description, status badge |
| `StatusBadge` | Color-coded: generating (yellow), pass (green), needs_review (red) |
| `LiveStatusIndicator` | Shows overall generation progress |
| `SceneLightbox` | Full-screen image viewer with prompt editing and controls |

---

## 5. Data Schemas

### 5.1 Scene Object
```json
{
  "scene_id": 1,
  "description": "A lone astronaut stands at the edge of a crater at sunset.",
  "subject": ["astronaut"],
  "action": "standing, looking out",
  "mood": "contemplative",
  "shot_type": "wide",
  "original_comfy_prompt": "cinematic still, wide shot, lone astronaut at crater edge, golden hour...",
  "comfy_prompt": "cinematic still, wide shot, lone astronaut at crater edge, golden hour..., Make astronaut more prominent",
  "image_path": "/output/scene_01_take_2.png",
  "take": 2,
  "steps": 6,
  "status": "pass",
  "manually_approved": false,
  "takes": [
    {
      "take": 1,
      "steps": 4,
      "prompt": "cinematic still, wide shot, ...",
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
      "prompt": "cinematic still, wide shot, ..., Make astronaut more prominent",
      "image_path": "scene_01_take_2.png",
      "vision_result": {
        "subjects_ok": true,
        "missing_subjects": [],
        "mood_ok": true,
        "shot_ok": true,
        "prompt_fix": null
      }
    }
  ]
}
```

### 5.2 Vision Result
```json
{
  "subjects_ok": true,
  "missing_subjects": [],
  "mood_ok": true,
  "shot_ok": true,
  "prompt_fix": null
}
```

### 5.3 Take Object
```json
{
  "take": 1,
  "steps": 4,
  "prompt": "cinematic still, wide shot, ...",
  "image_path": "scene_01_take_1.png",
  "vision_result": {
    "subjects_ok": false,
    "missing_subjects": ["alien"],
    "mood_ok": true,
    "shot_ok": true,
    "prompt_fix": "Make alien more prominent and visible"
  }
}
```

### 5.4 Generation Session
```json
{
  "session_id": "uuid",
  "story_idea": "A deep sea explorer discovers an ancient city",
  "scenes": [...],
  "started_at": "2024-01-01T00:00:00Z",
  "completed_at": "2024-01-01T00:05:00Z",
  "status": "complete"
}
```

### 5.5 Config (`config.json` or env vars)
```json
{
  "llama_server_url": "http://localhost:11434/v1",
  "comfy_url": "http://localhost:11820",
  "model": "Qwen3-VL-8B-Instruct",
  "scene_count": 6,
  "max_retries": 2,
  "step_ladder": [4, 6, 8],
  "style_prefix": "cinematic still, 4k, detailed, sharp focus,",
  "workflow_file": "workflow_zimage_turbo.json",
  "prompt_node_id": "3",
  "output_dir": "./public/output"
}
```

**Environment Variable Overrides:**
```bash
LLAMA_SERVER_URL=http://localhost:11434/v1
COMFY_URL=http://localhost:11820
MODEL=Qwen3-VL-8B-Instruct
SCENE_COUNT=6
MAX_RETRIES=2
```

---

## 6. File Structure

```
storyboard/
├── app/
│   ├── api/
│   │   ├── generate/
│   │   │   └── route.ts          # Main orchestration endpoint
│   │   └── stream/
│   │       └── route.ts          # SSE endpoint for live status
│   ├── layout.tsx
│   ├── page.tsx                  # Story input form
│   └── storyboard/
│       └── page.tsx              # Storyboard grid view
├── components/
│   ├── StoryInputForm.tsx
│   ├── StoryboardGrid.tsx
│   ├── SceneCard.tsx
│   ├── SceneLightbox.tsx
│   ├── StatusBadge.tsx
│   ├── LiveStatusIndicator.tsx
│   └── InterruptedWarning.tsx
├── lib/
│   ├── config.ts                 # Config loading (env + config.json)
│   ├── llama.ts                  # llama-cpp-server client
│   ├── comfyui.ts                # ComfyUI client
│   ├── vision.ts                 # Vision check logic
│   ├── orchestrator.ts           # Main pipeline orchestration
│   ├── story-agent.ts            # Story breakdown generation
│   └── workflow.ts               # Workflow template loading/injection
├── public/
│   └── output/                   # Generated images
├── workflows/
│   └── workflow_zimage_turbo.json
├── config.json                   # User settings (optional, env overrides)
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 7. Dependencies

| Dependency | Purpose |
|------------|---------|
| Next.js 14 | App framework (App Router) |
| React 18 | UI library |
| Tailwind CSS | Styling |
| shadcn/ui | Component library |
| `eventsource-parser` | SSE client (if needed) |
| `uuid` | Session ID generation |

**External Services (local):**
- llama-cpp-server with Qwen3 VL 8B model
- ComfyUI running at localhost:8188

---

## 8. Retry Logic

```typescript
const stepLadder = [4, 6, 8];

for (let take = 1; take <= MAX_RETRIES + 1; take++) {
  const steps = stepLadder[Math.min(take - 1, stepLadder.length - 1)];
  const image = await comfyui.generate(currentPrompt, steps);
  const result = await visionCheck(image, sceneSpec);
  
  if (result.allPass) {
    scene.status = "pass";
    break;
  } else if (take <= MAX_RETRIES) {
    currentPrompt = originalPrompt + ", " + result.promptFix;
    emitEvent({ type: "scene_retry", scene_id, take: take + 1, steps });
  } else {
    scene.status = "needs_review";
    break;
  }
}
```

**Key Rule:** Original prompt is never discarded — `prompt_fix` is always appended, not substituted.

---

## 9. Running the App

**Prerequisites:**
- Node.js 18+
- llama-server running with Qwen3-VL-8B-Instruct at `localhost:11434/v1`
- ComfyUI running at localhost:11820
- z-image turbo workflow exported to `workflows/workflow_zimage_turbo.json`

```bash
# Install dependencies
npm install

# Set environment (optional — defaults in config.ts)
export LLAMA_SERVER_URL=http://localhost:8080
export COMFY_URL=http://localhost:8188

# Run dev server
npm run dev

# Open in browser
open http://localhost:3000
```

---

## 10. Stack & Design System

### Stack
- Framework: Next.js 14 (App Router)
- Styling: Tailwind CSS + shadcn/ui components
- Font: Inter
- Deployment: local

### Design Rules
| Rule | Value |
|------|-------|
| Palette | Neutral grays (slate/zinc) + one accent color |
| Spacing | 8px scale (8, 16, 24, 32, 48, 64px) — no exceptions |
| Borders | 1px, rgba(0,0,0,0.08) |
| Radius | 8px everywhere |
| Shadows | Minimal — prefer borders |
| Typography | Hierarchy through size/weight, not color |
| Whitespace | ~40% empty screen |
| Components | Build 5–7 core components, compose everything |

---

## 11. Open Questions

| Question | Status |
|----------|--------|
| Workflow prompt node ID | User to provide (z-image turbo workflow) |
| SSE vs WebSocket | SSE recommended for MVP |
| Session persistence | In-memory for MVP (no database) |
