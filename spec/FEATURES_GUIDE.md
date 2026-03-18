# UI & Agent Improvements — User Guide

**Version:** 1.0  
**Date:** March 17, 2026

---

## Quick Start

All improvements are now live in the storyboard app. Here's how to use each new feature:

---

## 1. Image Lightbox

### How to Use
- **Click** on any scene card image to open the lightbox
- The lightbox shows a large version of the image with detailed controls
- **Close** by:
  - Clicking the ✕ button (top right)
  - Clicking the dark background
  - Pressing the `Escape` key

### What You'll See
- **Left side (65%)**: Large image display
- **Right side (35%)**: Scene details panel with:
  - Scene number and description
  - Shot type, mood, take number, step count
  - Subject tags (shows all required subjects)
  - Editable prompt textarea
  - Vision check notes (if failed)
  - Take history (all previous attempts)
  - Regenerate and Approve buttons

---

## 2. Manual Prompt Editing

### How to Use
1. Click a scene to open the lightbox
2. Edit the text in the **Prompt** textarea
3. Click **Regenerate** to generate a new image with your edited prompt

### Tips
- The prompt is pre-filled with the current prompt (including any previous fixes)
- You can completely rewrite the prompt if desired
- The original auto-generated prompt is preserved (shown as "Original:" below the textarea)
- Your edited prompt is used exactly as written — the style prefix is NOT re-added

---

## 3. Adaptive Step Count

### How It Works
The app automatically increases image quality on retries:

| Take | Steps | Quality | Speed |
|------|-------|---------|-------|
| 1    | 4     | Draft   | Fast  |
| 2    | 6     | Medium  | Balanced |
| 3+   | 8     | High    | Slower |

### Why It Matters
- First attempt is fast (4 steps) — good for quick iteration
- If vision check fails, retry uses more steps (6) for better quality
- Final retry uses maximum steps (8) for best chance of passing
- Step count is shown in the scene card and lightbox

---

## 4. Stricter Vision Checking (Multi-Subject Fix)

### The Problem (Fixed)
Previously, a scene requiring both "alien" and "fox" would pass if only the fox was visible.

### The Solution
- Story agent now specifies ALL required subjects: `["alien", "fox"]`
- Vision agent checks each subject individually
- Scene fails if ANY subject is missing
- UI shows exactly which subjects are missing

### Example Failure Message
```
• Missing subjects: alien
Fix: Add small green alien with big eyes sitting beside the fox
```

---

## 5. Regenerate Button (Unlimited)

### How to Use
1. Open the lightbox on any scene
2. Optionally edit the prompt
3. Click **Regenerate**
4. Wait for the new image to generate
5. Vision check runs automatically
6. New image replaces the old one in place

### Key Points
- **No retry cap** — regenerate as many times as you want (unlike automatic retries which are capped at 2)
- Each regeneration creates a new "take" (Take 1, Take 2, Take 3, etc.)
- Step count continues to increase per the step ladder
- All takes are recorded in the take history

### When to Use
- Vision check failed and you want to try again
- You're not happy with the image even though it passed vision check
- You want to experiment with different prompts
- You want higher quality (more steps) on a passing scene

---

## 6. Approve Button (Manual Override)

### How to Use
1. Open the lightbox on a scene with status "Needs Review" (red badge)
2. Review the vision check failure notes
3. If you're happy with the image despite the failure, click **Approve**
4. Scene status changes to "Pass" (green badge)

### When to Use
- Vision agent is being overly strict
- The missing subject is actually visible but the AI missed it
- The mood/shot type is close enough for your purposes
- You want to move forward without regenerating

### What It Does
- Sets scene status to "pass"
- Marks scene as `manually_approved: true`
- Updates the project file on disk
- Scene will be included in final storyboard

---

## 7. Take History

### How to View
Open the lightbox on any scene that has multiple takes — you'll see the "Take History" section.

### What You'll See
For each take:
- Take number (1, 2, 3, etc.)
- Step count used
- Pass/fail status (green checkmark or red X)

### Why It's Useful
- Track the evolution of each scene
- See which takes passed/failed and why
- Understand the impact of increasing step count
- Reference previous prompts if needed

---

## 8. Improved Failure Labels

### Before
```
• Subject check failed
Fix: Make alien more prominent
```

### After
```
• Missing subjects: alien
Fix: Add small green alien with big eyes sitting beside the fox
```

### Benefits
- Know exactly which subjects are missing
- More specific fix suggestions
- Easier to understand what needs to change
- Faster iteration when regenerating

---

## Workflow Examples

### Example 1: Quick Generation
1. Enter story idea
2. Wait for automatic generation (4 steps per scene)
3. Review storyboard grid
4. Click any scene to see details
5. Done!

### Example 2: Fixing a Failed Scene
1. Scene shows red "Needs Review" badge
2. Click to open lightbox
3. Read failure message: "Missing subjects: alien"
4. Edit prompt to emphasize the alien: "..., small green alien with big eyes clearly visible, ..."
5. Click Regenerate
6. New image generates with 6 steps (higher quality)
7. Vision check runs automatically
8. If it passes: green badge, done!
9. If it fails: repeat or click Approve if you're happy with it

### Example 3: Manual Quality Boost
1. Scene passed vision check but looks low quality
2. Click to open lightbox
3. Click Regenerate (no prompt changes needed)
4. New image generates with next step count in ladder
5. Compare the two takes in take history
6. Keep the one you prefer (can regenerate again if needed)

### Example 4: Multi-Subject Scene
1. Story: "An alien and a fox share tea"
2. Scene spec: `subject: ["alien", "fox"]`
3. First generation shows only the fox
4. Vision check fails: "Missing subjects: alien"
5. Fix suggestion: "Add small green alien beside the fox"
6. Regenerate with edited prompt
7. Both subjects now visible
8. Vision check passes

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Escape` | Close lightbox |
| `←` (Left Arrow) | Navigate to previous scene (closes lightbox) |
| `→` (Right Arrow) | Navigate to next scene (closes lightbox) |

---

## Configuration

### Step Ladder
Default: `[4, 6, 8]`

To customize, edit `config.json` or set environment variables.

### Max Retries (Automatic)
Default: `2`

This only applies to automatic retries during initial generation. Manual regenerations from the lightbox have no cap.

---

## Troubleshooting

### "Regenerate button is disabled"
- Check that the app is still running
- Check browser console for errors
- Ensure ComfyUI is running and accessible

### "Approve button not visible"
- Only visible on scenes with "Needs Review" status
- If scene already passed, no approval needed

### "Take history is empty"
- Only shows when there are 2+ takes
- First generation creates Take 1

### "Missing subjects shows empty list"
- Subject check may have passed
- Check mood_ok or shot_ok for other failures
- If all checks passed, no failure message shown

---

## Best Practices

1. **Let automatic generation run first** — 4-step drafts are fast and often pass
2. **Use manual regenerate strategically** — Edit the prompt to be more specific about missing elements
3. **Don't fear the Approve button** — Vision agent is helpful but not perfect
4. **Check take history** — Sometimes an earlier take looks better than the latest
5. **Multi-subject scenes need detail** — Be specific about all subjects in your story idea

---

## Support

For issues or questions, check:
- `SPEC.md` — Full technical specification
- `IMPLEMENTATION_SUMMARY.md` — Implementation details
- Console logs in browser DevTools
- Server logs in terminal

---

**Happy storyboarding! 🎬**
