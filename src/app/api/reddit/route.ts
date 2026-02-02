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

// Function to detect API blocking and rate limiting
function analyzeRedditResponse(response: Response, url: string): {
  isBlocked: boolean;
  isRateLimited: boolean;
  errorType: string;
  message: string;
} {
  const status = response.status;
  const statusText = response.statusText;
  
  // Check for common blocking scenarios
  if (status === 429) {
    return {
      isBlocked: false,
      isRateLimited: true,
      errorType: "RATE_LIMIT",
      message: `Reddit API rate limited (429) - Too many requests. Please wait before trying again.`
    };
  }
  
  if (status === 403) {
    return {
      isBlocked: true,
      isRateLimited: false,
      errorType: "FORBIDDEN",
      message: `Reddit API blocked request (403) - Access forbidden. This could be due to User-Agent restrictions or IP blocking.`
    };
  }
  
  if (status === 503 || status === 502) {
    return {
      isBlocked: false,
      isRateLimited: false,
      errorType: "SERVICE_UNAVAILABLE",
      message: `Reddit API service unavailable (${status}) - Reddit servers may be experiencing issues.`
    };
  }
  
  if (status >= 500) {
    return {
      isBlocked: false,
      isRateLimited: false,
      errorType: "SERVER_ERROR",
      message: `Reddit API server error (${status}) - Internal server error on Reddit's side.`
    };
  }
  
  if (status >= 400) {
    return {
      isBlocked: false,
      isRateLimited: false,
      errorType: "CLIENT_ERROR",
      message: `Reddit API client error (${status}) - Bad request or authentication issue.`
    };
  }
  
  return {
    isBlocked: false,
    isRateLimited: false,
    errorType: "UNKNOWN",
    message: `Reddit API returned status ${status} - ${statusText}`
  };
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
        const analysis = analyzeRedditResponse(basicTestResponse, basicTestUrl);
        console.warn(`⚠️ Reddit API basic test failed:`, analysis);
        
        if (analysis.isBlocked || analysis.isRateLimited) {
          return NextResponse.json(
            { 
              error: analysis.message,
              errorType: analysis.errorType,
              posts: [],
              totalFound: 0,
              subredditsSearched: subreddits,
              cached: false,
            },
            { status: 429 }
          );
        }
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
          const analysis = analyzeRedditResponse(testResponse, testUrl);
          console.warn(`Subreddit test failed:`, analysis);
          
          if (analysis.isBlocked || analysis.isRateLimited) {
            console.error(`🚫 Reddit API is blocking requests to r/${subreddit}:`, analysis.message);
            continue; // Skip this subreddit
          }
        }

        // Try multiple search strategies
        const searchStrategies = [
          {
            name: "Top posts with time filter",
            url: `https://oauth.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(
              query
            )}&limit=100&sort=top&t=${timeRange}&restrict_sr=1`,
          },
          {
            name: "New posts (broader search)",
            url: `https://oauth.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(
              query
            )}&limit=100&sort=new&restrict_sr=1`,
          },
          {
            name: "Relevance search (no time filter)",
            url: `https://oauth.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(
              query
            )}&limit=100&sort=relevance&restrict_sr=1`,
          },
          {
            name: "Comments search",
            url: `https://oauth.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(
              query
            )}&limit=100&sort=top&t=year&restrict_sr=1&include_over_18=on`,
          },
        ];

        let subredditPosts: any[] = [];
        let searchSuccessful = false;

        for (const strategy of searchStrategies) {
          if (searchSuccessful) break; // Stop if we found posts

          console.log(`Trying search strategy: ${strategy.name}`);
          console.log(`URL: ${strategy.url}`);

          try {
            const response: Response = await fetch(strategy.url, {
              method: "GET",
              headers,
            });

            if (!response.ok) {
              const analysis = analyzeRedditResponse(response, strategy.url);
              console.warn(`Strategy "${strategy.name}" failed:`, analysis);
              
              if (analysis.isBlocked) {
                console.error(`🚫 Reddit API is blocking search requests:`, analysis.message);
                console.error(`💡 Solutions:`);
                console.error(`   - Add Reddit API credentials (REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET)`);
                console.error(`   - Use a different User-Agent string`);
                console.error(`   - Implement request delays between calls`);
                console.error(`   - Consider using Reddit's JSON endpoints instead of API`);
                break; // Stop trying other strategies if blocked
              }
              
              if (analysis.isRateLimited) {
                console.error(`⏰ Reddit API rate limited:`, analysis.message);
                console.error(`💡 Solutions:`);
                console.error(`   - Implement exponential backoff`);
                console.error(`   - Add delays between requests`);
                console.error(`   - Use authenticated requests with proper rate limiting`);
                break; // Stop trying other strategies if rate limited
              }
              
              continue; // Try next strategy
            }

            const redditData: any = await response.json();

            // Debug: Log the full response structure
            console.log(`Reddit API response structure for ${strategy.name}:`, {
              hasData: !!redditData.data,
              hasChildren: !!redditData.data?.children,
              childrenLength: redditData.data?.children?.length || 0,
              responseKeys: Object.keys(redditData),
              dataKeys: redditData.data ? Object.keys(redditData.data) : "no data",
            });

            // Debug: Log first few posts if they exist
            if (redditData.data?.children?.length > 0) {
              console.log(
                `First 3 posts found with ${strategy.name}:`,
                redditData.data.children.slice(0, 3).map((child: any) => ({
                  title: child.data.title,
                  subreddit: child.data.subreddit,
                  score: child.data.score,
                  created: new Date(child.data.created_utc * 1000).toISOString(),
                }))
              );
            } else {
              console.log(`No posts found with ${strategy.name} for "${contestant}"`);
              continue; // Try next strategy
            }

            const strategyPosts = redditData.data.children
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

            if (strategyPosts.length > 0) {
              console.log(`✅ Strategy "${strategy.name}" found ${strategyPosts.length} posts`);
              subredditPosts = strategyPosts;
              searchSuccessful = true;
              break; // Stop trying other strategies
            } else {
              console.log(`❌ Strategy "${strategy.name}" found no posts`);
            }

            // Add a small delay between strategies to be respectful
            await new Promise(resolve => setTimeout(resolve, 1000));

          } catch (error: any) {
            console.error(`Error with strategy "${strategy.name}":`, error);
            console.error(`💡 Network error - possible causes:`);
            console.error(`   - Internet connectivity issues`);
            console.error(`   - Reddit servers down`);
            console.error(`   - DNS resolution problems`);
            continue; // Try next strategy
          }
        }

        if (!searchSuccessful) {
          console.log(`💡 All search strategies failed for r/${subreddit}`);
          console.log(`💡 Possible reasons:`);
          console.log(`   - No posts mention "${contestant}" in r/${subreddit}`);
          console.log(`   - Contestant name might be spelled differently`);
          console.log(`   - Reddit search might be filtering results`);
          console.log(`   - API restrictions or rate limiting`);
        }

        allPosts = allPosts.concat(subredditPosts);
        console.log(
          `Found ${subredditPosts.length} unique posts in r/${subreddit}`
        );
      } catch (error: any) {
        console.error(`Error fetching from r/${subreddit}:`, error);
        console.error(`💡 Network error - possible causes:`);
        console.error(`   - Internet connectivity issues`);
        console.error(`   - Reddit servers down`);
        console.error(`   - DNS resolution problems`);
        continue; // Continue with other subreddits
      }
    }

    // Sort posts by score (upvotes) to get the most relevant ones first
    allPosts.sort((a, b) => b.score - a.score);

    // Limit to top 25 posts total
    const topPosts = allPosts.slice(0, 25);

    console.log(
      `Total unique posts found: ${allPosts.length}, returning top ${topPosts.length}`
    );

    if (allPosts.length === 0) {
      console.warn(`⚠️ No posts found for "${contestant}" in any subreddit`);
      console.warn(`💡 Suggestions:`);
      console.warn(`   - Try a different time range (e.g., "year" instead of "month")`);
      console.warn(`   - Check if the contestant name is spelled correctly`);
      console.warn(`   - Consider searching in broader subreddits`);
      console.warn(`   - Reddit search might be limited due to API restrictions`);
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
