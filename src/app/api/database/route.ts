// src/app/api/database/route.ts

import { NextResponse } from "next/server";

// Simple in-memory storage for demo purposes
// In a real application, you'd want to use a proper database
const sentimentStorage: any[] = [];

// Cache for Reddit posts with expiration
const redditPostCache: {
  [key: string]: {
    posts: any[];
    timestamp: number;
    expiresAt: number;
  };
} = {};

// Cache expiration time: 1 hour (3600000 ms)
const CACHE_EXPIRY_TIME = 60 * 60 * 1000;

// Helper function to generate cache key
function generateCacheKey(contestant: string, timeRange: string): string {
  return `${contestant.toLowerCase()}_${timeRange.toLowerCase()}`;
}

// Helper function to check if cache is valid
function isCacheValid(cacheKey: string): boolean {
  const cached = redditPostCache[cacheKey];
  if (!cached) return false;

  const now = Date.now();
  return now < cached.expiresAt;
}

// This endpoint will handle saving processed sentiment data to in-memory storage.
export async function POST(req: Request) {
  try {
    const { contestant, season, posts } = await req.json();

    // Validate the incoming data
    if (!contestant || !season || !posts || !Array.isArray(posts)) {
      return NextResponse.json(
        {
          error:
            "Invalid input: contestant, season, and an array of posts are required.",
        },
        { status: 400 }
      );
    }

    // Create a new record with the processed data
    const newSentimentRecord = {
      contestant,
      season,
      date: new Date().toISOString(),
      posts,
    };

    // Store in memory (this will be lost on server restart)
    sentimentStorage.push(newSentimentRecord);

    // Log the data for debugging purposes
    console.log(`Saved sentiment data for ${contestant}:`, {
      totalPosts: posts.length,
      positiveCount: posts.filter((p: any) => p.sentiment === "Positive")
        .length,
      negativeCount: posts.filter((p: any) => p.sentiment === "Negative")
        .length,
      neutralCount: posts.filter((p: any) => p.sentiment === "Neutral").length,
      subreddits: [...new Set(posts.map((p: any) => p.subreddit))],
    });

    return NextResponse.json({
      message: "Data saved successfully!",
      storedRecords: sentimentStorage.length,
    });
  } catch (error: any) {
    console.error("Storage Error:", error);
    return NextResponse.json(
      { error: error.message || "Storage operation failed" },
      { status: 500 }
    );
  }
}

// Optional: Add a GET endpoint to retrieve stored data
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const contestant = searchParams.get("contestant");
    const timeRange = searchParams.get("timeRange");
    const type = searchParams.get("type"); // "sentiment" or "reddit"

    // Handle Reddit post cache requests
    if (type === "reddit" && contestant && timeRange) {
      const cacheKey = generateCacheKey(contestant, timeRange);

      if (isCacheValid(cacheKey)) {
        const cached = redditPostCache[cacheKey];
        console.log(
          `📦 Serving cached Reddit posts for ${contestant} (${timeRange}) - ${cached.posts.length} posts`
        );
        return NextResponse.json({
          posts: cached.posts,
          totalFound: cached.posts.length,
          subredditsSearched: ["LoveIslandUSA"],
          cached: true,
          cacheAge: Date.now() - cached.timestamp,
        });
      } else {
        console.log(
          `❌ Cache expired or not found for ${contestant} (${timeRange})`
        );
        return NextResponse.json({ cached: false });
      }
    }

    // Handle sentiment data requests
    if (contestant) {
      const filteredData = sentimentStorage.filter(
        (record) => record.contestant === contestant
      );
      return NextResponse.json({ data: filteredData });
    }

    return NextResponse.json({ data: sentimentStorage });
  } catch (error: any) {
    console.error("Retrieval Error:", error);
    return NextResponse.json(
      { error: error.message || "Data retrieval failed" },
      { status: 500 }
    );
  }
}

// New endpoint to cache Reddit posts
export async function PUT(req: Request) {
  try {
    const { contestant, timeRange, posts } = await req.json();

    if (!contestant || !timeRange || !posts || !Array.isArray(posts)) {
      return NextResponse.json(
        {
          error:
            "Invalid input: contestant, timeRange, and posts array required",
        },
        { status: 400 }
      );
    }

    const cacheKey = generateCacheKey(contestant, timeRange);
    const now = Date.now();

    redditPostCache[cacheKey] = {
      posts,
      timestamp: now,
      expiresAt: now + CACHE_EXPIRY_TIME,
    };

    console.log(
      `💾 Cached ${posts.length} Reddit posts for ${contestant} (${timeRange}) - expires in 1 hour`
    );

    return NextResponse.json({
      message: "Reddit posts cached successfully",
      cachedPosts: posts.length,
      expiresAt: new Date(now + CACHE_EXPIRY_TIME).toISOString(),
    });
  } catch (error: any) {
    console.error("Cache Storage Error:", error);
    return NextResponse.json(
      { error: error.message || "Cache storage failed" },
      { status: 500 }
    );
  }
}
