// script.js

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

    // View toggle buttons
    const gridBtn = document.getElementById('grid-view-btn');
    const bubbleBtn = document.getElementById('bubble-view-btn');
    const swipeBtn = document.getElementById('swipe-view-btn');

    gridBtn.addEventListener('click', () => showSection('grid'));
    bubbleBtn.addEventListener('click', () => showSection('bubble'));
    swipeBtn.addEventListener('click', () => showSection('swipe'));

    // Allow Enter key to search
    ['topic-filter', 'institution-filter', 'country-filter'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleSearch();
            });
        }
    });

    // Initialize swipe UI controls
    initSwipeControls();
}

let currentResearchers = [];
let savedResearchers = [];

// Load researchers from API using filters
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

// ===== Swipe View Implementation =====

function showSection(section) {
    // sections: 'grid', 'bubble', 'swipe'
    const gridSection = document.querySelector('.results-section');
    const bubbleSection = document.getElementById('bubble-section');
    const swipeSection = document.getElementById('swipe-section');

    // default hide all
    if (gridSection) gridSection.style.display = 'none';
    if (bubbleSection) bubbleSection.style.display = 'none';
    if (swipeSection) swipeSection.style.display = 'none';

    // clear any extant swipe deck when leaving swipe mode
    if (section !== 'swipe') {
        clearSwipeDeck();
    }

    if (section === 'grid') {
        if (gridSection) gridSection.style.display = '';
    } else if (section === 'bubble') {
        if (bubbleSection) bubbleSection.style.display = '';
    } else if (section === 'swipe') {
        if (swipeSection) {
            swipeSection.style.display = '';
            // build deck from currentResearchers
            buildSwipeDeck();
        }
    }
}

// Initialize swipe controls and modal listeners
function initSwipeControls() {
    // buttons are present in people.html
    const exitSwipeBtn = document.getElementById('exit-swipe-btn');
    const viewSavedBtn = document.getElementById('view-saved-btn');
    const savedModal = document.getElementById('saved-modal');
    const savedCloseBtn = document.getElementById('saved-close-btn');
    const savedClearBtn = document.getElementById('saved-clear-btn');
    const swipeExitEmpty = document.getElementById('swipe-exit-empty');

    if (exitSwipeBtn) {
        exitSwipeBtn.addEventListener('click', () => showSection('grid'));
    }
    if (viewSavedBtn) {
        viewSavedBtn.addEventListener('click', openSavedModal);
    }
    if (savedCloseBtn) {
        savedCloseBtn.addEventListener('click', closeSavedModal);
    }
    if (savedClearBtn) {
        savedClearBtn.addEventListener('click', () => {
            savedResearchers = [];
            renderSavedList();
        });
    }
    if (swipeExitEmpty) {
        swipeExitEmpty.addEventListener('click', () => showSection('grid'));
    }
}

