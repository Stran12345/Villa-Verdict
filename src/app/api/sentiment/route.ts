// src/app/api/sentiment/route.ts

import { NextResponse } from "next/server";

// Simple sentiment analysis using keyword matching as fallback
function analyzeSentimentFallback(text: string): string {
  const lowerText = text.toLowerCase();

  // Positive keywords
  const positiveWords = [
    "love",
    "amazing",
    "beautiful",
    "great",
    "awesome",
    "fantastic",
    "wonderful",
    "excellent",
    "perfect",
    "best",
    "good",
    "nice",
    "happy",
    "joy",
    "excited",
    "thrilled",
    "delighted",
    "pleased",
    "satisfied",
    "impressed",
    "stunning",
    "gorgeous",
    "handsome",
    "attractive",
    "charming",
    "sweet",
    "kind",
    "caring",
    "genuine",
    "authentic",
    "real",
    "honest",
    "loyal",
    "faithful",
    "romantic",
    "chemistry",
    "connection",
    "spark",
    "vibe",
    "energy",
    "positive",
    "optimistic",
    "confident",
    "strong",
    "independent",
    "mature",
    "respectful",
    "funny",
    "humorous",
    "entertaining",
    "engaging",
    "interesting",
    "captivating",
  ];

  // Negative keywords
  const negativeWords = [
    "hate",
    "terrible",
    "awful",
    "horrible",
    "worst",
    "bad",
    "ugly",
    "disgusting",
    "annoying",
    "irritating",
    "frustrating",
    "disappointing",
    "boring",
    "dull",
    "fake",
    "phony",
    "manipulative",
    "toxic",
    "red flag",
    "warning",
    "concern",
    "worried",
    "suspicious",
    "doubtful",
    "skeptical",
    "cynical",
    "negative",
    "pessimistic",
    "insecure",
    "jealous",
    "possessive",
    "controlling",
    "immature",
    "childish",
    "rude",
    "disrespectful",
    "mean",
    "cruel",
    "heartless",
    "cold",
    "distant",
    "aloof",
    "uninterested",
    "bored",
    "annoyed",
    "angry",
    "mad",
    "furious",
    "rage",
    "hate",
    "despise",
    "loathe",
    "disgust",
    "repulsed",
  ];

  // Count occurrences
  let positiveCount = 0;
  let negativeCount = 0;

  positiveWords.forEach((word) => {
    const regex = new RegExp(`\\b${word}\\b`, "g");
    const matches = lowerText.match(regex);
    if (matches) {
      positiveCount += matches.length;
    }
  });

  negativeWords.forEach((word) => {
    const regex = new RegExp(`\\b${word}\\b`, "g");
    const matches = lowerText.match(regex);
    if (matches) {
      negativeCount += matches.length;
    }
  });

  // Determine sentiment based on counts
  if (positiveCount > negativeCount) {
    return "Positive";
  } else if (negativeCount > positiveCount) {
    return "Negative";
  } else {
    return "Neutral";
  }
}

// Function to truncate text to a reasonable length for the model
function truncateText(text: string, maxWords: number = 400): string {
  const words = text.split(" ");
  if (words.length <= maxWords) {
    return text;
  }
  return words.slice(0, maxWords).join(" ") + "...";
}

