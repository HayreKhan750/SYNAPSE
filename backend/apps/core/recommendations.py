from __future__ import annotations

from typing import List, Tuple
from django.db.models import Q
from pgvector.django import CosineDistance

from apps.articles.models import Article
from apps.papers.models import ResearchPaper
from apps.repositories.models import Repository
from apps.core.models import UserActivity


def _recent_user_embedding_candidates(user, limit_per_type: int = 50):
    """
    Return recent content objects (articles, papers, repos) the user interacted with
    (bookmark or view), limited and ordered by recency.
    """
    # Use activity logs to fetch object ids by content type
    activities = (
        UserActivity.objects
        .filter(user=user, interaction_type__in=["bookmark", "view"])  # prioritize bookmarks/views
        .order_by('-timestamp')[:200]
    )

    article_ids, paper_ids, repo_ids = set(), set(), set()

    for act in activities:
        model = act.content_type.model
        if model == 'article':
            article_ids.add(act.object_id)
        elif model in ('researchpaper', 'paper', 'research_paper'):
            paper_ids.add(act.object_id)
        elif model == 'repository':
            repo_ids.add(act.object_id)

    articles = list(Article.objects.filter(id__in=list(article_ids), embedding__isnull=False)[:limit_per_type])
    papers = list(ResearchPaper.objects.filter(id__in=list(paper_ids), embedding__isnull=False)[:limit_per_type])
    repos = list(Repository.objects.filter(id__in=list(repo_ids), embedding__isnull=False)[:limit_per_type])

    return articles, papers, repos


def recommend_for_user(user, limit: int = 10) -> dict:
    """
    Content-based recommendations using pgvector cosine similarity.
    Strategy:
      - Take user's recent viewed/bookmarked items with embeddings
      - For each group (articles, papers, repos), find similar items
      - Exclude already seen items
      - Return top N per group
    """
    results = {"articles": [], "papers": [], "repos": []}

    if not user or not user.is_authenticated:
        return results

    articles, papers, repos = _recent_user_embedding_candidates(user)

    # For each content type, search similar by averaging recent vectors or using query-per-item
    # Here, for simplicity and performance, we do query-per-item and then merge unique results by id.

    # Articles
    seen_article_ids = {str(a.id) for a in articles}
    similar_articles: List[Tuple[Article, float]] = []
    for a in articles:
        q = (
            Article.objects
            .filter(embedding__isnull=False)
            .exclude(id=a.id)
            .annotate(similarity=CosineDistance('embedding', a.embedding))
            .order_by('similarity')[:limit]
        )
        for item in q:
            similar_articles.append((item, getattr(item, 'similarity', None)))
    # Deduplicate and take top by similarity
    seen = set()
    ranked = []
    for item, dist in sorted(similar_articles, key=lambda x: x[1] or 9999):
        if item.id in seen_article_ids or item.id in seen:
            continue
        seen.add(item.id)
        ranked.append(item)
        if len(ranked) >= limit:
            break
    results["articles"] = ranked

    # Papers
    seen_paper_ids = {str(p.id) for p in papers}
    similar_papers: List[Tuple[ResearchPaper, float]] = []
    for p in papers:
        q = (
            ResearchPaper.objects
            .filter(embedding__isnull=False)
            .exclude(id=p.id)
            .annotate(similarity=CosineDistance('embedding', p.embedding))
            .order_by('similarity')[:limit]
        )
        for item in q:
            similar_papers.append((item, getattr(item, 'similarity', None)))
    seen = set()
    ranked = []
    for item, dist in sorted(similar_papers, key=lambda x: x[1] or 9999):
        if item.id in seen_paper_ids or item.id in seen:
            continue
        seen.add(item.id)
        ranked.append(item)
        if len(ranked) >= limit:
            break
    results["papers"] = ranked

    # Repositories
    seen_repo_ids = {str(r.id) for r in repos}
    similar_repos: List[Tuple[Repository, float]] = []
    for r in repos:
        q = (
            Repository.objects
            .filter(embedding__isnull=False)
            .exclude(id=r.id)
            .annotate(similarity=CosineDistance('embedding', r.embedding))
            .order_by('similarity')[:limit]
        )
        for item in q:
            similar_repos.append((item, getattr(item, 'similarity', None)))
    seen = set()
    ranked = []
    for item, dist in sorted(similar_repos, key=lambda x: x[1] or 9999):
        if item.id in seen_repo_ids or item.id in seen:
            continue
        seen.add(item.id)
        ranked.append(item)
        if len(ranked) >= limit:
            break
    results["repos"] = ranked

    return results
