/**
 * GET /api/projects/[name]
 * 
 * Returns the full scenes.json for a single project.
 */

import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/projects";

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
