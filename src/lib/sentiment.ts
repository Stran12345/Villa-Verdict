// src/lib/sentiment.ts - Shared sentiment analysis logic

// Simple sentiment analysis using keyword matching as fallback
export function analyzeSentimentFallback(text: string): string {
  const lowerText = text.toLowerCase();

  const positiveWords = [
    "love", "amazing", "beautiful", "great", "awesome", "fantastic", "wonderful",
    "excellent", "perfect", "best", "good", "nice", "happy", "joy", "excited",
    "thrilled", "delighted", "pleased", "satisfied", "impressed", "stunning",
    "gorgeous", "handsome", "attractive", "charming", "sweet", "kind", "caring",
    "genuine", "authentic", "real", "honest", "loyal", "faithful", "romantic",
    "chemistry", "connection", "spark", "vibe", "energy", "positive", "optimistic",
    "confident", "strong", "independent", "mature", "respectful", "funny",
    "humorous", "entertaining", "engaging", "interesting", "captivating",
  ];

  const negativeWords = [
    "hate", "terrible", "awful", "horrible", "worst", "bad", "ugly", "disgusting",
    "annoying", "irritating", "frustrating", "disappointing", "boring", "dull",
    "fake", "phony", "manipulative", "toxic", "red flag", "warning", "concern",
    "worried", "suspicious", "doubtful", "skeptical", "cynical", "negative",
    "pessimistic", "insecure", "jealous", "possessive", "controlling", "immature",
    "childish", "rude", "disrespectful", "mean", "cruel", "heartless", "cold",
    "distant", "aloof", "uninterested", "bored", "annoyed", "angry", "mad",
    "furious", "rage", "despise", "loathe", "disgust", "repulsed",
  ];

  let positiveCount = 0;
  let negativeCount = 0;

  positiveWords.forEach((word) => {
    const regex = new RegExp(`\\b${word}\\b`, "g");
    const matches = lowerText.match(regex);
    if (matches) positiveCount += matches.length;
  });

  negativeWords.forEach((word) => {
    const regex = new RegExp(`\\b${word}\\b`, "g");
    const matches = lowerText.match(regex);
    if (matches) negativeCount += matches.length;
  });

  if (positiveCount > negativeCount) return "Positive";
  if (negativeCount > positiveCount) return "Negative";
  return "Neutral";
}

export function truncateText(text: string, maxWords: number = 400): string {
  const words = text.split(" ");
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(" ") + "...";
}

const MODEL = "cardiffnlp/twitter-roberta-base-sentiment";
const INFERENCE_URL = `https://router.huggingface.co/hf-inference/models/${MODEL}`;

function parseHuggingFaceResult(result: unknown): string | null {
  if (!result || !Array.isArray(result) || result.length === 0) return null;
  const sentiments = result[0];
  if (!Array.isArray(sentiments) || sentiments.length === 0) return null;

  const highest = sentiments.reduce(
    (prev: { score: number; label: string }, curr: { score: number; label: string }) =>
      prev.score > curr.score ? prev : curr
  );

  switch (highest.label) {
    case "LABEL_0": return "Negative";
    case "LABEL_1": return "Neutral";
    case "LABEL_2": return "Positive";
    default: return null;
  }
}

/**
 * Analyzes sentiment for a single text. Uses Hugging Face API when available,
 * falls back to keyword-based analysis on errors or short text.
 * Requires HUGGING_FACE_API_KEY to be set for API usage.
 */
export async function analyzeSentiment(text: string): Promise<string> {
  const cleanedText = text.trim();
  if (cleanedText.length === 0) return "Neutral";
  if (cleanedText.length < 10) return analyzeSentimentFallback(cleanedText);

  const apiKey = process.env.HUGGING_FACE_API_KEY;
  if (!apiKey) return analyzeSentimentFallback(cleanedText);

  const truncatedText = truncateText(cleanedText);

  try {
    const response = await fetch(INFERENCE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: truncatedText }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 400 || response.status === 500) {
        return analyzeSentimentFallback(cleanedText);
      }
      throw new Error(`Hugging Face API error: ${errorText}`);
    }

    const result = await response.json();
    const label = parseHuggingFaceResult(result);
    if (label) return label;

    return analyzeSentimentFallback(cleanedText);
  } catch {
    return analyzeSentimentFallback(cleanedText);
  }
}
