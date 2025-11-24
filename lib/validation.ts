import { z } from "zod";

export const configSchema = z.object({
  openAiApiKey: z.string().optional().or(z.literal("")),
  openAiModel: z.string().min(3),
  youtubeClientId: z.string().optional().or(z.literal("")),
  youtubeClientSecret: z.string().optional().or(z.literal("")),
  youtubeRefreshToken: z.string().optional().or(z.literal("")),
  defaultPrivacy: z.enum(["public", "unlisted", "private"]),
  defaultCategoryId: z.string().min(1),
  defaultTags: z.array(z.string().min(1)).default([])
});

export const taskSchema = z.object({
  name: z.string().min(3),
  prompt: z.string().min(10),
  cadence: z.enum(["once", "daily", "weekly"]),
  nextRunAt: z.string().datetime(),
  videoSourceUrl: z.string().url(),
  preferredDuration: z.number().min(10).max(7200),
  language: z.string().min(2).max(10),
  autoPublish: z.boolean().default(true),
  visibilityOverride: z.enum(["public", "unlisted", "private"]).optional()
});
