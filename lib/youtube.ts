import { google, youtube_v3 } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import fs from "fs";
import { promisify } from "util";
import stream from "stream";
import path from "path";
import os from "os";
import { AgentConfig } from "./types";

const pipeline = promisify(stream.pipeline);

export class YouTubeClient {
  private readonly oauth: OAuth2Client;
  private readonly youtube: youtube_v3.Youtube;

  constructor(config: AgentConfig) {
    if (!config.youtubeClientId || !config.youtubeClientSecret || !config.youtubeRefreshToken) {
      throw new Error("YouTube credentials missing in configuration.");
    }

    const oauth2Client = new google.auth.OAuth2(config.youtubeClientId, config.youtubeClientSecret);

    oauth2Client.setCredentials({
      refresh_token: config.youtubeRefreshToken
    });

    this.oauth = oauth2Client;
    this.youtube = google.youtube({
      version: "v3",
      auth: this.oauth
    });
  }

  async uploadVideo(
    videoStream: NodeJS.ReadableStream,
    opts: {
      title: string;
      description: string;
      tags: string[];
      privacyStatus: "public" | "unlisted" | "private";
      categoryId: string;
    }
  ) {
    const tempPath = path.join(os.tmpdir(), `agentic-upload-${Date.now()}.mp4`);
    const writeStream = fs.createWriteStream(tempPath);
    await pipeline(videoStream, writeStream);

    const { data } = await this.youtube.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: {
          title: opts.title,
          description: opts.description,
          tags: opts.tags,
          categoryId: opts.categoryId
        },
        status: {
          privacyStatus: opts.privacyStatus,
          selfDeclaredMadeForKids: false
        }
      },
      media: {
        body: fs.createReadStream(tempPath)
      }
    });

    await fs.promises.unlink(tempPath).catch(() => Promise.resolve());
    return data;
  }
}
