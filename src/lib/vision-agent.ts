/**
 * Vision Agent
 * 
 * Validates generated images against scene specifications.
 * Returns pass/fail for each criterion and optional prompt fixes.
 */

import { llamaVision, imageToBase64, LlamaMessage, llamaJson } from "./llama";
import type { Scene } from "./story-agent";

export interface VisionResult {
  subject_ok: boolean;
  mood_ok: boolean;
  shot_ok: boolean;
  prompt_fix: string | null;
  all_pass: boolean;
}

export interface SceneWithResult extends Scene {
  image_path?: string;
  image_base64?: string;
  take: number;
  status: "pass" | "needs_review" | "generating" | "retrying";
  vision_result?: VisionResult;
}

/**
 * Check if a generated image matches the scene specification
 */
export async function visionCheck(
  scene: Scene,
  imageBase64: string
): Promise<VisionResult> {
  const prompt = `Given this scene spec:
  Subject:   ${scene.subject}
  Action:    ${scene.action}
  Mood:      ${scene.mood}
  Shot type: ${scene.shot_type}

Look at the attached image and answer:
  subject_ok   : true/false — is the main subject visible and correct?
  mood_ok      : true/false — does the lighting/color match the mood?
  shot_ok      : true/false — does the framing match the shot type?

If any is false, write a short prompt_fix string (max 15 words) describing
only what needs to change. Otherwise set prompt_fix to null.

Return ONLY JSON. No explanation.`;

  const result = await llamaJson<{
    subject_ok: boolean;
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

  const allPass = result.subject_ok && result.mood_ok && result.shot_ok;

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
  const base64 = await imageToBase64(imagePath);
  return visionCheck(scene, base64);
}

/**
 * Create a new scene object with vision result
 */
export function applyVisionResult(
  scene: Scene,
  result: VisionResult,
  take: number,
  status: "pass" | "needs_review"
): SceneWithResult {
  return {
    ...scene,
    take,
    status,
    vision_result: result,
  };
}
