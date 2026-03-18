"use client";

import { cn } from "@/lib/utils";
import { SceneCard, type Scene } from "./SceneCard";

interface StoryboardGridProps {
  scenes: Scene[];
  className?: string;
}

export function StoryboardGrid({ scenes, className }: StoryboardGridProps) {
  if (scenes.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4",
        className
      )}
    >
      {scenes.map((scene) => (
        <SceneCard key={scene.scene_id} scene={scene} />
      ))}
    </div>
  );
}
