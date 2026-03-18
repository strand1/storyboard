"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { SceneCard, type Scene } from "./SceneCard";
import { SceneLightbox } from "./SceneLightbox";

export type { Scene };

interface StoryboardGridProps {
  scenes: Scene[];
  projectName?: string;
  className?: string;
  onRegenerate?: (sceneId: number, prompt: string, seed?: number) => Promise<void>;
  onApprove?: (sceneId: number) => void;
}

export function StoryboardGrid({
  scenes,
  projectName,
  className,
  onRegenerate,
  onApprove,
}: StoryboardGridProps) {
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  if (scenes.length === 0) {
    return null;
  }

  const handleSceneClick = (scene: Scene) => {
    setSelectedScene(scene);
    setIsLightboxOpen(true);
  };

  const handleCloseLightbox = () => {
    setIsLightboxOpen(false);
    setTimeout(() => setSelectedScene(null), 200);
  };

  return (
    <>
      <div
        className={cn(
          "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4",
          className
        )}
      >
        {scenes.map((scene) => (
          <div key={scene.scene_id} onClick={() => handleSceneClick(scene)} className="cursor-pointer">
            <SceneCard scene={scene} projectName={projectName} />
          </div>
        ))}
      </div>

      {selectedScene && (
        <SceneLightbox
          scene={selectedScene}
          scenes={scenes}
          projectName={projectName}
          isOpen={isLightboxOpen}
          onClose={handleCloseLightbox}
          onRegenerate={onRegenerate}
          onApprove={onApprove}
        />
      )}
    </>
  );
}
