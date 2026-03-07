# SYNAPSE

> **AI-Powered Technology Intelligence & Automation Platform**

A FAANG-style production system that continuously collects, analyzes, and surfaces technology intelligence from across the internet — powered by LLMs, semantic search, autonomous AI agents, and a beautiful real-time dashboard.

## What is SYNAPSE?

SYNAPSE is a combination of:
- 🔍 **Perplexity AI** — semantic search over curated tech knowledge
- 📚 **Notion** — personal knowledge management + document generation
- ⚡ **Zapier** — no-code automation workflows
- 🐙 **GitHub** — repository intelligence and trend monitoring

Specialized exclusively for **technology, AI, software engineering, and research**.

## Architecture

```
Internet Sources (HN, arXiv, GitHub, YouTube)
        ↓
Data Collection Layer (Scrapy, Playwright, APIs)
        ↓
Message Queue (Celery + Redis)
        ↓
Processing Pipeline (NLP, embeddings, classification)
        ↓
Knowledge Storage (PostgreSQL + pgvector + Redis + S3)
        ↓
AI Layer (LangChain, OpenAI, spaCy, HuggingFace)
        ↓
Agentic AI (Autonomous agents, document generation)
        ↓
API Layer (Django REST + FastAPI + GraphQL)
        ↓
Frontend (Next.js + React + TailwindCSS)
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Django 4.2, FastAPI 0.104, Python 3.11 |
| Frontend | Next.js 14, React 18, TypeScript, TailwindCSS |
| Databases | PostgreSQL 15, Redis 7, pgvector |
| AI/ML | LangChain, OpenAI API, spaCy, HuggingFace |
| Scraping | Scrapy, BeautifulSoup4, Playwright |
| Queue | Celery 5.3 + Redis |
| DevOps | Docker, GitHub Actions, AWS |
| Monitoring | Prometheus, Grafana, Sentry |

## Key Features

- 📰 **Tech Intelligence Feed** — AI-summarized articles every 30 minutes
- 🔬 **Research Explorer** — arXiv papers with AI summaries and difficulty ratings
- 📡 **GitHub Radar** — trending repositories with star growth analytics
- 🤖 **AI Chat Assistant** — RAG-powered Q&A grounded in your knowledge base
- ⚙️ **Automation Center** — schedule workflows (collect → summarize → generate → upload)
- 📄 **Document Studio** — AI generates PDFs, PPTs, Word docs on demand
- 📚 **Knowledge Library** — personal collections, bookmarks, and notes
- 📈 **Technology Trend Radar** — track rising and falling technologies

## Documentation

All project documentation is in the `docs/` directory:

| Document | Description |
|----------|-------------|
| `01_SRS.pdf` | Software Requirements Specification |
| `02_Architecture_Design.pdf` | System Architecture & Design |
| `03_Database_Schema.pdf` | Complete Database Schema |
| `04_API_Specification.pdf` | REST API Specification |
| `05_Roadmap.pdf` | 22-Week Development Roadmap |
| `06_Implementation_Guide.pdf` | Step-by-step Implementation Guide |
| `07_UI_UX_Design.pdf` | UI/UX Design System |
| `08_DevOps_Deployment.pdf` | DevOps & Deployment Guide |
| `09_Security_Compliance.pdf` | Security & Compliance |
| `10_Testing_Strategy.pdf` | Testing Strategy |
| `11_Business_Plan.pdf` | Business Plan & Monetization |
| `12_Data_Pipeline.pdf` | Data Pipeline Design |
| `13_AI_Agent_Spec.pdf` | AI Agent Specification |
| `14_API_SDK_Guide.pdf` | API SDK Guide |
| `15_OSS_Stack.pdf` | Open Source Libraries & Stack |

## Development Setup

```bash
# Clone repository
git clone https://github.com/HayreKhan750/SYNAPSE.git
cd SYNAPSE

# Start all services with Docker
docker-compose up -d

# Backend setup
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver

# Frontend setup
cd frontend
npm install
npm run dev
```

## Project Status

🚧 **In Development** — See [TASKS.md](TASKS.md) for the full task list and progress tracking.

## License

MIT License — see [LICENSE](LICENSE) for details.

## GitHub Actions Workflows

The CI/CD workflow files are in `_workflows_temp/`. To enable them:
1. Go to your GitHub token settings and add the `workflow` scope
2. Move files: `cp _workflows_temp/*.yml .github/workflows/`
3. Push: `git add -A && git push origin main`

Alternatively, create the workflow files directly in GitHub UI under **Actions → New workflow**.
