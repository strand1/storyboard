/**
 * llama-server client (OpenAI-compatible API)
 * 
 * Supports both text generation and vision (multimodal) queries.
 */

import { getConfig } from "./config";

export interface LlamaMessage {
  role: "system" | "user" | "assistant";
  content: string | LlamaContentPart[];
}

export interface LlamaContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: {
    url: string; // data:image/jpeg;base64,... or http://...
  };
}

export interface LlamaResponse {
  text: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Generate text using llama-server (OpenAI-compatible chat completions API)
 */
export async function llamaChat(
  messages: LlamaMessage[],
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }
): Promise<LlamaResponse> {
  const config = getConfig();
  
  const response = await fetch(`${config.llamaServerUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options?.model ?? config.model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 2048,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`llama-server error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  
  return {
    text: data.choices[0]?.message?.content ?? "",
    usage: data.usage,
  };
}

/**
 * Generate text with vision (multimodal) input
 * Sends an image along with text prompt to a vision-capable model
 */
export async function llamaVision(
  imageBase64: string,
  prompt: string,
  options?: {
    model?: string;
    maxTokens?: number;
  }
): Promise<LlamaResponse> {
  const messages: LlamaMessage[] = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: prompt,
        },
        {
          type: "image_url",
          image_url: {
            url: `data:image/png;base64,${imageBase64}`,
          },
        },
      ],
    },
  ];

  return llamaChat(messages, options);
}

/**
 * Convert image file to base64 string (for server-side use)
 */
export async function imageToBase64(imagePath: string): Promise<string> {
  // In Next.js server environment, we can use Node.js fs
  const fs = await import("fs");
  const path = await import("path");
  
  const absolutePath = path.isAbsolute(imagePath)
    ? imagePath
    : path.join(process.cwd(), imagePath);
  
  const imageBuffer = fs.readFileSync(absolutePath);
  return imageBuffer.toString("base64");
}

/**
 * Parse JSON from llama response, with retry logic for malformed output
 */
export async function llamaJson<T>(
  messages: LlamaMessage[],
  options?: {
    model?: string;
    maxTokens?: number;
    maxRetries?: number;
  }
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 2;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await llamaChat(messages, {
      model: options?.model,
      maxTokens: options?.maxTokens,
      temperature: 0.3, // Moderate temperature for balanced output
    });

    // Try to extract JSON from response
    const jsonText = extractJsonFromResponse(response.text);
    
    try {
      const parsed = JSON.parse(jsonText);
      return parsed as T;
    } catch (e) {
      console.error(`JSON parse attempt ${attempt + 1} failed:`, (e as Error).message);
      console.error(`JSON text (first 200 chars):`, jsonText.slice(0, 200));
      
      if (attempt === maxRetries) {
        throw new Error(
          `Failed to parse JSON after ${maxRetries + 1} attempts. Response: ${response.text.slice(0, 500)}`
        );
      }
    }
  }
  
  throw new Error("Unexpected error in llamaJson");
}

/**
 * Extract JSON from a response that may contain markdown or extra text
 */
function extractJsonFromResponse(text: string): string {
  // Remove markdown code fences if present
  let cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "");
  cleaned = cleaned.trim();
  
  // Check if response starts with array - if so, try to extract the full array
  if (cleaned.startsWith('[')) {
    // First try anchored match (complete array)
    const anchoredArray = cleaned.match(/^(\[[\s\S]*\])$/);
    if (anchoredArray) {
      return anchoredArray[1];
    }
    
    // Try greedy array match (may be truncated)
    const greedyArray = cleaned.match(/\[[\s\S]*\]/);
    if (greedyArray) {
      return greedyArray[0];
    }
  }
  
  // Try to find JSON object (for single-object responses like vision checks)
  // Use greedy match to get the complete object
  const objectMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    return objectMatch[0];
  }
  
  // Fallback: return cleaned text
  return cleaned;
}
