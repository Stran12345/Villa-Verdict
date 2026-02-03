// src/app/api/sentiment/batch/route.ts

import { NextResponse } from "next/server";
import { analyzeSentiment, analyzeSentimentLocal } from "@/lib/sentiment";

export async function POST(req: Request) {
  let body: { texts?: unknown; method?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { texts, method = "accurate" } = body;

  // Only require API key for accurate (Hugging Face) mode
  if (method === "accurate" && !process.env.HUGGING_FACE_API_KEY) {
    return NextResponse.json(
      {
        error:
          "Hugging Face API key not configured. Please add HUGGING_FACE_API_KEY to your .env.local file. Get your free API key from https://huggingface.co/settings/tokens",
      },
      { status: 500 }
    );
  }

  if (!Array.isArray(texts)) {
    return NextResponse.json(
      { error: 'Invalid input: "texts" field is required and must be an array of strings' },
      { status: 400 }
    );
  }

  const validatedTexts = texts.map((t) =>
    typeof t === "string" ? t.trim() : ""
  );

  let sentiments: string[];

  if (method === "fast") {
    // Fast mode: use local sentiment analysis (instant)
    sentiments = validatedTexts.map((text) => analyzeSentimentLocal(text || " "));
  } else {
    // Accurate mode: use Hugging Face API
    sentiments = await Promise.all(
      validatedTexts.map((text) => analyzeSentiment(text || " "))
    );
  }

  return NextResponse.json({ sentiments });
}
