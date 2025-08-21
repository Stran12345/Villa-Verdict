// src/app/api/database/route.ts

import { NextResponse } from "next/server";

// Simple in-memory storage for demo purposes
// In a real application, you'd want to use a proper database
const sentimentStorage: any[] = [];

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
