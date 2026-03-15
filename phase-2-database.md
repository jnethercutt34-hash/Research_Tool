 # Phase 2: Gemini API Vectorization & Storage

## Goal
Take the parsed text chunks, use the free Gemini API to generate numerical embeddings, and store them in a local vector database for instant semantic search.

## Tech Stack Requirements
* **Vector Database:** ChromaDB (Local, runs in-memory or saved to disk)
* **API SDK:** `google-genai` (The official Google SDK)
* **Embedding Model:** `text-embedding-004` (Free tier)

## Core Features to Implement
1. **API Setup:** Initialize the Gemini client using a `.env` file for the API key.
2. **Rate-Limit Manager (CRITICAL):** The Gemini free tier has a strict limit of 10-15 Requests Per Minute (RPM). You MUST implement an exponential backoff and a strict `time.sleep()` queue. The script should process a handful of chunks, pause, and resume, ensuring it never exceeds 10 API calls per minute.
3. **Embedding Pipeline:** Read the JSON from Phase 1, send the text to the Gemini embedding model, and retrieve the vectors. 
4. **Storage:** Save the embedding vector, along with its metadata (filename, page number, raw text), into a local ChromaDB collection.