function openSavedModal() {
    const modal = document.getElementById('saved-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    renderSavedList();
}

function closeSavedModal() {
    const modal = document.getElementById('saved-modal');
    if (!modal) return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
}

// Render the compact saved list inside modal
function renderSavedList() {
    const list = document.getElementById('saved-list');
    if (!list) return;
    list.innerHTML = '';

    if (!savedResearchers || savedResearchers.length === 0) {
        list.innerHTML = `<p style="color:var(--text-secondary);">No saved researchers yet.</p>`;
        return;
    }

    savedResearchers.forEach((r, idx) => {
        const row = document.createElement('div');
        row.className = 'saved-row';
        row.innerHTML = `
            <div class="left">
                <div style="width:48px;height:48px;border-radius:8px;background:linear-gradient(135deg,var(--primary-color),var(--secondary-color));display:flex;align-items:center;justify-content:center;color:white;font-weight:700;">
                    ${r.name.charAt(0)}
                </div>
                <div>
                    <h4>${r.name}</h4>
                    <div class="meta">${(r.topics && r.topics.slice(0,3).join(', ')) || ''}</div>
                </div>
            </div>
            <div style="display:flex;align-items:center;gap:0.75rem;">
                <div class="meta">${r.citations ? formatNumber(r.citations) + ' citations' : ''}${r.works_count ? ', ' + r.works_count + ' works' : ''}</div>
                <a class="btn btn-primary btn-sm" href="${r.link || '#'}" target="_blank">View Profile</a>
            </div>
        `;
        list.appendChild(row);
    });
}

// Build swipe deck
function buildSwipeDeck() {
    const container = document.getElementById('swipe-container');
    if (!container) return;

    // Clear existing cards but keep the empty placeholder
    // (we re-use #swipe-empty else create it)
    Array.from(container.children).forEach(child => {
        if (child.id !== 'swipe-empty') child.remove();
    });

    if (!currentResearchers || currentResearchers.length === 0) {
        // show empty state
        const empty = document.getElementById('swipe-empty');
        if (empty) empty.style.display = 'block';
        return;
    } else {
        const empty = document.getElementById('swipe-empty');
        if (empty) empty.style.display = 'none';
    }

    // Create cards. We'll add top N (or all) as stack. Top card is last appended.
    const deck = [...currentResearchers]; // keep original order
    // start from the last so the first researcher ends up on top (append order)
    for (let i = deck.length - 1; i >= 0; i--) {
        const r = deck[i];
        const idxFromTop = deck.length - 1 - i; // 0 = top
        const card = createSwipeCard(r, idxFromTop);
        container.appendChild(card);
    }

    // set pointer handlers on top card
    setTopCardPointerHandlers();
}

function clearSwipeDeck() {
    const container = document.getElementById('swipe-container');
    if (!container) return;
    // remove cards but keep empty placeholder
    Array.from(container.children).forEach(child => {
        if (child.id !== 'swipe-empty') child.remove();
    });
}

// Create swipe card element
function createSwipeCard(researcher, indexFromTop) {
    const card = document.createElement('div');
    card.className = 'swipe-card';
    card.setAttribute('data-index', indexFromTop);
    // store researcher data on DOM el for convenience
    card.__researcher = researcher;

    const topicsHTML = researcher.topics
        ? researcher.topics.slice(0, 3).map(t => `<span class="topic-tag">${t}</span>`).join('')
        : '';

    card.innerHTML = `
        <div class="card-top">
            <div class="swipe-avatar">${researcher.name.charAt(0)}</div>
            <div style="flex:1;">
                <h2>${researcher.name}</h2>
                <p class="affiliation">${researcher.affiliation || ''}</p>
                <div class="topics">${topicsHTML}</div>
            </div>
        </div>

        <div class="stats">
            ${researcher.citations ? `<div class="stat"><strong>${formatNumber(researcher.citations)}</strong> Citations</div>` : ''}
            ${researcher.works_count ? `<div class="stat"><strong>${researcher.works_count}</strong> Works</div>` : ''}
        </div>

        <div class="swipe-actions">
            <a href="${researcher.link || '#'}" target="_blank" class="btn btn-secondary btn-sm">View Profile</a>
        </div>
    `;

    // initial transform handled via CSS data-index rules
    card.style.transformOrigin = 'center';

    return card;
}

// Set pointer handlers on the top card only
function setTopCardPointerHandlers() {
    const container = document.getElementById('swipe-container');
    if (!container) return;

    const topCard = Array.from(container.querySelectorAll('.swipe-card')).pop();
    if (!topCard) {
        // deck empty
        showSwipeEmptyState();
        return;
    }

    // remove existing handlers to avoid duplicates
    topCard.onpointerdown = null;

    // track dragging states
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let currentY = 0;
    let isDragging = false;

    function pointerDown(e) {
        e.preventDefault();
        startX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
        startY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
        isDragging = true;
        topCard.classList.add('dragging');

        // capture pointer (for pointer events)
        if (e.pointerId) {
            topCard.setPointerCapture(e.pointerId);
        }
    }

    function pointerMove(e) {
        if (!isDragging) return;
        currentX = (e.clientX || (e.touches && e.touches[0].clientX)) - startX;
        currentY = (e.clientY || (e.touches && e.touches[0].clientY)) - startY;

        // rotate slightly based on horizontal movement
        const rotate = (currentX / window.innerWidth) * 30; // up to ~30deg
        topCard.style.transform = `translate(${currentX}px, ${currentY}px) rotate(${rotate}deg)`;
        // fade the card a little when dragged far
        const opacity = Math.max(0.25, 1 - Math.abs(currentX) / (window.innerWidth * 0.6));
        topCard.style.opacity = opacity;
    }

    function pointerUp(e) {
        if (!isDragging) return;
        isDragging = false;
        topCard.classList.remove('dragging');

        // threshold in px
        const threshold = 150;
        if (currentX > threshold) {
            // right swipe => save
            swipeCardRight(topCard);
        } else if (currentX < -threshold) {
            // left swipe => discard
            swipeCardLeft(topCard);
        } else {
            // restore to center
            topCard.style.transition = 'transform 300ms cubic-bezier(.22,.9,.26,1), opacity 200ms ease';
            topCard.style.transform = '';
            topCard.style.opacity = '';
            // cleanup transition after it's done
            setTimeout(() => {
                topCard.style.transition = '';
            }, 320);
        }

        // release pointer capture if used
        if (e.pointerId && topCard.releasePointerCapture) {
            try { topCard.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        }

        // reset deltas
        currentX = 0;
        currentY = 0;
    }

    // Support both pointer and mouse/touch events robustly
    topCard.addEventListener('pointerdown', pointerDown);
    window.addEventListener('pointermove', pointerMove);
    window.addEventListener('pointerup', pointerUp);

    // Clean up event listeners when card is removed - attach a small observer
    const observer = new MutationObserver(() => {
        if (!document.body.contains(topCard)) {
            // card removed, remove listeners
            topCard.removeEventListener('pointerdown', pointerDown);
            window.removeEventListener('pointermove', pointerMove);
            window.removeEventListener('pointerup', pointerUp);
            observer.disconnect();
            // set handlers for the new top card
            setTopCardPointerHandlers();
        }
    });
    observer.observe(document.getElementById('swipe-container'), { childList: true, subtree: false });
}

// swipe animations and removal
function swipeCardRight(card) {
    if (!card) return;
    const researcher = card.__researcher;
    // push to savedResearchers in memory
    if (researcher) savedResearchers.push(researcher);

    // animate off to right
    card.classList.add('swipe-off-right');

    // after animation, remove from DOM
    setTimeout(() => {
        card.remove();
        // re-index remaining cards visually
        reindexStack();
        // if deck empty show empty state
        if (document.querySelectorAll('#swipe-container .swipe-card').length === 0) {
            showSwipeEmptyState();
        }
    }, 350);
}

function swipeCardLeft(card) {
    if (!card) return;
    // animate off to left
    card.classList.add('swipe-off-left');

    setTimeout(() => {
        card.remove();
        reindexStack();
        if (document.querySelectorAll('#swipe-container .swipe-card').length === 0) {
            showSwipeEmptyState();
        }
    }, 350);
}

// Recalculate data-index attributes so CSS offsets apply correctly
function reindexStack() {
    const cards = Array.from(document.querySelectorAll('#swipe-container .swipe-card'));
    // top card should have data-index="0" and be last in DOM; we keep DOM order but reassign indexes for CSS
    // compute from bottom to top
    for (let i = 0; i < cards.length; i++) {
        const idxFromTop = cards.length - 1 - i;
        cards[i].setAttribute('data-index', idxFromTop);
        // reset inline transform/opacity to let CSS control offsets
        cards[i].style.transform = '';
        cards[i].style.opacity = '';
    }
}

// show empty state
function showSwipeEmptyState() {
    const empty = document.getElementById('swipe-empty');
    if (empty) empty.style.display = 'block';
    // hide any leftover cards (shouldn't be any)
    // optionally show saved modal or suggestion to exit
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
    const reopenSidebarBtn = document.getElementById('reopen-sidebar');

    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', () => {
            const sidebar = document.getElementById('researchers-sidebar');
            const chatMain = document.querySelector('.chat-main');
            sidebar.classList.remove('active');
            chatMain.classList.remove('sidebar-active');

            // Show reopen button
            if (reopenSidebarBtn) {
                reopenSidebarBtn.style.display = 'flex';
            }
        });
    }

    // Handle reopen sidebar button
    if (reopenSidebarBtn) {
        reopenSidebarBtn.addEventListener('click', () => {
            const sidebar = document.getElementById('researchers-sidebar');
            const chatMain = document.querySelector('.chat-main');
            sidebar.classList.add('active');
            chatMain.classList.add('sidebar-active');
            reopenSidebarBtn.style.display = 'none';
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
    const chatMain = document.querySelector('.chat-main');
    const reopenBtn = document.getElementById('reopen-sidebar');
    const countBadge = document.getElementById('researcher-count');

    container.innerHTML = '';

    researchers.forEach(researcher => {
        const card = document.createElement('div');
        card.className = 'researcher-mini-card';

        // Make entire card clickable
        card.addEventListener('click', () => {
            window.open(researcher.link, '_blank');
        });

        card.innerHTML = `
            <h4>${researcher.name}</h4>
            ${researcher.field ? `<p class="field">${researcher.field}</p>` : ''}
            ${researcher.affiliation ? `<p class="affiliation">${researcher.affiliation}</p>` : ''}
            <div class="btn btn-sm btn-primary">View Profile</div>
        `;
        container.appendChild(card);
    });

    // Update count badge
    if (countBadge) {
        countBadge.textContent = researchers.length;
    }

    // Show sidebar with animation and add padding to chat main
    sidebar.style.display = 'flex';
    setTimeout(() => {
        sidebar.classList.add('active');
        chatMain.classList.add('sidebar-active');
        // Hide reopen button when sidebar is shown
        if (reopenBtn) {
            reopenBtn.style.display = 'none';
        }
    }, 10);
}
