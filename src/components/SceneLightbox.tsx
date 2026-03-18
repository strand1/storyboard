"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { StatusBadge, type StatusType } from "./StatusBadge";
import type { Scene, VisionResult, Take } from "./SceneCard";

interface SceneLightboxProps {
  scene: Scene;
  scenes: Scene[];
  projectName?: string;
  isOpen: boolean;
  onClose: () => void;
  onRegenerate?: (sceneId: number, prompt: string, seed?: number) => Promise<void>;
  onApprove?: (sceneId: number) => void;
}

export function SceneLightbox({
  scene,
  scenes,
  projectName,
  isOpen,
  onClose,
  onRegenerate,
  onApprove,
}: SceneLightboxProps) {
  const [editedPrompt, setEditedPrompt] = useState(scene.comfy_prompt);
  const [editedSeed, setEditedSeed] = useState<number | undefined>(scene.seed);
  const [isRegenerating, setIsRegenerating] = useState(false);
  // Get image path from current take if scene.image_path is not set
  const getImagePath = (s: typeof scene) => {
    return s.image_path || 
      (s.takes && s.takes.length > 0 
        ? s.takes.find(t => t.take === s.take)?.image_path 
        : undefined);
  };

  const [currentImage, setCurrentImage] = useState<string | undefined>(
    getImagePath(scene)
  );

  // Reset state when scene changes
  useEffect(() => {
    setEditedPrompt(scene.comfy_prompt);
    setEditedSeed(scene.seed);
    setCurrentImage(getImagePath(scene));
    setIsRegenerating(false);
  }, [scene]);

  const randomizeSeed = () => {
    const newSeed = Math.floor(Math.random() * 0xFFFFFFFF);
    setEditedSeed(newSeed);
  };

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight") {
        navigateToNext();
      } else if (e.key === "ArrowLeft") {
        navigateToPrev();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, scene.scene_id, scenes]);

  const navigateToNext = useCallback(() => {
    const currentIndex = scenes.findIndex((s) => s.scene_id === scene.scene_id);
    if (currentIndex < scenes.length - 1) {
      // Navigation is handled by parent via scene change
      const nextScene = scenes[currentIndex + 1];
      // This would need to be lifted to parent - for now just close
      onClose();
    }
  }, [scene.scene_id, scenes, onClose]);

  const navigateToPrev = useCallback(() => {
    const currentIndex = scenes.findIndex((s) => s.scene_id === scene.scene_id);
    if (currentIndex > 0) {
      const prevScene = scenes[currentIndex - 1];
      onClose();
    }
  }, [scene.scene_id, scenes, onClose]);

  const handleRegenerate = async () => {
    if (!onRegenerate) return;

    setIsRegenerating(true);
    try {
      await onRegenerate(scene.scene_id, editedPrompt, editedSeed);
      // Image will be updated by parent via scene prop change
    } catch (error) {
      console.error("Regeneration failed:", error);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleApprove = () => {
    if (onApprove) {
      onApprove(scene.scene_id);
    }
  };

  const imageUrl = currentImage
    ? currentImage.startsWith("data:")
      ? currentImage
      : projectName
      ? `/output/projects/${projectName}/${currentImage}`
      : `/output/${currentImage}`
    : undefined;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-7xl h-[90vh] flex gap-4 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors z-10"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Image section (65%) */}
        <div className="flex-1 flex items-center justify-center bg-black/40 rounded-lg overflow-hidden">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={`Scene ${scene.scene_id}: ${scene.description}`}
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <div className="text-center text-white/60">
              <div className="text-6xl font-bold">{scene.scene_id}</div>
              <div className="text-lg mt-2">Scene</div>
            </div>
          )}
        </div>

        {/* Info panel (35%) */}
        <div className="w-[35%] min-w-[320px] bg-background border border-border rounded-lg p-6 overflow-y-auto">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-xl font-semibold">Scene {scene.scene_id}</h2>
              <StatusBadge status={scene.status} />
            </div>
            <p className="text-sm text-muted-foreground">{scene.description}</p>
          </div>

          {/* Meta info */}
          <div className="mb-6 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Shot:</span>
              <span className="px-2 py-0.5 bg-muted rounded">{scene.shot_type}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Mood:</span>
              <span className="px-2 py-0.5 bg-muted rounded">{scene.mood}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Take:</span>
              <span className="font-medium">{scene.take}</span>
              {scene.steps !== undefined && (
                <>
                  <span className="text-muted-foreground">•</span>
                  <span className="font-medium">{scene.steps} steps</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Seed:</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={editedSeed ?? 0}
                  onChange={(e) => setEditedSeed(parseInt(e.target.value, 10) || 0)}
                  className="w-28 px-2 py-0.5 text-xs bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <button
                  onClick={randomizeSeed}
                  className="p-1 hover:bg-muted rounded transition-colors"
                  title="Randomize seed"
                >
                  🎲
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Subjects:</span>
              <div className="flex gap-1 flex-wrap">
                {Array.isArray(scene.subject) ? scene.subject.map((subj, i) => (
                  <span key={i} className="px-2 py-0.5 bg-muted rounded text-xs">
                    {subj}
                  </span>
                )) : (
                  <span className="px-2 py-0.5 bg-muted rounded text-xs">
                    {scene.subject || "unknown"}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Prompt editing */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Prompt</label>
            <textarea
              value={editedPrompt}
              onChange={(e) => setEditedPrompt(e.target.value)}
              className="w-full h-40 p-3 text-sm bg-muted border border-border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="Enter prompt..."
            />
            {scene.original_comfy_prompt &&
              scene.original_comfy_prompt !== scene.comfy_prompt && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Original: {scene.original_comfy_prompt.slice(0, 80)}...
                </div>
              )}
          </div>

          {/* Vision notes */}
          {scene.vision_result && scene.status === "needs_review" && (
            <div className="mb-6 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-md">
              <div className="text-sm font-medium text-red-900 dark:text-red-100 mb-2">
                Vision Check Failed
              </div>
              <div className="text-xs text-red-700 dark:text-red-300 space-y-1">
                {!scene.vision_result.subjects_ok && (
                  <div>
                    • Missing: {scene.vision_result.missing_subjects?.join(", ") || "unknown"}
                  </div>
                )}
                {!scene.vision_result.mood_ok && (
                  <div>• Mood mismatch</div>
                )}
                {!scene.vision_result.shot_ok && (
                  <div>• Shot type mismatch</div>
                )}
                {scene.vision_result.prompt_fix && (
                  <div className="mt-2 text-orange-700 dark:text-orange-300">
                    Suggested fix: {scene.vision_result.prompt_fix}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Takes history */}
          {scene.takes && scene.takes.length > 1 && (
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">
                Take History ({scene.takes.length})
              </label>
              <div className="space-y-2">
                {scene.takes.map((take) => (
                  <div
                    key={take.take}
                    className={cn(
                      "p-2 text-xs border rounded-md",
                      take.take === scene.take
                        ? "border-accent bg-accent/10"
                        : "border-border bg-muted"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Take {take.take}</span>
                      <span>{take.steps} steps • seed: {take.seed}</span>
                    </div>
                    <div className="text-muted-foreground mt-1">
                      {take.vision_result.subjects_ok &&
                      take.vision_result.mood_ok &&
                      take.vision_result.shot_ok ? (
                        <span className="text-green-600 dark:text-green-400">
                          ✓ Passed
                        </span>
                      ) : (
                        <span className="text-red-600 dark:text-red-400">
                          ✗ Failed
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2">
            <button
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="w-full py-2 px-4 bg-accent text-accent-foreground rounded-md font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRegenerating ? "Regenerating..." : "Regenerate"}
            </button>

            {scene.status === "needs_review" && (
              <button
                onClick={handleApprove}
                className="w-full py-2 px-4 bg-green-600 text-white rounded-md font-medium hover:bg-green-700 transition-colors"
              >
                Approve
              </button>
            )}
          </div>

          {/* Navigation hint */}
          <div className="mt-6 text-xs text-muted-foreground text-center">
            Use ← → arrow keys to navigate scenes • Esc to close
          </div>
        </div>
      </div>
    </div>
  );
}
