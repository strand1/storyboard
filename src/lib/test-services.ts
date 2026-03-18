/**
 * Test script for llama-server and ComfyUI connectivity
 * 
 * Run with: npx tsx src/lib/test-services.ts
 */

import { llamaChat, llamaVision, imageToBase64, llamaJson } from "./llama";
import { comfyuiGenerate, comfyuiQueueStatus, loadWorkflow } from "./comfyui";
import { getConfig } from "./config";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
  output?: string;
}

async function runTests(): Promise<void> {
  const results: TestResult[] = [];
  const config = getConfig();

  console.log("=".repeat(60));
  console.log("SERVICE CONNECTIVITY TESTS");
  console.log("=".repeat(60));
  console.log(`llama-server: ${config.llamaServerUrl}`);
  console.log(`ComfyUI: ${config.comfyUrl}`);
  console.log(`Model: ${config.model}`);
  console.log("=".repeat(60));
  console.log();

  // Test 1: llama-server basic connectivity
  results.push(
    await runTest("llama-server: Basic chat", async () => {
      const response = await llamaChat([
        {
          role: "user",
          content: "Say hello in exactly 3 words.",
        },
      ]);
      return response.text.trim();
    })
  );

  // Test 2: llama-server vision (describe uploaded image)
  results.push(
    await runTest("llama-server: Vision (describe image)", async () => {
      const base64 = await imageToBase64("z-image_test.png");
      const response = await llamaVision(
        base64,
        "Describe this image in 2-3 sentences. Focus on the person's appearance and the background."
      );
      return response.text.trim();
    })
  );

  // Test 3: llama-server JSON output (story generation)
  results.push(
    await runTest("llama-server: JSON (story generation)", async () => {
      const response = await llamaJson<{ story: string; character: string }>([
        {
          role: "system",
          content:
            "You are a story generator. Output valid JSON only. No markdown, no explanation.",
        },
        {
          role: "user",
          content:
            "Based on this image description, create a 2-sentence story about the person. Return JSON with 'story' and 'character' fields.",
        },
      ]);
      return JSON.stringify(response, null, 2);
    })
  );

  // Test 4: ComfyUI queue status
  results.push(
    await runTest("ComfyUI: Queue status", async () => {
      const queue = await comfyuiQueueStatus();
      return `Running: ${queue.running.length}, Pending: ${queue.pending.length}`;
    })
  );

  // Test 5: ComfyUI workflow load
  results.push(
    await runTest("ComfyUI: Load workflow", async () => {
      const workflow = await loadWorkflow("workflows/workflow_zimage_turbo.json");
      const nodeCount = Object.keys(workflow).length;
      return `Workflow loaded with ${nodeCount} nodes`;
    })
  );

  // Test 6: ComfyUI full generation
  results.push(
    await runTest("ComfyUI: Generate image", async () => {
      const prompt =
        "photo of a person standing in an urban environment, natural lighting, realistic";
      const image = await comfyuiGenerate(prompt, {
        workflowFile: "z-image_generate.json",
      });
      return `Generated: ${image.filename} (${image.buffer.length} bytes)`;
    })
  );

  // Print results
  console.log();
  console.log("=".repeat(60));
  console.log("TEST RESULTS");
  console.log("=".repeat(60));

  let passed = 0;
  let failed = 0;

  for (const result of results) {
    const status = result.passed ? "✓ PASS" : "✗ FAIL";
    console.log(`${status} ${result.name} (${result.duration}ms)`);

    if (result.passed) {
      passed++;
      if (result.output) {
        console.log(`    Output: ${truncate(result.output, 100)}`);
      }
    } else {
      failed++;
      console.log(`    Error: ${result.error}`);
    }
    console.log();
  }

  console.log("=".repeat(60));
  console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log("=".repeat(60));

  if (failed > 0) {
    process.exit(1);
  }
}

async function runTest(
  name: string,
  fn: () => Promise<string>
): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const output = await fn();
    const duration = Date.now() - startTime;
    return { name, passed: true, duration, output };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      name,
      passed: false,
      duration,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}

// Run tests
runTests().catch(console.error);
