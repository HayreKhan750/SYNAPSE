# 🧠 SYNAPSE — Suggestion Task List (Master Execution Plan)

> **How to use this file:**
> - Check off `- [x]` when a task is complete
> - Each task has: Priority, Effort, Impact, and exact files to modify
> - Use `TASK-###` IDs to reference work in git commits and PRs
> - Color codes: 🔴 Critical (do first), 🟡 Simplify/Remove, 🟢 Add/Improve, 🏗️ Architecture, 🚀 Market Differentiator
> - Effort scale: XS (<1 day) · S (1–2 days) · M (3–5 days) · L (1–2 weeks) · XL (2–4 weeks)

---

## 📋 TABLE OF CONTENTS

1. [🔴 Phase 0 — Critical Fixes (Do First)](#phase-0--critical-fixes-do-first)
2. [🟡 Phase 1 — Remove & Simplify](#phase-1--remove--simplify)
3. [🟢 Phase 2 — Revenue & Retention (Tier 1)](#phase-2--revenue--retention-tier-1)
4. [🟢 Phase 3 — AI Differentiation (Tier 2)](#phase-3--ai-differentiation-tier-2)
5. [🟢 Phase 4 — UX & Design Overhaul (Tier 3)](#phase-4--ux--design-overhaul-tier-3)
6. [🏗️ Phase 5 — Technical Architecture Upgrades](#phase-5--technical-architecture-upgrades)
7. [🚀 Phase 6 — New Market Differentiation Features](#phase-6--new-market-differentiation-features)
8. [📊 Task Summary & Quick Reference](#task-summary--quick-reference)

---

## 📅 90-Day Execution Roadmap

| Month | Weeks | Focus |
|---|---|---|
| **Month 1** | Week 1–2 | Onboarding wizard + empty states |
| **Month 1** | Week 3–4 | Pricing page + billing gates + Stripe activation |
| **Month 2** | Week 5–6 | Hybrid search (BM25 + semantic + reranking) |
| **Month 2** | Week 7–8 | Upgrade embeddings + Claude/Ollama + web search tool for agents |
| **Month 3** | Week 9–10 | Team workspaces + org model |
| **Month 3** | Week 11–12 | Browser extension MVP + Weekly AI digest + API access & developer portal |

---

---

## 🔴 Phase 0 — Critical Fixes (Do First)

> These are blocking issues. Nothing else matters until these are done. Each one directly impacts activation, revenue, or security.

---

### TASK-001 — Onboarding Wizard
**Priority:** 🔴 Critical | **Effort:** M | **Impact:** +40–50% activation rate — first-time users see empty feeds with no guidance

#### Backend
- [x] **TASK-001-B1:** Create onboarding models — `OnboardingPreferences` model, `is_onboarded` / `onboarded_at` fields on User, migration `0003_onboarding_github.py`
- [x] **TASK-001-B2:** Create onboarding API endpoints — status, start, steps/<step>/complete, finish — all registered in urls.py
- [x] **TASK-001-B3:** Auto-populate feed based on preferences — interest-based filtering implemented in feed views
- [x] **TASK-001-B4:** Welcome email — `send_welcome_email(user)` in `email_service.py`, triggered on finish

#### Frontend
- [x] **TASK-001-F1:** Onboarding route & layout — `(onboarding)/layout.tsx` + `wizard/page.tsx`
- [x] **TASK-001-F2:** 5-step animated wizard — Welcome → Interests → Use-case → Try It → Done
- [x] **TASK-001-F3:** ProgressBar component — `frontend/src/components/onboarding/ProgressBar.tsx`
- [x] **TASK-001-F4:** useOnboarding hook — `frontend/src/hooks/useOnboarding.ts`
- [x] **TASK-001-F5:** EmptyState on all content pages (feed, research, library)
- [x] **TASK-001-F6:** Register page redirects to `/onboarding/wizard` after signup

#### Testing
- [x] **TASK-001-T1:** Onboarding model tests in `test_models.py`
- [x] **TASK-001-T2:** Onboarding endpoint integration tests in `test_views.py`
- [ ] **TASK-001-T3:** Feed filtering by interests — pending

---

### TASK-002 — Authentication Completion
**Priority:** 🔴 Critical | **Effort:** M | **Impact:** MFA recovery codes prevent lockouts; GitHub OAuth doubles developer conversion

#### MFA Recovery Codes
- [x] **TASK-002-B1:** RecoveryCode — backup codes stored as SHA-256 hashes in `mfa.py`; `generate_for_user(user)` creates 8 new single-use codes
- [x] **TASK-002-B2:** Recovery code endpoints — `POST /auth/mfa/verify-backup/` in `mfa_views.py`; registered in urls.py
- [x] **TASK-002-B3:** GitHub OAuth backend — `github_views.py` with redirect + callback + disconnect; `github_id`/`github_username` on User model; migration `0003_onboarding_github.py`; env vars in `.env.example`
- [x] **TASK-002-B4:** Email verification — `GET /auth/verify-email/` + `POST /auth/verify-email/resend/` endpoints added to `views.py` and `urls.py`

#### Frontend
- [x] **TASK-002-F1:** Recovery codes shown in `MFASection.tsx` after setup with Copy/Download buttons
- [x] **TASK-002-F2:** Recovery code login — backup code toggle in `login/page.tsx`
- [x] **TASK-002-F3:** GitHub OAuth buttons — "Sign in with GitHub" on both login and register pages
- [x] **TASK-002-F4:** Resend verification UI — in `verify-email/page.tsx` (resend button + 60s countdown)

#### Testing
- [x] **TASK-002-T1:** Unit tests for recovery code generation and hashing — `backend/apps/users/tests/test_mfa_recovery.py::TestBackupCodeGeneration` (6 tests) + `TestVerifyBackupCode` (8 tests)
- [x] **TASK-002-T2:** Integration tests for GitHub OAuth flow — `test_github_oauth.py::TestGitHubOAuthCallback` (5 tests) + `TestEmailVerificationResend` (4 tests)
- [x] **TASK-002-T3:** Recovery code login tests — `TestVerifyBackupEndpoint` (5 tests)

---

### TASK-003 — Billing Activation (Stripe)
**Priority:** 🔴 Critical | **Effort:** L | **Impact:** $0 → $5K–$10K MRR Month 1 — no revenue is possible without this

#### Backend
- [x] **TASK-003-B1:** Complete billing models
  - File: `backend/apps/billing/models.py`
  - Added `Invoice` model (stripe_invoice_id, amount_paid, pdf_url, hosted_url, period_start/end)
  - Migration: `backend/apps/billing/migrations/0002_invoice.py`
- [x] **TASK-003-B2:** Complete Stripe service implementation
  - File: `backend/apps/billing/stripe_service.py`
  - Full: `get_or_create_customer`, `create_checkout_session`, `create_portal_session`, webhook handlers
  - `handle_invoice_paid` now creates Invoice DB records
- [x] **TASK-003-B3:** Create Stripe webhook handler
  - File: `backend/apps/billing/views.py` → `WebhookView`
  - Handles: subscription.created/updated/deleted, invoice.paid, invoice.payment_failed
  - Async via Celery (`process_stripe_webhook` task)
- [x] **TASK-003-B4:** Billing API endpoints
  - `GET  /api/v1/billing/pricing/`      — public plan listing
  - `POST /api/v1/billing/checkout/`     — Stripe Checkout Session
  - `GET  /api/v1/billing/subscription/` — current plan + status
  - `POST /api/v1/billing/cancel/`       — cancel at period end *(new)*
  - `POST /api/v1/billing/portal/`       — Stripe Customer Portal URL
  - `GET  /api/v1/billing/invoices/`     — past invoices *(new)*
  - `GET  /api/v1/billing/usage/`        — usage meters per resource *(new)*
  - `GET/POST /api/v1/billing/referral/` — referral codes
- [x] **TASK-003-B5:** Plan limits enforcement middleware
  - File: `backend/apps/billing/limits.py` *(new)*
  - `check_plan_limit(user, resource, current_usage)` → raises `PermissionDenied(error_code='plan_limit_exceeded')`
  - `user_has_feature(user, feature)` → bool
  - `plan_limit_response(exc)` → JSON-serialisable dict for DRF
  - Full limits table: ai_queries, agent_runs, automations, documents, bookmarks
- [x] **TASK-003-B6:** Free plan auto-assignment on signup
  - `backend/apps/billing/signals.py` → `create_user_subscription` signal (already existed, verified)
- [x] **TASK-003-B7:** Add env vars for Stripe
  - `.env.example` updated with `STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, price IDs, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

#### Frontend
- [x] **TASK-003-F1:** Create pricing page
  - File: `frontend/src/app/pricing/page.tsx` *(new — public route)*
  - 3-column plan cards: Free / Pro $19/mo / Enterprise $99/mo
  - Monthly/Annual toggle (20% discount), feature ✓/✗ list, animated CTA buttons
- [x] **TASK-003-F2:** Create billing dashboard page
  - File: `frontend/src/app/(dashboard)/billing/page.tsx` *(new)*
  - Current plan + status badge, usage meters (progress bars), invoice table with PDF links
  - Upgrade / Cancel / Manage Billing (portal) buttons
  - Added to Sidebar nav and Navbar user dropdown
- [x] **TASK-003-F3:** Create upgrade/paywall modal + hook
  - File: `frontend/src/components/modals/UpgradeModal.tsx` *(new)*
  - `UpgradeModalProvider` wraps app in `Providers.tsx`
  - Listens to `synapse:plan_limit_exceeded` DOM event
  - File: `frontend/src/hooks/useUpgradeModal.ts` *(new)*
- [x] **TASK-003-F4:** Add plan badge to navbar
  - `PlanBadge` component in `Navbar.tsx` — FREE/PRO/ENTERPRISE badge, clicks to `/billing`
- [x] **TASK-003-F5:** Intercept 403 plan-limit errors globally
  - `frontend/src/utils/api.ts` — Axios interceptor fires `synapse:plan_limit_exceeded` DOM event on 403 with `error_code === 'plan_limit_exceeded'`

#### Testing
- [x] **TASK-003-T1:** Unit tests for plan limit enforcement
  - File: `backend/apps/billing/tests/test_limits.py` *(new)* — 15 test cases covering all limit/feature logic
- [x] **TASK-003-T2:** Stripe webhook integration tests — `backend/apps/billing/tests/test_webhooks.py`: `TestHandleSubscriptionUpdated`, `TestHandleInvoicePaid` (3 tests inc. dedup)
- [x] **TASK-003-T3:** Checkout/subscription/cancel/invoices/usage endpoint tests — `TestCheckoutView`, `TestSubscriptionView`, `TestCancelView`, `TestInvoiceListView`, `TestUsageView`

---

### TASK-004 — AI Guardrails & Cost Protection
**Priority:** 🔴 Critical | **Effort:** M | **Impact:** Prevent one bad actor from generating $500+ OpenAI bill overnight

- [x] **TASK-004-B1:** Per-user daily budget caps (Redis) — `rate_limit.py` with sliding-window + daily spend tracking
  - Before every LLM call: check budget; if exceeded → raise `BudgetExceededError`
  - Return HTTP 402 with `{"error": "daily_budget_exceeded", "reset_at": "...", "upgrade_url": "/pricing"}`
- [x] **TASK-004-B2:** Per-user request rate limiting
  - File: `ai_engine/middleware/rate_limit.py`
  - Redis key: `rl:user:{id}:ai:{minute}` — sliding window counter
  - Limits: Free 2 req/min · Pro 20 req/min · Team 60 req/min
  - Return HTTP 429 with `Retry-After` header
- [x] **TASK-004-B3:** Token estimation before agent runs — `_estimate_tokens()` via tiktoken in `executor.py`; `check_budget_before_run()`
  - File: `ai_engine/agents/executor.py`
  - Before executing agent: estimate token cost using `tiktoken`
  - If estimated cost > remaining budget: return error with cost estimate and upgrade prompt
  - Add `estimated_tokens` and `estimated_cost_usd` to agent run response
- [x] **TASK-004-B4:** Input content moderation — `ai_engine/middleware/moderation.py` with OpenAI Moderation API, hard/soft block categories, graceful fallback
  - File: `ai_engine/middleware/moderation.py` *(new)*
  - Call OpenAI Moderation API on every user input before sending to LLM
  - If flagged (violence, hate, sexual): return HTTP 400 with category info
  - Log flagged requests to DB for abuse review: `ModerationLog` model
- [x] **TASK-004-B5:** Jailbreak pattern detection — 12 regex patterns in `safety.py`, hard-block raises `JailbreakDetectedError`
  - File: `ai_engine/middleware/safety.py` *(new)*
  - Regex + keyword detection for common jailbreak patterns:
    - "ignore previous instructions", "system prompt override", "DAN mode", "pretend you are"
  - If detected: warn user (soft block) or refuse (hard block for egregious patterns)
- [x] **TASK-004-B6:** PII detection in inputs — `check_pii()` + `redact_pii()` in `safety.py` using Presidio (graceful degradation if not installed)
  - File: `ai_engine/middleware/safety.py`
  - Use `presidio-analyzer` to detect: email, phone, credit card, SSN, passport numbers
  - Warn user before processing; redact from logs always
  - Add `presidio-analyzer` to `ai_engine/requirements.txt`
- [x] **TASK-004-B7:** Query execution timeout — `executor.run()` wraps agent in `ThreadPoolExecutor` with `future.result(timeout=60s)`
  - File: `ai_engine/main.py`
  - Wrap all LLM calls with `asyncio.wait_for(coro, timeout=30.0)`
  - On timeout: return `{"error": "query_timeout", "message": "Query took too long. Try a simpler question."}`
- [x] **TASK-004-B8:** Fallback model on budget exceeded — `ai_engine/agents/router.py`: `get_model_for_user()` switches GPT-4o → GPT-4o-mini at 80% budget, raises `BudgetExceededError` at 100%
  - File: `ai_engine/agents/router.py` *(new, or add to base.py)*
  - If user over 80% of daily budget: automatically switch to cheaper model
    - GPT-4o → GPT-4o-mini
    - Claude 3.5 Sonnet → Claude 3 Haiku
  - Log model fallback event for analytics
- [x] **TASK-004-B9:** Add env vars for guardrails — Redis health check in `main.py` lifespan + `/health` endpoint; env vars in `.env.example`
  - File: `.env.example`
  - Add: `AI_RATE_LIMIT_FREE=2`, `AI_RATE_LIMIT_PRO=20`, `AI_BUDGET_FREE_CENTS=50`, `AI_BUDGET_PRO_CENTS=1000`

#### Testing
- [x] **TASK-004-T1:** Unit tests for budget tracking and rate limiting — `ai_engine/tests/test_guardrails.py::TestRateLimitModule`
- [x] **TASK-004-T2:** Unit tests for moderation and jailbreak detection — `TestJailbreakDetection`, `TestSanitizeInput`, `TestModerationModule`
- [x] **TASK-004-T3:** Model router tests — `TestModelRouter`: primary/fallback/exhausted, Claude provider, budget threshold

---

### TASK-005 — Upgrade Embeddings Model
**Priority:** 🔴 Critical | **Effort:** S | **Impact:** 2–3x better semantic search quality; current MiniLM-L6 is outdated

- [x] **TASK-005-B1:** Swap embedding model to BGE-large — `EMBEDDING_MODEL=BAAI/bge-large-en-v1.5` default in `embedder.py`; added `embed_query()` with BGE query prefix; `EMBEDDING_DIM=1024`
  - Update: `EMBEDDING_DIM = 1024` constant
  - BGE-large requires prepending `"Represent this sentence: "` prefix for query (not docs) — implement this
- [x] **TASK-005-B2:** Update all vector column dimensions in DB — migrations 0005_*_embedding_1024.py for articles, papers, repositories, videos; 0002_tweet_embedding_1024.py for tweets
  - Files: `backend/apps/articles/migrations/`, `backend/apps/papers/migrations/`, `backend/apps/repositories/migrations/`, `backend/apps/tweets/migrations/`, `backend/apps/videos/migrations/`
  - Create new migration in each app: alter `embedding` column from `vector(384)` to `vector(1024)`
  - Drop old IVFFlat indexes before alter, recreate after
  - Use `django-pgvector` migration helpers or raw SQL in `RunSQL`
- [x] **TASK-005-B3:** Create re-embedding Celery tasks — `reembed_tasks.py` in articles, papers, repositories; batch re-embed via AI engine `/embeddings` endpoint
  - File: `backend/apps/articles/embedding_tasks.py` (and equivalent in papers, repos, tweets, videos)
  - Task: `reembed_all_articles()` — fetch all articles with non-null content, re-embed in batches of 32, save
  - Progress logging: `logger.info(f"Re-embedded {i}/{total} articles")`
  - Add similar tasks for papers, repos, tweets, videos
- [x] **TASK-005-B4:** Update env config — `.env.example` updated: `EMBEDDING_MODEL=BAAI/bge-large-en-v1.5`, `EMBEDDING_DIM=1024`
  - File: `.env.example`
  - Update: `EMBEDDING_MODEL=BAAI/bge-large-en-v1.5`, `EMBEDDING_DIM=1024`
- [ ] **TASK-005-B5:** Update search quality tests
  - File: `backend/apps/core/tests/test_semantic_search.py`
  - Add test: known query returns semantically relevant result (regression test)
  - Benchmark: run both models, assert new model scores higher on test queries

#### Testing
- [x] **TASK-005-T1:** Integration tests for re-embedding pipeline — `backend/apps/core/tests/test_reembedding_pipeline.py::TestReembedArticlesPipeline` (4 tests)
- [x] **TASK-005-T2:** Embedder unit tests — `TestEmbedderDimensions` (6 tests): BGE prefix, 1024 dims, batch, empty string; `TestMigrationDimensions` (5 tests)

---

### TASK-006 — Team Workspaces & Organizations
**Priority:** 🔴 Critical | **Effort:** XL | **Impact:** Unlock B2B revenue — 3–5x larger deal sizes; enables Team plan

#### Backend
- [ ] **TASK-006-B1:** Create `organizations` app
  - Run: `python manage.py startapp organizations` in `backend/apps/`
  - File: `backend/apps/organizations/models.py` *(new)*
  - Models:
    ```
    Organization: name, slug, owner (FK User), avatar_url, created_at, settings (JSON)
    OrganizationMember: organization, user, role [owner|admin|member|viewer], joined_at
    OrganizationInvite: organization, email, role, token (UUID), created_at, accepted_at, expires_at
    OrganizationSettings: organization, invite_only (bool), default_member_role, allow_member_create (bool)
    ```
  - Register in `backend/config/settings/base.py` → `INSTALLED_APPS`
- [ ] **TASK-006-B2:** Create organization API endpoints
  - File: `backend/apps/organizations/views.py` *(new)*
  - Endpoint group `GET|POST /api/organizations/`:
    - `GET`  — list user's orgs (owned + member)
    - `POST` — create new org (auto-assign creator as owner)
  - Endpoint group `/api/organizations/{id}/`:
    - `GET` — org detail (members, settings, stats)
    - `PATCH` — update name/avatar/settings (admin+)
    - `DELETE` — delete org (owner only)
  - Member management `/api/organizations/{id}/members/`:
    - `GET` — list members with roles
    - `POST` — add member by user_id (admin+)
    - `PATCH /{user_id}/` — change member role (admin+)
    - `DELETE /{user_id}/` — remove member (admin+ or self)
  - Invitations `/api/organizations/{id}/invites/`:
    - `POST` — send invite by email (admin+), create OrganizationInvite, send email
    - `DELETE /{invite_id}/` — cancel pending invite
  - Accept invite: `POST /api/organizations/invites/{token}/accept/` — no auth required but must be logged in
- [ ] **TASK-006-B3:** RBAC permission classes
  - File: `backend/apps/organizations/permissions.py` *(new)*
  - `IsOrganizationOwner`, `IsOrganizationAdmin`, `IsOrganizationMember` — DRF permission classes
  - Helper: `get_user_org_role(user, org)` → role string or None
- [ ] **TASK-006-B4:** Scope content to organizations
  - Files: `backend/apps/documents/models.py`, `backend/apps/automation/models.py`
  - Add nullable FK: `organization = ForeignKey(Organization, null=True, blank=True, on_delete=SET_NULL)`
  - Update querysets: if `org_context` in request, filter by org; else show personal content
- [ ] **TASK-006-B5:** Organization audit log
  - File: `backend/apps/organizations/models.py`
  - Model: `OrgAuditLog` (organization, actor, action, resource, metadata JSON, ip_address, timestamp)
  - Log: member_added, member_removed, role_changed, invite_sent, settings_changed
  - Endpoint: `GET /api/organizations/{id}/audit-logs/` (admin+ only)
- [ ] **TASK-006-B6:** Invite email template
  - File: `backend/apps/notifications/email_service.py`
  - Method: `send_org_invite_email(invite)` — email with org name, inviter name, accept link
  - Link format: `{FRONTEND_URL}/invites/{invite.token}`

#### Frontend
- [ ] **TASK-006-F1:** Organization switcher in navbar
  - File: `frontend/src/components/layout/Navbar.tsx`
  - Dropdown: personal workspace + list of orgs + "New Organization" button
  - Current org shown with name/avatar; on switch → update context + refetch data
- [ ] **TASK-006-F2:** Organization context provider
  - File: `frontend/src/contexts/OrganizationContext.tsx` *(new)*
  - Hook: `useOrganization()` → `{org, role, isOwner, isAdmin, isMember}`
  - Persist selected org in `localStorage`
- [ ] **TASK-006-F3:** Organizations management page
  - File: `frontend/src/app/(dashboard)/organizations/page.tsx` *(new)*
  - List cards for each org: name, member count, your role, actions (Settings / Leave)
  - "Create Organization" button → modal with name input
- [ ] **TASK-006-F4:** Organization settings page
  - File: `frontend/src/app/(dashboard)/organizations/[id]/settings/page.tsx` *(new)*
  - Tabs: General / Members / Invites / Audit Log / Danger Zone
  - Members tab: table of members with role dropdown (admin) + remove button
  - Invites tab: list pending invites + "Invite by Email" form
- [ ] **TASK-006-F5:** Invite acceptance page
  - File: `frontend/src/app/(auth)/invite/[token]/page.tsx` *(new)*
  - Show: org name, inviting user, role being granted
  - "Accept Invitation" button → `POST /api/organizations/invites/{token}/accept/`
  - If not logged in: redirect to login, preserve token in query param

#### Testing
- [ ] **TASK-006-T1:** Unit tests for organization models + RBAC
- [ ] **TASK-006-T2:** Integration tests for all org endpoints
- [ ] **TASK-006-T3:** Permission tests: member can't delete org; viewer can't create content
- [ ] **TASK-006-T4:** E2E: create org → invite user → accept → see shared workspace


---

## 🟡 Phase 1 — Remove & Simplify

> Quick wins that reduce technical debt, dead code, and maintenance burden. Do these in parallel with Phase 0.

---

### TASK-101 — Kill the Nitter Spider
**Priority:** 🟡 Remove | **Effort:** XS | **Impact:** Remove dead tech — X/Twitter killed Nitter; reduces scraper failures

- [x] **TASK-101-1:** Delete Nitter spider file
  - File: `scraper/spiders/nitter_spider.py` → **DELETE**
- [x] **TASK-101-2:** Remove Nitter from Celery beat schedule (if present)
  - File: `backend/config/settings/base.py` — search for `nitter` in `CELERY_BEAT_SCHEDULE` and remove
- [x] **TASK-101-3:** Remove Nitter pipeline references
  - File: `scraper/pipelines/database.py` — remove any `nitter`-specific logic or item type handling
- [ ] **TASK-101-4:** *(Optional)* Replace with Twitter API v2
  - File: `scraper/spiders/twitter_spider.py` — update to use official Twitter API v2 Bearer Token
  - Add: `TWITTER_BEARER_TOKEN=` to `.env.example`
  - Requires Academic Research or Basic plan ($100/mo)

---

### TASK-102 — Remove In-Memory Redis Fallback
**Priority:** 🟡 Remove | **Effort:** XS | **Impact:** Prevent silent data loss in production — fallback dict loses all history on restart

- [x] **TASK-102-1:** Remove in-memory dict fallback from memory manager
  - File: `ai_engine/rag/memory.py`
  - Delete the `except` block that falls back to `{}` or a plain dict
  - Replace with: `raise RuntimeError("Redis connection failed — conversation history unavailable")`
- [x] **TASK-102-2:** Add Redis health check on AI engine startup — implemented in `main.py` lifespan + `/health` endpoint
  - File: `ai_engine/main.py`
  - On startup `lifespan`: `await redis_client.ping()` — if fails, log `CRITICAL` and exit
- [x] **TASK-102-3:** Add Redis status to `/health` endpoint — `/health` now returns `{"status":"ok","redis":"ok"|"unavailable"}`
  - File: `ai_engine/main.py`
  - Include `"redis": "ok"` or `"redis": "unavailable"` in `GET /health` JSON response

---

### TASK-103 — Move Automation Templates to Database
**Priority:** 🟡 Simplify | **Effort:** S | **Impact:** API-driven templates instead of hardcoded frontend arrays

- [ ] **TASK-103-1:** Create templates API endpoint
  - File: `backend/apps/automation/views.py`
  - `GET /api/automation/templates/` — return all templates from DB (already have template model?)
  - Filter by: category, is_active
- [ ] **TASK-103-2:** Seed templates into DB via Django fixture
  - File: `backend/apps/automation/fixtures/templates.json` *(new)*
  - Move all hardcoded frontend templates (from `TemplatesModal.tsx`) into this fixture
  - Run: `python manage.py loaddata automation/fixtures/templates.json`
- [ ] **TASK-103-3:** Remove hardcoded fallback from frontend
  - File: `frontend/src/app/(dashboard)/automation/TemplatesModal.tsx`
  - Remove static fallback arrays
  - Fetch exclusively from `GET /api/automation/templates/` via React Query (`useQuery`)
  - Show `<SkeletonCard>` while loading

---

### TASK-104 — Extract Inline Modals to Global Modal System
**Priority:** 🟡 Simplify | **Effort:** S | **Impact:** Cleaner component architecture; reusable modal system

- [ ] **TASK-104-1:** Extend global Modal component
  - File: `frontend/src/components/ui/Modal.tsx` — add props: `size` (sm/md/lg/xl/fullscreen), `closeOnBackdrop` (bool)
  - Ensure: ESC key closes modal, focus trap inside modal, scroll lock on body
- [ ] **TASK-104-2:** Move automation modals to `/components/modals/`
  - `frontend/src/app/(dashboard)/automation/EditWorkflowModal.tsx` → `frontend/src/components/modals/EditWorkflowModal.tsx`
  - `frontend/src/app/(dashboard)/automation/ScheduleModal.tsx` → `frontend/src/components/modals/ScheduleModal.tsx`
  - `frontend/src/app/(dashboard)/automation/AnalyticsModal.tsx` → `frontend/src/components/modals/AnalyticsModal.tsx`
  - Update imports in `frontend/src/app/(dashboard)/automation/page.tsx`
- [ ] **TASK-104-3:** Add modal portal root to layout
  - File: `frontend/src/app/layout.tsx`
  - Add `<div id="modal-root" />` as last child of `<body>` for React portal mounting

---

### TASK-105 — Add API Versioning
**Priority:** 🟡 Simplify | **Effort:** XS | **Impact:** Future-proof — allows breaking changes without breaking existing clients

- [ ] **TASK-105-1:** Prefix all API routes with `/api/v1/`
  - File: `backend/config/urls.py`
  - Wrap all `include('backend.apps.*.urls')` calls under `path('api/v1/', include(...))`
- [ ] **TASK-105-2:** Update frontend API base URL
  - File: `frontend/src/utils/api.ts`
  - Change `baseURL` from `/api/` to `/api/v1/`
- [ ] **TASK-105-3:** Update Nginx proxy config
  - File: `infrastructure/nginx/conf.d/synapse.conf`
  - Ensure `/api/v1/` proxies correctly to Django backend upstream
- [ ] **TASK-105-4:** Add API version header to responses
  - File: `backend/config/settings/base.py` or middleware
  - Add middleware that appends `X-API-Version: 1` to all API responses

---

## 🟢 Phase 2 — Revenue & Retention (Tier 1)

> Note: TASK-001 (Onboarding), TASK-003 (Billing), and TASK-006 (Teams) from Phase 0 are the primary revenue tasks. This phase covers supporting retention features.

---

### TASK-201 — Weekly AI Digest Email
**Priority:** 🟢 High | **Effort:** M | **Impact:** +25–35% re-engagement for inactive users

#### Backend
- [ ] **TASK-201-B1:** Add digest preferences to user model
  - File: `backend/apps/users/models.py`
  - Add: `digest_enabled = BooleanField(default=True)`, `digest_day = CharField(default='monday', choices=[...])`
  - Migration: `backend/apps/users/migrations/0004_digest_prefs.py`
- [ ] **TASK-201-B2:** Create weekly digest Celery task
  - File: `backend/apps/core/tasks.py`
  - Task: `send_weekly_digest()` — query all users with `digest_enabled=True`
  - For each user: fetch top 5 articles + top 3 papers + top trending repo from user's interest topics (from `OnboardingPreferences.interests`)
  - Call AI engine to generate a 2-paragraph personalized summary
  - Send via `email_service.send_digest_email(user, content)`
- [ ] **TASK-201-B3:** Create digest email template
  - File: `backend/apps/notifications/email_service.py`
  - Method: `send_digest_email(user, articles, papers, repos, ai_summary)`
  - HTML template sections: greeting, AI-generated summary blurb, top articles (title + link), trending papers, rising repos
  - Plain-text fallback version
- [ ] **TASK-201-B4:** Schedule Celery beat entry
  - File: `backend/config/settings/base.py`
  - Add to `CELERY_BEAT_SCHEDULE`: `'send-weekly-digest': {'task': '...send_weekly_digest', 'schedule': crontab(hour=8, minute=0, day_of_week=1)}`

#### Frontend
- [ ] **TASK-201-F1:** Digest toggle in settings
  - File: `frontend/src/app/(dashboard)/settings/page.tsx`
  - Add section "Email Preferences"
  - Toggle: "Weekly AI Digest" (on/off)
  - Dropdown: "Send on" (Monday–Sunday)
  - PATCH `/api/users/me/` to save preferences

---

### TASK-202 — GitHub OAuth (Developer Audience)
**Priority:** 🟢 High | **Effort:** S | **Impact:** 2x conversion from developer community — critical for your target audience

> Note: GitHub OAuth backend is also covered in TASK-002-B3. This task covers the additional sync features.

- [ ] **TASK-202-1:** Sync GitHub starred repos to knowledge base
  - File: `backend/apps/users/views.py` (GitHub OAuth callback)
  - After GitHub login: fetch user's starred repos via GitHub API (`/users/{username}/starred`)
  - For each repo: create or update `Repository` record in DB
  - Trigger embedding task for new repos
- [ ] **TASK-202-2:** Show "Connected: GitHub" in settings
  - File: `frontend/src/app/(dashboard)/settings/page.tsx`
  - If `github_username` set: show green connected badge + disconnect button
  - Disconnect: `DELETE /api/auth/github/disconnect/` — remove `github_id` from user

---

### TASK-203 — PostHog Product Analytics
**Priority:** 🟢 High | **Effort:** S | **Impact:** Data-driven decisions — currently flying blind on DAU, activation, churn

- [ ] **TASK-203-F1:** Install and configure PostHog
  - File: `frontend/package.json` — add `posthog-js`
  - File: `frontend/src/components/AnalyticsProvider.tsx` — initialize PostHog with `NEXT_PUBLIC_POSTHOG_KEY`
  - File: `.env.example` — add `NEXT_PUBLIC_POSTHOG_KEY=`, `NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com`
- [ ] **TASK-203-F2:** Track core user events
  - File: `frontend/src/utils/analytics.ts`
  - Add PostHog `capture()` calls for:
    - `user_signed_up` — on registration complete
    - `onboarding_step_completed` (step: 1–5) — during wizard
    - `onboarding_finished` — on wizard completion
    - `ai_query_sent` (model, query_length) — on chat submit
    - `agent_run_started` (agent_type, tools_count)
    - `agent_run_completed` (duration_ms, token_count)
    - `document_generated` (doc_type)
    - `workflow_created` / `workflow_triggered`
    - `upgrade_prompt_shown` (feature_gated, plan)
    - `plan_upgraded` (from_plan, to_plan)
    - `search_performed` (query_length, results_count, search_type)
- [ ] **TASK-203-B1:** Server-side PostHog for backend events
  - File: `backend/requirements.txt` — add `posthog`
  - File: `backend/apps/billing/` — track `subscription_created`, `subscription_cancelled`, `invoice_paid`
  - File: `backend/apps/agents/tasks.py` — track `agent_run_completed` with cost data

---

### TASK-204 — Sentry Error Monitoring
**Priority:** 🟢 High | **Effort:** XS | **Impact:** Know about bugs before users report them — currently flying blind on errors

- [ ] **TASK-204-B1:** Install Sentry in Django backend
  - File: `backend/requirements.txt` — add `sentry-sdk[django,celery]`
  - File: `backend/config/settings/base.py` — add:
    ```python
    import sentry_sdk
    sentry_sdk.init(dsn=env('SENTRY_DSN', default=''), traces_sample_rate=0.1, profiles_sample_rate=0.1)
    ```
  - File: `.env.example` — add `SENTRY_DSN=`
- [ ] **TASK-204-B2:** Install Sentry in FastAPI AI engine
  - File: `ai_engine/requirements.txt` — add `sentry-sdk[fastapi]`
  - File: `ai_engine/main.py` — add `sentry_sdk.init(dsn=..., integrations=[FastApiIntegration()])`
- [ ] **TASK-204-F1:** Install Sentry in Next.js frontend
  - Run: `npx @sentry/wizard@latest -i nextjs` in `frontend/`
  - Files auto-generated: `frontend/sentry.client.config.ts`, `frontend/sentry.server.config.ts`
  - File: `.env.example` — add `NEXT_PUBLIC_SENTRY_DSN=`


---

## 🟢 Phase 3 — AI Differentiation (Tier 2)

> These features directly improve the core AI quality and make Synapse meaningfully better than alternatives.

---

### TASK-301 — Hybrid Search (BM25 + Semantic + Reranking)
**Priority:** 🟢 High | **Effort:** L | **Impact:** 40–60% better retrieval accuracy — single biggest search quality improvement

#### Backend
- [ ] **TASK-301-B1:** Add PostgreSQL full-text search indexes
  - Files: `backend/apps/articles/models.py`, `backend/apps/papers/models.py`, `backend/apps/repositories/models.py`
  - Add `GinIndex` on `SearchVectorField` combining `title` + `summary` / `description`
  - Example:
    ```python
    from django.contrib.postgres.search import SearchVectorField
    search_vector = SearchVectorField(null=True)
    class Meta:
        indexes = [GinIndex(fields=['search_vector'])]
    ```
  - Create migrations for each app
- [ ] **TASK-301-B2:** Add Celery task to update search vectors
  - Files: `backend/apps/articles/tasks.py` etc.
  - Task: `update_search_vectors()` — runs nightly, updates all stale search_vector fields
  - Use `SearchVector('title', weight='A') + SearchVector('summary', weight='B')`
- [ ] **TASK-301-B3:** Install BM25 / full-text search dependency
  - File: `backend/requirements.txt` — verify `django.contrib.postgres` is enabled (built-in)
  - Optional: add `rank-bm25` for pure BM25 scoring outside PostgreSQL
- [ ] **TASK-301-B4:** Implement hybrid retriever
  - File: `ai_engine/rag/retriever.py`
  - New method `hybrid_search(query: str, k: int = 10) -> list[SearchResult]`:
    1. Run semantic vector search → top-20 results with cosine similarity scores
    2. Run PostgreSQL full-text search (`SearchQuery` + `SearchRank`) → top-20 results with text scores
    3. Merge using **Reciprocal Rank Fusion (RRF)**: `score = 1/(60 + rank_semantic) + 1/(60 + rank_bm25)`
    4. Sort by combined RRF score, return top-k
- [ ] **TASK-301-B5:** Add reranking step
  - File: `ai_engine/rag/retriever.py`
  - Add optional `rerank=True` parameter to `hybrid_search()`
  - If `rerank=True`: call Cohere Rerank API (`cohere.rerank(model='rerank-english-v3.0', query=q, documents=results, top_n=5)`)
  - Alternatively: use `BAAI/bge-reranker-base` locally via `FlagEmbedding`
  - File: `ai_engine/requirements.txt` — add `cohere` (or `FlagEmbedding`)
  - File: `.env.example` — add `COHERE_API_KEY=`
- [ ] **TASK-301-B6:** Update RAG chain to use hybrid search
  - File: `ai_engine/rag/chain.py`
  - Replace `retriever.search()` with `retriever.hybrid_search(query, k=10, rerank=True)`
- [ ] **TASK-301-B7:** Update semantic search API endpoint
  - File: `backend/apps/core/views_nlp.py`
  - Update `POST /api/search/semantic/` to use hybrid approach
  - Add query param `?mode=semantic|hybrid|keyword` to allow client control
- [ ] **TASK-301-B8:** Add search result explanations
  - File: `ai_engine/rag/retriever.py`
  - Return `match_reason` in results: `"semantic"`, `"keyword"`, or `"both"` — for frontend display

#### Frontend
- [ ] **TASK-301-F1:** Add search mode toggle
  - File: `frontend/src/app/(dashboard)/search/page.tsx`
  - Segmented control: "Smart (Hybrid)" / "Semantic" / "Keyword"
  - Pass `?mode=` param to API

---

### TASK-302 — Claude + Ollama LLM Support
**Priority:** 🟢 High | **Effort:** M | **Impact:** Enterprise readiness + privacy-conscious users + better reasoning

#### Backend
- [ ] **TASK-302-B1:** Add Anthropic Claude integration
  - File: `ai_engine/agents/base.py`
  - Add model instantiation branch: `if provider == 'anthropic': llm = ChatAnthropic(model=model_name, api_key=...)`
  - Supported: `claude-3-5-sonnet-20241022` (primary), `claude-3-haiku-20240307` (budget)
  - File: `ai_engine/requirements.txt` — add `langchain-anthropic`
  - File: `.env.example` — add `ANTHROPIC_API_KEY=`
- [ ] **TASK-302-B2:** Add Ollama local LLM integration
  - File: `ai_engine/agents/base.py`
  - Add: `if provider == 'ollama': llm = ChatOllama(model=model_name, base_url=OLLAMA_BASE_URL)`
  - Supported models: `llama3.2`, `mistral`, `codellama`, `deepseek-r1`
  - File: `ai_engine/requirements.txt` — add `langchain-ollama`
  - File: `.env.example` — add `OLLAMA_BASE_URL=http://localhost:11434`
- [ ] **TASK-302-B3:** Build model router
  - File: `ai_engine/agents/router.py` *(new)*
  - Route by task type:
    - Simple Q&A / summarization → `claude-3-haiku` or `gpt-4o-mini` (cheap)
    - Complex reasoning / research → `claude-3-5-sonnet` or `gpt-4o` (expensive)
    - Code tasks → `codellama` (local, free) or `gpt-4o`
  - Also route by user's plan: Free → cheap models only; Pro → any model
  - Read user's explicit preference from request body: `{"model": "claude-3-5-sonnet"}`
- [ ] **TASK-302-B4:** Add model metadata endpoint
  - File: `ai_engine/main.py` or `backend/apps/core/views.py`
  - `GET /api/models/` — return list of available models with: name, provider, cost_tier, capabilities
  - Filter by user's plan (Free users only see free/cheap models)

#### Frontend
- [ ] **TASK-302-F1:** Model selector in chat UI
  - File: `frontend/src/app/(dashboard)/chat/page.tsx`
  - Dropdown showing available models with cost indicator: 🟢 Free · 🟡 $ · 🔴 $$
  - Show: model name, provider logo, brief description
  - Persist selection to user preferences via `PATCH /api/users/me/`
- [ ] **TASK-302-F2:** Model selector in agent UI
  - File: `frontend/src/app/(dashboard)/agents/page.tsx`
  - Same model picker component (reuse from chat)
  - Show estimated cost before running expensive models

---

### TASK-303 — AI Agent Tool Expansion
**Priority:** 🟢 High | **Effort:** L | **Impact:** Agents become genuinely useful — current tools are limited

- [ ] **TASK-303-B1:** Add web search tool (Tavily)
  - File: `ai_engine/agents/tools.py`
  - New tool: `web_search(query: str, max_results: int = 5) -> list[SearchResult]`
  - Uses Tavily API — returns title, URL, snippet, published date
  - File: `ai_engine/requirements.txt` — add `tavily-python`
  - File: `.env.example` — add `TAVILY_API_KEY=`
- [ ] **TASK-303-B2:** Add Python code execution sandbox (E2B)
  - File: `ai_engine/agents/tools.py`
  - New tool: `run_python_code(code: str) -> dict` — returns stdout, stderr, any files
  - Uses E2B Sandbox API for safe isolated execution
  - File: `ai_engine/requirements.txt` — add `e2b`
  - File: `.env.example` — add `E2B_API_KEY=`
- [ ] **TASK-303-B3:** Add PDF/document reader tool
  - File: `ai_engine/agents/tools.py`
  - New tool: `read_document(file_url: str) -> str` — fetch PDF, extract text via `pymupdf`
  - Chunk text (512 tokens), embed on-the-fly, perform mini-RAG for document Q&A
  - File: `ai_engine/requirements.txt` — add `pymupdf`
- [ ] **TASK-303-B4:** Add chart/visualization generator tool
  - File: `ai_engine/agents/tools.py`
  - New tool: `generate_chart(data: dict, chart_type: str) -> str` — returns base64 PNG
  - Use `matplotlib` / `plotly` to render bar, line, pie charts
  - Frontend renders inline: `<img src="data:image/png;base64,{result}" />`
- [ ] **TASK-303-B5:** Add Notion reader tool
  - File: `ai_engine/agents/tools.py`
  - New tool: `read_notion_page(page_id: str) -> str` — fetch Notion page via Notion API
  - File: `.env.example` — add `NOTION_API_KEY=`
- [ ] **TASK-303-B6:** Register all new tools in agent registry
  - File: `ai_engine/agents/registry.py`
  - Add all new tools with: name, description, input schema, `requires_plan=['pro']` where applicable
  - LLM tool selection uses descriptions — write clear, action-oriented descriptions
- [ ] **TASK-303-F1:** Show tool call traces in agent UI
  - File: `frontend/src/app/(dashboard)/agents/page.tsx`
  - Below each agent response: collapsible "Reasoning Trace" accordion
  - Each tool call: `🔧 web_search("transformers 2025")` → truncated output preview
  - Code execution: syntax-highlighted code block + stdout output
  - Charts: render inline in the trace

---

### TASK-304 — Voice Interface
**Priority:** 🟢 Medium | **Effort:** M | **Impact:** Differentiation; hands-free research mode

- [ ] **TASK-304-B1:** Add Whisper transcription endpoint
  - File: `backend/apps/core/views_chat.py`
  - `POST /api/chat/transcribe/` — accept audio file (webm/ogg/mp4), return `{"text": "..."}`
  - Uses OpenAI Whisper API (`openai.audio.transcriptions.create`)
  - Max audio size: 25MB; return 400 if exceeded
- [ ] **TASK-304-F1:** Microphone input in chat
  - File: `frontend/src/app/(dashboard)/chat/page.tsx`
  - Mic button next to send button — click to start recording, click again to stop
  - Use browser `MediaRecorder` API to capture audio as `audio/webm`
  - On stop: POST blob to `/api/chat/transcribe/`, populate input field with result
  - Show: waveform animation while recording, loading spinner while transcribing
- [ ] **TASK-304-F2:** Text-to-speech playback
  - File: `frontend/src/app/(dashboard)/chat/page.tsx`
  - "🔊 Read Aloud" button on each AI response
  - Use browser `SpeechSynthesis` API (free) — `window.speechSynthesis.speak(utterance)`
  - Optional upgrade: ElevenLabs API for higher-quality TTS (Pro feature)

---

### TASK-305 — Daily AI Briefing (In-App)
**Priority:** 🟢 Medium | **Effort:** M | **Impact:** Creates daily engagement loop — users open app every morning

#### Backend
- [ ] **TASK-305-B1:** Create DailyBriefing model
  - File: `backend/apps/core/models.py`
  - Fields: `user (FK)`, `content (TextField)`, `generated_at (DateTimeField)`, `sources (JSONField)`, `topic_summary (JSONField)`
  - Unique constraint: one briefing per user per day
- [ ] **TASK-305-B2:** Create daily briefing Celery task
  - File: `backend/apps/core/tasks.py`
  - Task: `generate_daily_briefings()` — runs at 6:30am UTC via Celery beat
  - For each active user: query trending content from last 24h matching their interest topics
  - Call AI engine to generate 3-paragraph briefing with source attribution
  - Store in `DailyBriefing` model
- [ ] **TASK-305-B3:** Add briefing API endpoint
  - File: `backend/apps/core/views.py`
  - `GET /api/briefing/today/` — return today's briefing for authenticated user (or 404 if not generated yet)
  - `GET /api/briefing/history/` — list past 7 days of briefings

#### Frontend
- [ ] **TASK-305-F1:** "Today's Brief" card on home dashboard
  - File: `frontend/src/app/(dashboard)/home/page.tsx`
  - Prominent card at top: "Good morning {name} ☀️ — Here's what's happening in {topics}"
  - Expandable: show full briefing text
  - Source links: numbered inline citations [1], [2]... clickable to open source
  - "Ask follow-up" button → opens chat with briefing content as context

---

### TASK-306 — Prompt Library
**Priority:** 🟢 Medium | **Effort:** M | **Impact:** User stickiness + community-driven growth

#### Backend
- [ ] **TASK-306-B1:** Create PromptTemplate model
  - File: `backend/apps/agents/models.py`
  - Fields: `title, description, content (TextField), category (CharField), author (FK User), is_public (bool), use_count (int), upvotes (int), created_at`
  - Categories: Research / Coding / Writing / Analysis / Business / Creative
- [ ] **TASK-306-B2:** Prompt library API endpoints
  - File: `backend/apps/agents/views.py`
  - `GET  /api/prompts/`         — list public prompts (filter by `?category=`, `?sort=popular|newest`)
  - `POST /api/prompts/`         — create prompt (authenticated)
  - `GET  /api/prompts/{id}/`    — get single prompt
  - `POST /api/prompts/{id}/use/`    — increment use_count, return prompt content
  - `POST /api/prompts/{id}/upvote/` — toggle upvote (one per user)
  - `GET  /api/prompts/my/`     — list user's own prompts

#### Frontend
- [ ] **TASK-306-F1:** Prompt Library page
  - File: `frontend/src/app/(dashboard)/prompts/page.tsx` *(new)*
  - Category filter tabs: All / Research / Coding / Writing / Analysis
  - Sort: Popular / Newest / My Prompts
  - Prompt card: title, description, author, use count, upvote button
  - "Use Prompt" → opens agent runner or chat with prompt pre-filled
- [ ] **TASK-306-F2:** Prompt picker in agent/chat UI
  - File: `frontend/src/app/(dashboard)/agents/page.tsx` and `chat/page.tsx`
  - "📚 Browse Prompts" button → opens prompt picker modal
  - Search prompts inline, click to insert into input field


---

## 🟢 Phase 4 — UX & Design Overhaul (Tier 3)

> Polish and UX improvements that significantly improve perceived quality and user productivity.

---

### TASK-401 — Design System Upgrade
**Priority:** 🟢 Medium | **Effort:** L | **Impact:** Brand consistency, faster UI development, professional look

- [ ] **TASK-401-1:** Define custom design tokens in Tailwind config
  - File: `frontend/tailwind.config.ts`
  - Define: `colors.brand.{50..950}`, `colors.surface.{base|raised|overlay}`, `colors.text.{primary|secondary|muted}`
  - Replace all ad-hoc `indigo-*` / `violet-*` / `gray-*` with brand tokens throughout codebase
  - Run: global search-replace for color classes
- [ ] **TASK-401-2:** Implement dark/light mode toggle
  - File: `frontend/tailwind.config.ts` — add `darkMode: 'class'`
  - File: `frontend/src/app/layout.tsx` — wrap with `ThemeProvider` (use `next-themes`)
  - File: `frontend/src/components/layout/Navbar.tsx` — add sun/moon icon toggle button
  - Store preference in `localStorage`; respect OS `prefers-color-scheme` on first visit
  - Audit all components: ensure every color uses dark: variant
- [ ] **TASK-401-3:** Standardise spacing to 4px base grid
  - Audit all pages for arbitrary padding/margin values (e.g., `p-[13px]`)
  - Replace with nearest Tailwind spacing token
  - Goal: consistent 4/8/12/16/24/32/48/64px rhythm throughout
- [ ] **TASK-401-4:** Add Storybook for component library
  - Run: `npx storybook@latest init` inside `frontend/`
  - Write stories for all `frontend/src/components/ui/` components:
    - `Button` (all variants + sizes + states), `Card`, `Badge`, `Input`, `Modal`, `SkeletonLoader`, `Tooltip`
  - Auto-publish Storybook to GitHub Pages on CI

---

### TASK-402 — Command Palette (⌘K Global Search)
**Priority:** 🟢 High | **Effort:** M | **Impact:** Instant UX quality signal; power-user productivity

- [ ] **TASK-402-1:** Install `cmdk` library
  - File: `frontend/package.json` — add `cmdk`
  - Run: `npm install cmdk`
- [ ] **TASK-402-2:** Create CommandPalette component
  - File: `frontend/src/components/ui/CommandPalette.tsx` *(new)*
  - Trigger: `⌘K` (Mac) / `Ctrl+K` (Windows/Linux) — global `keydown` listener in layout
  - Structure:
    ```
    [Search input]
    ─── Recent ──────────────────
    [Recently visited pages]
    ─── Content ─────────────────
    [Matched articles, papers, repos]
    ─── Actions ─────────────────
    [New Agent / New Automation / New Document]
    ─── Navigation ──────────────
    [Settings / Billing / Help]
    ```
  - Keyboard navigation: `↑↓` arrows, `Enter` to select, `Esc` to close
- [ ] **TASK-402-3:** Connect to backend search API
  - File: `frontend/src/components/ui/CommandPalette.tsx`
  - Debounced (200ms) `GET /api/v1/search/?q={query}&limit=5` as user types
  - Show results grouped by content type with type icons
  - Show loading spinner during fetch
- [ ] **TASK-402-4:** Mount CommandPalette globally
  - File: `frontend/src/app/layout.tsx`
  - Add `<CommandPalette />` component — renders portal to `#modal-root`
  - Add "Search..." pill to Navbar that also triggers it on click

---

### TASK-403 — Dashboard Redesign — Command Center Layout
**Priority:** 🟢 Medium | **Effort:** XL | **Impact:** Premium product feel; UX differentiation vs competitors

- [ ] **TASK-403-1:** Implement 3-panel split layout
  - File: `frontend/src/app/(dashboard)/layout.tsx`
  - Left: collapsible sidebar (existing, refined) — 240px wide
  - Center: main content with infinite scroll — flexible
  - Right: collapsible AI assistant panel — 320px wide (hidden on < xl screens)
- [ ] **TASK-403-2:** Build persistent AI assistant right panel
  - File: `frontend/src/components/layout/AIAssistantPanel.tsx` *(new)*
  - Always-visible mini chat interface (like Cursor's AI panel)
  - Context-aware: reads current page route, passes as context to AI
  - Collapses to icon strip on mobile; full panel on desktop
  - Shares conversation state with main chat page
- [ ] **TASK-403-3:** Add infinite scroll to feed and research pages
  - Files: `frontend/src/app/(dashboard)/feed/page.tsx`, `research/page.tsx`
  - Replace `usePage`/cursor pagination with React Query `useInfiniteQuery`
  - `IntersectionObserver` at bottom of list to trigger `fetchNextPage()`
  - Show `<SkeletonCard />` rows while loading next page

---

### TASK-404 — Mobile-First Redesign + PWA Activation
**Priority:** 🟢 Medium | **Effort:** L | **Impact:** Mobile users + PWA installs = wider audience

- [ ] **TASK-404-1:** Add bottom navigation bar for mobile
  - File: `frontend/src/components/layout/Sidebar.tsx`
  - On `< md` screens: hide sidebar, show fixed bottom tab bar
  - Tabs (5 max): Home / Feed / Search / Chat / Profile
  - Active state: filled icon + label
- [ ] **TASK-404-2:** Activate Service Worker with proper caching
  - File: `frontend/public/sw.js` — implement full caching strategy:
    - Static assets (JS/CSS/fonts): Cache First
    - API GET requests: Stale-While-Revalidate
    - API POST/PATCH: Network Only
  - File: `frontend/src/components/ServiceWorkerRegistration.tsx` — verify SW registers; show update banner when new SW available
- [ ] **TASK-404-3:** Add PWA install prompt
  - File: `frontend/src/components/ServiceWorkerRegistration.tsx`
  - Listen for `beforeinstallprompt` event, store in ref
  - Show "Install App" banner at bottom with install button
  - On install: call `prompt()`, track install event in PostHog
- [ ] **TASK-404-4:** Add web push notifications
  - File: `frontend/src/hooks/useNotificationSocket.ts`
  - Request `Notification` permission after onboarding completes
  - Subscribe to push via `registration.pushManager.subscribe()`
  - Backend: `POST /api/users/push-subscriptions/` to store endpoint
  - Send push for: agent run completed, daily briefing ready, trending alert

---

### TASK-405 — Accessibility (A11y) Audit
**Priority:** 🟢 Medium | **Effort:** M | **Impact:** WCAG 2.1 AA compliance; screen reader support; legal risk reduction

- [ ] **TASK-405-1:** Add ARIA labels to all modals
  - Files: `frontend/src/components/ui/Modal.tsx` + all page-level modals
  - Add: `role="dialog"`, `aria-modal="true"`, `aria-labelledby="modal-title"`, `aria-describedby="modal-desc"`
- [ ] **TASK-405-2:** Implement focus trap in modals
  - File: `frontend/src/components/ui/Modal.tsx`
  - Install: `focus-trap-react` → `npm install focus-trap-react`
  - Wrap modal content in `<FocusTrap>` — Tab/Shift+Tab cycles only within open modal
  - On open: focus first focusable element; on close: return focus to trigger element
- [ ] **TASK-405-3:** Add keyboard navigation to automation builder
  - File: `frontend/src/app/(dashboard)/automation/page.tsx`
  - Arrow keys navigate between workflow steps
  - `Enter` to expand/edit step, `Delete` to remove, `Escape` to cancel edit
- [ ] **TASK-405-4:** Fix color contrast to WCAG AA
  - Audit all text/background combinations using `axe-core` or `Storybook a11y addon`
  - All normal text: 4.5:1 ratio minimum; large text: 3:1 minimum
  - Fix offending color combinations in design tokens
- [ ] **TASK-405-5:** Add skip-to-main-content link
  - File: `frontend/src/app/layout.tsx`
  - Add as first child of `<body>`: `<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-50">Skip to content</a>`
  - Add `id="main-content"` to main content wrapper in dashboard layout


---

## 🏗️ Phase 5 — Technical Architecture Upgrades

> Infrastructure improvements that make the system production-ready, observable, and scalable.

---

### TASK-501 — Per-User Rate Limiting (Django)
**Priority:** 🏗️ High | **Effort:** M | **Impact:** Prevent abuse; enforce plan tiers on Django API layer

- [ ] **TASK-501-B1:** Install django-ratelimit
  - File: `backend/requirements.txt` — add `django-ratelimit`
- [ ] **TASK-501-B2:** Add rate limits to AI/chat endpoints
  - File: `backend/apps/core/views_chat.py`
  - Decorator: `@ratelimit(key='user', rate='5/d', method='POST', block=True)` for Free
  - Use Redis-backed keys: `rl:user:{id}:ai:{date}`
  - Plan-aware limits: Free 5/day · Pro 200/day · Team 1000/day pooled
- [ ] **TASK-501-B3:** Add rate limits to agent endpoints
  - File: `backend/apps/agents/views.py`
  - Free: 1 agent run/day · Pro: 50/day · Team: 200/day pooled
- [ ] **TASK-501-B4:** Return clear 429 responses
  - Include headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
  - JSON body: `{"error": "rate_limit_exceeded", "reset_at": "...", "upgrade_url": "/pricing"}`
- [ ] **TASK-501-F1:** Handle 429 errors gracefully in frontend
  - File: `frontend/src/utils/api.ts`
  - Intercept 429 → show `<UpgradeModal>` with countdown timer until reset

---

### TASK-502 — Database Automated Backups
**Priority:** 🏗️ High | **Effort:** S | **Impact:** Data loss prevention; production safety net

- [ ] **TASK-502-B1:** Create pg_dump Celery task
  - File: `backend/apps/core/tasks.py`
  - Task: `backup_database()` — runs daily at 2:00 AM UTC via Celery beat
  - Command: `pg_dump {DATABASE_URL} | gzip > /tmp/backup_{date}.sql.gz`
  - Upload to S3: `s3://synapse-backups/postgres/YYYY/MM/DD.sql.gz`
  - Retention policy: keep last 30 days; delete older backups automatically
  - Env vars: `BACKUP_S3_BUCKET=`, `AWS_ACCESS_KEY_ID=`, `AWS_SECRET_ACCESS_KEY=`
- [ ] **TASK-502-B2:** Add backup failure alerting
  - On task failure: send email to admin + POST to Slack webhook
  - Add Prometheus metric: `synapse_backup_last_success_timestamp`
  - Alert rule: if backup not run in 25 hours → fire alert
- [ ] **TASK-502-3:** Document backup restore procedure
  - File: `DEPLOYMENT.md` — add "Backup & Restore" section
  - Include: `aws s3 cp ...`, `gunzip`, `psql {DATABASE_URL} < backup.sql` steps

---

### TASK-503 — Form Validation (React Hook Form + Zod)
**Priority:** 🏗️ Medium | **Effort:** M | **Impact:** Type-safe forms; better UX; eliminate runtime validation bugs

- [ ] **TASK-503-1:** Install dependencies
  - File: `frontend/package.json` — add `react-hook-form`, `zod`, `@hookform/resolvers`
  - Run: `npm install react-hook-form zod @hookform/resolvers`
- [ ] **TASK-503-2:** Add Zod schemas for auth forms
  - File: `frontend/src/app/(auth)/login/page.tsx` — schema: email (valid email), password (min 8 chars)
  - File: `frontend/src/app/(auth)/register/page.tsx` — schema: name, email, password, confirmPassword (must match)
  - File: `frontend/src/app/(auth)/forgot-password/page.tsx` — schema: email
  - File: `frontend/src/app/(auth)/reset-password/page.tsx` — schema: password + confirm (match, min 8, 1 number, 1 uppercase)
- [ ] **TASK-503-3:** Add validation to settings forms
  - File: `frontend/src/app/(dashboard)/settings/page.tsx`
  - Profile form: display_name (min 2), bio (max 160), website (valid URL or empty)
  - Password change: current_password, new_password (strength validation), confirm
- [ ] **TASK-503-4:** Add validation to automation workflow builder
  - File: `frontend/src/app/(dashboard)/automation/page.tsx`
  - Workflow name: required, min 3 chars, max 80
  - Trigger config: required fields per trigger type
  - Action config: required fields per action type

---

### TASK-504 — OpenTelemetry Distributed Tracing
**Priority:** 🏗️ Medium | **Effort:** M | **Impact:** Debug cross-service latency; identify slow queries

- [ ] **TASK-504-B1:** Add OpenTelemetry to Django backend
  - File: `backend/requirements.txt` — add `opentelemetry-sdk`, `opentelemetry-instrumentation-django`, `opentelemetry-instrumentation-psycopg2`, `opentelemetry-exporter-otlp`
  - File: `backend/config/settings/base.py` — configure TracerProvider with OTLP exporter to Tempo
  - Auto-instrument: Django requests, PostgreSQL queries, Redis calls, Celery tasks
- [ ] **TASK-504-B2:** Add OpenTelemetry to FastAPI AI engine
  - File: `ai_engine/requirements.txt` — add `opentelemetry-instrumentation-fastapi`, `opentelemetry-instrumentation-httpx`
  - File: `ai_engine/main.py` — configure tracer; instrument FastAPI app
  - Add spans around: LLM calls, embedding generation, retrieval steps
- [ ] **TASK-504-B3:** Add Grafana Tempo to monitoring stack
  - File: `docker-compose.monitoring.yml`
  - Add `tempo` service with OTLP HTTP/gRPC receiver
  - File: `infrastructure/monitoring/grafana/provisioning/datasources/datasources.yml` — add Tempo datasource
  - Link traces from Grafana dashboards

---

### TASK-505 — Audit Log System
**Priority:** 🏗️ Medium | **Effort:** M | **Impact:** Enterprise compliance (SOC2 prep); security forensics

- [ ] **TASK-505-B1:** Create AuditLog model
  - File: `backend/apps/core/models.py`
  - Fields: `user (FK, null)`, `action (CharField)`, `resource_type (CharField)`, `resource_id (CharField)`, `metadata (JSONField)`, `ip_address (GenericIPAddressField)`, `user_agent (TextField)`, `created_at (DateTimeField, db_index=True)`
  - Indexed on: `user`, `created_at`, `action`, composite `(user, action, created_at)`
- [ ] **TASK-505-B2:** Create audit log decorator/middleware
  - File: `backend/apps/core/audit.py` *(new)*
  - Decorator: `@audit_log(action='agent.run', resource_type='agent')`
  - Auto-captures: `request.user`, `request.META['REMOTE_ADDR']`, `request.META.get('HTTP_USER_AGENT')`
  - Apply to key views: login, logout, plan changes, agent runs, document generation, API key create/revoke, org changes
- [ ] **TASK-505-B3:** Audit log API for admins and org owners
  - File: `backend/apps/core/views.py`
  - `GET /api/admin/audit-logs/` — filterable by `?user=`, `?action=`, `?from=`, `?to=`
  - Paginated (100 per page); CSV export option

---

### TASK-506 — Database Connection Pooling (pgBouncer)
**Priority:** 🏗️ Medium | **Effort:** S | **Impact:** Handle 10x more concurrent users without DB connection exhaustion

- [ ] **TASK-506-1:** Add pgBouncer service to docker-compose
  - File: `docker-compose.prod.yml`
  - Add `pgbouncer` service: `edoburu/pgbouncer:latest`
  - Config: pool_mode = transaction, max_client_conn = 1000, default_pool_size = 20
- [ ] **TASK-506-2:** Update DATABASE_URL to point to pgBouncer
  - File: `.env.example` — note: `DATABASE_URL` should point to pgBouncer port (5432 → 6432)
  - Update `docker-compose.prod.yml` Django service env
- [ ] **TASK-506-3:** Disable Django persistent connections (incompatible with pgBouncer transaction mode)
  - File: `backend/config/settings/production.py`
  - Set: `CONN_MAX_AGE = 0` (disable persistent connections)

---

### TASK-507 — CDN for Static Assets (Cloudflare)
**Priority:** 🏗️ Medium | **Effort:** S | **Impact:** Faster global page loads; reduce server bandwidth

- [ ] **TASK-507-1:** Configure Next.js to use CDN for static assets
  - File: `frontend/next.config.mjs`
  - Add: `assetPrefix: process.env.CDN_URL || ''`
  - File: `.env.example` — add `CDN_URL=https://cdn.yoursynapse.com`
- [ ] **TASK-507-2:** Configure Nginx to set cache headers
  - File: `infrastructure/nginx/conf.d/synapse.conf`
  - Static assets: `Cache-Control: public, max-age=31536000, immutable`
  - API responses: `Cache-Control: no-store`
- [ ] **TASK-507-3:** Set up Cloudflare CDN
  - Point domain to Cloudflare
  - Enable: Brotli compression, HTTP/2, TLS 1.3
  - Cache rules: cache `/_next/static/` · bypass cache for `/api/`


---

## 🚀 Phase 6 — New Market Differentiation Features

> Build these after achieving Product-Market Fit. These are revenue multipliers and competitive moats.

---

### TASK-601 — Research Mode (Deep Dive Intelligence)
**Priority:** 🚀 High | **Effort:** XL | **Impact:** Core product differentiator; $10–20/month premium feature

#### Backend
- [ ] **TASK-601-B1:** Create ResearchSession model
  - File: `backend/apps/agents/models.py`
  - Fields: `user (FK)`, `query (TextField)`, `status [queued|running|complete|failed]`, `report (TextField)`, `sources (JSONField)`, `sub_questions (JSONField)`, `created_at`, `completed_at`
- [ ] **TASK-601-B2:** Build Plan-and-Execute research agent
  - File: `ai_engine/agents/research_agent.py` *(new)*
  - Multi-step LangGraph workflow:
    1. **Plan:** LLM decomposes query into 3–5 sub-questions
    2. **Research:** For each sub-question: search ArXiv + GitHub + knowledge base in parallel
    3. **Synthesize:** LLM synthesizes results per sub-question with citations
    4. **Report:** LLM generates final structured report (intro, sections per sub-question, conclusion)
    5. **Format:** Add inline citations `[1]`, `[2]` linked to sources
  - Stream progress events via WebSocket: `{step: "plan", data: sub_questions}`
- [ ] **TASK-601-B3:** Research API endpoints
  - `POST /api/research/`         — start research session (returns `session_id`)
  - `GET  /api/research/{id}/`    — get session status + report (poll-based)
  - `WS   /ws/research/{id}/`     — stream progress events (WebSocket)
  - `GET  /api/research/{id}/export/?format=pdf|markdown` — download report
- [ ] **TASK-601-B4:** PDF export for research reports
  - File: `backend/apps/documents/views.py`
  - Use existing document generation infrastructure
  - Template: academic literature review format with references section

#### Frontend
- [ ] **TASK-601-F1:** Research Mode landing UI
  - File: `frontend/src/app/(dashboard)/research/page.tsx` — overhaul existing page
  - Large centered search bar (Perplexity-style)
  - Toggle: "Quick Search" vs "Deep Research Mode" 
  - Research mode: show estimated time (2–5 min), source count
- [ ] **TASK-601-F2:** Research progress tracker
  - Real-time progress steps: Decomposing → Searching → Analyzing → Writing
  - Animated step indicator with sub-question previews as they're generated
- [ ] **TASK-601-F3:** Research report viewer
  - Structured report with section headers, paragraphs, and `[1]`-style citations
  - Citations panel on right side: numbered source cards with title, URL, excerpt
  - Click citation → highlight source card
  - Toolbar: Export PDF / Copy Markdown / Open in Notion / Share Link

---

### TASK-602 — GitHub Intelligence Dashboard
**Priority:** 🚀 Medium | **Effort:** L | **Impact:** Killer feature for developer/CTO audience; free to attract devs

- [ ] **TASK-602-B1:** Enhance GitHub spider with velocity data
  - File: `scraper/spiders/github_spider.py`
  - Capture: star count snapshots over time (store daily), fork count, language, topics, last_commit_date, contributor_count, open_issues
- [ ] **TASK-602-B2:** Create GitHub trend analytics Celery task
  - File: `backend/apps/repositories/` — new `analytics.py`
  - Daily task: compute 7-day and 30-day star velocity for each repo
  - Classify: `rising_star` (>50 stars/week), `stable`, `declining` (<-10 stars/week)
  - Store trend classification in Repository model
- [ ] **TASK-602-B3:** GitHub intelligence API endpoints
  - `GET /api/github/trending/` — repos sorted by 7d star velocity (filter: `?language=`, `?topic=`)
  - `GET /api/github/ecosystem/{language}/` — language health: total repos, avg star growth, top frameworks
  - `GET /api/github/repo/{id}/analysis/` — full repo analysis: growth chart, tech stack, similar repos
- [ ] **TASK-602-F1:** Overhaul GitHub Intelligence page
  - File: `frontend/src/app/(dashboard)/github/page.tsx`
  - Sections:
    - **Trending Now:** repos with star velocity sparklines (use existing `StarSparkline` component)
    - **Rising Stars:** repos gaining traction (<6 months old, >100 stars/week)
    - **Ecosystem Health:** language cards with growth indicators
    - **Tech Radar:** trending frameworks/libraries (use existing `TrendRadar` component)

---

### TASK-603 — AI Knowledge Graph
**Priority:** 🚀 Medium | **Effort:** XL | **Impact:** Unique visual differentiator; premium enterprise feature

- [ ] **TASK-603-B1:** Design knowledge graph data models
  - File: `backend/apps/core/models.py`
  - `KnowledgeNode`: `entity_type [concept|paper|repo|author|tool|organization]`, `name`, `description`, `source_ids (JSONField)`, `embedding (VectorField)`
  - `KnowledgeEdge`: `source (FK KnowledgeNode)`, `target (FK KnowledgeNode)`, `relation_type [cites|uses|authored_by|related_to|built_with]`, `weight (float)`, `evidence (JSONField)`
- [ ] **TASK-603-B2:** Build graph construction pipeline
  - File: `backend/apps/core/tasks.py` — new `build_knowledge_graph()` Celery task
  - Use NER results from `ai_engine/nlp/ner.py` to extract entities from all content
  - Link: papers citing same concepts, repos using same libraries, authors across papers
  - Run incrementally: process only new content since last run
- [ ] **TASK-603-B3:** Knowledge graph API
  - `GET /api/knowledge-graph/?center={node_id}&depth=2` — return nodes + edges JSON for visualization
  - `GET /api/knowledge-graph/search/?q={query}` — find node by name/concept
  - `GET /api/knowledge-graph/nodes/{id}/` — node detail with related content
- [ ] **TASK-603-F1:** Interactive knowledge graph UI
  - File: `frontend/src/app/(dashboard)/knowledge-graph/page.tsx` *(new)*
  - Use `react-force-graph-2d` for force-directed graph visualization
  - Node click: open detail panel showing related content
  - Filters: content type chips, date range slider, topic filter
  - "Explore from" input: type concept name → center graph on that node

---

### TASK-604 — Automation Marketplace
**Priority:** 🚀 Medium | **Effort:** L | **Impact:** Community-driven growth + 30% platform revenue from paid templates

- [ ] **TASK-604-B1:** Add marketplace fields to Workflow model
  - File: `backend/apps/automation/models.py`
  - Add: `is_published (bool)`, `marketplace_title (str)`, `marketplace_description (text)`, `download_count (int)`, `upvotes (int)`, `price_cents (int, default=0)`, `author_revenue_share (float, default=0.7)`
- [ ] **TASK-604-B2:** Marketplace API endpoints
  - `GET  /api/marketplace/workflows/`             — list published templates (filter: `?category=`, `?free=`, `?sort=popular`)
  - `GET  /api/marketplace/workflows/{id}/`        — template detail + preview
  - `POST /api/marketplace/workflows/{id}/install/` — clone template to user's workspace
  - `POST /api/marketplace/workflows/{id}/publish/` — submit user's workflow for review
  - `POST /api/marketplace/workflows/{id}/upvote/`
- [ ] **TASK-604-F1:** Marketplace page
  - File: `frontend/src/app/(dashboard)/marketplace/page.tsx` *(new)*
  - Hero: "Community Workflows" — featured templates
  - Filter sidebar: category, free/paid, popularity, rating
  - Template card: name, description, author avatar, downloads, rating, price
  - "Install" button → add to user's automation workspace, show success toast
  - "Publish" flow for users who want to share their workflows

---

### TASK-605 — Public API + Developer Portal
**Priority:** 🚀 Medium | **Effort:** L | **Impact:** PLG motion; $5K–$50K/month from API consumers

#### Backend
- [ ] **TASK-605-B1:** Create APIKey model
  - File: `backend/apps/users/models.py`
  - Model: `APIKey` (user FK, key_prefix CharField, key_hash CharField, name, scopes JSONField, last_used DateTimeField null, created_at, is_active bool, expires_at null)
  - Key format: `sk-syn-{32 random chars}` — store only hash (SHA-256), show full key once on creation
- [ ] **TASK-605-B2:** APIKey authentication class
  - File: `backend/apps/core/auth.py` *(new)*
  - DRF `BaseAuthentication` subclass: `APIKeyAuthentication`
  - Read `Authorization: Bearer sk-syn-...` header
  - Hash incoming key, lookup in DB, update `last_used`
  - Apply to all `/api/v1/` endpoints (alongside session auth)
- [ ] **TASK-605-B3:** Public API endpoints (rate-limited by plan)
  - `GET  /api/v1/content/articles/` — search articles (`?q=`, `?topic=`, `?limit=`)
  - `GET  /api/v1/content/papers/`   — search papers
  - `GET  /api/v1/content/repos/`    — search repositories
  - `POST /api/v1/ai/query/`         — ask AI with RAG (returns answer + sources)
  - `GET  /api/v1/trends/`           — current trending content
  - `POST /api/v1/content/save/`     — save URL to knowledge base (for browser extension)
  - All endpoints: require valid API key, enforce plan rate limits
- [ ] **TASK-605-B4:** API key management endpoints
  - `GET    /api/keys/`     — list user's API keys (without showing full key)
  - `POST   /api/keys/`     — create new key (returns full key ONCE)
  - `DELETE /api/keys/{id}/` — revoke key (set is_active=False)

#### Frontend
- [ ] **TASK-605-F1:** API Keys section in settings
  - File: `frontend/src/app/(dashboard)/settings/page.tsx`
  - Table: key name, prefix (sk-syn-xxxx...), created, last used, scopes, revoke button
  - "Create API Key" button → modal: name input + scope checkboxes → show full key once with copy button
  - Warning: "Copy your key now — we will not show it again"
- [ ] **TASK-605-F2:** Developer Portal page
  - File: `frontend/src/app/(dashboard)/developers/page.tsx` *(new)*
  - Sections:
    - Quick Start: copy-paste code snippets (Python / TypeScript / cURL)
    - Interactive API Reference: link to auto-generated ReDoc/Swagger docs
    - Rate Limits: table showing limits per plan
    - SDK Downloads: `pip install synapse-sdk` / `npm install @synapse/sdk`

---

### TASK-606 — Browser Extension
**Priority:** 🚀 Low | **Effort:** L | **Impact:** Acquisition channel; creates daily habit loop; +50% retention

- [ ] **TASK-606-1:** Create Chrome extension project
  - New directory: `browser-extension/`
  - Files: `manifest.json` (Manifest V3), `background.js` (service worker), `content.js` (page script), `popup.html` + `popup.js`
  - Permissions: `storage`, `tabs`, `contextMenus`, `notifications`
- [ ] **TASK-606-2:** "Save to Synapse" page action
  - `content.js`: inject floating "Save" button on supported pages (ArXiv, GitHub, HN, blog posts)
  - On click: collect `{url, title, selected_text, page_meta}` → `POST /api/v1/content/save/` with API key
  - Show success notification: "Saved to Synapse ✓"
- [ ] **TASK-606-3:** "Explain with Synapse AI" context menu
  - `background.js`: register context menu item on text selection
  - On click: send selected text to `POST /api/v1/ai/query/` → show response in popup
- [ ] **TASK-606-4:** Popup dashboard
  - `popup.html`: mini dashboard showing today's briefing + quick search input
  - Quick search: type query → show top 3 results from Synapse knowledge base
  - Link to full app for detailed view
- [ ] **TASK-606-5:** Firefox extension
  - Adapt Manifest V3 to also support Firefox (WebExtensions API compatible)
  - Submit to Firefox Add-ons store

---

### TASK-607 — Integrations Marketplace
**Priority:** 🚀 Low | **Effort:** L | **Impact:** Enterprise stickiness; unlock high-ACV deals

- [ ] **TASK-607-1:** Notion integration
  - File: `backend/apps/integrations/notion.py` *(new)*
  - OAuth flow: connect Notion workspace
  - Read: import Notion pages into RAG knowledge base (webhook on page update)
  - Write: export research reports directly to Notion as formatted pages
  - Frontend: connect button in Settings → Integrations tab
- [ ] **TASK-607-2:** Slack integration
  - File: `backend/apps/integrations/slack.py` *(new)*
  - Slack App: `/synapse {question}` slash command → calls AI, replies in-channel
  - Opt-in: deliver weekly AI digest to a designated Slack channel
  - Frontend: "Connect Slack" OAuth button in Settings
- [ ] **TASK-607-3:** Obsidian integration
  - File: `backend/apps/integrations/obsidian.py` *(new)*
  - Accept vault sync via file upload or webhook
  - Parse Markdown notes, embed into knowledge base
  - Two-way sync: write AI-generated summaries back as new notes
- [ ] **TASK-607-4:** Zotero integration
  - File: `backend/apps/integrations/zotero.py` *(new)*
  - Connect via Zotero API key
  - Import entire Zotero library (papers + PDFs) into RAG
  - Auto-update when new items added to Zotero
- [ ] **TASK-607-5:** Update integrations settings UI
  - File: `frontend/src/app/(dashboard)/settings/page.tsx` — add "Integrations" tab
  - Integration cards: Google Drive ✓ / Notion / Slack / Obsidian / Zotero / S3
  - Each card: logo, description, connect/disconnect button, last-synced timestamp


---

## 📊 Task Summary & Quick Reference

### Phase Overview

| Phase | Task IDs | Effort | Timeline | Priority |
|---|---|---|---|---|
| **Phase 0** — Critical Fixes | TASK-001 to TASK-006 | 6–8 weeks | Start immediately | 🔴 Blocking |
| **Phase 1** — Remove & Simplify | TASK-101 to TASK-105 | 1–2 weeks | Parallel with Phase 0 | 🟡 Quick wins |
| **Phase 2** — Revenue & Retention | TASK-201 to TASK-204 | 2–3 weeks | Month 1 | 🟢 High |
| **Phase 3** — AI Differentiation | TASK-301 to TASK-306 | 4–6 weeks | Month 2 | 🟢 High |
| **Phase 4** — UX & Design | TASK-401 to TASK-405 | 4–5 weeks | Month 2–3 | 🟢 Medium |
| **Phase 5** — Architecture | TASK-501 to TASK-507 | 3–4 weeks | Ongoing | 🏗️ Ongoing |
| **Phase 6** — New Features | TASK-601 to TASK-607 | 8–12 weeks | After PMF | 🚀 Post-PMF |

---

### ✅ Top 10 — Start Tomorrow

| # | Task ID | Action | Files |
|---|---|---|---|
| 1 | **TASK-101** | 🔥 Kill the Nitter spider | `scraper/spiders/nitter_spider.py` |
| 2 | **TASK-001** | 🔥 Build onboarding wizard | `backend/apps/users/`, `frontend/src/app/(onboarding)/` |
| 3 | **TASK-003** | 🔥 Activate Stripe billing | `backend/apps/billing/`, `frontend/src/app/(dashboard)/billing/` |
| 4 | **TASK-004** | 🔥 Add AI guardrails + budget caps | `ai_engine/middleware/rate_limit.py`, `ai_engine/middleware/moderation.py` |
| 5 | **TASK-005** | 🔥 Upgrade embeddings to BGE-large | `ai_engine/embeddings/embedder.py` |
| 6 | **TASK-204** | 🔥 Add Sentry error monitoring | `backend/config/settings/base.py`, `frontend/sentry.client.config.ts` |
| 7 | **TASK-203** | 🔥 Add PostHog product analytics | `frontend/src/components/AnalyticsProvider.tsx` |
| 8 | **TASK-402** | 🔥 Add ⌘K command palette | `frontend/src/components/ui/CommandPalette.tsx` |
| 9 | **TASK-006** | 🔥 Build team workspaces | `backend/apps/organizations/`, `frontend/src/contexts/OrganizationContext.tsx` |
| 10 | **TASK-301** | 🔥 Add hybrid search (BM25 + vector + rerank) | `ai_engine/rag/retriever.py`, `backend/apps/*/models.py` |

---

### 🗂️ Files Most Frequently Modified

| File | Tasks That Touch It |
|---|---|
| `backend/apps/users/models.py` | TASK-001-B1, TASK-002-B1, TASK-003-B6, TASK-201-B1, TASK-605-B1 |
| `backend/apps/users/views.py` | TASK-001-B2, TASK-002-B3, TASK-003-B6, TASK-202-1 |
| `backend/config/settings/base.py` | TASK-102, TASK-201-B4, TASK-204-B1, TASK-504-B1 |
| `ai_engine/agents/tools.py` | TASK-303-B1 through TASK-303-B5 |
| `ai_engine/rag/retriever.py` | TASK-301-B4, TASK-301-B5 |
| `ai_engine/agents/base.py` | TASK-302-B1, TASK-302-B2 |
| `frontend/src/app/(dashboard)/settings/page.tsx` | TASK-002-F1, TASK-201-F1, TASK-202-2, TASK-605-F1, TASK-607-5 |
| `frontend/src/app/(auth)/login/page.tsx` | TASK-002-F2, TASK-002-F3 |
| `frontend/src/components/layout/Navbar.tsx` | TASK-003-F4, TASK-006-F1, TASK-401-2 |
| `frontend/src/utils/api.ts` | TASK-003-F5, TASK-105-2, TASK-501-F1 |
| `.env.example` | TASK-003-B7, TASK-004-B9, TASK-101-4, TASK-302-B5, TASK-303-B1, TASK-301-B5 |
| `backend/apps/core/tasks.py` | TASK-201-B2, TASK-305-B2, TASK-502-B1, TASK-603-B2 |

---

### 💰 Revenue Impact Map

| Task | Revenue Impact | Timeline |
|---|---|---|
| TASK-003 (Billing) | $0 → $5K–$10K MRR | Month 1 |
| TASK-001 (Onboarding) | +40–50% activation → more paying users | Month 1 |
| TASK-002 (GitHub OAuth) | +2x developer signups | Month 1 |
| TASK-006 (Teams) | Unlock Team plan ($49/seat) | Month 2–3 |
| TASK-301 (Hybrid Search) | Reduce churn via better quality | Month 2 |
| TASK-605 (Public API) | $5K–$50K/month from API consumers | Month 3+ |
| TASK-604 (Marketplace) | 30% cut on paid templates | Post-PMF |
| TASK-601 (Research Mode) | Premium $10–20/month feature | Post-PMF |

---

### 🔐 Security & Compliance Checklist

- [ ] MFA recovery codes (TASK-002-B1)
- [ ] AI input moderation / jailbreak detection (TASK-004-B4, TASK-004-B5)
- [ ] PII detection and redaction from logs (TASK-004-B6)
- [ ] Per-user budget caps to prevent bill explosion (TASK-004-B1)
- [ ] API key hashing — never store plaintext (TASK-605-B1)
- [ ] Audit log for all sensitive actions (TASK-505)
- [ ] Database automated backups (TASK-502)
- [ ] RBAC for organization access (TASK-006-B3)
- [ ] Stripe webhook signature verification (TASK-003-B3)
- [ ] Rate limiting on all AI endpoints (TASK-501, TASK-004-B2)
- [ ] HTTPS everywhere — Nginx TLS config (existing, verify)
- [ ] CORS properly configured for production domain (verify in `settings/production.py`)
- [ ] `DEBUG=False` enforced in production (verify)
- [ ] `SECRET_KEY` rotated and stored in env (verify)
- [ ] Dependency vulnerability scanning in CI (add `safety check` to `.github/workflows/ci.yml`)

---

### 🧪 Testing Coverage Goals

| Area | Current | Target |
|---|---|---|
| Backend unit tests | Partial | 80% coverage |
| Backend integration tests | Partial | Key flows covered |
| Frontend component tests | None visible | Core UI components |
| E2E tests | None visible | Critical user journeys |
| AI engine tests | Partial | RAG pipeline + guardrails |
| Load tests | None | 100 concurrent users |

**Critical E2E journeys to cover:**
1. Sign up → Onboarding → First search → Bookmark result
2. Subscribe to Pro → Hit rate limit on Free → Upgrade prompt
3. Create agent → Run with tools → View trace → Export result
4. Create automation → Trigger → View run log
5. Invite team member → Accept → View shared workspace

---

> **Bottom line:** The foundation is solid. The gap between *"impressive prototype"* and *"$1M+ product"* is:
> 1. **Monetization** (TASK-003 — Stripe billing is the #1 priority)
> 2. **Activation** (TASK-001 — Onboarding wizard)
> 3. **Safety** (TASK-004 — AI guardrails before you invite real users)
> 4. **Quality** (TASK-005 + TASK-301 — better embeddings + hybrid search)
>
> Everything else is upside. **Start with Phase 0, ship Phase 1 in parallel, and deploy Phase 2 by end of Month 1.**

