/**
 * SSE Endpoint for Live Generation Status
 * 
 * POST /api/stream
 * Body: { storyIdea: string, sceneCount?: number, maxRetries?: number }
 * 
 * Streams Server-Sent Events as generation progresses.
 */

import { NextRequest } from "next/server";
import { generateStoryboard, type OrchestratorEvent } from "@/lib/orchestrator";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const encoder = new TextEncoder();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { storyIdea, sceneCount, maxRetries } = body;

    if (!storyIdea || typeof storyIdea !== "string") {
      return new Response(
        JSON.stringify({ error: "storyIdea is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Generate project name from story idea
    const { generateProjectName } = await import("@/lib/projects");
    const projectName = generateProjectName(storyIdea);

    // Create a ReadableStream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        let closed = false;

        const sendEvent = (event: string, data: any) => {
          if (closed) return;
          const sseMessage = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          try {
            controller.enqueue(encoder.encode(sseMessage));
          } catch (e) {
            // Stream may have been closed by client
            closed = true;
          }
        };

        try {
          // Send connection established
          sendEvent("connected", {
            message: "Generation started",
            storyIdea,
            projectName,
            timestamp: new Date().toISOString(),
          });

          // Event handler for pipeline events
          const onEvent = (event: OrchestratorEvent) => {
            sendEvent(event.type, event);
          };

          // Run the generation pipeline
          const result = await generateStoryboard(storyIdea, {
            sceneCount,
            maxRetries,
            onEvent,
          });

          // Send final result
          sendEvent("complete", {
            result,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.error("Generation error:", error);
          if (!closed) {
            sendEvent("error", {
              message: errorMessage,
              timestamp: new Date().toISOString(),
            });
          }
        } finally {
          closed = true;
          controller.close();
        }
      },
    });

    // Return SSE response
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error("SSE endpoint error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
