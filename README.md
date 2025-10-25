AI Research Collaboration Dashboard
🏁 Overview

Project Name: AI Research Collaboration Dashboard
Goal: Help researchers discover hot AI topics, visualize trends, and find collaborators through OpenAlex, Google Scholar, and Arxiv data.
Mission: Build an interactive dashboard that combines:

Word cloud of trending AI keywords

Graph of active authors and institutions

Filtered researcher list (with links to Google Scholar / Arxiv)

Chat assistant ("Mascot Rhett") that suggests trending topics & collaborators

🧩 Core Features
1. Home Page – Research Dashboard

Wordcloud: generated from OpenAlex topics and recent hot papers.

Trending Graph: display topic frequency or citation trend over time.

Data Source: OpenAlex API + Mock data (for offline mode).

2. People Page – Researcher & Collaborator Finder

Search / Filter researchers by:

Keyword or topic (e.g., “LLM”, “multimodal AI”)

Affiliation / Institution

Country / Year active

Display Cards:

Name → clickable link to Google Scholar or Arxiv

Affiliation

Research Interests (from OpenAlex)

Collaborator Graph: simple network showing connections or co-authors.

3. Chat Page – Mascot Rhett

User Input: interest or query about hot research topics

System Output:

Summarize current research trend (via OpenAI API)

Suggest top relevant researchers (via OpenAlex)

Optional: Generate a narrative (“narrate” function) explaining why those people are relevant

Tech: OpenAI API for chat, OpenAlex for data enrichment

⚙️ Tech Stack
Layer	Technology
Frontend	HTML + CSS + JavaScript (or React / Vite optional)
Visualization	Chart.js / D3.js / Plotly + Wordcloud.js
Backend	Python (FastAPI or Flask)
Database	None (fetch via OpenAlex API; mock JSON fallback)
API Integration	OpenAlex API, OpenAI API
Optional	Google Scholar / Arxiv scraping (Mock for demo)
📁 Project Structure
ai-research-dashboard/
│
├── frontend/
│   ├── index.html              # Home page (dashboard)
│   ├── people.html             # Researcher list & filter
│   ├── chat.html               # Chat with Mascot Rhett
│   ├── script.js               # Handles frontend logic
│   ├── styles.css              # Styling
│   ├── components/
│   │   ├── wordcloud.js
│   │   ├── chart.js
│   │   ├── researcherCard.js
│   │   └── chatBox.js
│   └── assets/
│       └── mascot.png
│
├── backend/
│   ├── app.py                  # FastAPI/Flask main server
│   ├── openalex_api.py         # Functions for querying OpenAlex
│   ├── openai_api.py           # OpenAI query + summarization
│   ├── mock_data.py            # fallback researcher/topic data
│   ├── utils/
│   │   └── wordcloud_generator.py
│   └── requirements.txt
│
├── data/
│   ├── mock_researchers.json
│   ├── mock_topics.json
│   └── openalex_sample.json
│
├── README.md                   # (this file)
└── .env.example                # API keys for OpenAI and OpenAlex

🔌 API Design
1. /api/wordcloud

GET → returns { "words": [{ "text": "LLM", "value": 120 }, ...] }

2. /api/trending

GET → returns { "topics": ["AI safety", "diffusion models"], "counts": [120, 98] }

3. /api/researchers

GET → parameters:

topic

institution

country
Returns: JSON list of researchers with name, link, and affiliations.

4. /api/chat

POST → { "query": "AI safety" }
Returns:

{
  "summary": "AI safety has grown rapidly in 2025...",
  "suggested_researchers": [
    { "name": "John Doe", "link": "https://scholar.google.com/...", "field": "AI alignment" }
  ]
}

🤖 Example Workflow

User visits Home Page → sees word cloud + trend graph

User clicks on “AI Safety” → navigates to People Page with filtered researchers

User goes to Chat Page, types “I’m interested in multimodal AI”

Mascot Rhett responds with:

“Hot topic: Video-Language models and reasoning”

“Suggested collaborators: Alice Zhang (Google Scholar), Mark Liu (Arxiv)”

“Would you like to visualize their network?”

🧠 Integration Notes

OpenAlex API endpoint: https://api.openalex.org/works?filter=concepts.id:<ID>

OpenAI Model: gpt-5 or gpt-4o-mini for narrative and suggestions

Mock Mode: If no API key, load local mock JSON instead

Frontend visualization: Use D3.js for graphs, WordCloud2.js for topic cloud

🐾 Mascot Rhett (Chat Assistant)

Personality: Friendly research helper.
Goal: Help users understand research trends and connect to people.
Example Output:

“Hey! Based on your interest in reinforcement learning, I found that the trend is moving toward large-scale agent coordination. You might want to connect with Dr. Li Wei (Stanford) or Prof. Smith (CMU).”

🚀 Future Add-ons

Add login + personal research notebook

Real-time collaboration via Firebase

Integration with Google Scholar API

Network visualization (co-author graph)

PDF summarization via OpenAI API

🧪 Mock Data Example

mock_researchers.json

[
  {
    "name": "Alice Zhang",
    "affiliation": "MIT CSAIL",
    "link": "https://scholar.google.com/citations?user=abc123",
    "topics": ["LLM", "NLP", "AI Safety"]
  },
  {
    "name": "Mark Liu",
    "affiliation": "Stanford AI Lab",
    "link": "https://arxiv.org/a/liu_m_1.html",
    "topics": ["Multimodal Learning", "Vision-Language Models"]
  }
]

💡 Prompt for Claude

Generate a full-stack web project based on this README.
Use Python (FastAPI) backend + HTML/JS frontend.
Integrate OpenAlex API for research data, OpenAI API for chat.
Include wordcloud, trend graph, researcher filter page, and mascot chat interface.
Create mock data for testing without keys.