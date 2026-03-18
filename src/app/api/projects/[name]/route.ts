/**
 * GET /api/projects/[name]
 * 
 * Returns the full scenes.json for a single project.
 * 
 * PUT /api/projects/[name]
 * 
 * Updates a project's scenes.json (for approve, regenerate, etc.)
 */

import { NextRequest, NextResponse } from "next/server";
import { getProject, updateProjectScenes, getProjectDir } from "@/lib/projects";
import { promises as fs } from "fs";
import path from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const project = await getProject(params.name);

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error("Error getting project:", error);
    return NextResponse.json(
      { error: "Failed to get project" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const body = await request.json();
    const { scenes } = body;

    if (!scenes || !Array.isArray(scenes)) {
      return NextResponse.json(
        { error: "scenes array is required" },
        { status: 400 }
      );
    }

    const project = await getProject(params.name);
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Update project with new scenes
    const updatedProject = {
      ...project,
      scenes,
      // Update status based on scenes
      status: scenes.some((s: any) => s.status === "needs_review")
        ? "needs_review"
        : "complete",
    };

    // Write updated scenes.json
    const scenesPath = path.join(getProjectDir(params.name), "scenes.json");
    await fs.writeFile(scenesPath, JSON.stringify(updatedProject, null, 2));

    return NextResponse.json(updatedProject);
  } catch (error) {
    console.error("Error updating project:", error);
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 }
    );
  }
}
