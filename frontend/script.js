// API Configuration
const API_BASE_URL = 'http://localhost:8000';
const PROJECTS_DATA_URL = '../data/mock_projects.json';
let previewModalElements = null;
let lastPreviewTrigger = null;

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

// ===== PROJECTS PAGE =====
export async function initProjectsPage() {
    console.log('Initializing projects page...');

    const elements = getProjectElements();
    if (!elements.grid) {
        return;
    }

    const controls = getProjectControls();
    const launchModal = getLaunchModalElements();
    let projects = [];
    let trending = [];

    try {
        if (elements.loading) {
            elements.loading.style.display = 'block';
        }

        const response = await fetch(PROJECTS_DATA_URL, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        projects = await response.json();
        trending = selectTrendingProjects(projects);
    } catch (error) {
        console.error('Error loading projects:', error);
        if (elements.loading) {
            elements.loading.textContent = 'Failed to load projects.';
        }
        return;
    } finally {
        if (elements.loading) {
            elements.loading.style.display = 'none';
        }
    }

    const state = {
        projects,
        filtered: [...projects],
        map: new Map(projects.map(p => [(p.code || p.id || '').toString().toUpperCase(), p]))
    };

    const applyAndRender = () => {
        const sortBy = controls.sortSelect?.value || 'updated';
        const filtered = sortProjects(filterProjects(state.projects, controls), sortBy);
        state.filtered = filtered;
        renderProjects(filtered, elements);
    };

    wireProjectControls(controls, applyAndRender);
    wirePreviewModal(getPreviewModalElements());
    renderTrendingProjects(trending);
    wireTrendingInteractions();
    wireSearchCollapse();
    wireLaunchModal(launchModal);
    applyAndRender();
}

function getProjectElements() {
    return {
        grid: document.getElementById('project-grid'),
        loading: document.getElementById('project-loading'),
        emptyState: document.getElementById('project-empty'),
        countBadge: document.getElementById('project-count')
    };
}

function getProjectControls() {
    return {
        searchInput: document.getElementById('project-search-input'),
        searchBtn: document.getElementById('project-search-btn'),
        sortSelect: document.getElementById('project-sort-select'),
        filterToggle: document.getElementById('project-filter-btn'),
        filterPanel: document.getElementById('project-filters'),
        stageSelect: document.getElementById('project-stage-filter'),
        locationSelect: document.getElementById('project-campus-filter'),
        modeSelect: document.getElementById('project-mode-filter'),
        fundingSelect: document.getElementById('project-funding-filter'),
        requirementSelect: document.getElementById('project-requirement-filter'),
        launchSelect: document.getElementById('project-launch-filter'),
        leadSelect: document.getElementById('project-lead-filter'),
        applyBtn: document.getElementById('apply-filter-btn'),
        resetBtn: document.getElementById('reset-filter-btn'),
        launchBtn: document.getElementById('project-launch-btn')
    };
}

function selectTrendingProjects(projects) {
    if (!Array.isArray(projects)) return [];
    return [...projects]
        .sort((a, b) => {
            const dateA = new Date(a.updated || 0).getTime();
            const dateB = new Date(b.updated || 0).getTime();
            return dateB - dateA;
        })
        .slice(0, 3);
}

function setTrendingMinimized(minimized) {
    const section = document.getElementById('projects-trending');
    const toggle = document.getElementById('trending-toggle');
    if (!section || !toggle) return;
    section.classList.toggle('minimized', minimized);
    toggle.textContent = minimized ? 'Expand' : 'Collapse';
    toggle.setAttribute('aria-expanded', (!minimized).toString());
}

function renderTrendingProjects(trendingProjects) {
    const list = document.getElementById('trending-list');
    if (!list) return;

    list.innerHTML = '';

    if (!trendingProjects.length) {
        const empty = document.createElement('div');
        empty.className = 'trending-empty';
        empty.textContent = 'No trending projects available yet.';
        list.appendChild(empty);
        return;
    }

    trendingProjects.forEach((project) => {
        const card = document.createElement('button');
        card.className = 'trending-card';
        card.type = 'button';
        card.setAttribute('data-project-code', (project.code || project.id || '').toString().toUpperCase());

        const art = document.createElement('div');
        art.className = 'trending-art';
        art.style.background = buildGradient(project.image);

        const body = document.createElement('div');
        body.className = 'trending-body';

        const title = document.createElement('span');
        title.className = 'trending-title';
        title.textContent = project.title;

        const meta = document.createElement('span');
        meta.className = 'trending-meta';
        meta.textContent = `${(project.code || project.id || '').toString().toUpperCase()} · ${formatStage(project.stage)}`;

        body.append(title, meta);
        card.append(art, body);

        card.addEventListener('click', () => {
            openProjectPreview(project);
            setTrendingMinimized(true);
        });

        list.appendChild(card);
    });
}

function wireTrendingInteractions() {
    const section = document.getElementById('projects-trending');
    const toggle = document.getElementById('trending-toggle');
    const controlsContainer = document.querySelector('.projects-controls');

    if (!section || !toggle || !controlsContainer) return;

    setTrendingMinimized(section.classList.contains('minimized'));

    toggle.addEventListener('click', () => {
        const minimized = section.classList.contains('minimized');
        setTrendingMinimized(!minimized);
    });

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                setTrendingMinimized(!entry.isIntersecting);
            });
        },
        {
            root: null,
            threshold: 0,
            rootMargin: '-120px 0px 0px 0px'
        }
    );

    observer.observe(controlsContainer);
}

