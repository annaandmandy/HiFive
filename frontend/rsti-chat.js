// RSTI-based Chat Initialization
const API_BASE_URL = 'http://localhost:8000';

export async function initRSTIChat() {
    const rstiResult = JSON.parse(localStorage.getItem('RSTI_RESULT') || '{}');
    const rstiType = rstiResult.type;

    if (!rstiType) {
        console.error('No RSTI result found');
        return null;
    }

    let conversationHistory = [];
    let currentRound = 0;
    const MAX_ROUNDS = 3;
    let recommendedTopics = [];

    // Get major from user
    const major = await promptForMajor();
    if (!major) return null;

    // Start the conversation
    const initialResponse = await callRSTIAdvisor(rstiType, major, conversationHistory, null);
    if (!initialResponse) return null;

    conversationHistory = initialResponse.conversation_history;

    // Show initial question
    addRhettMessage(initialResponse.reply);

    return {
        handleChoice: async (choice) => {
            if (initialResponse.is_final || currentRound >= MAX_ROUNDS) {
                return { isComplete: true, topics: recommendedTopics };
            }

            // Send choice and get next question
            const response = await callRSTIAdvisor(rstiType, major, conversationHistory, choice);
            if (!response) return { isComplete: false };

            conversationHistory = response.conversation_history;
            currentRound++;

            addRhettMessage(response.reply);

            if (response.is_final) {
                recommendedTopics = response.recommended_topics;
                return { isComplete: true, topics: recommendedTopics };
            }

            return { isComplete: false };
        }
    };
}

async function promptForMajor() {
    // Create a custom modal/prompt for major input
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        modal.innerHTML = `
            <div style="background: white; padding: 2rem; border-radius: 12px; max-width: 500px; width: 90%;">
                <h2 style="margin-bottom: 1rem; color: var(--dark-color);">Let's Find Your Research Direction!</h2>
                <p style="margin-bottom: 1.5rem; color: var(--text-secondary);">First, tell me about your academic background:</p>
                <input
                    type="text"
                    id="major-input"
                    placeholder="E.g., Data Science, Biology, Physics..."
                    style="width: 100%; padding: 0.75rem; border: 2px solid var(--border-color); border-radius: 8px; font-size: 1rem; margin-bottom: 1rem;"
                />
                <button
                    id="major-submit"
                    style="width: 100%; padding: 0.75rem; background: var(--primary-color); color: white; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer;"
                >
                    Let's Begin!
                </button>
            </div>
        `;

        document.body.appendChild(modal);

        const input = modal.querySelector('#major-input');
        const button = modal.querySelector('#major-submit');

        const submit = () => {
            const value = input.value.trim();
            if (value) {
                document.body.removeChild(modal);
                // Save major to localStorage
                localStorage.setItem('USER_MAJOR', value);
                resolve(value);
            }
        };

        button.addEventListener('click', submit);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') submit();
        });

        input.focus();
    });
}

async function callRSTIAdvisor(rstiType, major, conversationHistory, choice) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/rsti-advisor`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                rsti_type: rstiType,
                major: major,
                conversation_history: conversationHistory,
                choice: choice
            })
        });

        if (!response.ok) {
            throw new Error('Failed to get advisor response');
        }

        return await response.json();
    } catch (error) {
        console.error('Error calling RSTI advisor:', error);
        return null;
    }
}

function addRhettMessage(message) {
    const messagesContainer = document.getElementById('chat-messages');
    const welcomeContainer = document.getElementById('rhett-welcome');
    const chatWrapper = document.getElementById('chat-wrapper');

    // Hide welcome, show chat
    if (welcomeContainer) welcomeContainer.style.display = 'none';
    if (chatWrapper) chatWrapper.style.display = 'block';

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message rhett-message';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = message;

    messageDiv.appendChild(contentDiv);
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

export function addBinaryChoiceButtons(callback) {
    const messagesContainer = document.getElementById('chat-messages');

    const choiceDiv = document.createElement('div');
    choiceDiv.className = 'binary-choice-container';
    choiceDiv.style.cssText = `
        display: flex;
        gap: 1rem;
        margin: 1rem 0;
        justify-content: center;
    `;

    const button1 = document.createElement('button');
    button1.textContent = 'Option 1';
    button1.className = 'btn btn-primary';
    button1.style.cssText = 'padding: 0.75rem 2rem; font-size: 1rem;';
    button1.onclick = async () => {
        choiceDiv.remove();
        const result = await callback('1');
        if (!result.isComplete) {
            addBinaryChoiceButtons(callback);
        }
    };

    const button2 = document.createElement('button');
    button2.textContent = 'Option 2';
    button2.className = 'btn btn-secondary';
    button2.style.cssText = 'padding: 0.75rem 2rem; font-size: 1rem;';
    button2.onclick = async () => {
        choiceDiv.remove();
        const result = await callback('2');
        if (!result.isComplete) {
            addBinaryChoiceButtons(callback);
        }
    };

    choiceDiv.appendChild(button1);
    choiceDiv.appendChild(button2);
    messagesContainer.appendChild(choiceDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}
