"use client";

import { useState, useCallback } from "react";
import { StoryInputForm } from "@/components/StoryInputForm";
import { StoryboardGrid, type Scene } from "@/components/StoryboardGrid";
import { LiveStatusIndicator } from "@/components/LiveStatusIndicator";
import { StatusBadge, type StatusType } from "@/components/StatusBadge";

interface StreamEvent {
  type: string;
  story_idea?: string;
  breakdown?: {
    scenes: any[];
  };
  scene_id?: number;
  total_scenes?: number;
  take?: number;
  prompt?: string;
  status?: StatusType;
  reason?: string;
  scenes?: Scene[];
  result?: {
    scenes: Scene[];
    status: string;
  };
  message?: string;
}

export default function Home() {
  const [storyIdea, setStoryIdea] = useState("");
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [generationStatus, setGenerationStatus] = useState<"idle" | "generating" | "complete">("idle");
  const [currentScene, setCurrentScene] = useState(0);
  const [totalScenes, setTotalScenes] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async (idea: string) => {
    setStoryIdea(idea);
    setScenes([]);
    setGenerationStatus("generating");
    setCurrentScene(0);
    setTotalScenes(0);
    setError(null);

    try {
      const response = await fetch("/api/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          storyIdea: idea,
          sceneCount: 6,
          maxRetries: 2,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Generation failed");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE messages
        const messages = buffer.split("\n\n");
        buffer = messages.pop() || "";

        for (const message of messages) {
          const lines = message.split("\n");
          const eventLine = lines.find((l) => l.startsWith("event:"));
          const dataLine = lines.find((l) => l.startsWith("data:"));

          if (eventLine && dataLine) {
            const eventType = eventLine.replace("event: ", "").trim();
            const dataStr = dataLine.replace("data: ", "").trim();

            try {
              const data: StreamEvent = JSON.parse(dataStr);
              handleEvent(eventType, data);
            } catch (e) {
              console.error("Failed to parse event:", e);
            }
          }
        }
      }
    } catch (err) {
      console.error("Generation error:", err);
      setError(err instanceof Error ? err.message : String(err));
      setGenerationStatus("idle");
    }
  }, []);

  const handleEvent = (eventType: string, data: StreamEvent) => {
    console.log("Event:", eventType, data);

    switch (eventType) {
      case "story_complete":
        if (data.breakdown?.scenes) {
          const initialScenes: Scene[] = data.breakdown.scenes.map((s: any) => ({
            ...s,
            take: 0,
            status: "idle" as StatusType,
          }));
          setScenes(initialScenes);
          setTotalScenes(initialScenes.length);
        }
        break;

      case "scene_start":
        if (data.scene_id !== undefined) {
          setCurrentScene(data.scene_id);
          setScenes((prev) =>
            prev.map((scene) =>
              scene.scene_id === data.scene_id
                ? { ...scene, status: "generating" as StatusType }
                : scene
            )
          );
        }
        break;

      case "scene_generate":
        if (data.scene_id !== undefined) {
          setScenes((prev) =>
            prev.map((scene) =>
              scene.scene_id === data.scene_id
                ? { ...scene, take: data.take ?? scene.take }
                : scene
            )
          );
        }
        break;

      case "scene_complete":
        if (data.scene_id !== undefined && data.status) {
          setScenes((prev) =>
            prev.map((scene) =>
              scene.scene_id === data.scene_id
                ? { ...scene, status: data.status as StatusType }
                : scene
            )
          );
        }
        break;

      case "scene_retry":
        if (data.scene_id !== undefined) {
          setScenes((prev) =>
            prev.map((scene) =>
              scene.scene_id === data.scene_id
                ? { ...scene, status: "retrying" as StatusType, take: data.take ?? scene.take }
                : scene
            )
          );
        }
        break;

      case "generation_complete":
        if (data.scenes) {
          setScenes(data.scenes);
        }
        break;

      case "complete":
        if (data.result?.scenes) {
          setScenes(data.result.scenes);
          setGenerationStatus("complete");
        }
        break;

      case "error":
        setError(data.message || "An error occurred");
        setGenerationStatus("idle");
        break;
    }
  };

  const passedCount = scenes.filter((s) => s.status === "pass").length;
  const reviewCount = scenes.filter((s) => s.status === "needs_review").length;

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Storyboard</h1>
          <p className="text-muted-foreground">
            Turn your story ideas into visual storyboards with AI
          </p>
        </header>

        {/* Input Form */}
        <section className="mb-8">
          <StoryInputForm
            onSubmit={handleGenerate}
            disabled={generationStatus === "generating"}
            defaultValue={storyIdea || undefined}
          />
        </section>

        {/* Error Display */}
        {error && (
          <div className="mb-8 p-4 rounded-lg border border-red-500/20 bg-red-500/10">
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Live Status */}
        <LiveStatusIndicator
          status={generationStatus}
          currentScene={currentScene}
          totalScenes={totalScenes}
          passedCount={passedCount}
          reviewCount={reviewCount}
          className="mb-6"
        />

        {/* Storyboard Grid */}
        {scenes.length > 0 && (
          <section>
            <StoryboardGrid scenes={scenes} />
          </section>
        )}

        {/* Empty State */}
        {generationStatus === "idle" && scenes.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🎬</div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Ready to Create
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Enter a story idea above and watch as AI breaks it into scenes,
              generates images, and creates your visual storyboard.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