function wireSearchCollapse() {
    const controls = document.querySelector('.projects-controls');
    if (!controls) return;

    const listSection = document.querySelector('.project-list-panel');
    if (!listSection) return;

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                controls.classList.toggle('collapsed', entry.isIntersecting);
            });
        },
        {
            root: null,
            threshold: 0,
            rootMargin: '-120px 0px 0px 0px'
        }
    );

    observer.observe(listSection);
}

function setFilterPanelState(controls, collapsed) {
    if (!controls.filterPanel || !controls.filterToggle) return;

    if (collapsed) {
        controls.filterPanel.classList.add('collapsed');
    } else {
        controls.filterPanel.classList.remove('collapsed');
    }

    controls.filterToggle.textContent = collapsed ? 'Show Filters' : 'Hide Filters';
    controls.filterToggle.setAttribute('aria-expanded', (!collapsed).toString());
}

function wireProjectControls(controls, applyAndRender) {
    controls.searchBtn?.addEventListener('click', applyAndRender);
    controls.searchInput?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            applyAndRender();
        }
    });
    controls.searchInput?.addEventListener('focus', () => {
        setFilterPanelState(controls, false);
    });

    controls.sortSelect?.addEventListener('change', applyAndRender);
    controls.applyBtn?.addEventListener('click', applyAndRender);
    controls.resetBtn?.addEventListener('click', () => {
        resetProjectFilters(controls);
        applyAndRender();
    });

    if (controls.filterToggle && controls.filterPanel) {
        setFilterPanelState(
            controls,
            controls.filterPanel.classList.contains('collapsed')
        );
        controls.filterToggle.addEventListener('click', () => {
            const collapsed = controls.filterPanel.classList.contains('collapsed');
            setFilterPanelState(controls, !collapsed);
        });
    }
}

function resetProjectFilters(controls) {
    if (controls.searchInput) controls.searchInput.value = '';
    controls.stageSelect && (controls.stageSelect.value = '');
    controls.locationSelect && (controls.locationSelect.value = '');
    controls.modeSelect && (controls.modeSelect.value = '');
    controls.fundingSelect && (controls.fundingSelect.value = '');
    controls.requirementSelect && (controls.requirementSelect.value = '');
    controls.launchSelect && (controls.launchSelect.value = '');
    controls.leadSelect && (controls.leadSelect.value = '');
    if (controls.sortSelect) controls.sortSelect.value = 'updated';
    setFilterPanelState(controls, true);
    controls.searchInput?.focus();
}

