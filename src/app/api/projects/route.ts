/**
 * GET /api/projects
 * 
 * Returns a list of all projects for the sidebar,
 * ordered by created_at descending (newest first).
 */

import { NextResponse } from "next/server";
import { listProjects } from "@/lib/projects";

export async function GET() {
  try {
    const projects = await listProjects();
    return NextResponse.json(projects);
  } catch (error) {
    console.error("Error listing projects:", error);
    return NextResponse.json(
      { error: "Failed to list projects" },
      { status: 500 }
    );
  }
}
