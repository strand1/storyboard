# Storyboard

A local web app that orchestrates **llama-server** and **ComfyUI** to turn a one-line story idea into a visual storyboard. A Next.js backend handles the LLM and ComfyUI calls; a browser UI shows the storyboard grid with live generation status and per-scene controls.

Everything runs locally — no cloud services.

---

## Features

- **Story Input**: Enter a one-sentence story idea
- **Scene Generation**: LLM breaks your idea into 4–6 scenes with ComfyUI prompts
- **Image Generation**: ComfyUI generates one image per scene
- **Vision Check**: Vision-capable LLM verifies each image matches its scene spec (with auto-retry)
- **Storyboard Grid**: Interactive grid view showing all scenes with status
- **Live Status**: Real-time updates as scenes complete
- **Manual Controls**: Edit prompts, regenerate scenes, approve/reject results

---

## Prerequisites

### 1. Node.js 18+

```bash
node --version  # Should be v18 or higher
```

### 2. llama-server with Vision Model

Install and run llama-server with a vision-capable model (e.g., Qwen3-VL-8B-Instruct):

```bash
# Clone llama.cpp
git clone https://github.com/ggerganov/llama.cpp.git
cd llama.cpp

# Build llama-server
make -j

# Download Qwen3-VL-8B-Instruct GGUF model
# Get it from Hugging Face: https://huggingface.co/Qwen/Qwen3-VL-8B-Instruct-GGUF
wget https://huggingface.co/Qwen/Qwen3-VL-8B-Instruct-GGUF/resolve/main/qwen3-vl-8b-instruct-q4_k_m.gguf

# Run llama-server with OpenAI-compatible API
./server -m qwen3-vl-8b-instruct-q4_k_m.gguf --port 11434 --host 0.0.0.0
```

**Important**: Use a vision-capable model. The same model handles both text (scene generation) and vision (image verification) tasks.

### 3. ComfyUI

Install and run ComfyUI:

```bash
# Clone ComfyUI
git clone https://github.com/comfyanonymous/ComfyUI.git
cd ComfyUI

# Install dependencies
pip install -r requirements.txt

# Run ComfyUI on port 11820
python main.py --port 11820 --listen
```

**Required Models for z-image turbo workflow**:
- `z_image_turbo_bf16.safetensors` — UNet model
- `ae.safetensors` — VAE
- `qwen_3_4b.safetensors` — CLIP text encoder

Place these in your ComfyUI `models/` directories:
```
ComfyUI/models/unet/z_image_turbo_bf16.safetensors
ComfyUI/models/vae/ae.safetensors
ComfyUI/models/clip/qwen_3_4b.safetensors
```

---

## Installation

```bash
# Clone the repository
git clone git@github.com:strand1/storyboard.git
cd storyboard

# Install dependencies
npm install

# Copy environment example
cp .env.local.example .env.local

# Edit .env.local if needed (defaults work for most setups)
```

---

## Configuration

### Environment Variables (`.env.local`)

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Next.js dev server host |
| `PORT` | `11830` | Next.js dev server port |
| `LLAMA_SERVER_URL` | `http://localhost:11434/v1` | llama-server OpenAI API endpoint |
| `COMFY_URL` | `http://localhost:11820` | ComfyUI endpoint |
| `MODEL` | `Qwen3-VL-8B-Instruct` | Model name (must be vision-capable) |
| `SCENE_COUNT` | `6` | Number of scenes to generate (4–6 recommended) |
| `MAX_RETRIES` | `2` | Max auto-retry attempts per scene |
| `STYLE_PREFIX` | `cinematic still, 4k, detailed, sharp focus,` | Prepended to all ComfyUI prompts |
| `WORKFLOW_FILE` | `workflows/workflow_zimage_turbo.json` | ComfyUI workflow file |
| `PROMPT_NODE_ID` | `70` | Node ID in workflow for positive prompt |
| `OUTPUT_DIR` | `output` | Output directory (relative to `public/`) |

### config.json

Additional settings can be configured in `config.json`:

```json
{
  "step_ladder": [4, 6, 8],
  "max_retries": 2,
  "scene_count": 6,
  "style_prefix": "cinematic still, 4k, detailed, sharp focus,",
  "model": "Qwen3-VL-8B-Instruct",
  "llama_server_url": "http://localhost:11434/v1",
  "comfy_url": "http://localhost:11820",
  "workflow_file": "workflows/workflow_zimage_turbo.json",
  "prompt_node_id": "70",
  "output_dir": "output"
}
```

---

## Running the App

### 1. Start llama-server

```bash
cd llama.cpp
./server -m qwen3-vl-8b-instruct-q4_k_m.gguf --port 11434 --host 0.0.0.0
```

### 2. Start ComfyUI

```bash
cd ComfyUI
python main.py --port 11820 --listen
```

### 3. Start Next.js Dev Server

```bash
cd storyboard
npm run dev
```

### 4. Open in Browser

```
http://localhost:11830
```

---

## Usage

1. **Enter a story idea**: Type a one-sentence story idea (e.g., "A deep sea explorer discovers an ancient city")
2. **Generate**: Click "Generate Storyboard"
3. **Watch live**: Status updates appear in real-time as each scene generates
4. **Review**: Click any scene to open the lightbox with details
5. **Edit & Regenerate**: Edit the prompt or click regenerate to try again
6. **Approve**: Manually approve scenes that failed vision check but look good

