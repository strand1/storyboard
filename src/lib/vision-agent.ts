/**
 * Vision Agent
 * 
 * Validates generated images against scene specifications.
 * Returns pass/fail for each criterion and optional prompt fixes.
 */

import { llamaVision, imageToBase64, LlamaMessage, llamaJson } from "./llama";
import type { Scene } from "./story-agent";

export interface VisionResult {
  subjects_ok: boolean;
  missing_subjects: string[];
  mood_ok: boolean;
  shot_ok: boolean;
  prompt_fix: string | null;
  all_pass: boolean;
}

export interface Take {
  take: number;
  steps: number;
  seed: number;
  prompt: string;
  image_path: string;
  vision_result: VisionResult;
}

export interface SceneWithResult extends Scene {
  image_path?: string;
  take: number;
  steps: number;
  seed?: number;
  status: "pass" | "needs_review" | "generating" | "retrying";
  manually_approved?: boolean;
  original_comfy_prompt?: string;
  takes?: Take[];
  vision_result?: VisionResult;
}

/**
 * Check if a generated image matches the scene specification
 */
export async function visionCheck(
  scene: Scene,
  imageBuffer: Buffer
): Promise<VisionResult> {
  // Defensive handling for subject field - ensure it's always an array
  const subjectsArray = Array.isArray(scene.subject) 
    ? scene.subject 
    : typeof scene.subject === 'string' 
      ? [scene.subject] 
      : scene.subject || [];
  
  const subjectsList = subjectsArray.join(", ") || "unknown";
  
  console.log(`[visionCheck] Scene ${scene.scene_id}: subject=${JSON.stringify(scene.subject)}, parsed=${JSON.stringify(subjectsArray)}, subjectsList="${subjectsList}"`);
  
  const prompt = `Given this scene spec:
  Required subjects: ${subjectsList}
  Action:    ${scene.action}
  Mood:      ${scene.mood}
  Shot type: ${scene.shot_type}

Look at the attached image and answer:
  subjects_ok  : true ONLY if ALL required subjects are clearly visible.
                 If any single subject is missing, this is false.
  mood_ok      : true/false — does the lighting/color match the mood?
  shot_ok      : true/false — does the framing match the shot type?

If subjects_ok is false, list which subjects are missing in missing_subjects.
If mood_ok or shot_ok is false, describe what needs to change.
Set prompt_fix to null only if all three are true.

Return ONLY JSON. No explanation.`;

  console.log(`[visionCheck] Scene ${scene.scene_id} prompt (first 300 chars): ${prompt.slice(0, 300)}`);

  const imageBase64 = imageBuffer.toString("base64");

  const result = await llamaJson<{
    subjects_ok: boolean;
    missing_subjects: string[];
    mood_ok: boolean;
    shot_ok: boolean;
    prompt_fix: string | null;
  }>(
    [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: prompt,
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/png;base64,${imageBase64}`,
            },
          },
        ],
      },
    ],
    {
      maxTokens: 256,
      maxRetries: 1,
    }
  );

  console.log(`[visionCheck] Scene ${scene.scene_id} result:`, result);

  const allPass = result.subjects_ok && result.mood_ok && result.shot_ok;

  return {
    ...result,
    all_pass: allPass,
  };
}

/**
 * Check image from file path
 */
export async function visionCheckFile(
  scene: Scene,
  imagePath: string
): Promise<VisionResult> {
  const fs = await import("fs");
  const imageBuffer = await fs.promises.readFile(imagePath);
  return visionCheck(scene, imageBuffer);
}

/**
 * Create a new scene object with vision result
 */
export function applyVisionResult(
  scene: Scene,
  result: VisionResult,
  take: number,
  steps: number,
  status: "pass" | "needs_review"
): SceneWithResult {
  return {
    ...scene,
    take,
    steps,
    status,
    vision_result: result,
  };
}
