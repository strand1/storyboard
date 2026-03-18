"use client";

import { cn } from "@/lib/utils";
import { StatusBadge, type StatusType } from "./StatusBadge";

export interface Scene {
  scene_id: number;
  description: string;
  subject: string;
  action: string;
  mood: string;
  shot_type: "wide" | "medium" | "close-up" | "overhead";
  comfy_prompt: string;
  image_path?: string;
  image_base64?: string;
  take: number;
  status: StatusType;
  vision_result?: {
    subject_ok: boolean;
    mood_ok: boolean;
    shot_ok: boolean;
    prompt_fix: string | null;
  };
}

interface SceneCardProps {
  scene: Scene;
  className?: string;
}

export function SceneCard({ scene, className }: SceneCardProps) {
  const imageUrl = scene.image_base64
    ? `data:image/png;base64,${scene.image_base64}`
    : scene.image_path
    ? `/output/${scene.image_path}`
    : undefined;

  return (
    <div
      className={cn(
        "group relative bg-card border border-border rounded-lg overflow-hidden",
        "hover:border-accent transition-colors duration-200",
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
        </div>

        {/* Vision result (if failed) */}
        {scene.vision_result && scene.status === "needs_review" && (
          <div className="pt-2 border-t border-border">
            <div className="text-xs text-muted-foreground space-y-1">
              {!scene.vision_result.subject_ok && (
                <div className="text-red-500 dark:text-red-400">
                  • Subject check failed
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
