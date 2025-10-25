import os
from typing import Dict
import httpx

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_API_BASE = "https://api.openai.com/v1"

async def chat_with_rhett(query: str) -> Dict:
    """
    Use OpenAI to generate research suggestions and summaries
    """
    if not OPENAI_API_KEY:
        raise Exception("OpenAI API key not configured")

    try:
        # Create prompt for Mascot Rhett
        system_prompt = """You are Rhett, a friendly AI research assistant.
        Your goal is to help researchers understand trending topics and find collaborators.
        Provide helpful, encouraging responses about AI research trends.
        Keep responses concise and actionable."""

        user_prompt = f"""Based on the user's interest in "{query}", provide:
        1. A brief summary of current research trends in this area (2-3 sentences)
        2. Suggest 2-3 relevant research directions or sub-topics

        Format your response naturally and enthusiastically."""

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{OPENAI_API_BASE}/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "gpt-4o-mini",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    "temperature": 0.7,
                    "max_tokens": 500
                }
            )

            if response.status_code != 200:
                raise Exception(f"OpenAI API error: {response.status_code}")

            data = response.json()
            summary = data["choices"][0]["message"]["content"]

            # Try to get suggested researchers from OpenAlex
            from openalex_api import search_researchers
            researchers = await search_researchers(topic=query, limit=3)

            suggested = []
            if researchers:
                suggested = [
                    {
                        "name": r["name"],
                        "link": r["link"],
                        "field": query,
                        "affiliation": r.get("affiliation", "")
                    }
                    for r in researchers[:3]
                ]

            return {
                "summary": summary,
                "suggested_researchers": suggested
            }

    except Exception as e:
        print(f"OpenAI API error: {e}")
        raise
