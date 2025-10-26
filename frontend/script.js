// script.js

// API Configuration
const API_BASE_URL = 'http://localhost:8000';
const PROJECTS_DATA_URL = './mock_projects_real1.json';
const PROJECT_ASSET_FILES = [
    'Biomed.jpeg',
    'Biomed1.jpeg',
    'EconHis.jpg',
    'Itali-america.webp',
    'Jap.webp',
    'Neurophotonics.jpeg'
];
const PROJECT_ASSET_BASE_PATH = './assets/';
const resolvedProjectImages = new Map();
const LEAD_ASSET_FILES = [
    'BoasDavid.jpg',
    'DavidLagakos.jpeg',
    'EllaZeldich.jpg',
    'JamesPasto.jpeg',
    'PrattErica.jpeg',
    'SarahFrederick.jpg'
];
const LEAD_ASSET_BASE_PATH = './assets_prof_img/';
const resolvedLeadImages = new Map();
let previewModalElements = null;
let lastPreviewTrigger = null;
let trendingAutoMinimizeSuspended = false;
let lastTrendingIntersectionEntry = null;
let trendingObserver = null;
let trendingObserverTarget = null;

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

    // View toggle buttons
    const gridBtn = document.getElementById('grid-view-btn');
    const bubbleBtn = document.getElementById('bubble-view-btn');
    const swipeBtn = document.getElementById('swipe-view-btn');

    // Set grid as default active view
    if (gridBtn) gridBtn.classList.add('active');

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

    // Get button references
    const gridBtn = document.getElementById('grid-view-btn');
    const bubbleBtn = document.getElementById('bubble-view-btn');
    const swipeBtn = document.getElementById('swipe-view-btn');

    // Remove active class from all buttons
    if (gridBtn) gridBtn.classList.remove('active');
    if (bubbleBtn) bubbleBtn.classList.remove('active');
    if (swipeBtn) swipeBtn.classList.remove('active');

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
        if (gridBtn) gridBtn.classList.add('active');
    } else if (section === 'bubble') {
        if (bubbleSection) bubbleSection.style.display = '';
        if (bubbleBtn) bubbleBtn.classList.add('active');
    } else if (section === 'swipe') {
        if (swipeSection) {
            swipeSection.style.display = '';
            // build deck from currentResearchers
            buildSwipeDeck();
        }
        if (swipeBtn) swipeBtn.classList.add('active');
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
        assignProjectImages(projects);
        assignLeadImages(projects);
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
        topicSelect: document.getElementById('project-topic-filter'),
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

function assignProjectImages(projects) {
    resolvedProjectImages.clear();
    if (!Array.isArray(projects) || !projects.length) return;

    const descriptors = PROJECT_ASSET_FILES.map((file, index) => ({
        file,
        tokens: deriveAssetTokens(file),
        used: false,
        order: index
    }));

    const titleTokenCache = new Map();

    projects.forEach((project) => {
        const key = getProjectKey(project);
        if (!key) return;

        const title = (project.title || '').toString();
        let titleTokens = titleTokenCache.get(title);
        if (!titleTokens) {
            titleTokens = getTitleTokens(title);
            titleTokenCache.set(title, titleTokens);
        }

        let best = null;

        descriptors.forEach((descriptor) => {
            if (descriptor.used) return;
            const score = scoreAssetMatch(descriptor.tokens, titleTokens);
            if (!score) return;
            if (
                !best ||
                score > best.score ||
                (score === best.score && descriptor.tokens.length > best.descriptor.tokens.length)
            ) {
                best = { descriptor, score };
            }
        });

        if (best) {
            best.descriptor.used = true;
            resolvedProjectImages.set(key, `${PROJECT_ASSET_BASE_PATH}${best.descriptor.file}`);
        }
    });
}

function assignLeadImages(projects) {
    resolvedLeadImages.clear();
    if (!Array.isArray(projects) || !projects.length) return;

    const descriptors = LEAD_ASSET_FILES.map((file) => ({
        file,
        tokens: deriveAssetTokens(file)
    }));

    projects.forEach((project) => {
        const lead = project?.lead;
        const key = getLeadKey(lead);
        if (!key || resolvedLeadImages.has(key)) return;

        const tokens = getLeadNameTokens(lead.name);
        let best = null;

        descriptors.forEach((descriptor) => {
            const score = scoreAssetMatch(descriptor.tokens, tokens);
            if (!score) return;
            if (!best || score > best.score) {
                best = { descriptor, score };
            }
        });

        if (best) {
            resolvedLeadImages.set(key, `${LEAD_ASSET_BASE_PATH}${best.descriptor.file}`);
        }
    });
}

function getProjectBackgroundStyle(project) {
    const assetPath = resolveProjectImagePath(project);
    if (assetPath) {
        return `url("${assetPath}") center/cover no-repeat`;
    }
    return buildGradient(project.image);
}

function resolveProjectImagePath(project) {
    if (!project) return null;
    const key = getProjectKey(project);
    if (!key) return null;
    return resolvedProjectImages.get(key) || null;
}

function resolveLeadImagePath(lead) {
    const key = getLeadKey(lead);
    if (!key) return null;
    return resolvedLeadImages.get(key) || null;
}

function getProjectKey(project) {
    if (!project) return '';
    const raw = project.code || project.id || project.title;
    if (!raw) return '';
    return raw.toString().toUpperCase();
}

function getLeadKey(lead) {
    if (!lead || !lead.name) return '';
    return lead.name.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function deriveAssetTokens(fileName) {
    const base = fileName.replace(/\.[^.]+$/, '');
    return base
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[_\s-]+/g, ' ')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .map((token) => token.replace(/\d+/g, ''))
        .filter(Boolean);
}

function getTitleTokens(title) {
    if (!title) return [];
    return title
        .toLowerCase()
        .replace(/&/g, ' ')
        .split(/[^a-z0-9]+/)
        .filter(Boolean);
}

function getLeadNameTokens(name) {
    if (!name) return [];
    return name
        .toLowerCase()
        .replace(/&/g, ' ')
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length > 1);
}

