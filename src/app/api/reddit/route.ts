// src/app/api/reddit/route.ts

import { NextResponse } from "next/server";

// Function to get Reddit OAuth token
async function getRedditToken(): Promise<string | null> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.warn(
      "Reddit credentials not found, using unauthenticated requests"
    );
    return null;
  }

  try {
    const response = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${clientId}:${clientSecret}`
        ).toString("base64")}`,
        "User-Agent": "LoveIslandSentimentDashboard/1.0",
      },
      body: "grant_type=client_credentials",
    });

    if (!response.ok) {
      console.warn(`Failed to get Reddit token: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error("Error getting Reddit token:", error);
    return null;
  }
}

// This API endpoint fetches data from multiple relevant subreddits for a contestant.
export async function GET(req: Request) {
  try {
    console.log("Reddit API endpoint called");

    // Extract query parameters from the request URL
    const { searchParams } = new URL(req.url);
    const contestant = searchParams.get("contestant");
    const tParam = searchParams.get("t"); // hour|day|week|month|year|all

    console.log(`Request parameters: contestant=${contestant}, t=${tParam}`);

    // Validate that a contestant name was provided
    if (!contestant) {
      console.log("Missing contestant parameter");
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

    console.log(`Normalized time range: ${timeRange}`);

    // Check cache first
    console.log("🔍 Checking cache for existing posts...");
    try {
      const cacheResponse = await fetch(
        `${
          req.url.split("/api/reddit")[0]
        }/api/database?type=reddit&contestant=${encodeURIComponent(
          contestant
        )}&timeRange=${encodeURIComponent(timeRange)}`
      );

      if (cacheResponse.ok) {
        const cacheData = await cacheResponse.json();

        if (cacheData.cached) {
          console.log(
            `📦 Found cached posts for ${contestant} (${timeRange}) - serving ${cacheData.posts.length} posts`
          );
          return NextResponse.json({
            posts: cacheData.posts,
            totalFound: cacheData.totalFound,
            subredditsSearched: cacheData.subredditsSearched,
            cached: true,
            cacheAge: cacheData.cacheAge,
          });
        } else {
          console.log("❌ No valid cache found, fetching from Reddit API");
        }
      }
    } catch (error) {
      console.warn("Cache check failed, proceeding with Reddit API:", error);
    }

    // Get Reddit OAuth token
    const token = await getRedditToken();
    const headers: Record<string, string> = {
      "User-Agent": "LoveIslandSentimentDashboard/1.0",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
      console.log("Using authenticated Reddit API requests");
    } else {
      console.log("Using unauthenticated Reddit API requests");
    }

    // Test if Reddit API is accessible at all (with authentication if available)
    console.log("Testing basic Reddit API accessibility...");
    try {
      const basicTestUrl =
        "https://oauth.reddit.com/r/popular/hot.json?limit=1";
      const basicTestResponse = await fetch(basicTestUrl, {
        method: "GET",
        headers,
      });

      if (basicTestResponse.ok) {
        console.log("✅ Reddit API is accessible - basic test successful");
      } else {
        console.warn(
          `⚠️ Reddit API basic test failed: ${basicTestResponse.status} ${basicTestResponse.statusText}`
        );
      }
    } catch (error) {
      console.error("❌ Reddit API basic test failed with error:", error);
    }

    // Search in each subreddit
    for (const subreddit of subreddits) {
      try {
        // First, let's test if we can get ANY posts from the subreddit
        const testUrl = `https://oauth.reddit.com/r/${subreddit}/hot.json?limit=5`;
        console.log(`Testing subreddit access with: ${testUrl}`);

        const testResponse = await fetch(testUrl, {
          method: "GET",
          headers,
        });

        if (testResponse.ok) {
          const testData = await testResponse.json();
          console.log(
            `Subreddit test successful - found ${
              testData.data?.children?.length || 0
            } hot posts`
          );
        } else {
          console.warn(`Subreddit test failed: ${testResponse.status}`);
        }

        // Use Reddit sort=top with time range parameter
        const redditApiUrl: string = `https://oauth.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(
          query
        )}&limit=100&sort=top&t=${timeRange}&restrict_sr=1`;

        console.log(
          `Searching r/${subreddit} sort=top t=${timeRange} for "${contestant}"`
        );

        const response: Response = await fetch(redditApiUrl, {
          method: "GET",
          headers,
        });

        if (!response.ok) {
          console.warn(
            `Failed to fetch from r/${subreddit}: ${response.status}`
          );
          continue; // Skip this subreddit and continue with others
        }

        const redditData: any = await response.json();

        // Debug: Log the full response structure
        console.log(`Reddit API response structure:`, {
          hasData: !!redditData.data,
          hasChildren: !!redditData.data?.children,
          childrenLength: redditData.data?.children?.length || 0,
          responseKeys: Object.keys(redditData),
          dataKeys: redditData.data ? Object.keys(redditData.data) : "no data",
        });

        // Debug: Log first few posts if they exist
        if (redditData.data?.children?.length > 0) {
          console.log(
            `First 3 posts found:`,
            redditData.data.children.slice(0, 3).map((child: any) => ({
              title: child.data.title,
              subreddit: child.data.subreddit,
              score: child.data.score,
              created: new Date(child.data.created_utc * 1000).toISOString(),
            }))
          );
        } else {
          console.log(`No posts found in Reddit response`);
        }

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

    // Cache the results for future requests
    if (topPosts.length > 0) {
      console.log("💾 Caching posts for future requests...");
      try {
        const cacheResponse = await fetch(
          `${req.url.split("/api/reddit")[0]}/api/database`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contestant,
              timeRange,
              posts: topPosts,
            }),
          }
        );

        if (cacheResponse.ok) {
          const cacheResult = await cacheResponse.json();
          console.log(
            `✅ Successfully cached ${cacheResult.cachedPosts} posts`
          );
        } else {
          console.warn("Failed to cache posts:", cacheResponse.status);
        }
      } catch (error) {
        console.warn("Cache storage failed:", error);
      }
    }

    return NextResponse.json({
      posts: topPosts,
      totalFound: allPosts.length,
      subredditsSearched: subreddits,
      cached: false,
    });
  } catch (error: any) {
    console.error("Error in Reddit API endpoint:", error);
    return NextResponse.json(
      { error: "Failed to fetch Reddit data" },
      { status: 500 }
    );
  }
}
