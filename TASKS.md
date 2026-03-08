# SYNAPSE — Master Task List & Roadmap

> Track every task from setup to production. Check off each item as you complete it, then commit and push.
>
> **Legend:** `[ ]` = pending | `[x]` = completed | `[~]` = in progress

---

## PHASE 0 — Pre-Development & Documentation

### 0.1 Documentation
- [x] Create SRS document (01_SRS.tex / PDF)
- [x] Create Architecture & Design document (02_Architecture_Design.tex / PDF)
- [x] Create Database Schema document (03_Database_Schema.tex / PDF)
- [x] Create API Specification document (04_API_Specification.tex / PDF)
- [x] Create Project Roadmap document (05_Roadmap.tex / PDF)
- [x] Create Implementation Guide (06_Implementation_Guide.tex / PDF)
- [x] Create UI/UX Design document (07_UI_UX_Design.tex / PDF)
- [x] Create DevOps & Deployment document (08_DevOps_Deployment.tex / PDF)
- [x] Create Security & Compliance document (09_Security_Compliance.tex / PDF)
- [x] Create Testing Strategy document (10_Testing_Strategy.tex / PDF)
- [x] Create Business Plan document (11_Business_Plan.tex / PDF)
- [x] Create Data Pipeline Design document (12_Data_Pipeline.tex / PDF)
- [x] Create AI Agent Specification document (13_AI_Agent_Spec.tex / PDF)
- [x] Create API SDK Guide (14_API_SDK_Guide.tex / PDF)
- [x] Create OSS Stack document (15_OSS_Stack.tex / PDF)

### 0.2 Repository Setup
- [x] Initialize Git repository
- [x] Create README.md
- [x] Create project directory structure
- [x] Push initial commit to GitHub
- [x] Create .gitignore (Python, Node, Docker, IDE files)
- [x] Create LICENSE file (MIT)
- [~] Set up GitHub branch protection rules (main branch) — requires GitHub token with admin:repo scope — set in GitHub Settings > Branches
- [x] Create GitHub Issue templates (bug, feature, task)
- [x] Create GitHub PR template
- [~] Set up GitHub Projects board for task tracking — create manually at github.com/HayreKhan750/SYNAPSE/projects

### 0.3 Development Environment
- [x] Install Python 3.11 (Python 3.13.9 installed — compatible)
- [x] Install Node.js 20 LTS (Node.js 22.22.0 installed — compatible)
- [x] Install Docker Desktop (Docker 28.2.2 + Compose 2.37.1 installed)
- [x] Install PostgreSQL 15 locally (or use Docker) (psql 16.11 installed + Docker pgvector/pg15 image)
- [x] Install Redis 7 locally (or use Docker) (Redis 7 via Docker — synapse_redis container healthy)
- [x] Install VS Code with extensions (Python, ESLint, Prettier, Docker, GitLens) — install manually
- [x] Configure pre-commit hooks (black, isort, flake8, eslint)
- [x] Set up .env.local file with all required environment variables
- [x] Test Docker Compose local stack starts successfully (postgres + redis healthy, pgvector OK)

---

## PHASE 1 — Core Platform (Weeks 1–4)

### 1.1 Backend Foundation (Week 1)
- [x] Create Django project: `django-admin startproject config backend/`
- [x] Create Django apps: core, users, articles, repositories, papers, videos
- [x] Install and configure: djangorestframework, django-cors-headers, djangorestframework-simplejwt
- [x] Configure PostgreSQL database connection (settings.py)
- [x] Configure Redis cache backend (django-redis)
- [x] Set up Django admin customization
- [x] Create User model (extending AbstractUser, add role/preferences fields)
- [x] Create Article model (title, content, summary, url, source, topic, tags, keywords, sentiment_score, trending_score, embedding_id)
- [x] Create Source model (name, url, source_type, scrape_interval, config)
- [x] Create Repository model (github_id, name, stars, forks, language, topics, is_trending)
- [x] Create ResearchPaper model (arxiv_id, title, abstract, authors, categories, difficulty_level)
- [x] Create Video model (youtube_id, title, description, channel, transcript, topics)
- [x] Run initial migrations: `python manage.py migrate` (all migrations applied successfully)
- [x] Create superuser: `python manage.py createsuperuser` (use: python manage.py createsuperuser)
- [x] Set up JWT authentication endpoints (register, login, refresh, logout, me)
- [x] Create REST API endpoints for articles (list, detail, trending, search)
- [x] Create REST API endpoints for repositories (list, detail, trending)
- [x] Create REST API endpoints for research papers (list, detail, trending)
- [x] Create REST API endpoints for videos (list, detail)
- [x] Add pagination (page + page_size) to all list endpoints
- [x] Add filtering (topic, source, date_from, date_to) to article endpoints
- [x] Write unit tests for all models
- [x] Write unit tests for JWT auth endpoints
- [x] **Git commit:** `feat: backend foundation — models, auth, REST APIs` ✓ pushed 669ec3a

