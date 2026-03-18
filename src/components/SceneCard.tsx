"use client";

import { cn } from "@/lib/utils";
import { StatusBadge, type StatusType } from "./StatusBadge";

export interface VisionResult {
  subjects_ok: boolean;
  missing_subjects: string[];
  mood_ok: boolean;
  shot_ok: boolean;
  prompt_fix: string | null;
}

export interface Take {
  take: number;
  steps: number;
  seed: number;
  prompt: string;
  image_path: string;
  vision_result: VisionResult;
}

export interface Scene {
  scene_id: number;
  description: string;
  subject: string[];  // Array of required subjects
  action: string;
  mood: string;
  shot_type: "wide" | "medium" | "close-up" | "overhead";
  original_comfy_prompt?: string;
  comfy_prompt: string;
  image_path?: string;
  take: number;
  steps?: number;
  seed?: number;
  status: StatusType;
  manually_approved?: boolean;
  takes?: Take[];
  vision_result?: VisionResult;
}

interface SceneCardProps {
  scene: Scene;
  projectName?: string;
  className?: string;
  onClick?: () => void;
}

export function SceneCard({ scene, projectName, className, onClick }: SceneCardProps) {
  // Get image path from current take if scene.image_path is not set
  const imagePath = scene.image_path || 
    (scene.takes && scene.takes.length > 0 
      ? scene.takes.find(t => t.take === scene.take)?.image_path 
      : undefined);
  
  const imageUrl = imagePath && projectName
    ? `/output/projects/${projectName}/${imagePath}`
    : imagePath
    ? `/output/${imagePath}`
    : undefined;

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative bg-card border border-border rounded-lg overflow-hidden",
        "hover:border-accent transition-colors duration-200",
        onClick ? "cursor-pointer" : "",
        className
      )}
    >
      {/* Image */}
      <div className="aspect-[16/9] bg-muted relative overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`Scene ${scene.scene_id}: ${scene.description}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl font-bold text-muted-foreground/30">
                {scene.scene_id}
              </div>
              <div className="text-sm text-muted-foreground/50 mt-1">
                Scene
              </div>
            </div>
          </div>
        )}

        {/* Status badge overlay */}
        <div className="absolute top-2 right-2">
          <StatusBadge status={scene.status} />
        </div>

        {/* Take counter */}
        {scene.take > 1 && (
          <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 text-white text-xs rounded">
            Take {scene.take}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Description */}
        <p className="text-sm font-medium text-foreground line-clamp-2">
          {scene.description}
        </p>

        {/* Meta info */}
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center px-2 py-0.5 bg-muted rounded">
            {scene.shot_type}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 bg-muted rounded">
            {scene.mood}
          </span>
          {scene.steps !== undefined && (
            <span className="inline-flex items-center px-2 py-0.5 bg-muted rounded">
              {scene.steps} steps
            </span>
          )}
        </div>

        {/* Vision result (if failed) */}
        {scene.vision_result && scene.status === "needs_review" && (
          <div className="pt-2 border-t border-border">
            <div className="text-xs text-muted-foreground space-y-1">
              {!scene.vision_result.subjects_ok && (
                <div className="text-red-500 dark:text-red-400">
                  • Missing subjects: {scene.vision_result.missing_subjects?.join(", ") || "unknown"}
                </div>
              )}
              {!scene.vision_result.mood_ok && (
                <div className="text-red-500 dark:text-red-400">
                  • Mood check failed
                </div>
              )}
              {!scene.vision_result.shot_ok && (
                <div className="text-red-500 dark:text-red-400">
                  • Shot check failed
                </div>
              )}
              {scene.vision_result.prompt_fix && (
                <div className="text-orange-500 dark:text-orange-400 mt-1">
                  Fix: {scene.vision_result.prompt_fix}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