function filterProjects(projects, controls) {
    let results = [...projects];

    const query = controls.searchInput?.value.trim().toLowerCase();
    if (query) {
        results = results.filter((project) => matchesQuery(project, query));
    }

    const stageValue = controls.stageSelect?.value;
    if (stageValue) {
        results = results.filter((project) => (project.stage || '').toLowerCase() === stageValue);
    }

    const locationValue = controls.locationSelect?.value;
    if (locationValue) {
        results = results.filter((project) => (project.location || '').toLowerCase() === locationValue);
    }

    const modeValue = controls.modeSelect?.value;
    if (modeValue) {
        results = results.filter((project) => (project.mode || '').toLowerCase() === modeValue);
    }

    const fundingValue = controls.fundingSelect?.value;
    if (fundingValue) {
        results = results.filter((project) => (project.fundingStatus || '').toLowerCase() === fundingValue);
    }

    const requirementValue = controls.requirementSelect?.value;
    if (requirementValue) {
        results = results.filter((project) => (project.requirementLevel || '').toLowerCase() === requirementValue);
    }

    const launchValue = controls.launchSelect?.value;
    if (launchValue) {
        results = results.filter((project) => (project.launchType || '').toLowerCase() === launchValue);
    }

    const leadValue = controls.leadSelect?.value;
    if (leadValue) {
        results = results.filter((project) => (project.lead?.leadType || '').toLowerCase() === leadValue);
    }

    return results;
}

function matchesQuery(project, query) {
    const haystacks = [
        project.title,
        project.id,
        project.code,
        project.topic,
        project.summary,
        project.lead?.name,
        project.lead?.role,
        ...(project.tags || [])
    ];

    return haystacks.some((value) =>
        (value || '').toString().toLowerCase().includes(query)
    );
}

function sortProjects(projects, sortBy) {
    const sorted = [...projects];

    switch (sortBy) {
        case 'title':
            sorted.sort((a, b) => a.title.localeCompare(b.title));
            break;
        case 'members':
            sorted.sort((a, b) => (b.teamSize || 0) - (a.teamSize || 0));
            break;
        case 'updated':
        default:
            sorted.sort((a, b) => {
                const dateA = new Date(a.updated || 0).getTime();
                const dateB = new Date(b.updated || 0).getTime();
                return dateB - dateA;
            });
            break;
    }

    return sorted;
}

function renderProjects(projects, elements) {
    if (!elements.grid) return;

    elements.grid.innerHTML = '';
    if (elements.countBadge) {
        elements.countBadge.textContent = projects.length;
    }

    if (!projects.length) {
        if (elements.emptyState) elements.emptyState.style.display = 'block';
        return;
    }

    if (elements.emptyState) elements.emptyState.style.display = 'none';

    const fragment = document.createDocumentFragment();
    projects.forEach((project) => {
        fragment.appendChild(createProjectCard(project));
    });
    elements.grid.appendChild(fragment);
}

function createProjectCard(project) {
    const card = document.createElement('article');
    card.className = 'project-card';
    card.tabIndex = 0;
    const hoverColor = extractPrimaryColor(project.image);
    card.style.setProperty('--project-hover-shadow', hoverColor);

    const image = document.createElement('div');
    image.className = 'project-image';
    image.style.background = buildGradient(project.image);

    const badgeContainer = document.createElement('div');
    badgeContainer.className = 'project-badges';

    const launchLabel = (() => {
        switch ((project.launchType || '').toLowerCase()) {
            case 'research':
                return 'Research';
            case 'lab':
                return 'Lab';
            default:
                return 'Project';
        }
    })();

    badgeContainer.appendChild(
        createBadge(launchLabel, 'launch', project.launchType)
    );

    badgeContainer.appendChild(
        createBadge(formatStage(project.stage), 'stage', project.stage)
    );

    image.appendChild(badgeContainer);
    card.appendChild(image);

    const content = document.createElement('div');
    content.className = 'project-content';
    card.appendChild(content);

    const heading = document.createElement('div');
    heading.className = 'project-heading';
    content.appendChild(heading);

    const codeBadge = document.createElement('span');
    codeBadge.className = 'project-code';
    codeBadge.textContent = (project.code || project.id || '').toString().toUpperCase();
    heading.appendChild(codeBadge);

    const title = document.createElement('h4');
    title.textContent = project.title;
    heading.appendChild(title);

    const lead = document.createElement('div');
    lead.className = 'project-lead';
    lead.textContent = formatLead(project.lead);
    content.appendChild(lead);

    const summary = document.createElement('p');
    summary.className = 'project-summary';
    summary.textContent = project.summary;
    content.appendChild(summary);

    const meta = document.createElement('div');
    meta.className = 'project-meta';
    meta.appendChild(createMetaItem('Stage', formatStage(project.stage)));
    meta.appendChild(createMetaItem('Funding', formatFunding(project)));
    meta.appendChild(createMetaItem('Requirements', formatRequirement(project.requirementLevel)));
    meta.appendChild(createMetaItem('Team', formatTeam(project.teamSize)));
    meta.appendChild(createMetaItem('Location', formatLocation(project.location, project.mode)));
    meta.appendChild(createMetaItem('Updated', formatDate(project.updated)));
    content.appendChild(meta);

    if (project.tags && project.tags.length > 0) {
        const tags = document.createElement('div');
        tags.className = 'project-tags';
        project.tags.forEach((tag) => {
            const span = document.createElement('span');
            span.className = 'tag';
            span.textContent = tag;
            tags.appendChild(span);
        });
        content.appendChild(tags);
    }

    card.addEventListener('click', () => openProjectPreview(project));
    card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openProjectPreview(project);
        }
    });

    return card;
}

