# Villa Verdict

## Project Overview

**Villa Verdict** is designed to provide insights into public sentiment towards Love Island USA Season 7 contestants through real-time social media analysis. It offers both individual contestant analysis and side-by-side comparison modes, calculating sentiment based on Reddit posts and comments from the Love Island community.

The app allows users to compare contestants using interactive charts and generate detailed sentiment reports with visualizations.

## Features

### 1. Contestant Sentiment Analysis

- Retrieve and analyze Reddit posts mentioning specific Love Island USA contestants
- Generate sentiment analysis using Hugging Face's advanced NLP models
- View sentiment distribution through interactive pie charts and bar graphs
- Filter posts by time range (hour, day, week, month, year, all)

### 2. Contestant Comparison

- Compare up to two contestants simultaneously
- Side-by-side sentiment analysis with parallel charts
- Toggle between contestants' Reddit posts for detailed comparison
- Interactive data visualization with responsive charts

### 3. Responsive UI

- Mobile-friendly interface with responsive design
- Interactive contestant selection grid
- Real-time loading states and error handling
- Modern, clean interface with Tailwind CSS styling

### 4. Advanced Features

- Clickable logo for quick page refresh and reset
- Paginated post display with sentiment filtering
- Comprehensive error handling and fallback strategies
- Multiple search strategies for Reddit API integration

## Tech Stack

### Frontend

- **Next.js 15**: React framework for server-side rendering and API routes
- **TypeScript**: For type safety and better development experience
- **Tailwind CSS**: For responsive design and modern styling
- **Recharts**: For interactive data visualizations (bar charts, pie charts)

### Backend

- **Next.js API Routes**: For server-side logic and API endpoints
- **Hugging Face Transformers**: For advanced sentiment analysis using pre-trained NLP models

### Libraries and Tools

- **Reddit API**: For fetching posts and comments from r/LoveIslandUSA
- **Hugging Face Inference API**: For sentiment analysis using cardiffnlp/twitter-roberta-base-sentiment model
- **ESLint**: For code quality and consistency
- **Vercel**: For deployment and hosting

## Demo Link
- [https://villa-verdict.vercel.app/]
