/**
 * POST /api/approve
 * 
 * Manually approve a scene that failed vision check.
 * Body: { projectName: string, sceneId: number }
 * 
 * Sets the scene status to "pass" and marks it as manually_approved.
 */

import { NextRequest, NextResponse } from "next/server";
import { getProject, updateProjectScenes } from "@/lib/projects";
import type { SceneWithResult } from "@/lib/vision-agent";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectName, sceneId } = body;

    if (!projectName || !sceneId) {
      return NextResponse.json(
        { error: "projectName and sceneId are required" },
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

    // Update scene to approved
    const updatedScene: SceneWithResult = {
      ...scene,
      status: "pass",
      manually_approved: true,
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
    console.error("Approve error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
