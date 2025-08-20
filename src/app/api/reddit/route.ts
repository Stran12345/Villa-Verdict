// src/app/api/reddit/route.ts

import { NextResponse } from "next/server";

// This API endpoint fetches data from multiple relevant subreddits for a contestant.
export async function GET(req: Request) {
  // Extract query parameters from the request URL
  const { searchParams } = new URL(req.url);
  const contestant = searchParams.get("contestant");
  const tParam = searchParams.get("t"); // hour|day|week|month|year|all

  // Validate that a contestant name was provided
  if (!contestant) {
    return NextResponse.json(
      { error: 'Missing "contestant" query parameter' },
      { status: 400 }
    );
  }

  // Search only in r/LoveIslandUSA per request
  const subreddits = ["LoveIslandUSA"];

  // The search query includes the contestant's name
  const query = `${contestant}`;

  let allPosts: any[] = [];
  const seenUrls = new Set<string>(); // Track seen URLs to avoid duplicates

  // Normalize t (time range) for sort=top
  const allowedT = new Set(["hour", "day", "week", "month", "year", "all"]);
  const timeRange: string = allowedT.has((tParam || "").toLowerCase())
    ? (tParam as string).toLowerCase()
    : "month";

  // Search in each subreddit
  for (const subreddit of subreddits) {
    try {
      // Use Reddit sort=top with time range parameter
      const redditApiUrl: string = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(
        query
      )}&limit=100&sort=top&t=${timeRange}&restrict_sr=1`;

      console.log(
        `Searching r/${subreddit} sort=top t=${timeRange} for "${contestant}"`
      );

      const response: Response = await fetch(redditApiUrl, {
        method: "GET",
        headers: {
          "User-Agent": "LoveIslandSentimentDashboard/1.0",
        },
      });

      if (!response.ok) {
        console.warn(`Failed to fetch from r/${subreddit}: ${response.status}`);
        continue; // Skip this subreddit and continue with others
      }

      const redditData: any = await response.json();
      const subredditPosts = redditData.data.children
        .map((child: any) => ({
          title: child.data.title,
          text: child.data.selftext || child.data.body || "", // Handle both posts and comments
          subreddit: child.data.subreddit,
          date: new Date(child.data.created_utc * 1000).toISOString(),
          url: `https://www.reddit.com${child.data.permalink}`,
          author: child.data.author,
          score: child.data.score,
          numComments: child.data.num_comments,
          isSelfPost: child.data.is_self,
          postType: child.data.is_self ? "text" : "link",
        }))
        .filter(
          (post: any) =>
            post.subreddit?.toLowerCase() === subreddit.toLowerCase()
        )
        .filter((post: any) => {
          if (seenUrls.has(post.url)) return false;
          seenUrls.add(post.url);
          return true;
        });

      allPosts = allPosts.concat(subredditPosts);
      console.log(
        `Found ${subredditPosts.length} unique posts in r/${subreddit}`
      );
    } catch (error: any) {
      console.error(`Error fetching from r/${subreddit}:`, error);
      continue; // Continue with other subreddits
    }
  }

  // Sort posts by score (upvotes) to get the most relevant ones first
  allPosts.sort((a, b) => b.score - a.score);

  // Limit to top 50 posts total
  const topPosts = allPosts.slice(0, 50);

  console.log(
    `Total unique posts found: ${allPosts.length}, returning top ${topPosts.length}`
  );

  return NextResponse.json({
    posts: topPosts,
    totalFound: allPosts.length,
    subredditsSearched: subreddits,
  });
}
