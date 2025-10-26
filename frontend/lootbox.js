// ===========================
// LOOT BOX FUNCTIONALITY
// ===========================

const API_BASE_URL = 'http://localhost:8000';

// DOM Elements
const openLootboxBtn = document.getElementById('openLootboxBtn');
const cardsContainer = document.getElementById('cardsContainer');
const loadingState = document.getElementById('loadingState');

// State
let isOpening = false;

// ===========================
// EVENT LISTENERS
// ===========================

openLootboxBtn.addEventListener('click', async () => {
    if (isOpening) return;
    await openLootbox();
});

// ===========================
// MAIN FUNCTIONS
// ===========================

async function openLootbox() {
    try {
        isOpening = true;
        openLootboxBtn.disabled = true;

        // Show loading state
        loadingState.style.display = 'block';
        cardsContainer.innerHTML = '';

        // Fetch capsules from API
        const response = await fetch(`${API_BASE_URL}/api/lootbox`);
        if (!response.ok) {
            throw new Error('Failed to fetch loot box');
        }

        const data = await response.json();
        const capsules = data.capsules;

        // Wait a bit for suspense
        await delay(1500);

        // Hide loading
        loadingState.style.display = 'none';

        // Display cards with staggered animation
        displayCards(capsules);

    } catch (error) {
        console.error('Error opening loot box:', error);
        loadingState.style.display = 'none';
        cardsContainer.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #e74c3c;">
                <h3>Oops! The capsule machine is jammed!</h3>
                <p>Rhett is working on fixing it. Please try again in a moment.</p>
            </div>
        `;
    } finally {
        isOpening = false;
        openLootboxBtn.disabled = false;
    }
}

function displayCards(capsules) {
    cardsContainer.innerHTML = '';

    capsules.forEach((capsule, index) => {
        setTimeout(() => {
            const card = createCard(capsule);
            cardsContainer.appendChild(card);

            // Add sound effect simulation
            playCardRevealSound(capsule.rarity);
        }, index * 200); // Stagger card reveals
    });
}

function createCard(capsule) {
    const card = document.createElement('div');
    card.className = `research-card ${capsule.rarity.toLowerCase()}`;

    // Format authors
    const authorsText = capsule.authors.length > 0
        ? capsule.authors.join(', ')
        : 'Authors unavailable';

    // Format concepts
    const conceptsHTML = capsule.concepts.length > 0
        ? capsule.concepts.map(concept =>
            `<span class="concept-tag">${concept}</span>`
          ).join('')
        : '<span class="concept-tag">AI Research</span>';

    card.innerHTML = `
        <div class="card-rarity ${capsule.rarity.toLowerCase()}">
            ${capsule.rarity} - ${capsule.rarity_label}
        </div>
        <h3 class="card-title">${capsule.title}</h3>
        <div class="card-meta">
            <span class="card-year">📅 ${capsule.year}</span>
            <span class="card-citations">📊 ${capsule.citations.toLocaleString()} citations</span>
        </div>
        <div class="card-authors">
            <h4>Authors</h4>
            <p class="authors-list">${authorsText}</p>
        </div>
        <div class="card-concepts">
            ${conceptsHTML}
        </div>
        <a href="${capsule.link}" target="_blank" class="card-link">
            View Paper →
        </a>
    `;

    return card;
}

// ===========================
// HELPER FUNCTIONS
// ===========================

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function playCardRevealSound(rarity) {
    // Log card reveals for debugging
    if (rarity === 'SSR') {
        console.log('🎉 LEGENDARY CARD REVEALED! 🎉');
    } else if (rarity === 'SR') {
        console.log('✨ Epic card revealed!');
    } else if (rarity === 'R') {
        console.log('⭐ Rare card revealed!');
    } else {
        console.log('📄 Common card revealed.');
    }
}

// ===========================
// INITIALIZATION
// ===========================

console.log('🎁 Loot Box system initialized!');
console.log('🐕 Rhett says: "Ready to discover some amazing research!"');
