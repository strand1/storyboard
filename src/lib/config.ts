/**
 * Application configuration
 * 
 * Environment variables take precedence over defaults.
 * All service URLs and model names are configurable.
 */

export interface Config {
  // llama-server (OpenAI-compatible API)
  llamaServerUrl: string;
  // ComfyUI endpoint
  comfyUrl: string;
  // Model name for both text and vision (Qwen3-VL-8B-Instruct is vision-capable)
  model: string;
  // Number of scenes to generate
  sceneCount: number;
  // Maximum retry attempts per scene
  maxRetries: number;
  // Step ladder for adaptive quality on retry [draft, medium, high]
  stepLadder: number[];
  // Style prefix prepended to all ComfyUI prompts
  stylePrefix: string;
  // ComfyUI workflow file path (relative to project root)
  workflowFile: string;
  // Node ID in workflow that holds the positive prompt
  promptNodeId: string;
  // Output directory for generated images (relative to public/)
  outputDir: string;
}

const defaults: Config = {
  llamaServerUrl: "http://localhost:11434/v1",
  comfyUrl: "http://localhost:11820",
  model: "Qwen3-VL-8B-Instruct",
  sceneCount: 6,
  maxRetries: 2,
  stepLadder: [4, 6, 8],
  stylePrefix: "cinematic still, 4k, detailed, sharp focus,",
  workflowFile: "workflows/workflow_zimage_turbo.json",
  promptNodeId: "70",
  outputDir: "output",
};

function getEnvVar(key: string): string | undefined {
  if (typeof process === "undefined") {
    return undefined;
  }
  return process.env[key];
}

function getEnvVarAsInt(key: string, defaultValue: number): number {
  const value = getEnvVar(key);
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

export function getConfig(): Config {
  return {
    llamaServerUrl: getEnvVar("LLAMA_SERVER_URL") ?? defaults.llamaServerUrl,
    comfyUrl: getEnvVar("COMFY_URL") ?? defaults.comfyUrl,
    model: getEnvVar("MODEL") ?? defaults.model,
    sceneCount: getEnvVarAsInt("SCENE_COUNT", defaults.sceneCount),
    maxRetries: getEnvVarAsInt("MAX_RETRIES", defaults.maxRetries),
    stepLadder: defaults.stepLadder, // Could be made configurable via env if needed
    stylePrefix: getEnvVar("STYLE_PREFIX") ?? defaults.stylePrefix,
    workflowFile: getEnvVar("WORKFLOW_FILE") ?? defaults.workflowFile,
    promptNodeId: getEnvVar("PROMPT_NODE_ID") ?? defaults.promptNodeId,
    outputDir: getEnvVar("OUTPUT_DIR") ?? defaults.outputDir,
  };
}

// Export individual config values for convenience
const config = getConfig();
export const llamaServerUrl = config.llamaServerUrl;
export const comfyUrl = config.comfyUrl;
export const model = config.model;
export const sceneCount = config.sceneCount;
export const maxRetries = config.maxRetries;
export const stepLadder = config.stepLadder;
export const stylePrefix = config.stylePrefix;
export const workflowFile = config.workflowFile;
export const promptNodeId = config.promptNodeId;
export const outputDir = config.outputDir;