function scoreAssetMatch(assetTokens, titleTokens) {
    if (!assetTokens.length || !titleTokens.length) return 0;
    let score = 0;
    assetTokens.forEach((token) => {
        if (!token) return;
        if (titleTokens.some((word) => word.startsWith(token))) {
            score += 1;
        }
    });
    return score;
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
        art.style.background = getProjectBackgroundStyle(project);

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
                lastTrendingIntersectionEntry = entry;
                if (trendingAutoMinimizeSuspended) return;
                setTrendingMinimized(!entry.isIntersecting);
            });
        },
        {
            root: null,
            threshold: 0,
            rootMargin: '-120px 0px 0px 0px'
        }
    );
    trendingObserver = observer;
    trendingObserverTarget = controlsContainer;
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
    controls.topicSelect && (controls.topicSelect.value = '');
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

    const topicValue = controls.topicSelect?.value;
    if (topicValue) {
        results = results.filter((project) => {
            if (Array.isArray(project.topics) && project.topics.length) {
                return project.topics.some((t) => t === topicValue);
            }
            const topic = (project.topic || '').toString();
            const normalized = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            return normalized.includes(topicValue);
        });
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
        ...(project.topics || []),
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
    image.style.background = getProjectBackgroundStyle(project);

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

    const leadAvatar = createLeadAvatar(project.lead);
    if (leadAvatar) {
        lead.appendChild(leadAvatar);
    }

    const leadText = document.createElement('div');
    leadText.className = 'project-lead-text';
    leadText.textContent = formatLead(project.lead);
    lead.appendChild(leadText);

    content.appendChild(lead);

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

function createLeadAvatar(lead) {
    const src = resolveLeadImagePath(lead);
    if (!src) return null;

    const img = document.createElement('img');
    img.className = 'project-lead-photo';
    img.src = src;
    img.alt = lead?.name ? `${lead.name} portrait` : 'Project lead portrait';
    img.loading = 'lazy';
    return img;
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
        trendingAutoMinimizeSuspended = false;
        if (trendingObserver && trendingObserverTarget) {
            trendingObserver.observe(trendingObserverTarget);
        }
        if (lastTrendingIntersectionEntry) {
            setTrendingMinimized(!lastTrendingIntersectionEntry.isIntersecting);
        }
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

    trendingAutoMinimizeSuspended = true;
    if (trendingObserver && trendingObserverTarget) {
        trendingObserver.unobserve(trendingObserverTarget);
    }
    setTrendingMinimized(false);

    previewModalElements.title.textContent = project.title || 'Project Preview';
    previewModalElements.code.textContent = (project.code || project.id || '').toString().toUpperCase();
    previewModalElements.summary.textContent = project.summary || 'No summary available.';
    previewModalElements.message.textContent = project.managerMessage || 'The project lead has not shared an update yet.';

    previewModalElements.modal.hidden = false;
    previewModalElements.backdrop.hidden = false;
    document.body.classList.add('modal-open');
}
