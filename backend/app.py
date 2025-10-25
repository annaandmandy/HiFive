from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import json
import os
from openalex_api import get_trending_topics, search_researchers
from openai_api import chat_with_rhett
from mock_data import get_mock_wordcloud, get_mock_trending, get_mock_researchers

app = FastAPI(title="AI Research Collaboration Dashboard")

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    query: str

@app.get("/")
async def root():
    return {"message": "AI Research Collaboration Dashboard API"}

@app.get("/api/wordcloud")
async def get_wordcloud():
    """
    Returns word cloud data with trending AI keywords
    """
    try:
        # Try to get real data from OpenAlex
        data = await get_trending_topics()
        if data:
            return {"words": data}
    except Exception as e:
        print(f"Error fetching from OpenAlex: {e}")

    # Fallback to mock data
    return {"words": get_mock_wordcloud()}

@app.get("/api/trending")
async def get_trending():
    """
    Returns trending topics with their counts
    """
    try:
        # Try to get real data from OpenAlex
        data = await get_trending_topics(mode="counts")
        if data:
            return data
    except Exception as e:
        print(f"Error fetching trending data: {e}")

    # Fallback to mock data
    return get_mock_trending()

@app.get("/api/researchers")
async def get_researchers(
    topic: Optional[str] = None,
    institution: Optional[str] = None,
    country: Optional[str] = None
):
    """
    Search and filter researchers
    """
    try:
        # Try to get real data from OpenAlex
        data = await search_researchers(topic=topic, institution=institution, country=country)
        if data:
            return {"researchers": data}
    except Exception as e:
        print(f"Error searching researchers: {e}")

    # Fallback to mock data with client-side filtering
    mock_researchers = get_mock_researchers()

    # Filter mock data
    filtered = mock_researchers
    if topic:
        filtered = [r for r in filtered if any(topic.lower() in t.lower() for t in r.get("topics", []))]
    if institution:
        filtered = [r for r in filtered if institution.lower() in r.get("affiliation", "").lower()]
    if country:
        filtered = [r for r in filtered if country.lower() in r.get("country", "").lower()]

    return {"researchers": filtered}

@app.post("/api/chat")
async def chat(request: ChatRequest):
    """
    Chat with Mascot Rhett - get AI research suggestions
    """
    try:
        # Try to use OpenAI API
        response = await chat_with_rhett(request.query)
        return response
    except Exception as e:
        print(f"Error with chat API: {e}")

        # Fallback to simple response
        return {
            "summary": f"Based on your interest in '{request.query}', this is an exciting and rapidly evolving field in AI research. The community is actively working on novel approaches and applications.",
            "suggested_researchers": [
                {
                    "name": "Dr. Alice Zhang",
                    "link": "https://scholar.google.com/citations?user=example1",
                    "field": request.query
                },
                {
                    "name": "Prof. Mark Liu",
                    "link": "https://scholar.google.com/citations?user=example2",
                    "field": request.query
                }
            ]
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
