"use client";

import { useState, useCallback, useEffect } from "react";
import { StoryInputForm } from "@/components/StoryInputForm";
import { StoryboardGrid, type Scene } from "@/components/StoryboardGrid";
import { LiveStatusIndicator } from "@/components/LiveStatusIndicator";
import { StatusBadge, type StatusType } from "@/components/StatusBadge";
import { ProjectSidebar, type ProjectSummary } from "@/components/ProjectSidebar";
import { InterruptedWarning } from "@/components/InterruptedWarning";

// Helper to humanize project names (client-side copy)
function humanizeProjectName(name: string): string {
  return name.replace(/-/g, " ");
}

interface StreamEvent {
  type: string;
  story_idea?: string;
  projectName?: string;
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
    project_name: string;
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
  
  // Project state
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [interruptedProject, setInterruptedProject] = useState<ProjectSummary | null>(null);
  const [dismissedInterrupted, setDismissedInterrupted] = useState(false);

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      setIsLoadingProjects(true);
      const response = await fetch("/api/projects");
      const data = await response.json();
      setProjects(data);

      // Check for interrupted projects
      const interrupted = data.find((p: ProjectSummary) => p.status === "generating");
      if (interrupted && !dismissedInterrupted) {
        setInterruptedProject(interrupted);
      }

      // Load most recent project if none active
      if (data.length > 0 && !activeProject) {
        await loadProject(data[0].project_name);
      }
    } catch (error) {
      console.error("Failed to load projects:", error);
    } finally {
      setIsLoadingProjects(false);
    }
  }

  async function loadProject(projectName: string) {
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectName)}`);
      if (response.ok) {
        const project = await response.json();
        setScenes(project.scenes || []);
        setStoryIdea(project.story_idea || project.idea || "");
        setActiveProject(projectName);
        setGenerationStatus("complete");
      }
    } catch (error) {
      console.error("Failed to load project:", error);
    }
  }

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
      case "connected":
        if (data.projectName) {
          setActiveProject(data.projectName);
        }
        break;

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
          if (data.result.project_name) {
            setActiveProject(data.result.project_name);
            loadProjects(); // Refresh sidebar
          }
        }
        break;

      case "error":
        setError(data.message || "An error occurred");
        setGenerationStatus("idle");
        break;
    }
  };

  const handleSelectProject = (projectName: string) => {
    loadProject(projectName);
  };

  const handleDismissInterrupted = () => {
    setDismissedInterrupted(true);
    setInterruptedProject(null);
  };

  const handleViewPartial = () => {
    if (interruptedProject) {
      loadProject(interruptedProject.project_name);
      setDismissedInterrupted(true);
      setInterruptedProject(null);
    }
  };

  const handleRegenerate = async (sceneId: number, prompt: string, seed?: number) => {
    if (!activeProject) return;

    try {
      const response = await fetch("/api/regenerate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectName: activeProject,
          sceneId,
          prompt,
          seed,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Regeneration failed");
      }

      const data = await response.json();
      
      // Update the scene in the local state
      setScenes((prev) =>
        prev.map((scene) =>
          scene.scene_id === sceneId ? data.scene : scene
        )
      );
    } catch (error) {
      console.error("Regenerate error:", error);
      throw error;
    }
  };

  const handleApprove = async (sceneId: number) => {
    if (!activeProject) return;

    try {
      const response = await fetch("/api/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectName: activeProject,
          sceneId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Approval failed");
      }

      const data = await response.json();
      
      // Update the scene in the local state
      setScenes((prev) =>
        prev.map((scene) =>
          scene.scene_id === sceneId ? data.scene : scene
        )
      );
      
      // Refresh projects list to update sidebar status
      loadProjects();
    } catch (error) {
      console.error("Approve error:", error);
      throw error;
    }
  };

  const passedCount = scenes.filter((s) => s.status === "pass").length;
  const reviewCount = scenes.filter((s) => s.status === "needs_review").length;

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <ProjectSidebar
        projects={projects}
        activeProject={activeProject}
        onSelectProject={handleSelectProject}
        isLoading={isLoadingProjects}
      />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          {/* Header */}
          <header className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                {activeProject && (
                  <p className="text-sm text-muted-foreground mb-1">
                    Project: {humanizeProjectName(activeProject)}
                  </p>
                )}
                <h1 className="text-4xl font-bold text-foreground">Storyboard</h1>
              </div>
            </div>
            <p className="text-muted-foreground mt-2">
              Turn your story ideas into visual storyboards with AI
            </p>
          </header>

          {/* Interrupted Warning */}
          {interruptedProject && !dismissedInterrupted && (
            <InterruptedWarning
              projectName={humanizeProjectName(interruptedProject.project_name)}
              idea={interruptedProject.idea}
              onDismiss={handleDismissInterrupted}
              onViewPartial={handleViewPartial}
              className="mb-6"
            />
          )}

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
              <StoryboardGrid
                scenes={scenes}
                projectName={activeProject || undefined}
                onRegenerate={handleRegenerate}
                onApprove={handleApprove}
              />
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
    </div>
  );
}
