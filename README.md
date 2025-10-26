# HiFive - AI Research Discovery Platform

## Overview

**Project Name:** HiFive
**Goal:** Help students and researchers discover personalized AI research topics, connect with relevant researchers, and explore projects through an interactive, AI-powered platform.

**Mission:** Guide users through a personalized journey of research discovery:
1. **Assess** research interests through RSTI (Research Style & Topic Inventory) test
2. **Discover** personalized topic recommendations based on assessment
3. **Explore** research areas, people, and projects
4. **Connect** through an AI chat assistant for deeper engagement

## User Journey

### 1. Landing Page – RSTI Test
- **RSTI (Research Style & Topic Inventory)** assessment to understand user interests
- Interactive questionnaire that evaluates research preferences and topic alignment
- Generates a personalized profile based on responses

### 2. Personalized Recommendations
- AI-powered topic recommendations based on RSTI test results
- Curated research areas tailored to user's interests and academic background
- Visual presentation of recommended research directions

### 3. Research Exploration Hub
Users can explore through multiple pages:

#### Research Page
- Overview of AI research topics and trends
- Interactive visualizations of hot topics
- Wordcloud and trending graphs

#### People Page
- Discover researchers and potential collaborators
- Filter by research interests, affiliation, and expertise
- View researcher profiles with publications and projects

#### Projects Page
- Browse current research projects
- See project details, team members, and research focus
- Visual cards showing project information and faculty involvement

#### Chat Page
- Interactive AI assistant for research questions
- Ask about specific topics, researchers, or projects
- Get personalized guidance based on your RSTI profile

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
│   ├── rsti.html               # Landing page - RSTI test
│   ├── lootbox.html            # Personalized recommendations page
│   ├── research.html           # Research topics and trends
│   ├── people.html             # Researcher discovery & profiles
│   ├── projects.html           # Research projects showcase
│   ├── chat.html               # AI chat assistant
│   ├── script.js               # Main frontend logic
│   ├── styles.css              # Global styling
│   └── assets/
│       ├── images/             # Project and researcher images
│       └── icons/              # UI icons
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

## Example Workflow

1. **User arrives at Landing Page** → Takes RSTI test by answering questions about research interests and style

2. **Completion of RSTI** → Receives personalized topic recommendations based on test results

3. **User explores Research Page** → Views trending AI topics, word clouds, and research trends

4. **User visits People Page** → Discovers researchers aligned with their interests, views profiles and expertise

5. **User browses Projects Page** → Explores current research projects and finds potential opportunities

6. **User engages with Chat Page** → Asks questions like "Tell me more about multimodal AI" or "Who is working on reinforcement learning?"
   - AI assistant responds with relevant information
   - Suggests specific researchers and projects
   - Provides personalized guidance based on RSTI profile

🧠 Integration Notes

OpenAlex API endpoint: https://api.openalex.org/works?filter=concepts.id:<ID>

OpenAI Model: gpt-5 or gpt-4o-mini for narrative and suggestions

Mock Mode: If no API key, load local mock JSON instead

Frontend visualization: Use D3.js for graphs, WordCloud2.js for topic cloud

## AI Chat Assistant

**Personality:** Friendly, knowledgeable research guide
**Goal:** Help users understand research trends, discover relevant researchers and projects, and provide personalized guidance based on RSTI profile

**Example Interactions:**

User: "What research areas match my interests?"
Assistant: "Based on your RSTI profile showing interest in applied AI and human-computer interaction, you might enjoy exploring projects in multimodal learning and AI accessibility. Check out Dr. Smith's work on the People page!"

User: "Tell me about reinforcement learning"
Assistant: "Reinforcement learning is trending toward large-scale agent coordination and real-world applications. I found several researchers and projects in this area - would you like me to suggest some?"

## Future Enhancements

- **User Profiles:** Save RSTI results and track exploration history
- **Advanced Matching:** ML-based researcher-project matching algorithm
- **Collaboration Features:** Direct messaging and connection requests
- **Enhanced Visualizations:** Interactive co-author networks and research topic maps
- **Integration Expansions:** Google Scholar API, Arxiv, and university research databases
- **PDF Analysis:** Automatic paper summarization and key insight extraction
- **Personalized Dashboard:** Custom feeds based on research interests and RSTI profile

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