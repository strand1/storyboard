/**
 * Orchestrator
 * 
 * Main pipeline: story idea → scenes → generate images → vision check → retry loop
 * 
 * Emits events for live status updates during generation.
 */

import { generateStoryBreakdown, type Scene, type StoryBreakdown } from "./story-agent";
import { comfyuiGenerate, type ComfyUIImage } from "./comfyui";
import { visionCheck, type VisionResult, type SceneWithResult, type Take } from "./vision-agent";
import { getConfig } from "./config";
import { generateProjectName, saveProject, markProjectGenerating, getProjectDir } from "./projects";

export type OrchestratorEvent =
  | { type: "story_start"; story_idea: string }
  | { type: "story_complete"; breakdown: StoryBreakdown }
  | { type: "scene_start"; scene_id: number; total_scenes: number }
  | { type: "scene_generate"; scene_id: number; take: number; steps: number; seed: number; prompt: string }
  | { type: "scene_complete"; scene_id: number; status: "pass" | "needs_review" }
  | { type: "scene_retry"; scene_id: number; take: number; steps?: number; seed?: number; reason: string }
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
  project_name: string;
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
  const projectName = generateProjectName(storyIdea);

  try {
    // Mark project as generating (for interrupted run detection)
    await markProjectGenerating(projectName, storyIdea);

    // Emit start event
    await emit(onEvent, { type: "story_start", story_idea: storyIdea });

    // Generate story breakdown
    const breakdown = await generateStoryBreakdown(storyIdea, {
      sceneCount: options?.sceneCount,
      stylePrefix: options?.stylePrefix,
    });

    await emit(onEvent, { type: "story_complete", breakdown });

    // Get project directory for saving images
    const projectDir = getProjectDir(projectName);

    // Process each scene
    for (const scene of breakdown.scenes) {
      const sceneResult = await processScene(scene, maxRetries, onEvent, projectDir);
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

    // Save project to disk
    await saveProject(projectName, scenes, storyIdea, startedAt, completedAt);

    return {
      story_idea: storyIdea,
      scenes,
      started_at: startedAt,
      completed_at: completedAt,
      status,
      project_name: projectName,
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
      project_name: projectName,
    };
  }
}

/**
 * Process a single scene with retry loop
 */
async function processScene(
  scene: Scene,
  maxRetries: number,
  onEvent?: EventHandler,
  projectDir?: string
): Promise<SceneWithResult> {
  const config = getConfig();
  const path = await import("path");
  const totalScenes = 1; // We don't know total here, pass from caller if needed
  let currentPrompt = scene.comfy_prompt;
  let originalPrompt = scene.comfy_prompt;
  const takes: Take[] = [];

  await emit(onEvent, {
    type: "scene_start",
    scene_id: scene.scene_id,
    total_scenes: totalScenes,
  });

  for (let take = 1; take <= maxRetries + 1; take++) {
    try {
      // Get step count from step ladder (clamp to last value if exceeded)
      const steps = config.stepLadder[Math.min(take - 1, config.stepLadder.length - 1)];
      
      // Generate random seed for this take (0 to 2^32 - 1)
      const seed = Math.floor(Math.random() * 0xFFFFFFFF);

      // Emit generation event
      await emit(onEvent, {
        type: "scene_generate",
        scene_id: scene.scene_id,
        take,
        steps,
        seed,
        prompt: currentPrompt,
      });

      // Build save path for image
      const savePath = projectDir 
        ? path.join(projectDir, `scene_${String(scene.scene_id).padStart(2, '0')}_take_${take}.png`)
        : undefined;

      // Generate image with adaptive steps and random seed
      const image = await comfyuiGenerate(currentPrompt, {
        steps,
        seed,
        samplerNodeId: "68", // KSampler node ID in z-image turbo workflow
        savePath,
      });

      // Vision check (pass buffer directly)
      const visionResult = await visionCheck(scene, image.buffer);

      // Record this take
      // Use the saved filename (our naming convention) not ComfyUI's temp filename
      const savedImagePath = savePath ? path.basename(savePath) : image.filename;

      const takeRecord: Take = {
        take,
        steps,
        seed,
        prompt: currentPrompt,
        image_path: savedImagePath,
        vision_result: visionResult,
      };
      takes.push(takeRecord);

      if (visionResult.all_pass) {
        // Success!
        const result: SceneWithResult = {
          ...scene,
          original_comfy_prompt: originalPrompt,
          comfy_prompt: currentPrompt,
          image_path: savedImagePath,
          take,
          steps,
          seed,
          status: "pass",
          manually_approved: false,
          takes,
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
      if (!visionResult.subjects_ok) {
        const missing = visionResult.missing_subjects.join(", ");
        failedCriteria.push(`subject (${missing})`);
      }
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
          steps: config.stepLadder[Math.min(take, config.stepLadder.length - 1)],
          reason,
        });
      } else {
        // No more retries
        const result: SceneWithResult = {
          ...scene,
          original_comfy_prompt: originalPrompt,
          comfy_prompt: currentPrompt,
          image_path: savedImagePath,
          take,
          steps,
          seed,
          status: "needs_review",
          manually_approved: false,
          takes,
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
      const steps = config.stepLadder[Math.min(take - 1, config.stepLadder.length - 1)];
      const seed = Math.floor(Math.random() * 0xFFFFFFFF);

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
          original_comfy_prompt: originalPrompt,
          take,
          steps,
          seed,
          status: "needs_review",
          manually_approved: false,
          takes,
          vision_result: {
            subjects_ok: false,
            missing_subjects: [],
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
    original_comfy_prompt: originalPrompt,
    take: maxRetries + 1,
    steps: config.stepLadder[config.stepLadder.length - 1],
    seed: Math.floor(Math.random() * 0xFFFFFFFF),
    status: "needs_review",
    manually_approved: false,
    takes,
    vision_result: {
      subjects_ok: false,
      missing_subjects: [],
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
