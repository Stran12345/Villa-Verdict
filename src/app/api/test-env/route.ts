// src/app/api/test-env/route.ts

import { NextResponse } from "next/server";

export async function GET() {
  const huggingFaceKey = process.env.HUGGING_FACE_API_KEY;
  const redditClientId = process.env.REDDIT_CLIENT_ID;
  const redditClientSecret = process.env.REDDIT_CLIENT_SECRET;

  return NextResponse.json({
    environment: process.env.NODE_ENV,
    huggingFaceKey: huggingFaceKey ? "✅ Set" : "❌ Missing",
    redditClientId: redditClientId ? "✅ Set" : "❌ Missing",
    redditClientSecret: redditClientSecret ? "✅ Set" : "❌ Missing",
    message: "Check if all required environment variables are configured",
  });
}
