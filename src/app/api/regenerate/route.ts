/**
 * POST /api/regenerate
 * 
 * Regenerate a single scene with a custom prompt.
 * Body: { projectName: string, sceneId: number, prompt: string }
 * 
 * Returns the updated scene with the new image.
 */

import { NextRequest, NextResponse } from "next/server";
import { getProject, updateProjectScenes } from "@/lib/projects";
import { comfyuiGenerate } from "@/lib/comfyui";
import { visionCheck, type SceneWithResult, type Take } from "@/lib/vision-agent";
import { getConfig } from "@/lib/config";
import { promises as fs } from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectName, sceneId, prompt, seed } = body;

    if (!projectName || !sceneId || !prompt) {
      return NextResponse.json(
        { error: "projectName, sceneId, and prompt are required" },
        { status: 400 }
      );
    }

    const project = await getProject(projectName);
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    const sceneIndex = project.scenes.findIndex((s) => s.scene_id === sceneId);
    if (sceneIndex === -1) {
      return NextResponse.json(
        { error: "Scene not found" },
        { status: 404 }
      );
    }

    const scene = project.scenes[sceneIndex];
    const config = getConfig();

    // Determine next take number and step count
    const nextTake = (scene.takes?.length || 0) + 1;
    const steps = config.stepLadder[Math.min(nextTake - 1, config.stepLadder.length - 1)];
    
    // Use provided seed or generate random one
    const useSeed = seed ?? Math.floor(Math.random() * 0xFFFFFFFF);

    // Build save path for image
    const projectDir = path.join(process.cwd(), "public", "output", "projects", projectName);
    const savedImagePath = `scene_${String(sceneId).padStart(2, '0')}_take_${nextTake}.png`;
    const savePath = path.join(projectDir, savedImagePath);

    // Generate image with custom prompt and seed, save directly to project folder
    const image = await comfyuiGenerate(prompt, {
      steps,
      seed: useSeed,
      samplerNodeId: "68",
      savePath,
    });

    // Run vision check (pass buffer directly)
    const visionResult = await visionCheck(scene, image.buffer);

    // Create take record
    const takeRecord: Take = {
      take: nextTake,
      steps,
      seed: useSeed,
      prompt,
      image_path: savedImagePath,
      vision_result: visionResult,
    };

    // Update scene
    const updatedScene: SceneWithResult = {
      ...scene,
      comfy_prompt: prompt,
      image_path: savedImagePath,
      take: nextTake,
      steps,
      seed: useSeed,
      status: visionResult.all_pass ? "pass" : "needs_review",
      manually_approved: false,
      takes: [...(scene.takes || []), takeRecord],
      vision_result: visionResult,
    };

    // Update project scenes
    const updatedScenes = [...project.scenes];
    updatedScenes[sceneIndex] = updatedScene;
    await updateProjectScenes(projectName, updatedScenes);

    return NextResponse.json({
      success: true,
      scene: updatedScene,
    });
  } catch (error) {
    console.error("Regenerate error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
