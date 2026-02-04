/**
 * Bedrock utility for AI content generation
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';

const client = new BedrockRuntimeClient({});

interface BedrockMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface BedrockResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
  stop_reason: string;
}

export async function invokeClaudeModel(
  systemPrompt: string,
  messages: BedrockMessage[],
  maxTokens: number = 8192,
): Promise<string> {
  // Use Claude Opus 4 - the most capable model for deep technical content
  const modelId =
    process.env.BEDROCK_MODEL_ID || 'anthropic.claude-opus-4-20250514-v1:0';

  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })),
  };

  const response = await client.send(
    new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload),
    }),
  );

  const responseBody = JSON.parse(
    new TextDecoder().decode(response.body),
  ) as BedrockResponse;

  if (!responseBody.content || responseBody.content.length === 0) {
    throw new Error('No content in Bedrock response');
  }

  return responseBody.content[0].text;
}

export async function generateWithRetry(
  systemPrompt: string,
  userPrompt: string,
  maxRetries: number = 3,
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await invokeClaudeModel(systemPrompt, [
        { role: 'user', content: userPrompt },
      ]);
    } catch (error) {
      lastError = error as Error;
      console.error(`Bedrock attempt ${attempt + 1} failed:`, error);

      // Wait before retry with exponential backoff
      if (attempt < maxRetries - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 1000),
        );
      }
    }
  }

  throw lastError || new Error('Failed to generate content after retries');
}

function sanitizeJsonString(str: string): string {
  // Remove control characters that break JSON parsing
  // Replace actual newlines within string values with \n escape sequence
  // This handles cases where the LLM outputs literal newlines in JSON strings
  return str.replace(/[\x00-\x1F\x7F]/g, (char) => {
    // Keep actual newlines and tabs as escape sequences
    if (char === '\n') return '\\n';
    if (char === '\r') return '\\r';
    if (char === '\t') return '\\t';
    // Remove other control characters
    return '';
  });
}

export function parseJsonFromResponse<T>(response: string): T {
  // Try to extract JSON from the response
  const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/);

  let jsonStr = jsonMatch ? jsonMatch[1] : response;

  // First try to parse as-is
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    // Try to find JSON object in the response
    const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      jsonStr = objectMatch[0];
    }

    // Sanitize and try again
    try {
      const sanitized = sanitizeJsonString(jsonStr);
      return JSON.parse(sanitized) as T;
    } catch (e) {
      // Last resort: try to fix common JSON issues
      const fixed = jsonStr
        .replace(/,\s*}/g, '}') // Remove trailing commas
        .replace(/,\s*]/g, ']') // Remove trailing commas in arrays
        .replace(/'/g, '"') // Replace single quotes with double quotes
        .replace(/(\w+):/g, '"$1":'); // Quote unquoted keys

      try {
        return JSON.parse(sanitizeJsonString(fixed)) as T;
      } catch {
        console.error('Failed to parse JSON. Original response:', response);
        throw new Error('Could not parse JSON from response');
      }
    }
  }
}
