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
  subject: string[];  // Array of required subjects for multi-subject scenes
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
- subject: JSON array of ALL required subjects that must appear in the image (e.g. ["alien", "fox"] or ["astronaut"] for single-subject scenes)
- action: what they're doing
- mood: emotional tone
- shot_type: wide, medium, close-up, or overhead
- comfy_prompt: image generation prompt (prepend: "${stylePrefix}")

Return ONLY a JSON array like:
[{"scene_id":1,"description":"...","subject":["astronaut"],"action":"...","mood":"...","shot_type":"wide","comfy_prompt":"..."},...]

No markdown, no explanation, just the JSON array.`,
  };

  const scenes = await llamaJson<Scene[]>([userMessage], {
    maxTokens: 4096,
    maxRetries: 2,
  });

  console.log(`[story-agent] Raw scenes from Ollama: ${JSON.stringify(scenes, null, 2)}`);

  // Validate and normalize scenes
  const validatedScenes = scenes.map((scene, index) => {
    // Check if style prefix is already in the prompt (LLM sometimes includes it)
    let comfyPrompt = scene.comfy_prompt;
    if (!comfyPrompt.toLowerCase().includes(stylePrefix.toLowerCase().slice(0, 20))) {
      comfyPrompt = `${stylePrefix} ${comfyPrompt}`;
    }
    
    // Normalize subject field - ensure it's always an array
    // LLM may return string instead of array, so we handle both cases
    const rawSubject = scene.subject as any;
    let subject: string[];
    if (Array.isArray(rawSubject)) {
      subject = rawSubject;
    } else if (typeof rawSubject === 'string') {
      // LLM returned string instead of array - split by common delimiters
      subject = rawSubject.split(/[,;|]/).map((s: string) => s.trim()).filter((s: string) => s.length > 0);
      console.log(`[story-agent] Scene ${index + 1}: subject was string "${rawSubject}", normalized to [${subject.join(", ")}]`);
    } else {
      // Fallback to empty array
      subject = [];
      console.log(`[story-agent] Scene ${index + 1}: subject was ${typeof rawSubject}, defaulting to []`);
    }
    
    console.log(`[story-agent] Scene ${index + 1} normalized:`, {
      scene_id: scene.scene_id ?? index + 1,
      subject,
      description: scene.description?.slice(0, 50),
    });
    
    return {
      ...scene,
      scene_id: scene.scene_id ?? index + 1,
      subject,
      shot_type: validateShotType(scene.shot_type),
      comfy_prompt: comfyPrompt,
    };
  });

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
