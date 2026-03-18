/**
 * Test script for the orchestration pipeline
 * 
 * Run with: npx tsx src/lib/test-orchestrator.ts
 */

import { generateStoryBreakdown } from "./story-agent";
import { visionCheckFile } from "./vision-agent";
import { processSingleScene } from "./orchestrator";
import { generateStoryboard } from "./orchestrator";

async function runTests(): Promise<void> {
  console.log("=".repeat(60));
  console.log("ORCHESTRATION PIPELINE TESTS");
  console.log("=".repeat(60));
  console.log();

  let passed = 0;
  let failed = 0;

  // Test 1: Story agent
  console.log("Test 1: Story Agent - Generate breakdown");
  try {
    const startTime = Date.now();
    const storyIdea = "A photographer discovers an abandoned mansion in the woods";
    const breakdown = await generateStoryBreakdown(storyIdea, { sceneCount: 4 });
    const duration = Date.now() - startTime;

    if (breakdown.scenes.length !== 4) {
      throw new Error(`Expected 4 scenes, got ${breakdown.scenes.length}`);
    }

    // Validate structure
    for (const scene of breakdown.scenes) {
      if (!scene.scene_id || !scene.description || !scene.subject || 
          !scene.action || !scene.mood || !scene.shot_type || !scene.comfy_prompt) {
        throw new Error("Missing required scene field");
      }
    }

    console.log(`  ✓ PASS (${duration}ms)`);
    console.log(`    Generated ${breakdown.scenes.length} scenes`);
    passed++;
  } catch (error) {
    console.log(`  ✗ FAIL`);
    console.log(`    Error: ${(error as Error).message}`);
    failed++;
  }
  console.log();

  // Test 2: Vision agent
  console.log("Test 2: Vision Agent - Check image");
  try {
    const startTime = Date.now();
    const testScene = {
      scene_id: 1,
      description: "A woman with blonde hair in an urban setting",
      subject: "woman with blonde hair",
      action: "looking at camera",
      mood: "serious",
      shot_type: "medium" as const,
      comfy_prompt: "photo of a woman",
    };

    const result = await visionCheckFile(testScene, "z-image_test.png");
    const duration = Date.now() - startTime;

    console.log(`  ✓ PASS (${duration}ms)`);
    console.log(`    subject:${result.subject_ok} mood:${result.mood_ok} shot:${result.shot_ok} all:${result.all_pass}`);
    passed++;
  } catch (error) {
    console.log(`  ✗ FAIL`);
    console.log(`    Error: ${(error as Error).message}`);
    failed++;
  }
  console.log();

  // Test 3: Single scene generation
  console.log("Test 3: Full Pipeline - Single scene");
  try {
    const startTime = Date.now();
    const events: string[] = [];
    
    const scene = {
      scene_id: 1,
      description: "A serene landscape with mountains and lake at sunset",
      subject: "mountains and lake",
      action: "reflecting sunset colors",
      mood: "serene",
      shot_type: "wide" as const,
      comfy_prompt: "serene landscape with mountains and lake at sunset, golden hour",
    };

    const result = await processSingleScene(scene, {
      maxRetries: 1,
      onEvent: (e) => events.push(e.type),
    });
    const duration = Date.now() - startTime;

    if (!result.image_path) {
      throw new Error("No image generated");
    }

    console.log(`  ✓ PASS (${duration}ms)`);
    console.log(`    Status:${result.status} Take:${result.take} Events:${events.length}`);
    passed++;
  } catch (error) {
    console.log(`  ✗ FAIL`);
    console.log(`    Error: ${(error as Error).message}`);
    failed++;
  }
  console.log();

  // Test 4: Complete storyboard (2 scenes, 1 retry max)
  console.log("Test 4: Full Pipeline - Complete storyboard (2 scenes)");
  try {
    const startTime = Date.now();
    const events: string[] = [];
    
    const result = await generateStoryboard("A hiker reaches a mountain summit at sunrise", {
      sceneCount: 2,
      maxRetries: 1,
      onEvent: (e) => {
        if (e.type !== "scene_generate") events.push(e.type);
      },
    });
    const duration = Date.now() - startTime;

    if (result.status === "failed") {
      throw new Error("Storyboard generation failed");
    }

    const passedCount = result.scenes.filter(s => s.status === "pass").length;
    console.log(`  ✓ PASS (${duration}ms)`);
    console.log(`    Status:${result.status} Scenes:${result.scenes.length} Passed:${passedCount}/${result.scenes.length}`);
    passed++;
  } catch (error) {
    console.log(`  ✗ FAIL`);
    console.log(`    Error: ${(error as Error).message}`);
    failed++;
  }
  console.log();

  // Summary
  console.log("=".repeat(60));
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log("=".repeat(60));

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);
