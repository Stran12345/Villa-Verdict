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

// Consistent mapping from sentiment name to color
const SENTIMENT_COLOR_BY_NAME: Record<string, string> = {
  Positive: COLORS[0],
  Neutral: COLORS[1],
  Negative: COLORS[2],
};

const getSentimentColor = (name: string): string =>
  SENTIMENT_COLOR_BY_NAME[name] ?? "#9CA3AF"; // default gray if unknown

// Time ranges supported by Reddit search when sort=top
const TIME_RANGES = [
  { label: "Past Day", value: "day" },
  { label: "Past Week", value: "week" },
  { label: "Past Month", value: "month" },
  { label: "Past Year", value: "year" },
  { label: "All Time", value: "all" },
];

const POSTS_PER_PAGE = 5;
const SENTIMENT_CHUNK_SIZE = 5;

export default function App() {
  const [contestant, setContestant] = useState<string>("");
  const [contestant2, setContestant2] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [results, setResults] = useState<SentimentResult | null>(null);
  const [results2, setResults2] = useState<SentimentResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Time range selection for Reddit sort=top
  const [timeRange, setTimeRange] = useState<string>("month");
  const [selectedSentiments, setSelectedSentiments] = useState<string[]>([
    "Positive",
    "Neutral",
    "Negative",
  ]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [currentPage2, setCurrentPage2] = useState<number>(1);
  const [activeContestant, setActiveContestant] = useState<"first" | "second">(
    "first"
  );
  const [sentimentMode, setSentimentMode] = useState<"fast" | "accurate">(
    "accurate"
  );

  // Function to reset the page state (refresh functionality)
  const handleLogoClick = () => {
    setResults(null);
    setResults2(null);
    setError(null);
    setLoading(false);
    setCurrentPage(1);
    setCurrentPage2(1);
    setSelectedSentiments(["Positive", "Neutral", "Negative"]);
    setTimeRange("month");
    setActiveContestant("first");
    setSentimentMode("accurate");
    // Keep the current contestants selected but clear results
  };

  // Function to handle the entire data fetching and processing workflow
  const fetchAndProcessData = async () => {
    setLoading(true);
    setResults(null);
    setResults2(null);
    setError(null);

    try {
      const hasTwo = contestant2 && contestant2 !== contestant;

      // Fetch Reddit data for both contestants (if applicable)
      let posts1: Post[] = [];
      let posts2: Post[] = [];

      if (contestant) {
        const params = new URLSearchParams({ contestant });
        if (timeRange) params.set("t", timeRange);
        const redditResponse = await fetch(`/api/reddit?${params.toString()}`);
        if (!redditResponse.ok) throw new Error("Failed to fetch posts from Reddit.");
        const data = await redditResponse.json();
        posts1 = data.posts ?? [];
        if (posts1.length === 0) {
          setError(`No posts found for ${contestant}.`);
          setLoading(false);
          return;
        }
      }

      if (hasTwo) {
        const params = new URLSearchParams({ contestant: contestant2 });
        if (timeRange) params.set("t", timeRange);
        const redditResponse = await fetch(`/api/reddit?${params.toString()}`);
        if (!redditResponse.ok) throw new Error("Failed to fetch posts from Reddit for second contestant.");
        const data = await redditResponse.json();
        posts2 = data.posts ?? [];
        if (posts2.length === 0) {
          setError(`No posts found for ${contestant2}.`);
          setLoading(false);
          return;
        }
      }

      const texts1 = posts1.map((post: Post) =>
        [post.title, post.text].filter((p) => p?.trim()).join(". ")
      );
      const texts2 = posts2.map((post: Post) =>
        [post.title, post.text].filter((p) => p?.trim()).join(". ")
      );

      if (hasTwo) {
        // Two contestants: take turns processing chunks of 5
        const allPosts1: (Post & { sentiment: string })[] = [];
        const allPosts2: (Post & { sentiment: string })[] = [];
        const maxChunks = Math.max(
          Math.ceil(posts1.length / SENTIMENT_CHUNK_SIZE),
          Math.ceil(posts2.length / SENTIMENT_CHUNK_SIZE)
        );

        for (let i = 0; i < maxChunks; i++) {
          // Contestant 1's chunk (if any)
          if (i * SENTIMENT_CHUNK_SIZE < posts1.length) {
            const chunkPosts = posts1.slice(i * SENTIMENT_CHUNK_SIZE, (i + 1) * SENTIMENT_CHUNK_SIZE);
            const chunkTexts = texts1.slice(i * SENTIMENT_CHUNK_SIZE, (i + 1) * SENTIMENT_CHUNK_SIZE);
            const res = await fetch("/api/sentiment/batch", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ texts: chunkTexts, method: sentimentMode }),
            });
            if (!res.ok) throw new Error(`Sentiment API error: ${JSON.stringify(await res.json())}`);
            const { sentiments } = await res.json();
            const chunkWithSentiment = chunkPosts.map((post: Post, j: number) => ({
              ...post,
              sentiment: sentiments[j] ?? "Neutral",
            }));
            allPosts1.push(...chunkWithSentiment);
            setResults({ contestant: contestant!, season: "Season 7", date: new Date().toISOString(), posts: [...allPosts1] });
          }

          // Contestant 2's chunk (if any)
          if (i * SENTIMENT_CHUNK_SIZE < posts2.length) {
            const chunkPosts = posts2.slice(i * SENTIMENT_CHUNK_SIZE, (i + 1) * SENTIMENT_CHUNK_SIZE);
            const chunkTexts = texts2.slice(i * SENTIMENT_CHUNK_SIZE, (i + 1) * SENTIMENT_CHUNK_SIZE);
            const res = await fetch("/api/sentiment/batch", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ texts: chunkTexts, method: sentimentMode }),
            });
            if (!res.ok) throw new Error(`Sentiment API error: ${JSON.stringify(await res.json())}`);
            const { sentiments } = await res.json();
            const chunkWithSentiment = chunkPosts.map((post: Post, j: number) => ({
              ...post,
              sentiment: sentiments[j] ?? "Neutral",
            }));
            allPosts2.push(...chunkWithSentiment);
            setResults2({ contestant: contestant2!, season: "Season 7", date: new Date().toISOString(), posts: [...allPosts2] });
          }
        }

        // Save both to database
        const [save1, save2] = await Promise.all([
          fetch("/api/database", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contestant, season: "Season 7", posts: allPosts1 }),
          }),
          fetch("/api/database", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contestant: contestant2, season: "Season 7", posts: allPosts2 }),
          }),
        ]);
        if (!save1.ok) throw new Error(`Database API error: ${JSON.stringify(await save1.json())}`);
        if (!save2.ok) throw new Error(`Database API error: ${JSON.stringify(await save2.json())}`);
      } else {
        // Single contestant: process chunks sequentially
        const allPosts: (Post & { sentiment: string })[] = [];

        for (let i = 0; i < posts1.length; i += SENTIMENT_CHUNK_SIZE) {
          const chunkPosts = posts1.slice(i, i + SENTIMENT_CHUNK_SIZE);
          const chunkTexts = texts1.slice(i, i + SENTIMENT_CHUNK_SIZE);
          const res = await fetch("/api/sentiment/batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ texts: chunkTexts, method: sentimentMode }),
          });
          if (!res.ok) throw new Error(`Sentiment API error: ${JSON.stringify(await res.json())}`);
          const { sentiments } = await res.json();
          const chunkWithSentiment = chunkPosts.map((post: Post, j: number) => ({
            ...post,
            sentiment: sentiments[j] ?? "Neutral",
          }));
          allPosts.push(...chunkWithSentiment);
          setResults({ contestant: contestant!, season: "Season 7", date: new Date().toISOString(), posts: [...allPosts] });
        }

        const saveResponse = await fetch("/api/database", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contestant, season: "Season 7", posts: allPosts }),
        });
        if (!saveResponse.ok) throw new Error(`Database API error: ${JSON.stringify(await saveResponse.json())}`);
      }
    } catch (err: any) {
      console.error("Error during data processing:", err);
      setError(err.message || "Unknown error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (contestant || contestant2) {
      fetchAndProcessData();
    }
  };

  // Date handlers removed

  useEffect(() => {
    // Set initial contestant when the component mounts
    setContestant(contestants[0]);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    setCurrentPage2(1);
  }, [results, results2, selectedSentiments]);

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

  const sentimentData2 = useMemo(() => {
    if (!results2) return null;
    const sentimentCounts = results2.posts.reduce((acc, post) => {
      acc[post.sentiment] = (acc[post.sentiment] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    const chartData = Object.keys(sentimentCounts).map((sentiment) => ({
      name: sentiment,
      count: sentimentCounts[sentiment],
    }));

    return chartData;
  }, [results2]);

  const filteredPosts = useMemo(() => {
    if (!results) return [] as Post[];
    return results.posts.filter((post) =>
      selectedSentiments.includes(post.sentiment)
    );
  }, [results, selectedSentiments]);

  const filteredPosts2 = useMemo(() => {
    if (!results2) return [] as Post[];
    return results2.posts.filter((post) =>
      selectedSentiments.includes(post.sentiment)
    );
  }, [results2, selectedSentiments]);

  const totalFiltered = filteredPosts.length;
  const totalFiltered2 = filteredPosts2.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / POSTS_PER_PAGE));
  const totalPages2 = Math.max(1, Math.ceil(totalFiltered2 / POSTS_PER_PAGE));
  const page = Math.min(currentPage, totalPages);
  const page2 = Math.min(currentPage2, totalPages2);
  const paginatedPosts = filteredPosts.slice(
    (page - 1) * POSTS_PER_PAGE,
    page * POSTS_PER_PAGE
  );
  const paginatedPosts2 = filteredPosts2.slice(
    (page2 - 1) * POSTS_PER_PAGE,
    page2 * POSTS_PER_PAGE
  );

  const toggleSentiment = (name: string) => {
    setSelectedSentiments((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  return (
    <main className="min-h-screen relative overflow-hidden">
      {/* Parallax Background */}
      <div className="fixed inset-0 z-0">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat transform scale-110"
          style={{
            backgroundImage: "url(/background.png)",
          }}
        />
      </div>

      {/* Logo in upper left corner */}
      <div className="fixed top-4 left-4 z-20 hidden md:block">
        <button
          onClick={handleLogoClick}
          className="transition-all duration-200 hover:scale-105"
        >
          <img src="/Logo.png" alt="Logo" className="h-24 w-auto" />
        </button>
      </div>

      {/* Content Container */}
      <div className="relative z-10 min-h-screen p-8 flex flex-col items-center">
        <div className="w-full max-w-4xl space-y-8">
          {/* Semi-transparent Content Card */}
          <div className="backdrop-blur-md bg-white/90 rounded-2xl shadow-2xl border border-white/20 p-8">
            <header className="text-center">
              <h1 className="text-5xl font-extrabold tracking-tight text-gray-900">
                Love Island Sentiment Dashboard
              </h1>
              <p className="mt-4 text-lg text-gray-700">
                Analyze public sentiment about Love Island Season 7 contestants
                from Reddit!
              </p>
            </header>

            {/* Input Form */}
            <div className="bg-white/95 backdrop-blur-sm p-8 rounded-xl shadow-xl border border-white/30 mt-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Top Section - Time Range Dropdown */}
                <div className="w-full">
                  <label
                    htmlFor="time-range"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Top Posts From
                  </label>
                  <div className="relative">
                    <select
                      id="time-range"
                      name="time-range"
                      value={timeRange}
                      onChange={(e) => setTimeRange(e.target.value)}
                      className="w-full pl-3 pr-10 py-2.5 text-sm text-gray-900 font-medium border-2 border-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 rounded-md shadow-sm appearance-none bg-white"
                    >
                      {TIME_RANGES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                      <ChevronDown
                        className="h-5 w-5 text-gray-600"
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                </div>

                {/* Sentiment Mode Toggle */}
                <div className="w-full">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Analysis Mode
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSentimentMode("fast")}
                      className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-md border-2 transition-all duration-200 ${
                        sentimentMode === "fast"
                          ? "bg-green-500 text-white border-green-500"
                          : "bg-white text-gray-700 border-gray-400 hover:border-green-400"
                      }`}
                    >
                      ⚡ Fast (Local)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSentimentMode("accurate")}
                      className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-md border-2 transition-all duration-200 ${
                        sentimentMode === "accurate"
                          ? "bg-blue-500 text-white border-blue-500"
                          : "bg-white text-gray-700 border-gray-400 hover:border-blue-400"
                      }`}
                    >
                      🎯 Accurate (AI)
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {sentimentMode === "fast"
                      ? "Instant results using local lexicon analysis"
                      : "Uses Hugging Face AI model (slower but more accurate)"}
                  </p>
                </div>

                {/* Contestant Selection Grid */}
                <div className="w-full">
                  <label className="block text-sm font-medium text-gray-700 mb-4">
                    Select Contestants (Choose up to 2)
                  </label>
                  <div className="bg-white/90 backdrop-blur-sm border border-white/30 rounded-lg p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 h-40 overflow-y-auto snap-y snap-mandatory overflow-x-hidden">
                      {contestants.map((name) => {
                        const isSelected =
                          contestant === name || contestant2 === name;
                        const isFirst = contestant === name;
                        const isSecond = contestant2 === name;

                        return (
                          <button
                            type="button"
                            key={name}
                            onClick={() => {
                              if (isSelected) {
                                // Unselect if already selected
                                if (isFirst) {
                                  setContestant("");
                                } else if (isSecond) {
                                  setContestant2("");
                                }
                              } else {
                                // Select if not already selected
                                if (!contestant) {
                                  setContestant(name);
                                } else if (!contestant2) {
                                  setContestant2(name);
                                }
                                // If both are already selected, don't allow more selections
                              }
                            }}
                            className={`group relative rounded-lg border-2 p-3 text-center transition-all duration-200 bg-white/95 backdrop-blur-sm hover:shadow-md snap-start ${
                              isSelected
                                ? isFirst
                                  ? "border-blue-500 shadow-lg ring-2 ring-blue-200"
                                  : "border-green-500 shadow-lg ring-2 ring-green-200"
                                : "border-gray-200 hover:border-gray-300"
                            }`}
                          >
                            {isSelected && (
                              <div
                                className={`absolute -top-2 -right-2 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold shadow-lg z-10 ${
                                  isFirst ? "bg-blue-500" : "bg-green-500"
                                }`}
                              >
                                {isFirst ? "1" : "2"}
                              </div>
                            )}
                            <img
                              src={`/islanders/${encodeURIComponent(
                                name
                              )}.webp`}
                              alt={name}
                              className="w-full h-24 object-cover object-top rounded-md mb-2"
                              loading="lazy"
                            />
                            <span
                              className={`block text-xs font-medium truncate ${
                                isSelected
                                  ? isFirst
                                    ? "text-blue-700"
                                    : "text-green-700"
                                  : "text-gray-700 group-hover:text-gray-900"
                              }`}
                            >
                              {name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Bottom Section - Analyze Button */}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-8 py-3 border border-transparent text-base font-medium rounded-lg shadow-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-xl transform hover:scale-105"
                  >
                    {loading ? (
                      <span className="flex items-center">
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Analyzing...
                      </span>
                    ) : (
                      "Analyze Sentiment"
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Display Error Message */}
            {error && (
              <div
                className="backdrop-blur-md bg-red-100/90 border border-red-400/50 text-red-700 px-4 py-3 rounded-xl relative mt-6"
                role="alert"
              >
                <span className="block sm:inline">{error}</span>
              </div>
            )}

            {/* Display Results */}
            {results && (
              <div className="mt-8 space-y-6">
                <h2 className="text-3xl font-bold text-center text-gray-900">
                  {results2
                    ? `Sentiment Comparison: ${results.contestant} vs ${results2.contestant}`
                    : `Sentiment Results for ${results.contestant}`}
                </h2>

                <DashboardSection title="Sentiment Overview">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* First Contestant Charts */}
                    <div className="space-y-4">
                      <h3 className="text-xl font-semibold text-blue-700 text-center">
                        {results.contestant}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white/90 backdrop-blur-sm p-4 rounded-lg border border-white/30">
                          <h4 className="text-lg font-semibold text-gray-700 mb-2">
                            Bar Chart
                          </h4>
                          <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={sentimentData as any[]}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" />
                              <YAxis />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "#fff",
                                  border: "1px solid #e5e7eb",
                                }}
                                labelStyle={{ color: "#1f2937", fontWeight: 600 }}
                              />
                              <Legend />
                              <Bar dataKey="count" fill="#8884d8">
                                {sentimentData?.map((entry, index) => (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={getSentimentColor(
                                      (entry as any).name
                                    )}
                                  />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                        <div className="bg-white/90 backdrop-blur-sm p-4 rounded-lg border border-white/30">
                          <h4 className="text-lg font-semibold text-gray-700 mb-2">
                            Pie Chart
                          </h4>
                          <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                              <Pie
                                data={sentimentData as any[]}
                                dataKey="count"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={60}
                                fill="#8884d8"
                                labelLine={false}
                              >
                                {sentimentData?.map((entry, index) => (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={getSentimentColor(
                                      (entry as any).name
                                    )}
                                  />
                                ))}
                                <LabelList
                                  dataKey="count"
                                  position="inside"
                                  fill="#fff"
                                  fontSize={12}
                                />
                              </Pie>
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "#fff",
                                  border: "1px solid #e5e7eb",
                                }}
                                labelStyle={{ color: "#1f2937", fontWeight: 600 }}
                              />
                              {!results2 && <Legend />}
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>

                    {/* Second Contestant Charts (if available) */}
                    {results2 && (
                      <div className="space-y-4">
                        <h3 className="text-xl font-semibold text-green-700 text-center">
                          {results2.contestant}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-white/90 backdrop-blur-sm p-4 rounded-lg border border-white/30">
                            <h4 className="text-lg font-semibold text-gray-700 mb-2">
                              Bar Chart
                            </h4>
                            <ResponsiveContainer width="100%" height={200}>
                              <BarChart data={sentimentData2 as any[]}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip
                                  contentStyle={{
                                    backgroundColor: "#fff",
                                    border: "1px solid #e5e7eb",
                                  }}
                                  labelStyle={{
                                    color: "#1f2937",
                                    fontWeight: 600,
                                  }}
                                />
                                <Legend />
                                <Bar dataKey="count" fill="#8884d8">
                                  {sentimentData2?.map((entry, index) => (
                                    <Cell
                                      key={`cell-${index}`}
                                      fill={getSentimentColor(
                                        (entry as any).name
                                      )}
                                    />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>

                          <div className="bg-white/90 backdrop-blur-sm p-4 rounded-lg border border-white/30">
                            <h4 className="text-lg font-semibold text-gray-700 mb-2">
                              Pie Chart
                            </h4>
                            <ResponsiveContainer width="100%" height={200}>
                              <PieChart>
                                <Pie
                                  data={sentimentData2 as any[]}
                                  dataKey="count"
                                  nameKey="name"
                                  cx="50%"
                                  cy="50%"
                                  outerRadius={60}
                                  fill="#8884d8"
                                  labelLine={false}
                                >
                                  {sentimentData2?.map((entry, index) => (
                                    <Cell
                                      key={`cell-${index}`}
                                      fill={getSentimentColor(
                                        (entry as any).name
                                      )}
                                    />
                                  ))}
                                  <LabelList
                                    dataKey="count"
                                    position="inside"
                                    fill="#fff"
                                    fontSize={12}
                                  />
                                </Pie>
                                <Tooltip
                                  contentStyle={{
                                    backgroundColor: "#fff",
                                    border: "1px solid #e5e7eb",
                                  }}
                                  labelStyle={{
                                    color: "#1f2937",
                                    fontWeight: 600,
                                  }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </DashboardSection>

                <DashboardSection title="Recent Posts & Sentiment">
                  {/* Contestant Switcher for Comparison Mode */}
                  {results2 && (
                    <div className="flex justify-center mb-6">
                      <div className="bg-white/90 backdrop-blur-sm rounded-lg p-2 border border-white/30">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveContestant("first")}
                            className={`px-4 py-2 rounded-md font-medium transition-all duration-200 ${
                              activeContestant === "first"
                                ? "bg-blue-500 text-white shadow-md"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                          >
                            {results.contestant}
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveContestant("second")}
                            className={`px-4 py-2 rounded-md font-medium transition-all duration-200 ${
                              activeContestant === "second"
                                ? "bg-green-500 text-white shadow-md"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                          >
                            {results2.contestant}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-3 mb-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-sm text-gray-600">
                        Filter by sentiment:
                      </span>
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                          checked={selectedSentiments.includes("Positive")}
                          onChange={() => toggleSentiment("Positive")}
                        />
                        <span className="text-sm text-green-700">Positive</span>
                      </label>
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-yellow-500 focus:ring-yellow-500"
                          checked={selectedSentiments.includes("Neutral")}
                          onChange={() => toggleSentiment("Neutral")}
                        />
                        <span className="text-sm text-yellow-700">Neutral</span>
                      </label>
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                          checked={selectedSentiments.includes("Negative")}
                          onChange={() => toggleSentiment("Negative")}
                        />
                        <span className="text-sm text-red-700">Negative</span>
                      </label>
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>
                        Showing{" "}
                        {activeContestant === "first"
                          ? totalFiltered === 0
                            ? 0
                            : (page - 1) * POSTS_PER_PAGE + 1
                          : totalFiltered2 === 0
                          ? 0
                          : (page2 - 1) * POSTS_PER_PAGE + 1}
                        -
                        {activeContestant === "first"
                          ? Math.min(page * POSTS_PER_PAGE, totalFiltered)
                          : Math.min(
                              page2 * POSTS_PER_PAGE,
                              totalFiltered2
                            )}{" "}
                        of{" "}
                        {activeContestant === "first"
                          ? totalFiltered
                          : totalFiltered2}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            activeContestant === "first"
                              ? setCurrentPage((p) => Math.max(1, p - 1))
                              : setCurrentPage2((p) => Math.max(1, p - 1))
                          }
                          disabled={
                            activeContestant === "first"
                              ? page === 1
                              : page2 === 1
                          }
                          className="px-3 py-1 rounded border border-gray-300 bg-white/90 backdrop-blur-sm text-gray-700 disabled:opacity-50"
                        >
                          Prev
                        </button>
                        <span>
                          Page {activeContestant === "first" ? page : page2} of{" "}
                          {activeContestant === "first"
                            ? totalPages
                            : totalPages2}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            activeContestant === "first"
                              ? setCurrentPage((p) =>
                                  Math.min(totalPages, p + 1)
                                )
                              : setCurrentPage2((p) =>
                                  Math.min(totalPages2, p + 1)
                                )
                          }
                          disabled={
                            activeContestant === "first"
                              ? page === totalPages || totalFiltered === 0
                              : page2 === totalPages2 || totalFiltered2 === 0
                          }
                          className="px-3 py-1 rounded border border-gray-300 bg-white/90 backdrop-blur-sm text-gray-700 disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {(activeContestant === "first"
                      ? paginatedPosts
                      : paginatedPosts2
                    ).length === 0 && (
                      <div className="p-4 text-sm text-gray-600 border border-gray-200 rounded-md bg-white/90 backdrop-blur-sm">
                        No posts match the selected filters.
                      </div>
                    )}
                    {(activeContestant === "first"
                      ? paginatedPosts
                      : paginatedPosts2
                    ).map((post) => (
                      <div
                        key={post.url}
                        className="p-4 border border-white/30 rounded-md hover:shadow-md transition-shadow bg-white/90 backdrop-blur-sm"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold text-gray-800 text-lg">
                            {post.title}
                          </h4>
                        </div>

                        <p className="text-sm text-gray-600 mb-3 line-clamp-3">
                          {post.text}
                        </p>

                        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                          <span>By u/{post.author}</span>
                          <span>
                            {new Date(post.date).toLocaleDateString()}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                          <span>↑ {post.score} points</span>
                          <span>💬 {post.numComments} comments</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <p className="text-sm text-gray-700 font-medium">
                            Sentiment:{" "}
                            <span
                              className={`font-bold ${
                                post.sentiment === "Positive"
                                  ? "text-green-600"
                                  : post.sentiment === "Negative"
                                  ? "text-red-600"
                                  : "text-yellow-600"
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
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 bg-white/90 backdrop-blur-sm border-t border-white/30 mt-16">
        <div className="max-w-4xl mx-auto px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm text-gray-600">
              © {new Date().getFullYear()} Villa Verdict. All rights reserved.
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span>Built by Steven Tran</span>
              <a
                href="https://www.linkedin.com/in/steventran246"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 transition-colors duration-200 hover:underline"
              >
                LinkedIn
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
