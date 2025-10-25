// API Configuration
const API_BASE_URL = 'http://localhost:8000';

// Utility function to fetch from API
async function fetchAPI(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// ===== HOME PAGE (Dashboard) =====
export async function initDashboard() {
    console.log('Initializing dashboard...');
    await loadWordCloud();
    await loadTrendingChart();
    updateStats();
}

async function loadWordCloud() {
    const container = document.getElementById('wordcloud-container');
    const loading = document.getElementById('wordcloud-loading');
    const canvas = document.getElementById('wordcloud');

    try {
        loading.style.display = 'block';
        const data = await fetchAPI('/api/wordcloud');

        if (data && data.words && data.words.length > 0) {
            loading.style.display = 'none';
            container.style.display = 'block';

            // Convert to WordCloud2 format
            const wordList = data.words.map(w => [w.text, w.value]);

            // Initialize word cloud
            WordCloud(canvas, {
                list: wordList,
                gridSize: 8,
                weightFactor: 3,
                fontFamily: 'Arial, sans-serif',
                color: function() {
                    const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b'];
                    return colors[Math.floor(Math.random() * colors.length)];
                },
                rotateRatio: 0.3,
                backgroundColor: '#ffffff',
                click: function(item) {
                    // Navigate to people page with topic filter
                    window.location.href = `people.html?topic=${encodeURIComponent(item[0])}`;
                }
            });
        }
    } catch (error) {
        console.error('Error loading word cloud:', error);
        loading.textContent = 'Failed to load word cloud';
    }
}

async function loadTrendingChart() {
    const chartCanvas = document.getElementById('trending-chart');
    const loading = document.getElementById('chart-loading');

    try {
        loading.style.display = 'block';
        const data = await fetchAPI('/api/trending');

        if (data && data.topics && data.counts) {
            loading.style.display = 'none';

            const ctx = chartCanvas.getContext('2d');
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: data.topics.slice(0, 8),
                    datasets: [{
                        label: 'Research Activity',
                        data: data.counts.slice(0, 8),
                        backgroundColor: 'rgba(59, 130, 246, 0.6)',
                        borderColor: 'rgba(59, 130, 246, 1)',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Frequency'
                            }
                        },
                        x: {
                            ticks: {
                                maxRotation: 45,
                                minRotation: 45
                            }
                        }
                    },
                    onClick: (event, elements) => {
                        if (elements.length > 0) {
                            const index = elements[0].index;
                            const topic = data.topics[index];
                            window.location.href = `people.html?topic=${encodeURIComponent(topic)}`;
                        }
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error loading chart:', error);
        loading.textContent = 'Failed to load chart';
    }
}

function updateStats() {
    // Update stat cards with animated counts
    animateValue('stat-topics', 0, 25, 1000);
    animateValue('stat-researchers', 0, 150, 1500);
    animateValue('stat-papers', 0, 2400, 2000);
}

function animateValue(id, start, end, duration) {
    const element = document.getElementById(id);
    if (!element) return;

    const range = end - start;
    const increment = range / (duration / 16);
    let current = start;

    const timer = setInterval(() => {
        current += increment;
        if (current >= end) {
            element.textContent = end + '+';
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(current) + '+';
        }
    }, 16);
}

// ===== PEOPLE PAGE (Researchers) =====
export async function initPeoplePage() {
    console.log('Initializing people page...');

    // Get URL parameters
    const params = new URLSearchParams(window.location.search);
    const topicParam = params.get('topic');

    if (topicParam) {
        document.getElementById('topic-filter').value = topicParam;
    }

    // Load initial researchers
    await loadResearchers();

    // Set up event listeners
    document.getElementById('search-btn').addEventListener('click', handleSearch);
    document.getElementById('reset-btn').addEventListener('click', handleReset);
    document.getElementById('sort-select').addEventListener('change', handleSort);

    // Allow Enter key to search
    ['topic-filter', 'institution-filter', 'country-filter'].forEach(id => {
        document.getElementById(id).addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSearch();
        });
    });
}

let currentResearchers = [];