---

## Project Structure

```
storyboard/
├── spec/                      # Documentation and specs
│   ├── SPEC.md                # Full technical specification
│   ├── FEATURES_GUIDE.md      # User guide for all features
│   ├── CHANGES.md             # Implementation changelog
│   ├── IMPLEMENTATION_SUMMARY.md
│   ├── SEED_MANAGEMENT_IMPLEMENTATION.md
│   └── workflows/             # ComfyUI workflow files
│       └── workflow_zimage_turbo.json
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── api/               # API endpoints
│   │   ├── layout.tsx
│   │   ├── page.tsx           # Story input form
│   │   └── projects/          # Project management pages
│   ├── components/            # React components
│   │   ├── SceneCard.tsx
│   │   ├── SceneLightbox.tsx
│   │   ├── StoryboardGrid.tsx
│   │   ├── StoryInputForm.tsx
│   │   └── ...
│   └── lib/                   # Core logic
│       ├── comfyui.ts         # ComfyUI client
│       ├── config.ts          # Configuration loader
│       ├── llama.ts           # llama-server client
│       ├── orchestrator.ts    # Generation pipeline
│       ├── story-agent.ts     # Scene breakdown generation
│       └── vision-agent.ts    # Vision verification
├── public/
│   └── output/                # Generated images
├── config.json                # User configuration
├── .env.local.example         # Environment template
└── package.json
```

---

## How It Works

### Pipeline Flow

1. User submits story idea via web form
2. API calls llama-server to generate scene breakdown (4–6 scenes)
3. For each scene:
   - Inject prompt into ComfyUI workflow
   - POST to ComfyUI `/prompt` endpoint
   - Poll `/history/{prompt_id}` for completion
   - Download generated image
   - Call vision LLM to verify image matches spec
   - If check fails and retries remain: append fix to prompt, regenerate
4. Stream status updates to UI via Server-Sent Events (SSE)
5. Display completed storyboard grid

### Retry Logic

- **Max 2 auto-retries** per scene during initial generation
- **Step ladder**: 4 → 6 → 8 steps (increases quality on retry)
- **Random seed**: Each take uses a unique random seed for variety
- **Prompt accumulation**: Fixes are appended, never replacing the original
- **Unlimited manual regenerations** via the lightbox UI

---

## Vision Check

The vision agent verifies each generated image against its scene spec:

| Criterion | Description |
|-----------|-------------|
| `subjects_ok` | ALL required subjects must be clearly visible |
| `mood_ok` | Lighting/color matches the emotional tone |
| `shot_ok` | Framing matches the shot type (wide/medium/close-up/overhead) |

If any check fails:
1. Vision agent provides a `prompt_fix` suggestion
2. Fix is appended to the original prompt
3. New image generates with higher step count
4. Process repeats until pass or max retries exhausted

---

## Key Features

### Image Lightbox
- Click any scene to view full details
- Large image display with editable prompt
- Seed controls (view, randomize, manual input)
- Take history with pass/fail status

### Manual Controls
- **Regenerate**: Unlimited regenerations with custom prompts
- **Approve**: Override vision check for scenes you like
- **Seed Management**: Randomize or set specific seeds

### Live Status
- Real-time updates via Server-Sent Events (SSE)
- Progress indicator during generation
- Per-scene status badges (generating/pass/needs review)

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/generate` | POST | Start storyboard generation |
| `/api/stream` | GET | SSE endpoint for live status |
| `/api/regenerate` | POST | Manual scene regeneration |
| `/api/approve` | POST | Manual scene approval |
| `/api/projects` | GET | List all projects |
| `/api/projects/[name]` | GET | Get project details |
| `/api/projects/[name]` | PUT | Update project scenes |
| `/api/projects/[name]` | DELETE | Delete project |

---

## Troubleshooting

### llama-server not responding
```bash
# Check if server is running
curl http://localhost:11434/v1/models

# Should return list of available models
```

### ComfyUI not responding
```bash
# Check if ComfyUI is running
curl http://localhost:11820/system_stats

# Should return system statistics
```

### Vision check always fails
- Ensure you're using a vision-capable model (Qwen3-VL, LLaVA, etc.)
- Check that images are being generated correctly
- Review vision agent logs for specific failures

### Images look similar across regenerations
- Each take should use a different random seed
- Check that seed is being randomized in the lightbox
- Try manual seed randomization before editing prompt

---

## Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint
npm run lint
```

---

## Documentation

| File | Description |
|------|-------------|
| `spec/SPEC.md` | Full technical specification |
| `spec/FEATURES_GUIDE.md` | User guide for all features |
| `spec/IMPLEMENTATION_SUMMARY.md` | Implementation details |
| `spec/SEED_MANAGEMENT_IMPLEMENTATION.md` | Seed feature documentation |
| `spec/CHANGES.md` | Changelog |

---

## License

MIT

---

## Acknowledgments

- [llama.cpp](https://github.com/ggerganov/llama.cpp) — Local LLM inference
- [ComfyUI](https://github.com/comfyanonymous/ComfyUI) — Stable Diffusion GUI
- [Next.js](https://nextjs.org/) — React framework
- [shadcn/ui](https://ui.shadcn.com/) — Component library
