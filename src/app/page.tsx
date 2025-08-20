// src/app/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronDown, Loader2 } from "lucide-react"; // Using Lucide React for icons
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from "recharts";

// Let's add mock components for now that we can replace later.
const DashboardSection = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
    <h3 className="text-xl font-bold mb-4 text-gray-800">{title}</h3>
    {children}
  </div>
);

// A list of contestants from Love Island USA Season 7
const contestants = [
  "Amaya",
  "Bryan",
  "Nic",
  "Olandria",
  "Huda",
  "Chris",
  "Iris",
  "Pepe",
  "Ace",
  "Chelley",
  "Clarke",
  "Taylor",
  "Elan",
  "Zak",
  "Cierra",
  "Andreina",
  "Austin",
  "Gracyn",
  "Jaden",
  "TJ",
  "CoCo",
  "JD",
  "Vanna",
  "Zac",
  "Jeremiah",
  "Hannah",
  "Jalen",
  "Charlie",
  "Belle-A",
  "Yulissa",
];

interface Post {
  title: string;
  text: string;
  sentiment: string;
  subreddit: string;
  date: string;
  url: string;
  author: string;
  score: number;
  numComments: number;
  postType: string;
}

interface SentimentResult {
  contestant: string;
  season: string;
  date: string;
  posts: Post[];
}

// Color palette for the charts
const COLORS = ["#10B981", "#FCD34D", "#EF4444"]; // Green for Positive, Yellow for Neutral, Red for Negative

// Time ranges supported by Reddit search when sort=top
const TIME_RANGES = [
  { label: "Past Day", value: "day" },
  { label: "Past Week", value: "week" },
  { label: "Past Month", value: "month" },
  { label: "Past Year", value: "year" },
  { label: "All Time", value: "all" },
];

