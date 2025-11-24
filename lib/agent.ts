import { AutomationTask, AgentConfig, AgentRunResult } from "./types";
import OpenAI from "openai";
import { Readable } from "stream";
import type { ReadableStream as NodeReadableStream } from "stream/web";
import { YouTubeClient } from "./youtube";

type GeneratedMetadata = {
  title: string;
  description: string;
  tags: string[];
};

async function generateMetadata(
  task: AutomationTask,
  config: AgentConfig
): Promise<GeneratedMetadata> {
  if (!config.openAiApiKey) {
    throw new Error("OpenAI API key missing in configuration.");
  }

  const client = new OpenAI({ apiKey: config.openAiApiKey });
  const response = await client.responses.create({
    model: config.openAiModel || "gpt-4o-mini",
    reasoning: { effort: "medium" },
    input: [
      {
        role: "system",
        content:
          "You are a seasoned YouTube growth strategist. Craft magnetic titles, compelling descriptions, and SEO-rich tags."
      },
      {
        role: "user",
        content: `Task prompt: ${task.prompt}
Preferred duration: ${task.preferredDuration} seconds
Language: ${task.language}

Generate a JSON object with:
- "title": short hook under 80 characters
- "description": 2 paragraphs, include CTAs and relevant keywords
- "tags": 8-12 keyword phrases`
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "metadata",
        schema: {
          type: "object",
          required: ["title", "description", "tags"],
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            tags: {
              type: "array",
              items: { type: "string" },
              minItems: 5,
              maxItems: 15
            }
          },
          additionalProperties: false
        }
      }
    }
  } as any);

  const outputText =
    (response as any).output_text ??
    response.output
      ?.flatMap((item: any) => item.content)
      ?.filter((chunk: any) => chunk.type === "output_text")
      ?.map((chunk: any) => chunk.text)
      ?.join("");

  if (!outputText) {
    throw new Error("Unexpected metadata response from OpenAI.");
  }

  const parsed = JSON.parse(outputText) as GeneratedMetadata;
  return parsed;
}

async function fetchVideoStream(url: string): Promise<Readable> {
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download video from ${url} (${res.status})`);
  }

  return Readable.fromWeb(res.body as unknown as NodeReadableStream<any>);
}

export async function runAgent(task: AutomationTask, config: AgentConfig): Promise<AgentRunResult> {
  const meta = await generateMetadata(task, config);
  const yt = new YouTubeClient(config);
  const stream = await fetchVideoStream(task.videoSourceUrl);

  const video = await yt.uploadVideo(stream, {
    title: meta.title,
    description: meta.description,
    tags: [...new Set([...(config.defaultTags || []), ...meta.tags])],
    privacyStatus: task.visibilityOverride ?? config.defaultPrivacy,
    categoryId: config.defaultCategoryId
  });

  if (!video || !video.id) {
    throw new Error("YouTube upload returned an unexpected response.");
  }

  return {
    taskId: task.id,
    title: meta.title,
    description: meta.description,
    tags: meta.tags,
    videoId: video.id as string,
    publishedAt: new Date().toISOString()
  };
}
