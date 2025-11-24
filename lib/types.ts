export type AgentConfig = {
  openAiApiKey?: string;
  openAiModel: string;
  youtubeClientId?: string;
  youtubeClientSecret?: string;
  youtubeRefreshToken?: string;
  defaultPrivacy: "public" | "unlisted" | "private";
  defaultCategoryId: string;
  defaultTags: string[];
};

export type AutomationTask = {
  id: string;
  name: string;
  status: "idle" | "running" | "scheduled" | "error" | "completed";
  prompt: string;
  cadence: "once" | "daily" | "weekly";
  nextRunAt: string;
  lastRunAt?: string;
  videoSourceUrl: string;
  preferredDuration: number;
  language: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  autoPublish: boolean;
  visibilityOverride?: "public" | "unlisted" | "private";
};

export type AgentRunResult = {
  taskId: string;
  title: string;
  description: string;
  tags: string[];
  videoId: string;
  publishedAt: string;
};