export default function App() {
  const [contestant, setContestant] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [results, setResults] = useState<SentimentResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Time range selection for Reddit sort=top
  const [timeRange, setTimeRange] = useState<string>("month");

  // Function to handle the entire data fetching and processing workflow
  const fetchAndProcessData = async () => {
    setLoading(true);
    setResults(null);
    setError(null);

    // Step 1: Fetch posts from the Reddit API
    try {
      const params = new URLSearchParams({ contestant });
      if (timeRange) params.set("t", timeRange);
      const redditResponse = await fetch(`/api/reddit?${params.toString()}`);
      if (!redditResponse.ok) {
        throw new Error("Failed to fetch posts from Reddit.");
      }
      const { posts } = await redditResponse.json();

      console.log(`Reddit API returned ${posts.length} total posts`);

      if (!posts || posts.length === 0) {
        setError("No posts found for the selected contestant.");
        setLoading(false);
        return;
      }

      // Server-side time-range filtering now applied; use posts as-is
      const filteredPosts = posts;

      if (filteredPosts.length === 0) {
        setError("No posts found within the selected date range.");
        setLoading(false);
        return;
      }

      // Step 2: Process each post for sentiment analysis
      const postsWithSentiment = await Promise.all(
        filteredPosts.map(async (post: Post) => {
          const combinedText = [post.title, post.text]
            .filter((part) => part && part.trim().length > 0)
            .join(". ");

          const sentimentResponse = await fetch("/api/sentiment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: combinedText }),
          });

          if (!sentimentResponse.ok) {
            // Include more detailed error message from the API
            const errorData = await sentimentResponse.json();
            throw new Error(
              `Sentiment API error: ${JSON.stringify(errorData)}`
            );
          }

          const { sentiment } = await sentimentResponse.json();
          return { ...post, sentiment };
        })
      );

      // Step 3: Save the processed data to the MongoDB database
      const saveResponse = await fetch("/api/database", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contestant,
          season: "Season 7",
          posts: postsWithSentiment,
        }),
      });

      if (!saveResponse.ok) {
        // Include more detailed error message from the API
        const errorData = await saveResponse.json();
        throw new Error(`Database API error: ${JSON.stringify(errorData)}`);
      }

      // After saving, we'll just use the processed data directly for display
      setResults({
        contestant,
        season: "Season 7",
        date: new Date().toISOString(),
        posts: postsWithSentiment,
      });
    } catch (err: any) {
      console.error("Error during data processing:", err);
      setError(err.message || "An unknown error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (contestant) {
      fetchAndProcessData();
    }
  };

  const handleContestantChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setContestant(e.target.value);
  };

  // Date handlers removed

  useEffect(() => {
    // Set initial contestant when the component mounts
    setContestant(contestants[0]);
  }, []);

  // Memoize the sentiment data for the charts
  const sentimentData = useMemo(() => {
    if (!results) return null;
    const sentimentCounts = results.posts.reduce((acc, post) => {
      acc[post.sentiment] = (acc[post.sentiment] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    const chartData = Object.keys(sentimentCounts).map((sentiment) => ({
      name: sentiment,
      count: sentimentCounts[sentiment],
    }));

    return chartData;
  }, [results]);

  const totalPosts = results?.posts.length || 0;
  const positiveCount =
    sentimentData?.find((d) => d.name === "Positive")?.count || 0;
  const negativeCount =
    sentimentData?.find((d) => d.name === "Negative")?.count || 0;
  const neutralCount =
    sentimentData?.find((d) => d.name === "Neutral")?.count || 0;

  return (
    <main className="min-h-screen bg-gray-50 p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl space-y-8">
        <header className="text-center">
          <h1 className="text-5xl font-extrabold tracking-tight text-gray-900">
            Love Island USA Season 7 Sentiment
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            Analyze public sentiment about contestants from Reddit.
          </p>
        </header>

        {/* Input Form */}
        <div className="bg-white p-8 rounded-xl shadow-xl border border-gray-200">
          <form
            onSubmit={handleSubmit}
            className="flex flex-col md:flex-row gap-4 justify-center items-end"
          >
            <div className="flex-1 w-full">
              <label
                htmlFor="contestant"
                className="block text-sm font-medium text-gray-700"
              >
                Contestant
              </label>
              <div className="mt-1 relative">
                <select
                  id="contestant"
                  name="contestant"
                  value={contestant}
                  onChange={handleContestantChange}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm appearance-none bg-white"
                >
                  {contestants.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                  <ChevronDown
                    className="h-5 w-5 text-gray-400"
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>

            <div className="flex-1 w-full relative">
              <label
                htmlFor="time-range"
                className="block text-sm font-medium text-gray-700"
              >
                Time Range (Reddit sort=top)
              </label>
              <select
                id="time-range"
                name="time-range"
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm appearance-none bg-white"
              >
                {TIME_RANGES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-8 right-0 flex items-center pr-2">
                <ChevronDown
                  className="h-5 w-5 text-gray-400"
                  aria-hidden="true"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full md:w-auto px-6 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </span>
              ) : (
                "Analyze Sentiment"
              )}
            </button>
          </form>
        </div>

        {/* Display Error Message */}
        {error && (
          <div
            className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl relative"
            role="alert"
          >
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {/* Display Results */}
        {results && (
          <div className="mt-8 space-y-6">
            <h2 className="text-3xl font-bold text-center text-gray-900">
              Sentiment Results for {results.contestant}
            </h2>

            <DashboardSection title="Sentiment Overview">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-100 p-4 rounded-lg">
                  <h4 className="text-lg font-semibold text-gray-700 mb-2">
                    Sentiment Distribution (Bar Chart)
                  </h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={sentimentData as any[]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" fill="#8884d8">
                        {sentimentData?.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-gray-100 p-4 rounded-lg">
                  <h4 className="text-lg font-semibold text-gray-700 mb-2">
                    Sentiment Distribution (Pie Chart)
                  </h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={sentimentData as any[]}
                        dataKey="count"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        labelLine={false}
                      >
                        {sentimentData?.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                        <LabelList
                          dataKey="count"
                          position="inside"
                          fill="#fff"
                          fontSize={12}
                        />
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </DashboardSection>

            <DashboardSection title="Recent Posts & Sentiment">
              <div className="space-y-4">
                {results.posts.map((post, index) => (
                  <div
                    key={index}
                    className="p-4 border border-gray-200 rounded-md hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold text-gray-800 text-lg">
                        {post.title}
                      </h4>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        r/{post.subreddit}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 mb-3 line-clamp-3">
                      {post.text}
                    </p>

                    <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                      <span>By u/{post.author}</span>
                      <span>{new Date(post.date).toLocaleDateString()}</span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                      <span>↑ {post.score} points</span>
                      <span>💬 {post.numComments} comments</span>
                      {/* Removed explicit post type label per request */}
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-sm">
                        Sentiment:{" "}
                        <span
                          className={`font-bold ${
                            post.sentiment === "Positive"
                              ? "text-green-600"
                              : post.sentiment === "Negative"
                              ? "text-red-600"
                              : "text-gray-500"
                          }`}
                        >
                          {post.sentiment}
                        </span>
                      </p>

                      <a
                        href={post.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium hover:underline"
                      >
                        View on Reddit →
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </DashboardSection>
          </div>
        )}
      </div>
    </main>
  );
}
