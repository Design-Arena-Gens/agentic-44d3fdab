import { NextRequest, NextResponse } from "next/server";
import { loadConfig, saveConfig } from "@/lib/storage";
import { configSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET() {
  const config = await loadConfig();
  return NextResponse.json(config);
}

export async function PUT(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = configSchema.parse(json);
    await saveConfig({
      openAiApiKey: parsed.openAiApiKey?.trim() || undefined,
      youtubeClientId: parsed.youtubeClientId?.trim() || undefined,
      youtubeClientSecret: parsed.youtubeClientSecret?.trim() || undefined,
      youtubeRefreshToken: parsed.youtubeRefreshToken?.trim() || undefined,
      openAiModel: parsed.openAiModel,
      defaultPrivacy: parsed.defaultPrivacy,
      defaultCategoryId: parsed.defaultCategoryId,
      defaultTags: parsed.defaultTags
    });

    const config = await loadConfig();
    return NextResponse.json(config);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update config" },
      { status: 400 }
    );
  }
}
