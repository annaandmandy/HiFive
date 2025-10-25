# AI Research Collaboration Dashboard - Quick Start Guide

Welcome to the AI Research Collaboration Dashboard! This guide will help you get started quickly.

## Overview

This is a full-stack web application that helps researchers:
- Discover trending AI topics through interactive visualizations
- Find and filter AI researchers by topic, institution, or country
- Chat with Rhett, an AI assistant, for research suggestions

## Project Structure

```
HiFive/
├── frontend/           # HTML, CSS, JavaScript files
│   ├── index.html      # Home dashboard page
│   ├── people.html     # Researcher search page
│   ├── chat.html       # Chat with Rhett page
│   ├── script.js       # Main JavaScript logic
│   └── styles.css      # Styling
├── backend/            # Python FastAPI backend
│   ├── app.py          # Main API server
│   ├── openalex_api.py # OpenAlex integration
│   ├── openai_api.py   # OpenAI integration
│   └── mock_data.py    # Fallback mock data
├── data/               # Mock JSON data files
└── .env.example        # API key configuration template
```

## Quick Start

### Step 1: Install Python Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### Step 2: Configure API Keys (Optional)

The application works in **mock mode** by default without any API keys. To use real data:

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Add your API keys to `.env`:
   ```
   OPENAI_API_KEY=sk-your-actual-openai-key
   OPENALEX_EMAIL=your.email@example.com
   ```

### Step 3: Start the Backend Server

```bash
cd backend
python app.py
```

The API will start at `http://localhost:8000`

### Step 4: Open the Frontend

Open `frontend/index.html` in your web browser. You can either:

**Option A: Direct file access**
- Simply double-click `frontend/index.html`

**Option B: Use a local server (recommended)**
```bash
cd frontend
python -m http.server 8080
```
Then visit `http://localhost:8080` in your browser

## Features

### 1. Home Page (Dashboard)
- **Word Cloud**: Visual representation of trending AI topics
- **Trending Chart**: Bar chart showing research activity by topic
- **Quick Stats**: Overview of topics, researchers, and papers
- Click on any topic to filter researchers by that topic

### 2. Researchers Page
- **Search & Filter**: Find researchers by topic, institution, or country
- **Sort Options**: Sort by citations, name, or number of works
- **Researcher Cards**: View detailed profiles with links to Google Scholar/Arxiv

### 3. Chat Page (Mascot Rhett)
- **AI Assistant**: Chat about research interests
- **Trending Topics**: Get summaries of current research trends
- **Researcher Suggestions**: Receive personalized researcher recommendations
- **Suggestion Chips**: Quick-start queries for common topics

## API Endpoints

The backend provides these REST API endpoints:

- `GET /api/wordcloud` - Get trending topic word cloud data
- `GET /api/trending` - Get trending topics with counts
- `GET /api/researchers?topic=X&institution=Y&country=Z` - Search researchers
- `POST /api/chat` - Chat with Rhett AI assistant

## Mock vs Real Data

### Mock Mode (Default)
- Works immediately without any API keys
- Uses pre-populated data from `backend/mock_data.py`
- Great for testing and development

### Real Data Mode
- Requires OpenAI API key and optionally OpenAlex email
- Fetches live data from OpenAlex research database
- Uses OpenAI GPT-4o-mini for intelligent chat responses

## Troubleshooting

### Backend won't start
- Make sure you're in the `backend/` directory
- Verify Python dependencies are installed: `pip install -r requirements.txt`

### Word cloud not showing
- Check browser console for errors (F12)
- Ensure backend is running at `http://localhost:8000`
- Try refreshing the page

### Chat not working
- Without OpenAI API key: Uses simple fallback responses
- With API key: Verify the key is correct in `.env` file

### CORS errors
- Make sure backend is running
- Frontend should be served from `http://localhost:8080` or opened directly
- Check that API_BASE_URL in `script.js` matches your backend URL

## Technologies Used

### Frontend
- HTML5, CSS3, JavaScript (ES6+)
- Chart.js for bar charts
- WordCloud2.js for word cloud visualization
- Responsive design with CSS Grid and Flexbox

### Backend
- FastAPI - Modern Python web framework
- httpx - Async HTTP client
- OpenAlex API - Research data
- OpenAI API - Chat intelligence

## Next Steps

1. Explore the dashboard and click on trending topics
2. Try searching for researchers in your field
3. Chat with Rhett about AI research areas
4. (Optional) Add your API keys to use real-time data

## Need Help?

- Check the main README.md for detailed API documentation
- Review the code comments in each file
- The application logs errors to browser console (F12)

Enjoy exploring AI research trends!
