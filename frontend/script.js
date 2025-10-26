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
  renderTopicNetwork();
  updateDashboardStats();
}

async function renderTopicNetwork() {
  const loadingEl = document.getElementById('network-loading');
  loadingEl.style.display = 'block';

  let topics = [];
  try {
    const res = await fetchAPI('/api/trending');
    // Accept either array or { topics: [...] } shapes
    if (Array.isArray(res)) topics = res;
    else if (res && Array.isArray(res.topics)) topics = res.topics;
    else if (res && Array.isArray(res.data)) topics = res.data;
    else {
      // If backend returns object with counts, attempt to coerce
      if (res && typeof res === 'object') {
        // Try to extract a list-like value
        const vals = Object.values(res).find(v => Array.isArray(v));
        if (Array.isArray(vals)) topics = vals;
      }
    }
  } catch (err) {
    console.warn('Trending API failed — using mock topics.');
    topics = [
      { topic: "Large Language Models", count: 150 },
      { topic: "AI Safety", count: 120 },
      { topic: "Computer Vision", count: 100 },
      { topic: "Reinforcement Learning", count: 80 },
      { topic: "Prompt Engineering", count: 70 },
      { topic: "Optimization", count: 65 },
      { topic: "Bias & Fairness", count: 60 },
      { topic: "Diffusion Models", count: 55 },
      { topic: "Quantum AI", count: 50 },
      { topic: "Transformers", count: 45 },
      { topic: "Neural Networks", count: 40 },
      { topic: "Data Efficiency", count: 35 },
      { topic: "AI Ethics", count: 30 },
      { topic: "Causal Inference", count: 28 },
      { topic: "Autonomous Agents", count: 25 },
      { topic: "Speech Recognition", count: 24 },
      { topic: "Graph Neural Networks", count: 22 },
      { topic: "Representation Learning", count: 20 },
      { topic: "AI Governance", count: 18 },
      { topic: "Federated Learning", count: 15 },
    ];
  }

  // Normalize incoming items to {name, value}
  const normalized = topics.slice(0, 50).map((t) => {
    if (typeof t === 'string') return { name: t, value: 1 };
    return {
      name: t.topic || t.name || t.label || t.id || 'Unknown',
      value: Number(t.count || t.value || t.freq || 1)
    };
  });

  // If no data, show message
  if (!normalized.length) {
    loadingEl.textContent = 'No trending topics available.';
    return;
  }

  // Build token sets for similarity
  const tokenize = (s) => {
    return s
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .map(tok => tok.replace(/\d+/g, '')); // remove pure numbers
  };

  const topicObjs = normalized.map(d => {
    const tokens = new Set(tokenize(d.name));
    return { name: d.name, value: d.value, tokens };
  });

  // Pairwise Jaccard similarity
  function jaccard(aSet, bSet) {
    const a = Array.from(aSet);
    const b = Array.from(bSet);
    const inter = a.filter(x => bSet.has(x)).length;
    const union = new Set([...a, ...b]).size || 1;
    return inter / union;
  }

  // Create edges for pairs with similarity above threshold
  const links = [];
  for (let i = 0; i < topicObjs.length; i++) {
    for (let j = i + 1; j < topicObjs.length; j++) {
      const s = jaccard(topicObjs[i].tokens, topicObjs[j].tokens);
      if (s > 0.18) { // threshold tuned for meaningful relatedness
        links.push({
          source: i,
          target: j,
          weight: s
        });
      }
    }
  }

  // Build nodes array (with id and cluster placeholder)
  const nodes = topicObjs.map((t, i) => ({ id: i, name: t.name, value: t.value, tokens: t.tokens }));

  // Simple greedy clustering: create clusters by similarity to cluster token centroid
  const clusters = [];
  const clusterAssign = new Array(nodes.length).fill(-1);
  const CLUSTER_SIM_THRESHOLD = 0.25;
  nodes.forEach((node, idx) => {
    // try assign to existing cluster if similar enough to centroid
    let assigned = false;
    for (let c = 0; c < clusters.length; c++) {
      const centroidTokens = clusters[c].centroid;
      const sim = jaccard(node.tokens, centroidTokens);
      if (sim >= CLUSTER_SIM_THRESHOLD) {
        clusters[c].members.push(idx);
        // update centroid as union (simple)
        centroidTokens.forEach(tok => {});
        node.tokens.forEach(tok => centroidTokens.add(tok));
        clusterAssign[idx] = c;
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      // create new cluster
      const newCentroid = new Set(node.tokens);
      clusters.push({ centroid: newCentroid, members: [idx] });
      clusterAssign[idx] = clusters.length - 1;
    }
  });

  // Limit number of clusters to a reasonable number (merge extras) - optional
  // Map cluster index -> color
  const pastelPalette = [
    '#c7e9f1', '#e9d5ff', '#ffe7c7', '#e2f7d5', '#fbe4f2', '#f0f9ff', '#fef3c7'
  ];
  // ensure at least as many colors as clusters (repeat if needed)
  const clusterColor = (cIdx) => pastelPalette[cIdx % pastelPalette.length];

  // Prepare D3 simulation
  const svg = d3.select('#graph-svg');
  svg.selectAll('*').remove(); // clear old graph

  const width = parseInt(svg.style('width')) || 1200;
  const height = parseInt(svg.style('height')) || 600;

  // Compute node radii based on value (log scale to avoid huge sizes)
  const values = nodes.map(n => n.value || 1);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const radiusScale = d3.scaleSqrt().domain([minV, maxV]).range([10, 42]);

  // Convert link indices to node ids for d3 force
  const d3Links = links.map(l => ({
    source: l.source,
    target: l.target,
    weight: l.weight
  }));

  // Add defs for marker if needed (not necessary now)

  // Force simulation
  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(d3Links).id(d => d.id).distance(d => {
      // stronger similarity => shorter distance
      const link = d3Links.find(l => (l.source === d.source?.id && l.target === d.target?.id) || (l.source === d.target?.id && l.target === d.source?.id));
      return link ? 120 - (link.weight * 80) : 220;
    }).strength(l => l.weight * 0.9))
    .force('charge', d3.forceManyBody().strength(-160))
    .force('center', d3.forceCenter(width / 2, height / 2))
    // use collision radius accounting for labels to avoid overlap
    .force('collide', d3.forceCollide().radius(d => {
      const r = radiusScale(d.value);
      // add label padding. We'll approximate label width by characters * 6 (enough for our font-size)
      const approxLabelWidth = Math.min(220, (d.name.length * 7));
      const extra = Math.sqrt(approxLabelWidth * approxLabelWidth + 16 * 16) / 2;
      return r + extra + 6;
    }).iterations(2))
    .alphaDecay(0.02)
    .on('tick', ticked);

  // Draw links
  const linkG = svg.append('g').attr('class', 'links');
  const link = linkG.selectAll('line')
    .data(d3Links)
    .enter()
    .append('line')
    .attr('class', 'link-line')
    .attr('stroke-width', d => Math.max(1, d.weight * 2.2));

  // Draw nodes group
  const nodeG = svg.append('g').attr('class', 'nodes');

  const node = nodeG.selectAll('g.node')
    .data(nodes)
    .enter()
    .append('g')
    .attr('class', 'node')
    .call(drag(simulation));

  // circle
  node.append('circle')
    .attr('class', 'node-circle')
    .attr('r', d => radiusScale(d.value))
    .attr('fill', d => clusterColor(clusterAssign[d.id]));

  // label (always visible)
  node.append('text')
    .attr('class', 'node-label')
    .attr('dy', d => -radiusScale(d.value) - 6)
    .text(d => d.name)
    .each(function(d) {
      // wrap long labels into multiple lines if too long (improve layout)
      const self = d3.select(this);
      const words = d.name.split(/\s+/);
      if (words.length > 3 || d.name.length > 18) {
        self.text('');
        let line = [];
        let lineNumber = 0;
        const lineHeight = 12;
        let tspan = self.append('tspan').attr('x', 0).attr('dy', -radiusScale(d.value) - 6 + 'px').attr('text-anchor','middle');
        words.forEach((word) => {
          line.push(word);
          tspan.text(line.join(' '));
          if (tspan.node().getComputedTextLength() > 160) {
            line.pop();
            tspan.text(line.join(' '));
            line = [word];
            lineNumber++;
            tspan = self.append('tspan').attr('x', 0).attr('dy', (lineNumber * lineHeight) + 'px').text(word).attr('text-anchor','middle');
          }
        });
      }
    });

  // small count text inside/near node if large enough
  node.append('text')
    .attr('class', 'node-count')
    .attr('dy', d => 4)
    .text(d => d.value > 9 ? d.value : '');

  // click behavior: go to people.html?topic=<name>
  node.on('click', (event, d) => {
    const topic = d.name;
    window.location.href = `people.html?topic=${encodeURIComponent(topic)}`;
  });

  // show legend (cluster chips)
  renderLegend(svg, clusters.map((c, idx) => ({ idx, count: c.members.length })));

  // hide loading
  loadingEl.style.display = 'none';

  // update positions on each tick
  function ticked() {
  const margin = 60; // keep small padding around the edges
  const w = width;
  const h = height;

  // Clamp node positions to stay within bounds
  nodes.forEach((d) => {
    const r = radiusScale(d.value);
    d.x = Math.max(r + margin, Math.min(w - r - margin, d.x));
    d.y = Math.max(r + margin, Math.min(h - r - margin, d.y));
  });

  // Update link positions
  link
    .attr('x1', d => Math.max(margin, Math.min(w - margin, d.source.x)))
    .attr('y1', d => Math.max(margin, Math.min(h - margin, d.source.y)))
    .attr('x2', d => Math.max(margin, Math.min(w - margin, d.target.x)))
    .attr('y2', d => Math.max(margin, Math.min(h - margin, d.target.y)));

  // Update node group positions
  node.attr('transform', d => `translate(${d.x},${d.y})`);
}

  // make canvas responsive: recompute center
  window.addEventListener('resize', () => {
    const w = svg.node().clientWidth;
    const h = svg.node().clientHeight;
    simulation.force('center', d3.forceCenter(w / 2, h / 2));
    simulation.alpha(0.5).restart();
  });

  // Drag helpers
  function drag(sim) {
    function started(event, d) {
      if (!event.active) sim.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }
    function ended(event, d) {
      if (!event.active) sim.alphaTarget(0);
      // Keep nodes free (no permanent fixed positions)
      d.fx = null;
      d.fy = null;
    }
    return d3.drag()
      .on('start', started)
      .on('drag', dragged)
      .on('end', ended);
  }

  // Render a simple legend overlay for clusters
  function renderLegend(svgRoot, clusterInfo) {
    // create a small HTML legend inside the graph container for clarity
    // remove older legend if present
    d3.selectAll('.graph-legend').remove();

    const container = d3.select('#graph-container');
    const legend = container.append('div').attr('class', 'graph-legend');

    clusterInfo.slice(0, 8).forEach(ci => {
      const chip = legend.append('div').attr('class', 'legend-chip');
      chip.append('div')
        .attr('class', 'legend-swatch')
        .style('background', clusterColor(ci.idx));
      chip.append('div').text(`Group ${ci.idx + 1} (${ci.count})`);
    });
  }
}

/* -------------------------
   Dashboard stats 
   ------------------------- */
function updateDashboardStats() {
  const trendingTopics = ["Deep Learning", "NLP", "Computer Vision", "AI Safety"];
  const activeResearchers = 128;
  const recentPapers = 45;
  document.getElementById("stat-topics").textContent = trendingTopics.join(", ");
  document.getElementById("stat-researchers").textContent = activeResearchers;
  document.getElementById("stat-papers").textContent = recentPapers;
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
