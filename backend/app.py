from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import json
import os
from openalex_api import get_trending_topics, search_researchers
from openai_api import chat_with_rhett
from mock_data import get_mock_wordcloud, get_mock_trending, get_mock_researchers
from callopenalex import OpenAlexAPI
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
app = FastAPI(title="AI Research Collaboration Dashboard")
openalex = OpenAlexAPI(email="carrieff@bu.edu")

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

# -------------------------
# Request/Response Models
# -------------------------
class ChatRequest(BaseModel):
    query: str
    user_background: Optional[str] = None  # e.g., "data science student", "PhD in robotics"

# -------------------------
# Helper: Extract Authors from Works
# -------------------------
def extract_authors_from_works(works_response: dict, max_authors: int = 3) -> list:
    """
    Extract unique authors from works response.
    Returns list of author info dicts with name, affiliation, works_count, etc.
    """
    authors_dict = {}  # Use dict to track unique authors by ID

    if "results" not in works_response:
        return []

    for work in works_response["results"]:
        authorships = work.get("authorships", [])

        for authorship in authorships:
            author = authorship.get("author")
            if not author:
                continue

            author_id = author.get("id")
            if not author_id or author_id in authors_dict:
                continue  # Skip if no ID or already added

            # Get institution info
            institutions = authorship.get("institutions", [])
            affiliation = "N/A"
            if institutions and len(institutions) > 0:
                affiliation = institutions[0].get("display_name", "N/A")

            # Extract field from author data if available
            field = "AI Research"  # default

            authors_dict[author_id] = {
                "name": author.get("display_name", "Unknown"),
                "link": author_id,
                "affiliation": affiliation,
                "field": field,
                "works_count": None,  # Not available from work authorship
                "cited_by_count": None  # Not available from work authorship
            }

            # Stop if we have enough unique authors
            if len(authors_dict) >= max_authors:
                break

        if len(authors_dict) >= max_authors:
            break

    return list(authors_dict.values())[:max_authors]

# -------------------------
# Helper: Chat with Rhett (OpenAI)
# -------------------------
async def chat_with_rhett(query: str, researcher_suggestions: str) -> dict:
    """
    Use OpenAI to generate narrative + explanation based on topic and researchers.
    """
    prompt = f"""
You are Mascot Rhett, an AI research assistant helping students discover relevant research and collaborators.

User's interest: {query}
Suggested researchers and papers:
{researcher_suggestions}

Write a concise, encouraging response (3-5 sentences)
explaining what research trend this belongs to and why these researchers/papers are relevant.
    """

    try:
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

        response = client.responses.create(
            model="gpt-4o-mini",   # or "gpt-5" if you have access
            input=[
                {"role": "system", "content": "You are a helpful AI research assistant named Rhett."},
                {"role": "user", "content": prompt},
            ],
            tools=[{"type": "web_search"}],   # enable live research lookup
        )

        # ✅ The new Responses API stores text in response.output
        summary = response.output[0].content[0].text.strip()
        return summary

    except Exception as e:
        print(f"[OpenAI Error] {e}")
        return "This is an exciting and fast-growing area of AI research with many active contributors."

# -------------------------
# MAIN ENDPOINT
# -------------------------
@app.post("/api/chat")
async def chat(request: ChatRequest):
    """
    Chat with Mascot Rhett — get research topic summary and recommended researchers/papers.
    """
    try:
        # Step 1: Use OpenAlex to fetch related works & authors
        topic = request.query

        # Get top papers in the last 3 years
        works = openalex.search_works(
            query=topic,
            publication_year="2022-2025",
            sort="cited_by_count:desc",
            per_page=3
        )

        # Format paper results
        paper_info = []
        if "results" in works:
            for w in works["results"]:
                paper_info.append({
                    "title": w.get("title"),
                    "year": w.get("publication_year"),
                    "citations": w.get("cited_by_count"),
                    "link": w.get("id")
                })

        # Extract authors from the works we found (NEW APPROACH)
        researcher_info = extract_authors_from_works(works, max_authors=3)

        # Debug: Print what we're sending to frontend
        print(f"[DEBUG] Researcher info being sent: {researcher_info}")

        # Step 2: Prepare context summary for OpenAI
        researcher_suggestions = "\n".join(
            [f"- {r['name']} ({r['affiliation']})" for r in researcher_info]
        )
        paper_suggestions = "\n".join(
            [f"- {p['title']} ({p['year']})" for p in paper_info]
        )

        # Step 3: Generate AI summary using OpenAI
        summary = await chat_with_rhett(topic, researcher_suggestions + "\n" + paper_suggestions)

        # At the end of /api/chat endpoint, before return:
        if not researcher_info and not paper_info:
            # fallback to trending works
            trending = openalex.get_trending_works(days=7, per_page=3)
            for w in trending.get("results", []):
                paper_info.append({
                    "title": w.get("title"),
                    "year": w.get("publication_year"),
                    "citations": w.get("cited_by_count"),
                    "link": w.get("id")
                })

        
        # Step 4: Return structured JSON
        return {
            "summary": summary,
            "suggested_researchers": researcher_info,
            "suggested_papers": paper_info
        }

    except Exception as e:
        print(f"Error with chat API: {e}")
        # graceful fallback
        return {
            "summary": f"Based on your interest in '{request.query}', this field is growing rapidly with numerous breakthroughs in AI applications.",
            "suggested_researchers": [
                {
                    "name": "Dr. Alice Zhang",
                    "link": "https://scholar.google.com/citations?user=example1",
                    "affiliation": "MIT CSAIL"
                },
                {
                    "name": "Prof. Mark Liu",
                    "link": "https://scholar.google.com/citations?user=example2",
                    "affiliation": "Stanford AI Lab"
                }
            ],
            "suggested_papers": []
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
