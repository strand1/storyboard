/**
 * Project Management
 * 
 * Handles project persistence, listing, and retrieval.
 * Projects are stored in /public/output/projects/[project_name]/
 */

import { promises as fs } from "fs";
import path from "path";
import { type SceneWithResult } from "./vision-agent";

export interface ProjectSummary {
  project_name: string;
  idea: string;
  created_at: string;
  status: "complete" | "needs_review" | "generating";
  scene_count: number;
  thumbnail: string | null;
}

export interface Project extends ProjectSummary {
  story_idea: string;
  scenes: SceneWithResult[];
  started_at: string;
  completed_at?: string;
}

const PROJECTS_DIR = path.join(process.cwd(), "public", "output", "projects");

/**
 * Generate a URL-safe project name from a story idea
 */
export function generateProjectName(idea: string): string {
  return idea
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

/**
 * Humanize a project name for display
 */
export function humanizeProjectName(name: string): string {
  return name.replace(/-/g, " ");
}

/**
 * Ensure projects directory exists
 */
export async function ensureProjectsDir(): Promise<void> {
  await fs.mkdir(PROJECTS_DIR, { recursive: true });
}

/**
 * Get the project directory path
 */
export function getProjectDir(projectName: string): string {
  return path.join(PROJECTS_DIR, projectName);
}

/**
 * Save a project's scenes.json and images
 */
export async function saveProject(
  projectName: string,
  scenes: SceneWithResult[],
  storyIdea: string,
  startedAt: string,
  completedAt?: string
): Promise<void> {
  const projectDir = getProjectDir(projectName);
  await fs.mkdir(projectDir, { recursive: true });

  // Determine status
  const passedCount = scenes.filter((s) => s.status === "pass").length;
  const reviewCount = scenes.filter((s) => s.status === "needs_review").length;
  const status: ProjectSummary["status"] =
    reviewCount > 0 ? "needs_review" : "complete";

  // Get thumbnail (first passing scene, or first scene)
  const thumbnailScene =
    scenes.find((s) => s.status === "pass" && s.image_path) ||
    scenes.find((s) => s.image_path);
  const thumbnail = thumbnailScene
    ? `/output/projects/${projectName}/${thumbnailScene.image_path}`
    : null;

  const project: Project = {
    project_name: projectName,
    idea: storyIdea,
    story_idea: storyIdea,
    created_at: startedAt,
    started_at: startedAt,
    completed_at: completedAt,
    status,
    scene_count: scenes.length,
    thumbnail,
    scenes,
  };

  // Write scenes.json
  const scenesPath = path.join(projectDir, "scenes.json");
  await fs.writeFile(scenesPath, JSON.stringify(project, null, 2));
}

/**
 * Mark a project as generating (for interrupted run detection)
 */
export async function markProjectGenerating(
  projectName: string,
  storyIdea: string
): Promise<void> {
  const projectDir = getProjectDir(projectName);
  await fs.mkdir(projectDir, { recursive: true });

  const project: Partial<Project> = {
    project_name: projectName,
    idea: storyIdea,
    story_idea: storyIdea,
    created_at: new Date().toISOString(),
    started_at: new Date().toISOString(),
    status: "generating",
    scene_count: 0,
    thumbnail: null,
    scenes: [],
  };

  const scenesPath = path.join(projectDir, "scenes.json");
  await fs.writeFile(scenesPath, JSON.stringify(project, null, 2));
}

/**
 * List all projects
 */
export async function listProjects(): Promise<ProjectSummary[]> {
  try {
    await ensureProjectsDir();
    const entries = await fs.readdir(PROJECTS_DIR, { withFileTypes: true });
    const projectDirs = entries.filter((e) => e.isDirectory());

    const projects: ProjectSummary[] = [];

    for (const dir of projectDirs) {
      try {
        const scenesPath = path.join(PROJECTS_DIR, dir.name, "scenes.json");
        const content = await fs.readFile(scenesPath, "utf-8");
        const project: Partial<Project> = JSON.parse(content);

        if (project.project_name && project.idea) {
          projects.push({
            project_name: project.project_name,
            idea: project.idea,
            created_at: project.created_at || project.started_at || "",
            status: project.status || "complete",
            scene_count: project.scene_count || 0,
            thumbnail: project.thumbnail || null,
          });
        }
      } catch (error) {
        console.error(`Error reading project ${dir.name}:`, error);
      }
    }

    // Sort by created_at descending (newest first)
    projects.sort((a, b) => {
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();
      return bTime - aTime;
    });

    return projects;
  } catch (error) {
    console.error("Error listing projects:", error);
    return [];
  }
}

/**
 * Get a single project by name
 */
export async function getProject(name: string): Promise<Project | null> {
  try {
    const scenesPath = path.join(getProjectDir(name), "scenes.json");
    const content = await fs.readFile(scenesPath, "utf-8");
    return JSON.parse(content) as Project;
  } catch (error) {
    return null;
  }
}

/**
 * Update a project's scenes
 */
export async function updateProjectScenes(
  projectName: string,
  scenes: SceneWithResult[]
): Promise<void> {
  const projectDir = getProjectDir(projectName);
  const scenesPath = path.join(projectDir, "scenes.json");
  
  const content = await fs.readFile(scenesPath, "utf-8");
  const project: Project = JSON.parse(content);
  
  // Update status based on scenes
  const passedCount = scenes.filter((s) => s.status === "pass").length;
  const reviewCount = scenes.filter((s) => s.status === "needs_review").length;
  
  const updatedProject = {
    ...project,
    scenes,
    status: reviewCount > 0 ? "needs_review" : "complete",
    completed_at: new Date().toISOString(),
  };
  
  await fs.writeFile(scenesPath, JSON.stringify(updatedProject, null, 2));
}

/**
 * Check if any project has status "generating" (interrupted run)
 */
export async function hasInterruptedProjects(): Promise<boolean> {
  const projects = await listProjects();
  return projects.some((p) => p.status === "generating");
}

/**
 * Get interrupted projects
 */
export async function getInterruptedProjects(): Promise<ProjectSummary[]> {
  const projects = await listProjects();
  return projects.filter((p) => p.status === "generating");
}
