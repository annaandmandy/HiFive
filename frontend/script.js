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
    await loadTopicNetwork();
    updateStats();
}

function colorForString(str) {
    // Generate a repeatable color from string
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 50%)`;
}

function darker(color, factor = 0.2) {
    try {
        const c = d3.color(color);
        c.l -= factor;
        return c.formatHsl();
    } catch {
        return color;
    }
}
/*
  loadTopicNetwork()
  - tries /api/trending_network (nodes + links). If not found, falls back to /api/trending and /api/wordcloud
  - renders a force-directed network using D3 v7
  - nodes sized by frequency and drawn with radial gradients to appear 3D
  - clicking a node navigates to people.html?topic=...
*/
async function loadTopicNetwork() {
    const svg = d3.select('#topic-network');
    const loading = document.getElementById('network-loading');
    loading.style.display = 'block';
    svg.selectAll('*').remove();

    // Fetch trending network data or build fallback
    let data = null;
    try {
        data = await fetchAPI('/api/trending_network');
    } catch (e) {
        console.warn('Using mock data fallback');
        data = {
            nodes: [
                { id: "AI Ethics", value: 42 },
                { id: "Neural Networks", value: 35 },
                { id: "Reinforcement Learning", value: 28 },
                { id: "Computer Vision", value: 22 },
                { id: "Natural Language Processing", value: 50 },
                { id: "Quantum AI", value: 18 },
                { id: "Generative Models", value: 45 }
            ],
            links: [
                { source: "AI Ethics", target: "Neural Networks" },
                { source: "Neural Networks", target: "Reinforcement Learning" },
                { source: "Reinforcement Learning", target: "Computer Vision" },
                { source: "Computer Vision", target: "Natural Language Processing" },
                { source: "Generative Models", target: "Natural Language Processing" },
                { source: "Quantum AI", target: "AI Ethics" }
            ]
        };
    }

    const nodes = data.nodes || [];
    const links = data.links || [];

    if (nodes.length === 0) {
        loading.textContent = 'No topics available';
        return;
    }

    // Normalize node sizes
    const values = nodes.map(n => n.value);
    const rScale = d3.scaleSqrt().domain([Math.min(...values), Math.max(...values)]).range([8, 40]);

    loading.style.display = 'none';

    const bbox = svg.node().getBoundingClientRect();
    const width = bbox.width || 800;
    const height = bbox.height || 500;
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    // Color from styles.css
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent-color') || '#4f46e5';

    // Force simulation (runs once)
    const simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => d.id).distance(90))
        .force('charge', d3.forceManyBody().strength(-200))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collide', d3.forceCollide().radius(d => rScale(d.value) + 6))
        .stop();

    // Run the simulation manually (static layout)
    simulation.tick(200);

    // Draw links
    svg.append('g')
        .attr('stroke', 'var(--border-color)')
        .attr('stroke-opacity', 0.6)
        .selectAll('line')
        .data(links)
        .enter().append('line')
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

    // Tooltip
    let tooltip = d3.select('body').selectAll('.topic-tooltip').data([0]);
    tooltip = tooltip.enter().append('div').attr('class','topic-tooltip').merge(tooltip);

    // Draw nodes
    const nodeG = svg.append('g')
        .selectAll('circle')
        .data(nodes)
        .enter().append('circle')
        .attr('r', d => rScale(d.value))
        .attr('cx', d => d.x)
        .attr('cy', d => d.y)
        .attr('fill', accent)
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5)
        .on('mouseover', function(event, d) {
            tooltip
                .style('display', 'block')
                .html(`<strong>${d.id}</strong><div style="font-size:0.85rem;color:var(--text-secondary)">Frequency: ${d.value}</div>`);
        })
        .on('mousemove', function(event) {
            tooltip.style('left', (event.pageX + 12) + 'px').style('top', (event.pageY + 12) + 'px');
        })
        .on('mouseout', function() {
            tooltip.style('display', 'none');
        })
        .on('click', function(event, d) {
            window.location.href = `people.html?topic=${encodeURIComponent(d.id)}`;
        });

    // Label text
    svg.append('g')
        .selectAll('text')
        .data(nodes)
        .enter().append('text')
        .attr('x', d => d.x)
        .attr('y', d => d.y + rScale(d.value) + 14)
        .attr('text-anchor', 'middle')
        .attr('font-weight', '600')
        .attr('fill', 'var(--text-primary)')
        .text(d => d.id);

    // === Quick Stats updates ===
    try {
        // Trending Topics
        const topTopics = nodes.sort((a, b) => b.value - a.value).slice(0, 3).map(n => n.id).join(', ');
        document.getElementById('stat-topics').textContent = topTopics || '-';

        // Active Researchers
        const people = await fetchAPI('/api/people');
        if (people && Array.isArray(people)) {
            document.getElementById('stat-researchers').textContent = people.length.toString();
        } else if (people && people.count) {
            document.getElementById('stat-researchers').textContent = people.count.toString();
        } else {
            document.getElementById('stat-researchers').textContent = '-';
        }

        // Recent Papers
        const papers = await fetchAPI('/api/papers');
        if (papers && Array.isArray(papers)) {
            document.getElementById('stat-papers').textContent = papers.length.toString();
        } else if (papers && papers.count) {
            document.getElementById('stat-papers').textContent = papers.count.toString();
        } else {
            document.getElementById('stat-papers').textContent = '-';
        }
    } catch (err) {
        console.warn('Could not update stats:', err);
    }

    try {
        // Trending Topics (top 3)
        const topTopics = nodes.sort((a, b) => b.value - a.value).slice(0, 3).map(n => n.id).join(', ');
        document.getElementById('stat-topics').textContent = topTopics || '-';

        // Mock researchers & papers
        document.getElementById('stat-researchers').textContent = '23';
        document.getElementById('stat-papers').textContent = '12';
    } catch (err) {
        console.warn('Could not update stats:', err);
    }
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
            document.getElementById('researchers-sidebar').classList.remove('active');
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

        // Add bot response to chat history and UI
        chatHistory.push({ type: 'bot', text: response.summary, researchers: response.suggested_researchers });
        addMessage(response.summary, 'bot');

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
                <div class="message-text">${text}</div>
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
