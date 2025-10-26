"""
Mock data for testing without API keys
"""

def get_mock_wordcloud():
    """Returns mock word cloud data"""
    return [
        {"text": "Large Language Models", "value": 150},
        {"text": "Multimodal Learning", "value": 130},
        {"text": "AI Safety", "value": 120},
        {"text": "Reinforcement Learning", "value": 110},
        {"text": "Computer Vision", "value": 105},
        {"text": "Natural Language Processing", "value": 100},
        {"text": "Diffusion Models", "value": 95},
        {"text": "Transformer Architecture", "value": 90},
        {"text": "Few-Shot Learning", "value": 85},
        {"text": "Neural Networks", "value": 80},
        {"text": "Deep Learning", "value": 78},
        {"text": "Generative AI", "value": 75},
        {"text": "AI Alignment", "value": 70},
        {"text": "Machine Learning", "value": 68},
        {"text": "Vision-Language Models", "value": 65},
        {"text": "Agent Systems", "value": 60},
        {"text": "Meta-Learning", "value": 58},
        {"text": "Explainable AI", "value": 55},
        {"text": "Transfer Learning", "value": 52},
        {"text": "Graph Neural Networks", "value": 50},
        {"text": "Attention Mechanisms", "value": 48},
        {"text": "Self-Supervised Learning", "value": 45},
        {"text": "Federated Learning", "value": 42},
        {"text": "Neural Architecture Search", "value": 40},
        {"text": "Robotics", "value": 38},
    ]

def get_mock_trending():
    """Returns mock trending topics with counts
    Format: [{"topic": "name", "count": 123}, ...]
    """
    return [
        {"topic": "Large Language Models", "count": 150},
        {"topic": "Multimodal Learning", "count": 130},
        {"topic": "AI Safety", "count": 120},
        {"topic": "Reinforcement Learning", "count": 110},
        {"topic": "Computer Vision", "count": 105},
        {"topic": "Diffusion Models", "count": 95},
        {"topic": "Natural Language Processing", "count": 90},
        {"topic": "Few-Shot Learning", "count": 85},
        {"topic": "Neural Networks", "count": 80},
        {"topic": "Deep Learning", "count": 78},
        {"topic": "Generative AI", "count": 75},
        {"topic": "Vision-Language Models", "count": 65},
        {"topic": "Agent Systems", "count": 60},
        {"topic": "Meta-Learning", "count": 58},
        {"topic": "Explainable AI", "count": 55},
    ]

def get_mock_researchers():
    """Returns mock researcher data"""
    return [
        {
            "name": "Dr. Alice Zhang",
            "affiliation": "MIT CSAIL",
            "country": "US",
            "link": "https://scholar.google.com/citations?user=alice_zhang",
            "topics": ["Large Language Models", "Natural Language Processing", "AI Safety"],
            "citations": 15420,
            "works_count": 87
        },
        {
            "name": "Prof. Mark Liu",
            "affiliation": "Stanford AI Lab",
            "country": "US",
            "link": "https://arxiv.org/a/liu_m_1.html",
            "topics": ["Multimodal Learning", "Vision-Language Models", "Computer Vision"],
            "citations": 12350,
            "works_count": 65
        },
        {
            "name": "Dr. Sarah Chen",
            "affiliation": "Google DeepMind",
            "country": "UK",
            "link": "https://scholar.google.com/citations?user=sarah_chen",
            "topics": ["Reinforcement Learning", "Agent Systems", "AI Safety"],
            "citations": 18900,
            "works_count": 52
        },
        {
            "name": "Prof. James Anderson",
            "affiliation": "UC Berkeley",
            "country": "US",
            "link": "https://scholar.google.com/citations?user=j_anderson",
            "topics": ["Deep Learning", "Neural Networks", "Transfer Learning"],
            "citations": 22100,
            "works_count": 120
        },
        {
            "name": "Dr. Elena Rodriguez",
            "affiliation": "Carnegie Mellon University",
            "country": "US",
            "link": "https://scholar.google.com/citations?user=e_rodriguez",
            "topics": ["Computer Vision", "Generative AI", "Diffusion Models"],
            "citations": 9800,
            "works_count": 45
        },
        {
            "name": "Prof. Wei Li",
            "affiliation": "Tsinghua University",
            "country": "CN",
            "link": "https://scholar.google.com/citations?user=wei_li",
            "topics": ["Natural Language Processing", "Large Language Models", "Machine Learning"],
            "citations": 14200,
            "works_count": 92
        },
        {
            "name": "Dr. Michael Brown",
            "affiliation": "Oxford University",
            "country": "UK",
            "link": "https://scholar.google.com/citations?user=m_brown",
            "topics": ["AI Safety", "AI Alignment", "Explainable AI"],
            "citations": 8500,
            "works_count": 38
        },
        {
            "name": "Prof. Yuki Tanaka",
            "affiliation": "University of Tokyo",
            "country": "JP",
            "link": "https://scholar.google.com/citations?user=y_tanaka",
            "topics": ["Robotics", "Reinforcement Learning", "Agent Systems"],
            "citations": 11200,
            "works_count": 68
        },
        {
            "name": "Dr. Sophie Martin",
            "affiliation": "ETH Zurich",
            "country": "CH",
            "link": "https://scholar.google.com/citations?user=s_martin",
            "topics": ["Meta-Learning", "Few-Shot Learning", "Transfer Learning"],
            "citations": 7600,
            "works_count": 41
        },
        {
            "name": "Prof. David Kumar",
            "affiliation": "IIT Delhi",
            "country": "IN",
            "link": "https://scholar.google.com/citations?user=d_kumar",
            "topics": ["Graph Neural Networks", "Deep Learning", "Machine Learning"],
            "citations": 6900,
            "works_count": 55
        }
    ]