async function loadResearchers() {
    const topic = document.getElementById('topic-filter').value;
    const institution = document.getElementById('institution-filter').value;
    const country = document.getElementById('country-filter').value;

    const loading = document.getElementById('researchers-loading');
    const grid = document.getElementById('researchers-grid');
    const noResults = document.getElementById('no-results');

    loading.style.display = 'block';
    grid.innerHTML = '';
    noResults.style.display = 'none';

    try {
        const params = new URLSearchParams();
        if (topic) params.append('topic', topic);
        if (institution) params.append('institution', institution);
        if (country) params.append('country', country);

        const data = await fetchAPI(`/api/researchers?${params.toString()}`);
        currentResearchers = data.researchers || [];

        loading.style.display = 'none';

        if (currentResearchers.length === 0) {
            noResults.style.display = 'block';
        } else {
            renderResearchers(currentResearchers);
        }

        updateResultsCount(currentResearchers.length);
    } catch (error) {
        console.error('Error loading researchers:', error);
        loading.textContent = 'Failed to load researchers';
    }
}

function renderResearchers(researchers) {
    const grid = document.getElementById('researchers-grid');
    grid.innerHTML = '';

    researchers.forEach(researcher => {
        const card = createResearcherCard(researcher);
        grid.appendChild(card);
    });
}

function createResearcherCard(researcher) {
    const card = document.createElement('div');
    card.className = 'researcher-card';

    const topicsHTML = researcher.topics
        ? researcher.topics.slice(0, 3).map(t => `<span class="topic-tag">${t}</span>`).join('')
        : '';

    card.innerHTML = `
        <div class="researcher-header">
            <div class="researcher-avatar">${researcher.name.charAt(0)}</div>
            <div class="researcher-info">
                <h4>${researcher.name}</h4>
                <p class="affiliation">${researcher.affiliation}</p>
                ${researcher.country ? `<p class="country">📍 ${researcher.country}</p>` : ''}
            </div>
        </div>
        <div class="researcher-topics">
            ${topicsHTML}
        </div>
        <div class="researcher-stats">
            ${researcher.citations ? `<div class="stat"><strong>${formatNumber(researcher.citations)}</strong> Citations</div>` : ''}
            ${researcher.works_count ? `<div class="stat"><strong>${researcher.works_count}</strong> Works</div>` : ''}
        </div>
        <div class="researcher-actions">
            <a href="${researcher.link}" target="_blank" class="btn btn-primary btn-sm">View Profile</a>
        </div>
    `;

    return card;
}

function formatNumber(num) {
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'k';
    }
    return num;
}

function updateResultsCount(count) {
    document.getElementById('results-count').textContent = count;
}

function handleSearch() {
    loadResearchers();
}

function handleReset() {
    document.getElementById('topic-filter').value = '';
    document.getElementById('institution-filter').value = '';
    document.getElementById('country-filter').value = '';
    loadResearchers();
}

function handleSort() {
    const sortBy = document.getElementById('sort-select').value;
    let sorted = [...currentResearchers];

    switch (sortBy) {
        case 'citations':
            sorted.sort((a, b) => (b.citations || 0) - (a.citations || 0));
            break;
        case 'name':
            sorted.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'works':
            sorted.sort((a, b) => (b.works_count || 0) - (a.works_count || 0));
            break;
    }

    renderResearchers(sorted);
}

// ===== CHAT PAGE (Mascot Rhett) =====
let chatHistory = [];
let isFirstMessage = true;

export async function initChatPage() {
    console.log('Initializing chat page...');

    const sendBtn = document.getElementById('send-btn');
    const chatInput = document.getElementById('chat-input');

    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Handle example question chips
    document.querySelectorAll('.example-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            chatInput.value = chip.dataset.query;
            sendMessage();
        });
    });

    // Handle close sidebar button
    const closeSidebarBtn = document.getElementById('close-sidebar');
    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', () => {
            const sidebar = document.getElementById('researchers-sidebar');
            sidebar.classList.remove('active');
        });
    }
}

