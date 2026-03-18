"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// Client-safe copy (server module uses Node.js fs)
function humanizeProjectName(name: string): string {
  return name.replace(/-/g, " ");
}

export interface ProjectSummary {
  project_name: string;
  idea: string;
  created_at: string;
  status: "complete" | "needs_review" | "interrupted" | "generating";
  scene_count: number;
  thumbnail: string | null;
}

interface ProjectSidebarProps {
  projects: ProjectSummary[];
  activeProject?: string | null;
  onSelectProject: (name: string) => void;
  isLoading?: boolean;
  className?: string;
}

export function ProjectSidebar({
  projects,
  activeProject,
  onSelectProject,
  isLoading,
  className,
}: ProjectSidebarProps) {
  return (
    <aside
      className={cn(
        "w-72 border-r border-border bg-card flex flex-col h-full",
        className
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Projects</h2>
      </div>

      {/* Project List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Loading...
          </div>
        ) : projects.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            <p className="mb-1">No projects yet.</p>
            <p>Enter an idea to get started.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {projects.map((project) => (
              <li key={project.project_name}>
                <button
                  onClick={() => onSelectProject(project.project_name)}
                  className={cn(
                    "w-full p-3 text-left hover:bg-accent transition-colors",
                    activeProject === project.project_name && "bg-accent"
                  )}
                >
                  <div className="flex gap-3">
                    {/* Thumbnail */}
                    <div className="w-16 h-12 bg-muted rounded overflow-hidden flex-shrink-0">
                      {project.thumbnail ? (
                        <img
                          src={project.thumbnail}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                          No image
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-foreground truncate">
                          {humanizeProjectName(project.project_name)}
                        </span>
                        {project.status === "generating" && (
                          <span className="px-1.5 py-0.5 bg-red-500/10 text-red-600 dark:text-red-400 text-xs rounded border border-red-600/20">
                            Interrupted
                          </span>
                        )}
                        {project.status === "needs_review" && (
                          <span className="px-1.5 py-0.5 bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs rounded border border-orange-600/20">
                            Review
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {project.idea}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatRelativeTime(project.created_at)}
                      </p>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
