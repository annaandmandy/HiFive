from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import json
import os
from openalex_api import get_trending_topics, search_researchers
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
    Search and filter researchers using real OpenAlex data
    """
    try:
        print(f"[API] Searching researchers - topic: {topic}, institution: {institution}, country: {country}")

        # Get real data from OpenAlex
        data = await search_researchers(topic=topic, institution=institution, country=country)

        if data:
            print(f"[API] Found {len(data)} researchers from OpenAlex")
            return {"researchers": data}
        else:
            print("[API] No data returned from OpenAlex, using fallback")
    except Exception as e:
        print(f"[API] Error searching researchers: {e}")
        import traceback
        traceback.print_exc()

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

    print(f"[API] Returning {len(filtered)} mock researchers as fallback")
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
You are Mascot Rhett, Boston University's terrier mascot turned AI research guide.
Your voice is playful, curious, and supportive—think wagging tail energy, clever canine metaphors, and light BU references.

User's interest: {query}
Suggested researchers and papers:
{researcher_suggestions}

Compose 3-5 sentences that:
1. Identify the broader research trend or opportunity.
2. Highlight why the listed researchers or papers are exciting leads.
3. Include at least one spirited Rhett-style flourish (e.g., tail wags, sniffing out insights, Terrier tenacity).
Stay encouraging and action-oriented while keeping things academically accurate.
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
        return (
            "Whoops—my Terrier nose hit a snag fetching OpenAI just now. "
            "Still, this topic is buzzing harder than a BU dining hall at lunchtime, "
            "so take a look at the researchers on the right while I reset my tail wag."
        )

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
            publication_year="2024-2025",
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

# -------------------------
# RSTI PhD ADVISOR ENDPOINT
# -------------------------
class RSTIAdvisorRequest(BaseModel):
    rsti_type: str
    major: Optional[str] = None
    conversation_history: List[dict] = []
    choice: Optional[str] = None  # "1" or "2" for binary choice

@app.post("/api/rsti-advisor")
async def rsti_advisor(request: RSTIAdvisorRequest):
    """
    RSTI-based PhD advisor that asks binary questions to guide research direction.
    """
    try:
        client = OpenAI(api_key=OPENAI_API_KEY)

        # Initialize conversation if this is the first call
        if not request.conversation_history:
            major = request.major or "your field"
            messages = [
                {
                    "role": "system",
                    "content": (
                        "You are Mascot Rhett, Boston University's terrier mascot turned AI research guide. "
                        "Your voice is playful, curious, and supportive—think wagging tail energy, clever canine metaphors, and light BU references. "
                        "You are acting like an academic advisor helping a student choose a PhD research direction "
                        "through a maximum of 3 binary (1/2) choices. "
                        "Each round, ask a short question (<=3 lines) with exactly two numbered options. "
                        "At the end, summarize the most suitable PhD field in 3–5 sentences, "
                        "explicitly combining the student's academic background and their previous choices. "
                        "When you provide the final recommendation, start with '🎯 Final Recommendation:' and provide exactly 3 specific research topics/areas."
                    ),
                },
                {"role": "user", "content": f"My academic background is {major} and my RSTI type is {request.rsti_type}. Let's begin."},
            ]
        else:
            # Continue existing conversation
            messages = request.conversation_history.copy()

            # Add user's choice if provided
            if request.choice:
                messages.append({"role": "user", "content": f"I choose option {request.choice}."})

        # Get response from OpenAI
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.7,
        )

        reply = response.choices[0].message.content.strip()

        # Add assistant's reply to messages
        messages.append({"role": "assistant", "content": reply})

        # Check if this is the final recommendation
        is_final = "🎯" in reply or ("Final" in reply and "Recommendation" in reply)

        # Extract recommended topics if final
        recommended_topics = []
        if is_final:
            # Try to extract 3 topics from the response
            # This is a simple extraction - you might want to improve this
            lines = reply.split('\n')
            for line in lines:
                line = line.strip()
                if line and (line[0].isdigit() or line.startswith('-') or line.startswith('•')):
                    # Remove numbering/bullets
                    topic = line.lstrip('0123456789.-•) ').strip()
                    if topic and len(recommended_topics) < 3:
                        recommended_topics.append(topic)

        return {
            "reply": reply,
            "conversation_history": messages,
            "is_final": is_final,
            "recommended_topics": recommended_topics if is_final else []
        }

    except Exception as e:
        print(f"Error in RSTI advisor: {e}")
        return {
            "reply": "Woof! My tail got tangled for a moment. Let me help you explore research directions in AI and machine learning!",
            "conversation_history": request.conversation_history,
            "is_final": False,
            "recommended_topics": []
        }

# -------------------------
# LOOT BOX ENDPOINT
# -------------------------
@app.get("/api/lootbox")
async def get_lootbox():
    """
    Returns 5 random research papers with rarity classifications:
    - SSR (Super Super Rare): 5000+ citations
    - SR (Super Rare): 1000-5000 citations
    - R (Rare): 200-1000 citations
    - N (Normal): <200 citations
    """
    try:
        import random

        # Get random AI papers from the last 5 years
        current_year = 2025
        random_year_range = f"{current_year - 5}-{current_year}"

        # Fetch 20 papers to randomize from
        works = openalex.search_works(
            query="artificial intelligence OR machine learning OR deep learning",
            publication_year=random_year_range,
            sort="cited_by_count:desc",
            per_page=20
        )

        if "results" not in works or not works["results"]:
            raise Exception("No works found")

        # Randomly select 5 papers
        all_papers = works["results"]
        selected_papers = random.sample(all_papers, min(5, len(all_papers)))

        # Classify papers by rarity based on citations
        capsules = []
        for paper in selected_papers:
            citations = paper.get("cited_by_count", 0)

            # Determine rarity
            if citations >= 5000:
                rarity = "SSR"
                rarity_label = "Legendary"
            elif citations >= 1000:
                rarity = "SR"
                rarity_label = "Epic"
            elif citations >= 200:
                rarity = "R"
                rarity_label = "Rare"
            else:
                rarity = "N"
                rarity_label = "Common"

            # Get authors
            authors = []
            for authorship in paper.get("authorships", [])[:3]:
                author = authorship.get("author", {})
                if author.get("display_name"):
                    authors.append(author.get("display_name"))

            # Get concepts/topics
            concepts = []
            for concept in paper.get("concepts", [])[:3]:
                if concept.get("display_name"):
                    concepts.append(concept.get("display_name"))

            capsules.append({
                "title": paper.get("title", "Unknown Title"),
                "year": paper.get("publication_year", "N/A"),
                "citations": citations,
                "link": paper.get("id", ""),
                "rarity": rarity,
                "rarity_label": rarity_label,
                "authors": authors,
                "concepts": concepts,
                "abstract": paper.get("abstract_inverted_index", None)
            })

        return {"capsules": capsules}

    except Exception as e:
        print(f"Error fetching loot box: {e}")
        # Fallback to mock capsules
        import random

        mock_capsules = [
            {
                "title": "Attention Is All You Need",
                "year": 2017,
                "citations": 98234,
                "link": "https://openalex.org/W2964315648",
                "rarity": "SSR",
                "rarity_label": "Legendary",
                "authors": ["Ashish Vaswani", "Noam Shazeer", "Niki Parmar"],
                "concepts": ["Transformer", "Neural Network", "Natural Language Processing"]
            },
            {
                "title": "BERT: Pre-training of Deep Bidirectional Transformers",
                "year": 2019,
                "citations": 67543,
                "link": "https://openalex.org/W2964315649",
                "rarity": "SSR",
                "rarity_label": "Legendary",
                "authors": ["Jacob Devlin", "Ming-Wei Chang", "Kenton Lee"],
                "concepts": ["BERT", "Language Model", "NLP"]
            },
            {
                "title": "Deep Residual Learning for Image Recognition",
                "year": 2016,
                "citations": 154234,
                "link": "https://openalex.org/W2964315650",
                "rarity": "SSR",
                "rarity_label": "Legendary",
                "authors": ["Kaiming He", "Xiangyu Zhang", "Shaoqing Ren"],
                "concepts": ["Computer Vision", "ResNet", "Deep Learning"]
            },
            {
                "title": "Generative Adversarial Networks",
                "year": 2014,
                "citations": 45678,
                "link": "https://openalex.org/W2964315651",
                "rarity": "SSR",
                "rarity_label": "Legendary",
                "authors": ["Ian Goodfellow", "Jean Pouget-Abadie", "Mehdi Mirza"],
                "concepts": ["GAN", "Generative Model", "Deep Learning"]
            },
            {
                "title": "Adam: A Method for Stochastic Optimization",
                "year": 2015,
                "citations": 123456,
                "link": "https://openalex.org/W2964315652",
                "rarity": "SSR",
                "rarity_label": "Legendary",
                "authors": ["Diederik P. Kingma", "Jimmy Ba"],
                "concepts": ["Optimization", "Machine Learning", "Gradient Descent"]
            },
            {
                "title": "Neural Architecture Search with Reinforcement Learning",
                "year": 2017,
                "citations": 876,
                "link": "https://openalex.org/W2964315653",
                "rarity": "SR",
                "rarity_label": "Epic",
                "authors": ["Barret Zoph", "Quoc V. Le"],
                "concepts": ["AutoML", "Neural Architecture Search", "Reinforcement Learning"]
            },
            {
                "title": "EfficientNet: Rethinking Model Scaling",
                "year": 2019,
                "citations": 543,
                "link": "https://openalex.org/W2964315654",
                "rarity": "SR",
                "rarity_label": "Epic",
                "authors": ["Mingxing Tan", "Quoc V. Le"],
                "concepts": ["Computer Vision", "Model Scaling", "Neural Networks"]
            },
            {
                "title": "Graph Neural Networks: A Review",
                "year": 2020,
                "citations": 234,
                "link": "https://openalex.org/W2964315655",
                "rarity": "R",
                "rarity_label": "Rare",
                "authors": ["Jie Zhou", "Ganqu Cui", "Zhengyan Zhang"],
                "concepts": ["Graph Neural Networks", "Deep Learning", "Graph Theory"]
            },
            {
                "title": "Self-Supervised Learning in Computer Vision",
                "year": 2021,
                "citations": 187,
                "link": "https://openalex.org/W2964315656",
                "rarity": "R",
                "rarity_label": "Rare",
                "authors": ["Alexey Dosovitskiy", "Lucas Beyer", "Alexander Kolesnikov"],
                "concepts": ["Self-Supervised Learning", "Computer Vision", "Representation Learning"]
            },
            {
                "title": "Few-Shot Learning with Meta-Learning",
                "year": 2022,
                "citations": 45,
                "link": "https://openalex.org/W2964315657",
                "rarity": "N",
                "rarity_label": "Common",
                "authors": ["Chelsea Finn", "Pieter Abbeel", "Sergey Levine"],
                "concepts": ["Few-Shot Learning", "Meta-Learning", "Transfer Learning"]
            }
        ]

        return {"capsules": random.sample(mock_capsules, 5)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
