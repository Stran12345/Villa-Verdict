# Setup Instructions

## Hugging Face API Key Setup

To use the more accurate Hugging Face NLP model for sentiment analysis, you need to set up an API key:

### 1. Get a Free API Key

1. Go to [Hugging Face](https://huggingface.co/settings/tokens)
2. Sign up for a free account if you don't have one
3. Click "New token" to create a new API key
4. Give it a name (e.g., "Sentiment Analysis")
5. Select "Read" permissions
6. Copy the generated token

### 2. Configure the API Key

1. Create a file called `.env.local` in the root directory of your project
2. Add the following line to the file:
   ```
   HUGGING_FACE_API_KEY=your_actual_api_key_here
   ```
3. Replace `your_actual_api_key_here` with the token you copied from Hugging Face

### 3. Restart the Development Server

After adding the API key, restart your development server:

```bash
npm run dev
```

## Model Information

The app uses the `cardiffnlp/twitter-roberta-base-sentiment` model, which is specifically trained for sentiment analysis and provides much more accurate results than simple keyword matching.

## Free Tier Limits

- Hugging Face offers a generous free tier
- The model is optimized for efficiency
- Perfect for personal projects and testing

## Troubleshooting

### "Not Found" Error (404)

If you see "Not Found" errors, try these steps:

1. **Check your API key**:

   - Make sure your API key is correctly set in `.env.local`
   - Ensure there are no extra spaces or characters
   - Try creating a new API key if the current one doesn't work

2. **Verify the .env.local file**:

   - The file should be in the root directory of your project
   - The format should be exactly: `HUGGING_FACE_API_KEY=your_key_here`
   - No quotes around the API key

3. **Restart the server**:

   - Stop the development server (Ctrl+C)
   - Run `npm run dev` again

4. **Check the console logs**:

   - The app now includes detailed logging
   - Check your terminal for debugging information
   - Look for "API Key present: true" in the logs

5. **Test your API key**:
   - Go to https://huggingface.co/settings/tokens
   - Verify your token is still active
   - Try creating a new token if needed

### Common Issues

- **Port already in use**: The app will automatically use port 3001 if 3000 is busy
- **Model loading**: The first request might take longer as the model loads
- **Rate limiting**: If you make too many requests, you might hit rate limits

### Getting Help

If you're still having issues:

1. Check the browser's developer console for errors
2. Look at the terminal output for detailed logs
3. Verify your API key works by testing it directly on Hugging Face