### 1.2 Web Scraping System (Week 2)
- [x] Create Scrapy project: `scrapy startproject synapse_scraper scraper/`
- [x] Install dependencies: scrapy, beautifulsoup4, playwright, httpx, feedparser, trafilatura
- [~] Install Playwright browsers: `playwright install chromium` — install manually on server
- [x] Create HackerNews spider (Firebase API: https://hacker-news.firebaseio.com/v0/)
- [x] Create GitHub trending spider (GitHub REST API v3, requires GITHUB_TOKEN)
- [x] Create arXiv spider (arXiv API: http://export.arxiv.org/api/query)
- [x] Create YouTube spider (YouTube Data API v3, requires YOUTUBE_API_KEY)
- [~] Create NewsAPI collector (newsapi.org, requires NEWS_API_KEY) — planned for Phase 2
- [x] Set up Scrapy item pipelines (validation, deduplication, database storage)
- [x] Implement URL-based deduplication (SHA-256 hash stored in Redis)
- [~] Implement content deduplication (MinHash LSH via datasketch) — Phase 2 enhancement
- [x] Configure Scrapy middlewares (retry, user-agent rotation, rate limiting)
- [x] Install and configure Celery (celery, django-celery-beat, django-celery-results)
- [x] Create Celery tasks for each scraper (scrape_hackernews, scrape_github, scrape_arxiv, scrape_youtube)
- [x] Configure Celery Beat schedules (HN every 30min, GitHub every 2hrs, arXiv every 6hrs)
- [~] Set up Flower monitoring for Celery: `flower --port=5555` — run manually: `celery -A config.celery flower`
- [x] Test each scraper manually and verify data stored in DB — 55 HN articles, 74 arXiv papers, 35 GitHub repos pulled live
- [~] Write integration tests for scrapers (mock HTTP responses) — Phase 1.2 follow-up
- [x] **Git commit:** `feat: web scraping system — spiders, Celery tasks, deduplication` ✓

### 1.3 Frontend Dashboard (Week 3)
- [x] Create Next.js project: `npx create-next-app@latest frontend --typescript --tailwind --app`
- [x] Install dependencies: framer-motion, recharts, axios, zustand, @tanstack/react-query, react-hook-form, zod, lucide-react, next-themes, react-hot-toast, react-markdown, date-fns
- [x] Configure TailwindCSS (custom colors: indigo-500 primary, cyan-500 secondary, violet-500 accent)
- [x] Configure dark mode (next-themes, class strategy)
- [x] Create API client (axios instance with JWT interceptor, auto token refresh)
- [x] Create Zustand auth store (user, tokens, login, logout actions)
- [x] Create main layout (sidebar + top navbar + content area)
- [x] Create sidebar component (navigation links, logo, user profile, collapse button)
- [x] Create top navbar (search bar, notification bell, dark mode toggle, user avatar)
- [x] Create login page (/auth/login)
- [x] Create register page (/auth/register)
- [x] Create main dashboard page (/) — stats row, trend radar, news feed
- [x] Create Tech Intelligence Feed page (/feed) — article cards, filters, infinite scroll
- [x] Create GitHub Radar page (/github) — trending repos, language filters
- [x] Create Research Explorer page (/research) — papers with difficulty badges
- [x] Create reusable ArticleCard component (title, source, AI summary, tags, bookmark button)
- [x] Create reusable RepositoryCard component (name, stars, language, description)
- [x] Create reusable PaperCard component (title, authors, abstract preview, difficulty badge)
- [x] Create skeleton loading components for all cards
- [x] Implement infinite scroll for news feed (Load More button pattern)
- [x] Add @tanstack/react-query for data fetching and caching
- [~] Write component unit tests (Jest + React Testing Library) — follow-up task
- [x] **Git commit:** `feat: frontend dashboard — layout, pages, article/repo/paper cards` ✓

### 1.4 Search Engine (Week 4)
- [x] Add full-text search to articles endpoint (PostgreSQL ILIKE or django-haystack)
- [x] Add tag-based filtering to articles endpoint
- [x] Add topic-based filtering
- [x] Create global search bar component (debounced input, 300ms)
- [x] Create search results page (/search?q=)
- [x] Create UserBookmark model (user, content_type, content_id, notes, tags)
- [x] Create bookmark API endpoints (POST/DELETE /articles/{id}/bookmark, etc.)
- [x] Create bookmark button component (heart icon, toggle state, optimistic UI)
- [x] Create Knowledge Library page (/library) — bookmarked items grid
- [x] Create Collection model (name, description, user, is_public)
- [x] Create collection API endpoints (CRUD + add/remove items)
- [x] Create collections UI in Knowledge Library page
- [x] Add django-axes for login rate limiting (lockout after 5 failed attempts)
- [x] Write integration tests for search endpoints
- [ ] Write E2E test for search flow (Playwright) — deferred to Phase 8 (testing strategy)
- [x] **Git commit:** `feat: search, bookmarks, collections — knowledge library complete`

---

## PHASE 2 — AI Layer (Weeks 5–8)

### 2.1 NLP Processing Pipeline (Week 5)
- [x] Install NLP dependencies: spacy, transformers, sentence-transformers, keybert, langdetect, datasketch
- [x] Download spaCy model: `python -m spacy download en_core_web_sm`
- [x] Create NLP processing Celery task (process_article_nlp)
- [x] Implement text cleaning (BeautifulSoup HTML stripping, whitespace normalization)
- [x] Implement language detection (langdetect) — skip non-English articles
- [x] Implement keyword extraction (KeyBERT with all-MiniLM-L6-v2)
- [x] Implement topic classification (zero-shot with facebook/bart-large-mnli)
- [x] Implement sentiment analysis (cardiffnlp/twitter-roberta-base-sentiment)
- [x] Implement named entity recognition (spaCy NER for tech terms)
- [x] Update Article model fields (keywords, topic, sentiment_score populated by NLP)
- [x] Chain NLP task after scraping: scrape_article -> process_nlp
- [x] Add NLP processing metrics to Prometheus (processing_time, articles_per_minute)
- [x] Write unit tests for each NLP function
- [x] **Git commit:** `feat: NLP pipeline — keyword extraction, topic classification, sentiment`

### 2.2 Article Summarization (Week 6)
- [ ] Install transformers (already done) + accelerate for GPU support
- [ ] Download/cache facebook/bart-large-cnn model
- [ ] Create summarization Celery task (summarize_article)
- [ ] Implement summarization with BART (max_length=150, min_length=50)
- [ ] Handle long articles (chunk and summarize then combine)
- [ ] Update Article model: populate summary field after summarization
- [ ] Chain tasks: scrape -> nlp -> summarize -> embed
- [ ] Display summaries in ArticleCard component (3-line truncated, expand on click)
- [ ] Add AI summary badge on cards ("AI Summary" chip)
- [ ] Create summarize-on-demand API endpoint (POST /api/v1/ai/summarize)
- [ ] Write unit tests for summarizer (test output length, ROUGE score)
- [ ] **Git commit:** `feat: AI summarization — BART model, auto-summary pipeline`

### 2.3 Vector Search (Week 7)
- [ ] Install pgvector: `pip install pgvector`
- [ ] Install pgvector extension in PostgreSQL: `CREATE EXTENSION vector;`
- [ ] Add embedding column to Article model (VectorField, dimensions=1536 for OpenAI)
- [ ] Create embedding generation Celery task (generate_embeddings)
- [ ] Implement embedding generation (OpenAI text-embedding-ada-002 OR sentence-transformers/all-MiniLM-L6-v2)
- [ ] Batch process embeddings (process 100 at a time to manage API costs)
- [ ] Create semantic search API endpoint (POST /api/v1/search/semantic)
- [ ] Implement cosine similarity search with pgvector (<=> operator)
- [ ] Apply same embeddings to ResearchPaper and Repository models
- [ ] Create ivfflat index on embedding column for performance
- [ ] Update search results page to use semantic search by default
- [ ] Add similarity score display in search results
- [ ] Write integration tests for semantic search
- [ ] **Git commit:** `feat: vector search — pgvector embeddings, semantic search API`

### 2.4 Recommendation System (Week 8)
- [ ] Create UserActivity model (user, action_type, content_type, content_id, timestamp)
- [ ] Log user interactions (view article, bookmark, search query)
- [ ] Create recommendation engine (content-based: find similar content via embeddings)
- [ ] Implement user interest vector (average of viewed content embeddings)
- [ ] Create recommendation API endpoint (GET /api/v1/recommendations)
- [ ] Create TechnologyTrend model (technology_name, mention_count, trend_score, date)
- [ ] Create trend analysis Celery task (analyze_trends — runs daily)
- [ ] Create trend radar API endpoint (GET /api/v1/trends/radar)
- [ ] Create trend timeline API endpoint (GET /api/v1/trends/timeline?tech=)
- [ ] Add Technology Trend Radar chart to main dashboard (Recharts RadarChart)
- [ ] Add "For You" personalized feed tab to Tech Intelligence Feed page
- [ ] Write unit tests for recommendation logic
- [ ] **Git commit:** `feat: recommendations + trends — personalized feed, trend radar`

---

## PHASE 3 — AI Chat Assistant (Weeks 9–10)

### 3.1 LangChain RAG Pipeline (Week 9)
- [ ] Install: langchain, langchain-openai, langchain-community, openai, tiktoken
- [ ] Create FastAPI AI service project (ai_engine/)
- [ ] Set up OpenAI client with API key
- [ ] Create vector store retriever using pgvector + LangChain PGVector
- [ ] Create RecursiveCharacterTextSplitter (chunk_size=1000, overlap=200)
- [ ] Create ConversationalRetrievalChain with retriever + OpenAI LLM
- [ ] Design system prompt (grounded in knowledge base, cite sources)
- [ ] Implement conversation history management (ConversationBufferWindowMemory, last 10 turns)
- [ ] Create Conversation model (user, conversation_id, messages JSONB)
- [ ] Create chat API endpoint (POST /api/v1/ai/chat)
- [ ] Create conversation history endpoint (GET /api/v1/ai/chat/{conversation_id}/history)
- [ ] Implement SSE (Server-Sent Events) for streaming responses
- [ ] Add source citations to chat responses (return retrieved documents)
- [ ] Write integration tests for RAG pipeline (mock OpenAI)
- [ ] **Git commit:** `feat: RAG pipeline — LangChain, pgvector retriever, conversation memory`

### 3.2 AI Chat UI (Week 10)
- [ ] Create AI Chat page (/chat)
- [ ] Create conversation list sidebar (past conversations, new chat button)
- [ ] Create ChatMessage component (user message right-aligned, AI response left-aligned)
- [ ] Create AI response component with source citation cards
- [ ] Implement SSE streaming in frontend (EventSource or fetch with ReadableStream)
- [ ] Add streaming text animation (token-by-token display)
- [ ] Add copy button to AI responses
- [ ] Add suggested prompt chips on empty chat state
- [ ] Create AI explain endpoint (POST /api/v1/ai/explain — for papers/repos)
- [ ] Add "Ask AI" button on ArticleCard and PaperCard
- [ ] Add typing indicator while AI generates response
- [ ] Write E2E test for full chat flow (Playwright)
- [ ] **Git commit:** `feat: AI chat UI — streaming responses, source citations, conversation history`

---

## PHASE 4 — Automation System (Weeks 11–12)

### 4.1 Workflow Engine (Week 11)
- [ ] Create AutomationWorkflow model (name, trigger_type, cron_expression, actions JSONB, is_active)
- [ ] Create WorkflowRun model (workflow, status, started_at, completed_at, result, error)
- [ ] Create workflow CRUD API endpoints
- [ ] Create workflow execution engine (Celery task: execute_workflow)
- [ ] Implement action types: collect_news, summarize_content, generate_pdf, send_email, upload_to_drive
- [ ] Set up Celery Beat for cron-based workflow scheduling
- [ ] Handle missed tasks (django-celery-beat reschedule logic)
- [ ] Create workflow builder UI (Automation Center page /automation)
- [ ] Create workflow form (name, description, trigger picker, action builder)
- [ ] Create cron expression picker UI component
- [ ] **Git commit:** `feat: automation workflow engine — Celery Beat, action system, workflow builder`

### 4.2 Notifications (Week 12)
- [ ] Create Notification model (user, title, message, notif_type, is_read, metadata)
- [ ] Create notification API endpoints (list, mark read, mark all read)
- [ ] Install SendGrid: `pip install sendgrid`
- [ ] Create email notification service (SendGrid API)
- [ ] Add email notification on workflow completion
- [ ] Create notification bell component (badge count, dropdown list)
- [ ] Implement real-time notifications via WebSocket (django-channels) OR polling
- [ ] Add notification preferences to user settings
- [ ] Create workflow run history table in Automation Center
- [ ] Add workflow status badges (active, paused, failed)
- [ ] Write integration tests for workflow execution
- [ ] **Git commit:** `feat: notifications — in-app alerts, email via SendGrid, workflow history`

---

## PHASE 5 — Agentic AI (Weeks 13–16)

### 5.1 Agent Framework (Week 13)
- [ ] Install: langchain, langgraph (for complex workflows)
- [ ] Create LangChain ReAct agent base class
- [ ] Register agent tools with LangChain StructuredTool
- [ ] Create tool: search_knowledge_base(query, limit, filters)
- [ ] Create tool: fetch_articles(topic, date_range, limit)
- [ ] Create tool: analyze_trends(technologies, period)
- [ ] Create tool: search_github(query, language, stars_min)
- [ ] Create tool: fetch_arxiv_papers(query, max_results)
- [ ] Create AgentTask model (user, task_type, prompt, status, result, celery_task_id)
- [ ] Create agent task Celery task (execute_agent_task — async execution)
- [ ] Create agent task API endpoints (create, status, cancel, list)
- [ ] Add token usage tracking (tiktoken) and cost logging per task
- [ ] Add safety limits (max 10000 tokens per task, 5min timeout)
- [ ] Write unit tests for each agent tool
- [ ] **Git commit:** `feat: agent framework — ReAct agent, search/fetch/analyze tools`

### 5.2 Document Generation (Week 14)
- [ ] Install: reportlab, python-pptx, python-docx, jinja2, pillow
- [ ] Create tool: generate_pdf(title, sections, content) using ReportLab
- [ ] Implement PDF with: cover page, table of contents, sections, styled paragraphs, footer
- [ ] Create tool: generate_ppt(title, slides) using python-pptx
- [ ] Implement PPT with: title slide, content slides with bullet points, styled theme
- [ ] Create tool: generate_word_doc(title, content) using python-docx
- [ ] Implement Word doc with: styles, headers, table of contents, structured content
- [ ] Create GeneratedDocument model (user, title, doc_type, file_path, cloud_url, agent_prompt)
- [ ] Store generated files in local media/ folder (then S3 in Phase 6)
- [ ] Create document API endpoints (generate, list, download, delete)
- [ ] Create Document Studio page (/documents)
- [ ] Create document generation form (prompt input, type selector)
- [ ] Create documents library grid (title, type badge, date, download button)
- [ ] Write unit tests for document generation tools
- [ ] **Git commit:** `feat: document generation — PDF/PPT/Word tools, Document Studio UI`

### 5.3 Project Builder (Week 15)
- [ ] Create tool: create_project(project_type, name, features)
- [ ] Implement Django REST API project template (models, views, serializers, urls, settings, requirements.txt)
- [ ] Implement FastAPI microservice template
- [ ] Implement Next.js app template (pages, components, API client, TailwindCSS config)
- [ ] Implement Python data science notebook template
- [ ] Package generated project as .zip file
- [ ] Store zip in media/ (then S3 in Phase 6)
- [ ] Add project download to Document Studio
- [ ] Create Markdown report generator (structured content to .md)
- [ ] **Git commit:** `feat: project builder — Django/FastAPI/Next.js templates, zip download`

### 5.4 Agent UI (Week 16)
- [ ] Create agent command interface in Automation Center (natural language input)
- [ ] Create active agents panel (running tasks with progress bars)
- [ ] Create agent task history list (completed tasks, results, files generated)
- [ ] Add real-time task progress via SSE or WebSocket
- [ ] Add task cancellation button
- [ ] Add cost display per agent task ($X.XX estimated)
- [ ] Write E2E test for full agent task flow
- [ ] **Git commit:** `feat: agent UI — command interface, progress tracking, task history`

---

## PHASE 6 — Cloud Integration (Weeks 17–18)

### 6.1 Google Drive Integration (Week 17)
- [ ] Install: google-api-python-client, google-auth-httplib2, google-auth-oauthlib
- [ ] Set up Google Cloud project and OAuth2 credentials
- [ ] Implement Google Drive OAuth2 flow (user connects their Drive)
- [ ] Create tool: upload_to_drive(file_path, folder_name)
- [ ] Create tool: list_drive_files(folder_name)
- [ ] Create tool: create_drive_folder(folder_name)
- [ ] Add "Upload to Drive" button in Document Studio
- [ ] Store Google Drive tokens securely in DB (encrypted)
- [ ] Add Drive connection status in user profile/settings
- [ ] **Git commit:** `feat: Google Drive integration — OAuth2, upload/list tools`

### 6.2 AWS S3 Integration (Week 18)
- [ ] Install: boto3
- [ ] Configure AWS credentials (via environment variables or IAM role)
- [ ] Create S3 service class (upload_file, download_file, get_presigned_url, delete_file)
- [ ] Migrate document storage from local media/ to S3
- [ ] Use presigned URLs for secure file downloads (expire after 1 hour)
- [ ] Configure S3 bucket (versioning enabled, public access blocked)
- [ ] Update GeneratedDocument model (cloud_url points to S3 presigned URL)
- [ ] Create tool: upload_to_s3(file_path, bucket, key)
- [ ] Add S3 storage for scraped media (images, thumbnails)
- [ ] Configure django-storages for Django static/media files on S3
- [ ] **Git commit:** `feat: AWS S3 integration — file storage, presigned URLs, media CDN`

---

## PHASE 7 — Premium UI/UX (Weeks 19–20)

### 7.1 Design System & Animations (Week 19)
- [ ] Create design tokens (colors, typography, spacing in tailwind.config.ts)
- [ ] Create reusable Button component (primary, secondary, ghost, destructive variants + sm/md/lg sizes)
- [ ] Create reusable Input component (text, search, textarea with label + error state)
- [ ] Create reusable Card component (with hover lift effect via Framer Motion)
- [ ] Create reusable Badge/Tag component
- [ ] Create reusable Modal/Dialog component (Radix UI Dialog)
- [ ] Create reusable Toast notification system (react-hot-toast)
- [ ] Add page transition animations (Framer Motion AnimatePresence)
- [ ] Add card entrance animations (staggered fade-in on list pages)
- [ ] Add skeleton shimmer loading states for all data-fetching components
- [ ] Create Technology Trend Radar chart (Recharts RadarChart)
- [ ] Create star growth sparkline for GitHub repos (Recharts LineChart)
- [ ] Create topic distribution pie chart for dashboard (Recharts PieChart)
- [ ] Create activity heatmap component
- [ ] Implement smooth sidebar collapse animation
- [ ] **Git commit:** `feat: premium UI — design system, Framer Motion animations, data viz`

### 7.2 Mobile & Performance (Week 20)
- [ ] Make all pages fully responsive (mobile 320px, tablet 768px, desktop 1024px+)
- [ ] Create mobile bottom navigation bar (replaces sidebar on mobile)
- [ ] Implement PWA (next-pwa: service worker, manifest.json, offline page)
- [ ] Optimize images (Next.js Image component, WebP format, lazy loading)
- [ ] Implement code splitting (dynamic imports for heavy components)
- [ ] Add React Suspense boundaries with fallback skeletons
- [ ] Run Lighthouse CI (target: Performance 90+, Accessibility 95+, Best Practices 95+)
- [ ] Fix Core Web Vitals (LCP < 2.5s, FID < 100ms, CLS < 0.1)
- [ ] Add error boundaries (graceful error UI for failed API calls)
- [ ] Add empty state components for all list pages
- [ ] Implement optimistic UI updates for bookmarks
- [ ] **Git commit:** `feat: mobile responsive, PWA, performance optimization`

---

## PHASE 8 — Deployment & Production (Weeks 21–22)

### 8.1 Docker & CI/CD (Week 21)
- [ ] Create backend/Dockerfile (multi-stage: builder + production, non-root user)
- [ ] Create ai_engine/Dockerfile (FastAPI service, uvicorn)
- [ ] Create frontend/Dockerfile (multi-stage: deps + builder + runner, Next.js standalone)
- [ ] Create docker-compose.yml (backend, fastapi-ai, frontend, postgres, redis, celery_worker, celery_beat)
- [ ] Create docker-compose.prod.yml (production overrides)
- [ ] Create .dockerignore files for each service
- [ ] Create .github/workflows/ci.yml (lint + test backend + test frontend + build)
- [ ] Create .github/workflows/deploy.yml (build images + push to registry + deploy)
- [ ] Configure GitHub Actions secrets (AWS credentials, API keys, deploy SSH key)
- [ ] Set up Docker image registry (Docker Hub or AWS ECR)
- [ ] Test full Docker Compose stack locally (all services running)
- [ ] **Git commit:** `feat: Docker + GitHub Actions CI/CD pipeline`

### 8.2 Production Deployment (Week 22)
- [ ] Set up AWS EC2 instance (t3.medium for backend, t3.large for AI service)
- [ ] Set up AWS RDS PostgreSQL 15 (with pgvector extension installed)
- [ ] Set up AWS ElastiCache Redis
- [ ] Configure Nginx as reverse proxy (SSL termination, rate limiting, gzip)
- [ ] Set up SSL/HTTPS with Let's Encrypt + Certbot
- [ ] Configure Route 53 DNS
- [ ] Install Prometheus on server
- [ ] Set up Grafana dashboards (system + application + business metrics)
- [ ] Integrate Sentry (Django + Next.js error tracking)
- [ ] Configure structured logging (JSON logs, CloudWatch integration)
- [ ] Set up uptime monitoring (UptimeRobot)
- [ ] Run load test with Locust (50 concurrent users baseline)
- [ ] Configure auto-scaling (CloudWatch alarms + Auto Scaling Groups)
- [ ] Create deployment runbook (step-by-step deploy, rollback procedure)
- [ ] Go live! Share on Product Hunt + Hacker News (Show HN)
- [ ] **Git commit:** `feat: production deployment — AWS, Nginx, SSL, monitoring`

---

## PHASE 9 — Post-Launch (Ongoing)

### 9.1 Security Hardening
- [ ] Run OWASP ZAP scan against production
- [ ] Run bandit static analysis: `bandit -r backend/`
- [ ] Run safety dependency check: `safety check`
- [ ] Run npm audit: `npm audit`
- [ ] Enable Django security settings (HSTS, CSP headers, SECURE_SSL_REDIRECT)
- [ ] Configure fail2ban on server
- [ ] Set up AWS GuardDuty
- [ ] Enable S3 bucket versioning and MFA delete
- [ ] Review and test RBAC permissions (admin vs premium vs free user)
- [ ] Implement MFA (TOTP) for admin accounts

### 9.2 Monitoring & Analytics
- [ ] Create Grafana dashboard: Platform Overview (requests/sec, error rate, latency p95)
- [ ] Create Grafana dashboard: Business Metrics (signups/day, articles scraped, AI queries)
- [ ] Create Grafana dashboard: Celery Tasks (queue depth, task success rate)
- [ ] Set up alerting rules (PagerDuty/Slack: error rate >5%, CPU >80%, disk >90%)
- [ ] Track North Star Metric (WAU using AI chat or automation)
- [ ] Implement user analytics (PostHog or Plausible — privacy-first)

### 9.3 Growth & Iteration
- [ ] Launch on Product Hunt
- [ ] Post on Hacker News (Show HN: SYNAPSE — AI tech intelligence platform)
- [ ] Write technical blog post (DEV.to, Medium) about building SYNAPSE
- [ ] Set up Discord server for community
- [ ] Implement referral program (1 month Pro for each referral)
- [ ] Launch Pro tier billing (Stripe integration)
- [ ] Collect user feedback (in-app feedback widget)
- [ ] Plan v2.0 features based on user feedback

---

## Quick Reference: Git Commit Convention

```
feat: new feature
fix: bug fix
docs: documentation changes
style: formatting (no logic change)
refactor: code restructure
test: adding tests
chore: build, deps, CI changes
perf: performance improvement
security: security fix
```

## Quick Reference: How to Mark Tasks Done & Push

```bash
# 1. Complete the task
# 2. Mark it done in TASKS.md: [ ] -> [x]
# 3. Stage and commit:
git add -A
git commit -m "feat: <what you just built>"
# 4. Push to GitHub:
git push origin main
```

---

**Total Tasks: 200+ | Phases: 9 | Estimated Duration: 22 weeks**