export async function POST(req: Request) {
  // Ensure the Hugging Face API key is set in the environment variables
  if (!process.env.HUGGING_FACE_API_KEY) {
    console.error("Hugging Face API key is not configured.");
    return NextResponse.json(
      {
        error:
          "Hugging Face API key not configured. Please add HUGGING_FACE_API_KEY to your .env.local file. Get your free API key from https://huggingface.co/settings/tokens",
      },
      { status: 500 }
    );
  }

  const { text } = await req.json();

  // Validate the input text
  if (!text || typeof text !== "string") {
    return NextResponse.json(
      { error: 'Invalid input: "text" field is required and must be a string' },
      { status: 400 }
    );
  }

  // Clean and validate the text
  const cleanedText = text.trim();
  if (cleanedText.length === 0) {
    return NextResponse.json(
      { error: "Text cannot be empty after trimming" },
      { status: 400 }
    );
  }

  // If text is too short, use fallback immediately
  if (cleanedText.length < 10) {
    console.log("Text too short, using fallback analysis");
    const fallbackSentiment = analyzeSentimentFallback(cleanedText);
    return NextResponse.json({
      sentiment: fallbackSentiment,
      method: "keyword_fallback",
      note: "Used keyword analysis due to short text length",
    });
  }

  // Truncate text if it's too long (to avoid token limit issues)
  const truncatedText = truncateText(cleanedText);
  const wasTruncated = truncatedText !== text;

  // Use a more reliable and commonly available sentiment analysis model
  const model = "cardiffnlp/twitter-roberta-base-sentiment";
  const inferenceApiUrl = `https://api-inference.huggingface.co/models/${model}`;

  console.log(`Making request to: ${inferenceApiUrl}`);
  console.log(`API Key present: ${!!process.env.HUGGING_FACE_API_KEY}`);
  console.log(`Original text length: ${cleanedText.length} characters`);
  console.log(`Truncated text length: ${truncatedText.length} characters`);
  console.log(`Was truncated: ${wasTruncated}`);

  try {
    const response = await fetch(inferenceApiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HUGGING_FACE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: truncatedText,
      }),
    });

    console.log(`Response status: ${response.status}`);

    // Check if the API call was successful
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Hugging Face API Error:", errorText);
      console.error("Response status:", response.status);

      // If we get any error, fall back to keyword analysis
      if (response.status === 400 || response.status === 500) {
        console.log(
          "Falling back to keyword-based sentiment analysis due to API error"
        );
        const fallbackSentiment = analyzeSentimentFallback(cleanedText);
        return NextResponse.json({
          sentiment: fallbackSentiment,
          method: "keyword_fallback",
          note: "Used keyword analysis due to API error",
        });
      }

      return NextResponse.json(
        {
          error: `Hugging Face API error: ${errorText}`,
          status: response.status,
          url: inferenceApiUrl,
        },
        { status: response.status }
      );
    }

    const result = await response.json();
    console.log("API Response:", JSON.stringify(result, null, 2));

    // Handle empty or invalid response
    if (!result || !Array.isArray(result) || result.length === 0) {
      console.log("Empty or invalid response, using fallback");
      const fallbackSentiment = analyzeSentimentFallback(cleanedText);
      return NextResponse.json({
        sentiment: fallbackSentiment,
        method: "keyword_fallback",
        note: "Used keyword analysis due to invalid API response",
      });
    }

    // The result from this specific model is an array of objects
    // We need to parse this to find the label with the highest score
    if (result[0]) {
      const sentiments = result[0];

      // Validate sentiments array
      if (!Array.isArray(sentiments) || sentiments.length === 0) {
        console.log("Invalid sentiments array, using fallback");
        const fallbackSentiment = analyzeSentimentFallback(cleanedText);
        return NextResponse.json({
          sentiment: fallbackSentiment,
          method: "keyword_fallback",
          note: "Used keyword analysis due to invalid sentiments data",
        });
      }

      const highestScore = sentiments.reduce(
        (
          prev: { score: number; label: string },
          current: { score: number; label: string }
        ) => {
          return prev.score > current.score ? prev : current;
        }
      );

      // Map the label to a more human-readable format
      let sentimentLabel = "";
      switch (highestScore.label) {
        case "LABEL_0":
          sentimentLabel = "Negative";
          break;
        case "LABEL_1":
          sentimentLabel = "Neutral";
          break;
        case "LABEL_2":
          sentimentLabel = "Positive";
          break;
        default:
          sentimentLabel = "Unknown";
          break;
      }

      console.log(
        `Determined sentiment: ${sentimentLabel} (${highestScore.label})`
      );

      // Respond with the determined sentiment
      return NextResponse.json({
        sentiment: sentimentLabel,
        method: "hugging_face",
        truncated: wasTruncated,
      });
    }

    // If we reach here, use fallback
    console.log("Unexpected response format, using fallback");
    const fallbackSentiment = analyzeSentimentFallback(cleanedText);
    return NextResponse.json({
      sentiment: fallbackSentiment,
      method: "keyword_fallback",
      note: "Used keyword analysis due to unexpected response format",
    });
  } catch (error: any) {
    console.error("Internal Server Error:", error);

    // Use fallback on any error
    console.log("Exception occurred, using fallback analysis");
    const fallbackSentiment = analyzeSentimentFallback(cleanedText);
    return NextResponse.json({
      sentiment: fallbackSentiment,
      method: "keyword_fallback",
      note: "Used keyword analysis due to exception",
    });
  }
}
