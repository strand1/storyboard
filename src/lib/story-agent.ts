/**
 * Story Agent
 * 
 * Converts a one-line story idea into structured scene objects
 * with ComfyUI-ready prompts.
 */

import { llamaJson, LlamaMessage } from "./llama";
import { getConfig } from "./config";

export interface Scene {
  scene_id: number;
  description: string;
  subject: string;
  action: string;
  mood: string;
  shot_type: "wide" | "medium" | "close-up" | "overhead";
  comfy_prompt: string;
}

export interface StoryBreakdown {
  story_idea: string;
  scenes: Scene[];
}

/**
 * Generate scene breakdown from a story idea
 */
export async function generateStoryBreakdown(
  storyIdea: string,
  options?: {
    sceneCount?: number;
    stylePrefix?: string;
  }
): Promise<StoryBreakdown> {
  const config = getConfig();
  const sceneCount = options?.sceneCount ?? config.sceneCount;
  const stylePrefix = options?.stylePrefix ?? config.stylePrefix;

  const userMessage: LlamaMessage = {
    role: "user",
    content: `You are a storyboard writer. Break this story idea into ${sceneCount} scenes.

Story idea: ${storyIdea}

For each scene, create a JSON object with:
- scene_id: integer (1-based)
- description: one sentence
- subject: main subject/character
- action: what they're doing
- mood: emotional tone
- shot_type: wide, medium, close-up, or overhead
- comfy_prompt: image generation prompt (prepend: "${stylePrefix}")

Return ONLY a JSON array like:
[{"scene_id":1,"description":"...","subject":"...","action":"...","mood":"...","shot_type":"wide","comfy_prompt":"..."},...]

No markdown, no explanation, just the JSON array.`,
  };

  const scenes = await llamaJson<Scene[]>([userMessage], {
    maxTokens: 4096,
    maxRetries: 2,
  });

  // Validate and normalize scenes
  const validatedScenes = scenes.map((scene, index) => ({
    ...scene,
    scene_id: scene.scene_id ?? index + 1,
    shot_type: validateShotType(scene.shot_type),
    comfy_prompt: `${stylePrefix} ${scene.comfy_prompt}`,
  }));

  return {
    story_idea: storyIdea,
    scenes: validatedScenes,
  };
}

/**
 * Validate shot_type, defaulting to "medium" if invalid
 */
function validateShotType(shotType: string | undefined): Scene["shot_type"] {
  const validTypes = ["wide", "medium", "close-up", "overhead"];
  if (shotType && validTypes.includes(shotType)) {
    return shotType as Scene["shot_type"];
  }
  return "medium";
}

/**
 * Generate a story idea based on an image description
 * (Optional helper for image-inspired stories)
 */
export async function generateStoryFromImage(
  imageDescription: string
): Promise<string> {
  const messages: LlamaMessage[] = [
    {
      role: "system",
      content:
        "You are a creative writer. Given a description of an image, create a compelling one-sentence story idea that could feature this character or scene. Be specific and evocative. Return only the story idea, no explanation.",
    },
    {
      role: "user",
      content: `Image description: ${imageDescription}`,
    },
  ];

  const response = await llamaJson<{ story_idea: string }>(messages, {
    maxTokens: 256,
  });

  return response.story_idea;
}
