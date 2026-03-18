/**
 * ComfyUI client
 * 
 * Handles workflow injection, prompt submission, polling, and image retrieval.
 */

import { getConfig } from "./config";

export interface ComfyUIPromptResponse {
  prompt_id: string;
  number: number;
  node_errors: Array<{
    node_id: string;
    message: string;
  }>;
}

export interface ComfyUIHistoryResponse {
  prompt_id: string;
  status: {
    status_str: "success" | "error" | "running";
    completed: boolean;
    messages: string[];
  };
  outputs: Record<
    string,
    {
      images?: Array<{
        filename: string;
        subfolder: string;
        type: "output" | "temp";
      }>;
    }
  >;
}

export interface ComfyUIImage {
  filename: string;
  subfolder: string;
  type: "output" | "temp";
  url: string;
  buffer: Buffer;
}

/**
 * Load workflow JSON from file
 */
export async function loadWorkflow(workflowFile?: string): Promise<Record<string, any>> {
  const config = getConfig();
  const fs = await import("fs");
  const path = await import("path");
  
  const workflowPath = workflowFile ?? config.workflowFile;
  const absolutePath = path.isAbsolute(workflowPath)
    ? workflowPath
    : path.join(process.cwd(), workflowPath);
  
  const content = fs.readFileSync(absolutePath, "utf-8");
  return JSON.parse(content);
}

/**
 * Inject a prompt into the workflow at the specified node
 */
export function injectPrompt(
  workflow: Record<string, any>,
  nodeId: string,
  prompt: string
): Record<string, any> {
  const cloned = JSON.parse(JSON.stringify(workflow));
  
  if (!cloned[nodeId]) {
    throw new Error(`Workflow node "${nodeId}" not found`);
  }
  
  // Set the text input for CLIPTextEncode node
  cloned[nodeId].inputs.text = prompt;
  
  return cloned;
}

/**
 * Submit a prompt to ComfyUI and return the prompt_id
 */
export async function comfyuiSubmit(
  workflow: Record<string, any>
): Promise<string> {
  const config = getConfig();
  
  const response = await fetch(`${config.comfyUrl}/prompt`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: workflow,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ComfyUI error (${response.status}): ${errorText}`);
  }

  const data: ComfyUIPromptResponse = await response.json();
  
  if (data.node_errors && data.node_errors.length > 0) {
    throw new Error(
      `ComfyUI node errors: ${JSON.stringify(data.node_errors)}`
    );
  }
  
  return data.prompt_id;
}

/**
 * Poll ComfyUI for generation status
 */
export async function comfyuiPoll(
  promptId: string
): Promise<ComfyUIHistoryResponse> {
  const config = getConfig();
  
  const response = await fetch(`${config.comfyUrl}/history/${promptId}`);
  
  if (!response.ok) {
    throw new Error(`ComfyUI history error (${response.status})`);
  }
  
  const data: Record<string, ComfyUIHistoryResponse> = await response.json();
  
  // Response is { prompt_id: { prompt, outputs, status, meta } }
  if (data[promptId]) {
    return data[promptId];
  }
  
  // If empty object or prompt not found yet, throw to continue polling
  if (Object.keys(data).length === 0 || !data[promptId]) {
    throw new Error(`No history found for prompt_id: ${promptId}`);
  }
  
  throw new Error(`Unexpected history response format`);
}

/**
 * Wait for generation to complete, polling every 500ms
 */
export async function comfyuiWaitForCompletion(
  promptId: string,
  timeoutMs: number = 60000
): Promise<ComfyUIHistoryResponse> {
  const startTime = Date.now();
  
  // Initial delay to allow ComfyUI to register the prompt in history
  await sleep(200);
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const history = await comfyuiPoll(promptId);
      
      if (history.status?.completed) {
        if (history.status.status_str !== "success") {
          throw new Error(`ComfyUI generation failed: ${JSON.stringify(history.status.messages)}`);
        }
        return history;
      }
    } catch (error) {
      // History might not be available yet, continue polling
      if (!(error instanceof Error && error.message.includes("No history found"))) {
        throw error;
      }
    }
    
    await sleep(500);
  }
  
  throw new Error(`ComfyUI generation timed out after ${timeoutMs}ms`);
}

/**
 * Download an image from ComfyUI
 */
export async function comfyuiDownloadImage(
  filename: string,
  subfolder: string = "",
  type: "output" | "temp" = "output"
): Promise<Buffer> {
  const config = getConfig();
  
  const params = new URLSearchParams({
    filename,
    subfolder,
    type,
  });
  
  const response = await fetch(`${config.comfyUrl}/view?${params}`);
  
  if (!response.ok) {
    throw new Error(`ComfyUI download error (${response.status})`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Generate an image with ComfyUI
 * High-level function that handles the full workflow:
 * 1. Load workflow
 * 2. Inject prompt
 * 3. Submit to ComfyUI
 * 4. Wait for completion
 * 5. Download result
 */
export async function comfyuiGenerate(
  prompt: string,
  options?: {
    workflowFile?: string;
    promptNodeId?: string;
    outputFilename?: string;
  }
): Promise<ComfyUIImage> {
  const config = getConfig();
  
  // Load and inject
  const workflow = await loadWorkflow(options?.workflowFile);
  const nodeId = options?.promptNodeId ?? config.promptNodeId;
  const injectedWorkflow = injectPrompt(workflow, nodeId, prompt);
  
  // Submit
  const promptId = await comfyuiSubmit(injectedWorkflow);
  
  // Wait for completion
  const history = await comfyuiWaitForCompletion(promptId);
  
  // Get image info from outputs
  let imageInfo: { filename: string; subfolder: string; type: "output" | "temp" } | null = null;
  
  for (const nodeId of Object.keys(history.outputs)) {
    const output = history.outputs[nodeId];
    if (output.images && output.images.length > 0) {
      imageInfo = output.images[0];
      break;
    }
  }
  
  if (!imageInfo) {
    throw new Error("No image found in ComfyUI output");
  }
  
  // Download
  const buffer = await comfyuiDownloadImage(
    imageInfo.filename,
    imageInfo.subfolder,
    imageInfo.type
  );
  
  return {
    filename: imageInfo.filename,
    subfolder: imageInfo.subfolder,
    type: imageInfo.type,
    url: `${config.comfyUrl}/view?filename=${imageInfo.filename}&subfolder=${imageInfo.subfolder}&type=${imageInfo.type}`,
    buffer,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get queue status from ComfyUI
 */
export async function comfyuiQueueStatus(): Promise<{
  running: string[];
  pending: string[][];
}> {
  const config = getConfig();
  
  const response = await fetch(`${config.comfyUrl}/queue`);
  
  if (!response.ok) {
    throw new Error(`ComfyUI queue error (${response.status})`);
  }
  
  const data = await response.json();
  
  // Handle different response formats
  return {
    running: data?.queue_running?.map((q: any) => q[1]?.prompt_id ?? q[0]) ?? [],
    pending: data?.queue_pending ?? [],
  };
}