function buildGradient(image) {
    if (!image || image.type !== 'gradient' || !Array.isArray(image.colors) || !image.colors.length) {
        return 'linear-gradient(135deg, #3b82f6, #8b5cf6)';
    }

    const direction = image.direction || '135deg';
    return `linear-gradient(${direction}, ${image.colors.join(', ')})`;
}

function extractPrimaryColor(image) {
    if (!image) return 'rgba(59, 130, 246, 0.35)';
    if (Array.isArray(image.colors) && image.colors.length > 0) {
        return hexToRgba(image.colors[0], 0.45);
    }
    if (typeof image === 'string') {
        const match = image.match(/#([0-9a-fA-F]{6})/);
        if (match) return hexToRgba(`#${match[1]}`, 0.45);
    }
    return 'rgba(59, 130, 246, 0.35)';
}

function hexToRgba(hex, alpha = 1) {
    const normalized = hex.replace('#', '');
    if (normalized.length !== 6) return `rgba(59, 130, 246, ${alpha})`;
    const bigint = parseInt(normalized, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function createBadge(text, type, modifier = '') {
    const badge = document.createElement('span');
    const normalizedModifier = modifier ? ` ${type}-${sanitizeClassName(modifier)}` : '';
    badge.className = `badge badge-${type}${normalizedModifier}`;
    badge.textContent = text;
    return badge;
}

function createMetaItem(label, value) {
    const item = document.createElement('span');
    item.className = 'meta-item';

    const labelEl = document.createElement('span');
    labelEl.className = 'meta-label';
    labelEl.textContent = label;

    const valueEl = document.createElement('span');
    valueEl.className = 'meta-value';
    valueEl.textContent = value;

    item.append(labelEl, valueEl);
    return item;
}

function formatStage(stage) {
    const map = {
        proposal: 'Proposal',
        'in-progress': 'In Progress',
        pilot: 'Pilot Study',
        finished: 'Finished',
        published: 'Published',
        concluded: 'Concluded'
    };
    return map[(stage || '').toLowerCase()] || 'Planning';
}

function formatFunding(project) {
    const labels = {
        seeking: 'Seeking Funding',
        partial: 'Partially Funded',
        secured: 'Funding Secured'
    };

    const status = (project.fundingStatus || '').toLowerCase();
    const baseLabel = labels[status] || 'Funding TBD';

    if (!project.fundingNeeded || status === 'secured') {
        return baseLabel;
    }

    return `${baseLabel} · $${Number(project.fundingNeeded).toLocaleString()}`;
}

function formatRequirement(level) {
    const map = {
        low: 'Low',
        medium: 'Moderate',
        high: 'High'
    };
    return map[(level || '').toLowerCase()] || 'Not Specified';
}

function formatTeam(size) {
    if (!size) return 'Small Team';
    return `${size} ${size === 1 ? 'member' : 'members'}`;
}

function formatLocation(location, mode) {
    const loc = (location || '').replace(/-/g, ' ');
    const formattedLoc = loc ? capitalizeWords(loc) : 'Location TBD';

    if (!mode) return formattedLoc;
    const formattedMode = capitalizeWords(mode);
    return `${formattedLoc} · ${formattedMode}`;
}

function formatLead(lead) {
    if (!lead) return 'Lead: To be assigned';
    const { name, role, leadType } = lead;

    const parts = [];
    if (name) parts.push(name);
    if (role) parts.push(role);
    if (leadType) parts.push(capitalizeWords(leadType.replace(/-/g, ' ')));

    return parts.length ? parts.join(' · ') : 'Lead: To be assigned';
}

function formatDate(dateString) {
    if (!dateString) return '—';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function capitalizeWords(value) {
    return value
        .split(/\s+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function sanitizeClassName(value = '') {
    return value.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

function getLaunchModalElements() {
    return {
        openBtn: document.getElementById('project-launch-btn'),
        backdrop: document.getElementById('launch-modal-backdrop'),
        modal: document.getElementById('launch-modal'),
        closeBtn: document.getElementById('launch-modal-close'),
        cancelBtn: document.getElementById('launch-modal-cancel'),
        form: document.getElementById('project-create-form'),
        firstField: document.getElementById('project-title')
    };
}

function wireLaunchModal(elements) {
    if (!elements.modal || !elements.openBtn || !elements.backdrop) return;

    const openModal = () => {
        elements.modal.hidden = false;
        elements.backdrop.hidden = false;
        document.body.classList.add('modal-open');
        setTimeout(() => elements.firstField?.focus(), 50);
    };

    const closeModal = () => {
        elements.modal.hidden = true;
        elements.backdrop.hidden = true;
        document.body.classList.remove('modal-open');
        elements.openBtn?.focus();
    };

    elements.openBtn.addEventListener('click', openModal);
    elements.closeBtn?.addEventListener('click', closeModal);
    elements.cancelBtn?.addEventListener('click', closeModal);
    elements.backdrop.addEventListener('click', closeModal);

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !elements.modal.hidden) {
            closeModal();
        }
    });

    elements.form?.addEventListener('submit', (event) => {
        event.preventDefault();
        const formData = new FormData(elements.form);
        console.log('Launch submission (mock):', Object.fromEntries(formData.entries()));
        elements.form.reset();
        closeModal();
    });
}

function getPreviewModalElements() {
    return {
        modal: document.getElementById('preview-modal'),
        backdrop: document.getElementById('preview-modal-backdrop'),
        closeBtn: document.getElementById('preview-modal-close'),
        dismissBtn: document.getElementById('preview-modal-dismiss'),
        title: document.getElementById('preview-modal-title'),
        code: document.getElementById('preview-modal-code'),
        summary: document.getElementById('preview-modal-summary'),
        message: document.getElementById('preview-modal-message')
    };
}

function wirePreviewModal(elements) {
    if (!elements.modal || !elements.backdrop) return;
    previewModalElements = elements;

    const closePreview = () => {
        if (!previewModalElements) return;
        previewModalElements.modal.hidden = true;
        previewModalElements.backdrop.hidden = true;
        document.body.classList.remove('modal-open');
        if (lastPreviewTrigger && typeof lastPreviewTrigger.focus === 'function') {
            lastPreviewTrigger.focus();
        }
        lastPreviewTrigger = null;
    };

    elements.closeBtn?.addEventListener('click', closePreview);
    elements.dismissBtn?.addEventListener('click', closePreview);
    elements.backdrop.addEventListener('click', closePreview);

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && previewModalElements && !previewModalElements.modal.hidden) {
            closePreview();
        }
    });
}

function openProjectPreview(project) {
    if (!previewModalElements || !previewModalElements.modal) return;

    const active = document.activeElement;
    if (active && typeof active.focus === 'function') {
        lastPreviewTrigger = active;
    }

    previewModalElements.title.textContent = project.title || 'Project Preview';
    previewModalElements.code.textContent = (project.code || project.id || '').toString().toUpperCase();
    previewModalElements.summary.textContent = project.summary || 'No summary available.';
    previewModalElements.message.textContent = project.managerMessage || 'The project lead has not shared an update yet.';

    previewModalElements.modal.hidden = false;
    previewModalElements.backdrop.hidden = false;
    document.body.classList.add('modal-open');
}
