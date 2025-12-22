// MCP server: YouTube search & play
// Requires: `npm install @modelcontextprotocol/sdk zod node-fetch`

import { Server } from "@modelcontextprotocol/sdk/server.js";
import { z } from "zod";
import fetch from "node-fetch";

const server = new Server({
  name: "youtube-mcp",
  version: "0.0.1",
});

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

if (!YOUTUBE_API_KEY) {
  console.error("[youtube-mcp] Missing YOUTUBE_API_KEY env variable");
}

// Helper to call YouTube Data API v3
async function youtubeGet(path, params) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  Object.entries({ ...params, key: YOUTUBE_API_KEY }).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`YouTube API error ${res.status}: ${text}`);
  }
  return res.json();
}

// Tool: search_youtube
server.tool(
  "search_youtube",
  {
    description: "Search YouTube videos by query",
    inputSchema: z.object({
      query: z.string().min(1).describe("Search keyword"),
      maxResults: z
        .number()
        .int()
        .min(1)
        .max(25)
        .default(5)
        .describe("Maximum number of results (1-25)"),
    }),
  },
  async ({ query, maxResults }) => {
    if (!YOUTUBE_API_KEY) {
      throw new Error("YOUTUBE_API_KEY is not set in environment");
    }

    // First call: search to get videoIds
    const searchData = await youtubeGet("search", {
      part: "snippet",
      type: "video",
      q: query,
      maxResults,
    });

    const items = Array.isArray(searchData.items) ? searchData.items : [];
    const videoIds = items
      .map((it) => it.id && it.id.videoId)
      .filter(Boolean);

    if (videoIds.length === 0) {
      return {
        videos: [],
        raw: searchData,
      };
    }

    // Second call: get details including duration
    const detailsData = await youtubeGet("videos", {
      part: "snippet,contentDetails",
      id: videoIds.join(","),
    });

    const detailsMap = new Map();
    for (const v of detailsData.items || []) {
      detailsMap.set(v.id, v);
    }

    const videos = videoIds
      .map((id) => {
        const v = detailsMap.get(id);
        if (!v) return null;
        const snippet = v.snippet || {};
        const contentDetails = v.contentDetails || {};
        const thumbnails = snippet.thumbnails || {};

        return {
          videoId: id,
          title: snippet.title || "",
          channelTitle: snippet.channelTitle || "",
          description: snippet.description || "",
          url: `https://www.youtube.com/watch?v=${id}`,
          thumbnails: {
            default: thumbnails.default || null,
            medium: thumbnails.medium || null,
            high: thumbnails.high || null,
          },
          publishedAt: snippet.publishedAt || null,
          duration: contentDetails.duration || null,
        };
      })
      .filter(Boolean);

    return { videos };
  }
);

// Tool: play_youtube (get info by videoId)
server.tool(
  "play_youtube",
  {
    description:
      "Get YouTube video information by videoId to play/open in client.",
    inputSchema: z.object({
      videoId: z.string().min(1).describe("YouTube video ID"),
    }),
  },
  async ({ videoId }) => {
    if (!YOUTUBE_API_KEY) {
      throw new Error("YOUTUBE_API_KEY is not set in environment");
    }

    const data = await youtubeGet("videos", {
      part: "snippet,contentDetails",
      id: videoId,
    });

    const item = (data.items || [])[0];
    if (!item) {
      throw new Error(`Video not found for id: ${videoId}`);
    }

    const snippet = item.snippet || {};
    const contentDetails = item.contentDetails || {};
    const thumbnails = snippet.thumbnails || {};

    return {
      videoId,
      title: snippet.title || "",
      channelTitle: snippet.channelTitle || "",
      description: snippet.description || "",
      url: `https://www.youtube.com/watch?v=${videoId}`,
      thumbnails: {
        default: thumbnails.default || null,
        medium: thumbnails.medium || null,
        high: thumbnails.high || null,
      },
      publishedAt: snippet.publishedAt || null,
      duration: contentDetails.duration || null,
    };
  }
);

// Start MCP server (stdio)
server.listen();