async function sendMessage() {
    const input = document.getElementById('chat-input');
    const query = input.value.trim();

    if (!query) return;

    // Transition from welcome screen to chat on first message
    if (isFirstMessage) {
        transitionToChat();
        isFirstMessage = false;
    }

    // Add user message to chat history and UI
    chatHistory.push({ type: 'user', text: query });
    addMessage(query, 'user');
    input.value = '';

    // Show typing indicator
    const typingId = addTypingIndicator();

    try {
        const response = await fetchAPI('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query })
        });

        // Remove typing indicator
        removeTypingIndicator(typingId);

        // Debug: Log the full response
        console.log('[DEBUG] Chat API Response:', response);
        console.log('[DEBUG] Suggested Researchers:', response.suggested_researchers);
        console.log('[DEBUG] Suggested Papers:', response.suggested_papers);

        // Build Rhett's full response (summary + papers)
        let rhettMessageHTML = `<div class="message-text">${response.summary}</div>`;

        // Add related papers section if available
        if (response.suggested_papers && response.suggested_papers.length > 0) {
            rhettMessageHTML += `
                <div class="papers-list">
                    <h4>📄 Related Papers</h4>
                    <ul>
                        ${response.suggested_papers
                            .map(
                                (p) => `
                                <li>
                                    <a href="${p.link}" target="_blank">${p.title}</a>
                                    (${p.year || 'n/a'}) — Citations: ${p.citations || 0}
                                </li>`
                            )
                            .join('')}
                    </ul>
                </div>`;
        }

        if ((!response.suggested_papers || response.suggested_papers.length === 0) &&
            response.summary.includes('rapidly')) {
            rhettMessageHTML += `<p class="note">No specific papers found — here are trending AI works instead.</p>`;
        }


        // Add message to chat.researcher
        chatHistory.push({
            type: 'bot',
            text: response.summary,
            researchers: response.suggested_researchers,
            papers: response.suggested_papers
        });
        addMessage(rhettMessageHTML, 'bot');

        // Show suggested researchers in sidebar
        if (response.suggested_researchers && response.suggested_researchers.length > 0) {
            showSuggestedResearchers(response.suggested_researchers);
        }

    } catch (error) {
        console.error('Chat error:', error);
        removeTypingIndicator(typingId);
        const errorMsg = 'Sorry, I encountered an error. Please try again later.';
        chatHistory.push({ type: 'bot', text: errorMsg });
        addMessage(errorMsg, 'bot');
    }
}

function transitionToChat() {
    const welcomeContainer = document.getElementById('rhett-welcome');
    const chatWrapper = document.getElementById('chat-wrapper');

    // Fade out welcome screen
    welcomeContainer.classList.add('fade-out');

    // After animation, hide welcome and show chat
    setTimeout(() => {
        welcomeContainer.style.display = 'none';
        chatWrapper.style.display = 'flex';
    }, 300);
}

function addMessage(text, type) {
    const messagesContainer = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}-message`;

    if (type === 'bot') {
        messageDiv.innerHTML = `
            <div class="message-avatar">
                <img src="assets/rhett-removebg-preview.png" alt="Rhett">
            </div>
            <div class="message-content">
                <div class="message-sender">Rhett</div>
                ${text}
            </div>
        `;
    } else {
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-sender">You</div>
                <div class="message-text">${text}</div>
            </div>
            <div class="message-avatar">👤</div>
        `;
    }

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function addTypingIndicator() {
    const messagesContainer = document.getElementById('chat-messages');
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message bot-message typing-indicator';
    typingDiv.id = 'typing-' + Date.now();

    typingDiv.innerHTML = `
        <div class="message-avatar">
            <img src="assets/rhett-removebg-preview.png" alt="Rhett">
        </div>
        <div class="message-content">
            <div class="typing-dots">
                <span></span><span></span><span></span>
            </div>
        </div>
    `;

    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    return typingDiv.id;
}

function removeTypingIndicator(id) {
    const indicator = document.getElementById(id);
    if (indicator) {
        indicator.remove();
    }
}

function showSuggestedResearchers(researchers) {
    const sidebar = document.getElementById('researchers-sidebar');
    const container = document.getElementById('suggested-researchers');

    container.innerHTML = '';

    researchers.forEach(researcher => {
        const card = document.createElement('div');
        card.className = 'researcher-mini-card';
        card.innerHTML = `
            <h4>${researcher.name}</h4>
            ${researcher.field ? `<p class="field">${researcher.field}</p>` : ''}
            ${researcher.affiliation ? `<p class="affiliation">${researcher.affiliation}</p>` : ''}
            <a href="${researcher.link}" target="_blank" class="btn btn-sm btn-primary">View Profile</a>
        `;
        container.appendChild(card);
    });

    // Show sidebar with animation
    sidebar.style.display = 'flex';
    setTimeout(() => {
        sidebar.classList.add('active');
    }, 10);
}
