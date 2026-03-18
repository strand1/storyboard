/**
 * Orchestrator
 * 
 * Main pipeline: story idea → scenes → generate images → vision check → retry loop
 * 
 * Emits events for live status updates during generation.
 */

import { generateStoryBreakdown, type Scene, type StoryBreakdown } from "./story-agent";
import { comfyuiGenerate, type ComfyUIImage } from "./comfyui";
import { visionCheck, type VisionResult, type SceneWithResult } from "./vision-agent";
import { getConfig } from "./config";

export type OrchestratorEvent =
  | { type: "story_start"; story_idea: string }
  | { type: "story_complete"; breakdown: StoryBreakdown }
  | { type: "scene_start"; scene_id: number; total_scenes: number }
  | { type: "scene_generate"; scene_id: number; take: number; prompt: string }
  | { type: "scene_complete"; scene_id: number; status: "pass" | "needs_review" }
  | { type: "scene_retry"; scene_id: number; take: number; reason: string }
  | { type: "generation_complete"; scenes: SceneWithResult[] }
  | { type: "error"; message: string; scene_id?: number };

export type EventHandler = (event: OrchestratorEvent) => void | Promise<void>;

export interface GenerationOptions {
  sceneCount?: number;
  stylePrefix?: string;
  maxRetries?: number;
  onEvent?: EventHandler;
}

export interface GenerationResult {
  story_idea: string;
  scenes: SceneWithResult[];
  started_at: string;
  completed_at: string;
  status: "complete" | "partial" | "failed";
}

/**
 * Run the full generation pipeline
 */
export async function generateStoryboard(
  storyIdea: string,
  options?: GenerationOptions
): Promise<GenerationResult> {
  const config = getConfig();
  const maxRetries = options?.maxRetries ?? config.maxRetries;
  const onEvent = options?.onEvent;

  const startedAt = new Date().toISOString();
  const scenes: SceneWithResult[] = [];

  try {
    // Emit start event
    await emit(onEvent, { type: "story_start", story_idea: storyIdea });

    // Generate story breakdown
    const breakdown = await generateStoryBreakdown(storyIdea, {
      sceneCount: options?.sceneCount,
      stylePrefix: options?.stylePrefix,
    });

    await emit(onEvent, { type: "story_complete", breakdown });

    // Process each scene
    for (const scene of breakdown.scenes) {
      const sceneResult = await processScene(scene, maxRetries, onEvent);
      scenes.push(sceneResult);
    }

    const completedAt = new Date().toISOString();

    // Determine overall status
    const passedCount = scenes.filter((s) => s.status === "pass").length;
    const status: GenerationResult["status"] =
      passedCount === scenes.length
        ? "complete"
        : passedCount > 0
        ? "partial"
        : "failed";

    await emit(onEvent, { type: "generation_complete", scenes });

    return {
      story_idea: storyIdea,
      scenes,
      started_at: startedAt,
      completed_at: completedAt,
      status,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await emit(onEvent, { type: "error", message: errorMessage });

    return {
      story_idea: storyIdea,
      scenes,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      status: "failed",
    };
  }
}

/**
 * Process a single scene with retry loop
 */
async function processScene(
  scene: Scene,
  maxRetries: number,
  onEvent?: EventHandler
): Promise<SceneWithResult> {
  const totalScenes = 1; // We don't know total here, pass from caller if needed
  let currentPrompt = scene.comfy_prompt;
  let originalPrompt = scene.comfy_prompt;

  await emit(onEvent, {
    type: "scene_start",
    scene_id: scene.scene_id,
    total_scenes: totalScenes,
  });

  for (let take = 1; take <= maxRetries + 1; take++) {
    try {
      // Emit generation event
      await emit(onEvent, {
        type: "scene_generate",
        scene_id: scene.scene_id,
        take,
        prompt: currentPrompt,
      });

      // Generate image
      const image = await comfyuiGenerate(currentPrompt);

      // Convert image buffer to base64 for vision check
      const imageBase64 = image.buffer.toString("base64");

      // Vision check
      const visionResult = await visionCheck(scene, imageBase64);

      if (visionResult.all_pass) {
        // Success!
        const result: SceneWithResult = {
          ...scene,
          image_path: image.filename,
          image_base64: imageBase64,
          take,
          status: "pass",
          vision_result: visionResult,
        };

        await emit(onEvent, {
          type: "scene_complete",
          scene_id: scene.scene_id,
          status: "pass",
        });

        return result;
      }

      // Vision check failed
      const failedCriteria = [];
      if (!visionResult.subject_ok) failedCriteria.push("subject");
      if (!visionResult.mood_ok) failedCriteria.push("mood");
      if (!visionResult.shot_ok) failedCriteria.push("shot");

      const reason = `${failedCriteria.join(", ")} check failed`;

      if (take <= maxRetries && visionResult.prompt_fix) {
        // Retry with prompt fix appended
        currentPrompt = originalPrompt + ", " + visionResult.prompt_fix;

        await emit(onEvent, {
          type: "scene_retry",
          scene_id: scene.scene_id,
          take: take + 1,
          reason,
        });
      } else {
        // No more retries
        const result: SceneWithResult = {
          ...scene,
          image_path: image.filename,
          image_base64: imageBase64,
          take,
          status: "needs_review",
          vision_result: visionResult,
        };

        await emit(onEvent, {
          type: "scene_complete",
          scene_id: scene.scene_id,
          status: "needs_review",
        });

        return result;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (take <= maxRetries) {
        await emit(onEvent, {
          type: "scene_retry",
          scene_id: scene.scene_id,
          take: take + 1,
          reason: `Generation error: ${errorMessage}`,
        });
      } else {
        // Final attempt failed
        const result: SceneWithResult = {
          ...scene,
          take,
          status: "needs_review",
          vision_result: {
            subject_ok: false,
            mood_ok: false,
            shot_ok: false,
            prompt_fix: null,
            all_pass: false,
          },
        };

        await emit(onEvent, {
          type: "scene_complete",
          scene_id: scene.scene_id,
          status: "needs_review",
        });

        return result;
      }
    }
  }

  // Should not reach here, but handle gracefully
  return {
    ...scene,
    take: maxRetries + 1,
    status: "needs_review",
    vision_result: {
      subject_ok: false,
      mood_ok: false,
      shot_ok: false,
      prompt_fix: null,
      all_pass: false,
    },
  };
}

/**
 * Emit event to handler
 */
async function emit(
  handler: EventHandler | undefined,
  event: OrchestratorEvent
): Promise<void> {
  if (handler) {
    try {
      await handler(event);
    } catch (error) {
      console.error("Event handler error:", error);
    }
  }
}

/**
 * Process a single scene independently (for testing or manual control)
 */
export async function processSingleScene(
  scene: Scene,
  options?: {
    maxRetries?: number;
    onEvent?: EventHandler;
  }
): Promise<SceneWithResult> {
  const config = getConfig();
  const maxRetries = options?.maxRetries ?? config.maxRetries;
  return processScene(scene, maxRetries, options?.onEvent);
}
