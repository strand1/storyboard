/**
 * Test script for SSE endpoint
 * 
 * Starts the dev server, makes a POST request, and logs all SSE events.
 * 
 * Run with: npx tsx src/lib/test-sse-endpoint.ts
 */

async function testSSE(): Promise<void> {
  console.log("=".repeat(60));
  console.log("SSE ENDPOINT TEST");
  console.log("=".repeat(60));
  console.log();

  const baseUrl = "http://localhost:11830";
  const storyIdea = "A photographer discovers an abandoned mansion";

  console.log(`POST ${baseUrl}/api/stream`);
  console.log(`Body: { storyIdea: "${storyIdea}", sceneCount: 2 }`);
  console.log();
  console.log("Events:");
  console.log("-".repeat(60));

  const response = await fetch(`${baseUrl}/api/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      storyIdea,
      sceneCount: 2,
      maxRetries: 1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  const events: string[] = [];

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      console.log("-".repeat(60));
      console.log("Stream closed");
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
          const data = JSON.parse(dataStr);
          events.push(eventType);
          
          // Format output
          const timestamp = new Date().toLocaleTimeString();
          let summary = "";

          switch (eventType) {
            case "connected":
              summary = `Generation started`;
              break;
            case "story_start":
              summary = `Story: "${data.story_idea.slice(0, 40)}..."`;
              break;
            case "story_complete":
              summary = `${data.breakdown.scenes.length} scenes generated`;
              break;
            case "scene_start":
              summary = `Scene ${data.scene_id}/${data.total_scenes}`;
              break;
            case "scene_generate":
              summary = `Generating (take ${data.take})`;
              break;
            case "scene_complete":
              summary = `Scene ${data.scene_id}: ${data.status}`;
              break;
            case "scene_retry":
              summary = `Scene ${data.scene_id} retry (take ${data.take}): ${data.reason}`;
              break;
            case "generation_complete":
              const passed = data.scenes.filter((s: any) => s.status === "pass").length;
              summary = `Complete: ${passed}/${data.scenes.length} passed`;
              break;
            case "complete":
              summary = `Final: ${data.result.status}`;
              break;
            case "error":
              summary = `ERROR: ${data.message}`;
              break;
          }

          console.log(`[${timestamp}] ${eventType.padEnd(20)} ${summary}`);
        } catch (e) {
          console.log(`[parse error] ${dataStr.slice(0, 50)}`);
        }
      }
    }
  }

  console.log();
  console.log("=".repeat(60));
  console.log(`Total events: ${events.length}`);
  console.log(`Event sequence: ${events.join(" → ")}`);
  console.log("=".repeat(60));
}

testSSE().catch(console.error);
