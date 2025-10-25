import httpx
from typing import Optional, List, Dict
import os
from datetime import datetime, timedelta

OPENALEX_API_BASE = "https://api.openalex.org"
EMAIL = os.getenv("OPENALEX_EMAIL", "")  # Polite pool access

async def get_trending_topics(mode="wordcloud", days=30):
    """
    Fetch trending AI topics from OpenAlex
    mode: 'wordcloud' returns word/value pairs, 'counts' returns topics/counts
    """
    try:
        # Calculate date filter for recent papers
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)

        # Query recent AI-related works
        params = {
            "filter": f"concepts.id:C154945302,from_publication_date:{start_date.strftime('%Y-%m-%d')}",
            "per_page": 200,
            "mailto": EMAIL
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{OPENALEX_API_BASE}/works", params=params)

            if response.status_code != 200:
                return None

            data = response.json()

            # Extract and count concepts/topics
            topic_counts = {}
            for work in data.get("results", []):
                for concept in work.get("concepts", []):
                    name = concept.get("display_name", "")
                    if name and concept.get("level", 0) >= 2:  # Filter out very broad concepts
                        topic_counts[name] = topic_counts.get(name, 0) + 1

            # Sort by frequency
            sorted_topics = sorted(topic_counts.items(), key=lambda x: x[1], reverse=True)[:30]

            if mode == "wordcloud":
                return [{"text": topic, "value": count} for topic, count in sorted_topics]
            else:
                return {
                    "topics": [topic for topic, _ in sorted_topics],
                    "counts": [count for _, count in sorted_topics]
                }
    except Exception as e:
        print(f"OpenAlex API error: {e}")
        return None

async def search_researchers(
    topic: Optional[str] = None,
    institution: Optional[str] = None,
    country: Optional[str] = None,
    limit: int = 50
) -> Optional[List[Dict]]:
    """
    Search for researchers using OpenAlex Authors API
    """
    try:
        filters = []

        # Build filters
        if topic:
            # Search for authors working on this topic
            filters.append(f"concepts.id:C154945302")  # AI concept

        if institution:
            filters.append(f"last_known_institution.display_name.search:{institution}")

        if country:
            filters.append(f"last_known_institution.country_code:{country.upper()}")

        params = {
            "filter": ",".join(filters) if filters else "concepts.id:C154945302",
            "per_page": limit,
            "mailto": EMAIL,
            "sort": "cited_by_count:desc"
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{OPENALEX_API_BASE}/authors", params=params)

            if response.status_code != 200:
                return None

            data = response.json()
            researchers = []

            for author in data.get("results", []):
                # Extract topics/concepts
                topics = [c.get("display_name") for c in author.get("x_concepts", [])[:5]]

                # Get institution info
                institution_info = author.get("last_known_institution") or {}
                affiliation = institution_info.get("display_name", "Unknown")
                country_code = institution_info.get("country_code", "")

                researchers.append({
                    "name": author.get("display_name", "Unknown"),
                    "affiliation": affiliation,
                    "country": country_code,
                    "link": author.get("orcid") or f"https://scholar.google.com/scholar?q={author.get('display_name', '').replace(' ', '+')}",
                    "topics": topics,
                    "citations": author.get("cited_by_count", 0),
                    "works_count": author.get("works_count", 0)
                })

            return researchers
    except Exception as e:
        print(f"OpenAlex researcher search error: {e}")
        return None
