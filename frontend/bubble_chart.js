// Bubble Chart Visualization for AI Researchers
(function() {
    'use strict';

    // ========================================
    // Configuration & Constants
    // ========================================
    const API_BASE_URL = 'http://localhost:8000';
    const MAX_VISIBLE = 15; // Maximum nodes to display
    const HEIGHT = 640;
    const COLOR = getComputedStyle(document.documentElement)
        .getPropertyValue('--primary-color')?.trim() || '#cc0000';

    // ========================================
    // DOM Elements
    // ========================================
    const gridViewBtn = document.getElementById('grid-view-btn');
    const bubbleViewBtn = document.getElementById('bubble-view-btn');
    const bubbleSection = document.getElementById('bubble-section');
    const filtersSection = document.querySelector('.filters-section');
    const resultsSection = document.querySelector('.results-section');

    const topicPrompt = document.getElementById('topic-prompt');
    const topicInput = document.getElementById('topic-input');
    const topicSubmit = document.getElementById('topic-submit');
    const vizContainer = document.getElementById('viz-container');
    const bubbleSvg = d3.select('#bubble-svg');
    const messageDiv = document.getElementById('message');
    const controls = document.getElementById('controls');
    const backBtn = document.getElementById('back-btn');
    const currentTopicSpan = document.getElementById('current-topic');
    const nodeCountSpan = document.getElementById('node-count');
    const loadingDiv = document.getElementById('loading');

    // ========================================
    // State
    // ========================================
    let fullResearchers = [];
    let visibleNodes = [];
    let simulation = null;
    let state = { topic: null, mainId: null };

    // ========================================
    // View Toggle
    // ========================================
    gridViewBtn.addEventListener('click', () => {
        // Show grid view
        bubbleSection.style.display = 'none';
        filtersSection.style.display = 'block';
        resultsSection.style.display = 'block';
        gridViewBtn.classList.remove('btn-secondary');
        gridViewBtn.classList.add('btn-primary');
        bubbleViewBtn.classList.remove('btn-primary');
        bubbleViewBtn.classList.add('btn-secondary');
    });

    bubbleViewBtn.addEventListener('click', () => {
        // Show bubble view
        bubbleSection.style.display = 'block';
        filtersSection.style.display = 'none';
        resultsSection.style.display = 'none';
        bubbleViewBtn.classList.remove('btn-secondary');
        bubbleViewBtn.classList.add('btn-primary');
        gridViewBtn.classList.remove('btn-primary');
        gridViewBtn.classList.add('btn-secondary');
    });

    // ========================================
    // Utility Functions
    // ========================================
    function worksCountOf(r) {
        return r.works || r.works_count || 0;
    }

    function scoreOf(r) {
        return (r.citations || 0) + worksCountOf(r);
    }

    function formatNumber(n) {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
        return String(n);
    }

    function hashStringToNumber(s) {
        let h = 0;
        for (let i = 0; i < s.length; i++) {
            h = (h << 5) - h + s.charCodeAt(i);
            h |= 0;
        }
        return Math.abs(h);
    }

    // ========================================
    // Data Fetching
    // ========================================
    async function fetchResearchers(topic) {
        loadingDiv.style.display = 'flex';
        messageDiv.style.display = 'none';
        vizContainer.style.display = 'none';
        controls.style.display = 'none';

        try {
            const resp = await fetch(`${API_BASE_URL}/api/researchers?topic=${encodeURIComponent(topic)}`);
            if (!resp.ok) {
                throw new Error(`HTTP ${resp.status}`);
            }
            const json = await resp.json();
            const arr = Array.isArray(json) ? json : (json.researchers || []);

            // Normalize data from OpenAlex
            const normalized = arr.map((r, i) => ({
                id: r.id || r.name?.replace(/\s+/g, '_') + '_' + i,
                name: r.name || `Researcher_${i}`,
                topics: r.topics || [],
                citations: r.citations || r.cited_by_count || 0,
                works: r.works || r.works_count || 0,
                affiliation: r.affiliation || r.institution || '',
                link: r.link || '#',
                raw: r
            }));

            fullResearchers = normalized;
            loadingDiv.style.display = 'none';
            return normalized;
        } catch (err) {
            loadingDiv.style.display = 'none';
            console.error('Error fetching researchers:', err);
            throw err;
        }
    }

    // ========================================
    // Rendering
    // ========================================
    function chooseMainNode(nodes) {
        if (!nodes || nodes.length === 0) return null;
        return nodes.reduce((best, cur) =>
            scoreOf(cur) > scoreOf(best) ? cur : best, nodes[0]
        );
    }

    function nodeRadiusFn(score, maxScore) {
        const minR = 18;
        const maxR = 90;
        if (!maxScore || maxScore <= 0) return minR;
        const scaled = minR + (Math.sqrt(score) / Math.sqrt(maxScore)) * (maxR - minR);
        return Math.max(minR, Math.min(maxR, scaled));
    }

    function renderTopicFromData(topic, data) {
        state.topic = topic;

        if (data.length === 0) {
            showNoResults(topic);
            return;
        }

        fullResearchers = data.slice();
        const sorted = data.slice().sort((a, b) => scoreOf(b) - scoreOf(a));
        visibleNodes = sorted.slice(0, MAX_VISIBLE);

        currentTopicSpan.textContent = `Topic: ${topic}`;
        nodeCountSpan.textContent = `${data.length} researcher(s) (showing ${visibleNodes.length})`;

        topicPrompt.style.display = 'none';
        controls.style.display = 'flex';
        vizContainer.style.display = 'block';
        messageDiv.style.display = 'none';

        const main = chooseMainNode(visibleNodes);
        state.mainId = main.id;

        const nodesData = visibleNodes.map(d => ({
            ...d,
            isMain: d.id === state.mainId
        }));

        const links = nodesData.filter(d => !d.isMain)
            .map(d => ({ source: state.mainId, target: d.id }));

        const maxScore = d3.max(nodesData, d => scoreOf(d));
        startSimulation(nodesData, links, maxScore);
    }

    function showNoResults(topic) {
        topicPrompt.style.display = 'none';
        controls.style.display = 'none';
        vizContainer.style.display = 'none';
        messageDiv.style.display = 'block';
        messageDiv.textContent = `No researchers found for topic "${topic}". Try another topic.`;
    }

    // ========================================
    // D3 Force Simulation
    // ========================================
    function startSimulation(nodes, links, maxScore) {
        bubbleSvg.selectAll('*').remove();

        const w = Math.max(800, document.querySelector('.container').clientWidth - 80);
        const h = HEIGHT;
        bubbleSvg.attr('width', w).attr('height', h);

        // Tooltip
        const tooltip = d3.select('body')
            .append('div')
            .attr('class', 'bubble-tooltip')
            .style('position', 'absolute')
            .style('pointer-events', 'none')
            .style('opacity', 0)
            .style('z-index', 10000);

        // Links
        const link = bubbleSvg.append('g').attr('class', 'links')
            .selectAll('line')
            .data(links)
            .enter()
            .append('line')
            .attr('stroke', '#f8d7da')
            .attr('stroke-width', 1.5)
            .attr('opacity', 0.9);

        // Node groups
        const nodeG = bubbleSvg.append('g').attr('class', 'nodes')
            .selectAll('g')
            .data(nodes, d => d.id)
            .enter()
            .append('g')
            .attr('class', d => d.isMain ? 'node main-node' : 'node sub-node')
            .style('cursor', 'pointer')
            .on('mouseover', function(event, d) {
                const html = `
                    <div class="tt-name">${d.name}</div>
                    <div class="tt-topics">Topics: ${(d.topics && d.topics.join(', ')) || '-'}</div>
                    <div class="tt-aff">${d.affiliation ? 'Affiliation: ' + d.affiliation : ''}</div>
                    <div class="tt-cit">Citations: ${formatNumber(d.citations)}</div>
                    <div class="tt-works">Works: ${formatNumber(d.works)}</div>
                `;
                tooltip.html(html)
                    .style('left', (event.pageX + 12) + 'px')
                    .style('top', (event.pageY + 12) + 'px')
                    .transition().duration(140).style('opacity', 1);

                d3.select(this).select('circle')
                    .transition().duration(150)
                    .attr('stroke-width', 3)
                    .attr('transform', 'scale(1.04)');
            })
            .on('mousemove', function(event) {
                tooltip.style('left', (event.pageX + 12) + 'px')
                       .style('top', (event.pageY + 12) + 'px');
            })
            .on('mouseout', function() {
                tooltip.transition().duration(120).style('opacity', 0).remove();
                d3.select(this).select('circle')
                    .transition().duration(150)
                    .attr('stroke-width', 1)
                    .attr('transform', 'scale(1)');
            })
            .on('click', function(event, d) {
                if (d.id === state.mainId) {
                    // Open link if clicking main node
                    if (d.link && d.link !== '#') {
                        window.open(d.link, '_blank');
                    }
                } else {
                    promoteToMain(d.id);
                }
            });

        // Circles
        nodeG.append('circle')
            .attr('r', d => {
                const s = scoreOf(d);
                return d.isMain ? nodeRadiusFn(s, maxScore) : nodeRadiusFn(s, maxScore) * 0.55;
            })
            .attr('fill', COLOR)
            .attr('fill-opacity', d => d.isMain ? 1 : 0.55)
            .attr('stroke', '#fff')
            .attr('stroke-width', 1)
            .attr('class', 'node-circle');

        // Name label
        nodeG.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', d => d.isMain ? '-0.12em' : '-0.1em')
            .attr('class', 'node-label name')
            .style('font-size', d => d.isMain ? '13px' : '10px')
            .style('font-weight', d => d.isMain ? 700 : 600)
            .style('pointer-events', 'none')
            .text(d => d.name);

        // Citations label
        nodeG.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', d => d.isMain ? '1.05em' : '1.2em')
            .attr('class', 'node-label citations')
            .style('font-size', d => d.isMain ? '12px' : '9px')
            .style('opacity', 0.95)
            .style('pointer-events', 'none')
            .text(d => `✦ ${formatNumber(d.citations || 0)}`);

        // Simulation
        const simNodes = nodes.map(d => Object.assign({}, d));
        const simLinks = links.map(l => ({ source: l.source, target: l.target }));

        if (simulation) simulation.stop();

        simulation = d3.forceSimulation(simNodes)
            .force('center', d3.forceCenter(w / 2, h / 2))
            .force('charge', d3.forceManyBody().strength(-120))
            .force('collide', d3.forceCollide(d => {
                const r = nodeRadiusFn(scoreOf(d), maxScore) * (d.isMain ? 1.1 : 0.6);
                return r + 6;
            }))
            .force('link', d3.forceLink(simLinks).id(d => d.id).distance(d => {
                const target = simNodes.find(n => n.id === d.target.id);
                return target && target.isMain ? (nodeRadiusFn(scoreOf(target), maxScore) * 1.6) : 120;
            }).strength(0.9))
            .force('mainFix', forceMainFixed(simNodes[0], w / 2, h / 2))
            .force('radial', d3.forceRadial(d => d.isMain ? 0 : computeOrbitRadius(d, maxScore), w / 2, h / 2).strength(0.95))
            .alphaDecay(0.02)
            .on('tick', ticked);

        // Orbiting animation
        const tStart = Date.now();
        d3.timer(() => {
            const t = (Date.now() - tStart) / 1000;
            nodeG.attr('transform', function(d) {
                const n = simNodes.find(n2 => n2.id === d.id) || d;
                if (!n) return null;
                if (!n.isMain) {
                    const angle = (t * 0.5) + (hashStringToNumber(n.id) % 10) * 0.6;
                    const amp = 4 + (hashStringToNumber(n.id) % 6);
                    const dx = Math.cos(angle) * amp;
                    const dy = Math.sin(angle) * amp;
                    return `translate(${(n.x + dx)}, ${(n.y + dy)})`;
                }
                return `translate(${n.x}, ${n.y})`;
            });

            link.attr('x1', d => {
                const s = simNodes.find(n => n.id === d.source.id || n.id === d.source);
                return s ? s.x : d.source.x;
            }).attr('y1', d => {
                const s = simNodes.find(n => n.id === d.source.id || n.id === d.source);
                return s ? s.y : d.source.y;
            }).attr('x2', d => {
                const t = simNodes.find(n => n.id === d.target.id || n.id === d.target);
                return t ? t.x : d.target.x;
            }).attr('y2', d => {
                const t = simNodes.find(n => n.id === d.target.id || n.id === d.target);
                return t ? t.y : d.target.y;
            });

            if (simulation.alpha() < 0.005) return true;
            return false;
        }, 100);

        function ticked() {
            nodeG.attr('transform', function(d) {
                const n = simNodes.find(n2 => n2.id === d.id) || d;
                if (!n) return null;
                return `translate(${n.x}, ${n.y})`;
            });
        }

        function promoteToMain(clickedId) {
            const idx = simNodes.findIndex(n => n.id === clickedId);
            if (idx === -1) return;

            simNodes.forEach(n => n.isMain = false);
            simNodes[idx].isMain = true;

            const newMain = simNodes.splice(idx, 1)[0];
            simNodes.unshift(newMain);

            const newLinks = simNodes.slice(1).map(d => ({ source: simNodes[0].id, target: d.id }));
            const newMax = d3.max(simNodes, d => scoreOf(d));

            bubbleSvg.selectAll('.node')
                .data(simNodes, d => d.id)
                .select('circle')
                .transition().duration(700)
                .attr('r', d => d.isMain ? nodeRadiusFn(scoreOf(d), newMax) : nodeRadiusFn(scoreOf(d), newMax) * 0.55)
                .attr('fill-opacity', d => d.isMain ? 1 : 0.55);

            bubbleSvg.selectAll('.node .name')
                .transition().duration(450)
                .style('font-size', d => d.isMain ? '13px' : '10px')
                .style('font-weight', d => d.isMain ? 700 : 600);

            bubbleSvg.selectAll('.node .citations')
                .transition().duration(450)
                .style('font-size', d => d.isMain ? '12px' : '9px')
                .text(d => `✦ ${formatNumber(d.citations || 0)}`);

            link.data(newLinks, d => d.source + '-' + d.target);

            simulation.nodes(simNodes);
            simulation.force('link').links(newLinks);
            simulation.force('mainFix', forceMainFixed(simNodes[0], w / 2, h / 2));
            simulation.force('radial', d3.forceRadial(d => d.isMain ? 0 : computeOrbitRadius(d, newMax), w / 2, h / 2).strength(0.95));

            simulation.alpha(0.9).restart();
            state.mainId = clickedId;
        }

        function computeOrbitRadius(d, maxScore) {
            const s = scoreOf(d);
            const base = nodeRadiusFn(s, maxScore);
            return Math.max(140, base * 2.1 + 80 + (hashStringToNumber(d.id) % 80));
        }
    }

    function forceMainFixed(mainNode, cx, cy) {
        function force(alpha) {
            if (!mainNode) return;
            mainNode.x += (cx - mainNode.x) * 0.5 * alpha;
            mainNode.y += (cy - mainNode.y) * 0.5 * alpha;
            mainNode.vx = 0;
            mainNode.vy = 0;
        }
        force.initialize = function() {};
        return force;
    }

    // ========================================
    // Event Handlers
    // ========================================
    topicSubmit.addEventListener('click', async () => {
        const topic = topicInput.value && topicInput.value.trim();
        if (!topic) {
            topicInput.focus();
            return;
        }
        try {
            const data = await fetchResearchers(topic);
            renderTopicFromData(topic, data);
        } catch (err) {
            messageDiv.style.display = 'block';
            messageDiv.textContent = 'Failed to load researchers. Try again later.';
        }
    });

    topicInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') topicSubmit.click();
    });

    backBtn.addEventListener('click', () => {
        topicPrompt.style.display = 'flex';
        vizContainer.style.display = 'none';
        controls.style.display = 'none';
        messageDiv.style.display = 'none';
        bubbleSvg.selectAll('*').remove();
        fullResearchers = [];
        visibleNodes = [];
        state = { topic: null, mainId: null };
        if (simulation) {
            simulation.stop();
            simulation = null;
        }
    });

    // Window resize handler
    window.addEventListener('resize', () => {
        if (!state.topic) return;
        renderTopicFromData(state.topic, fullResearchers);
    });

})();
