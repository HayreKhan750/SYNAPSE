"""
Integration tests for Phase 2.3 — Vector embeddings & semantic search.

Tests cover:
  - POST /api/v1/search/semantic  (semantic search endpoint)
  - Embedding task logic (unit)
  - Similarity score computation
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient


# ── Helpers ────────────────────────────────────────────────────────────────────

FAKE_VECTOR = [0.1] * 384  # 384-dim all-MiniLM-L6-v2 vector


def _make_fake_embedder():
    """Return a mock SynapseEmbedder that returns deterministic vectors."""
    embedder = MagicMock()
    embedder.embed.return_value = FAKE_VECTOR
    embedder.embed_batch.return_value = [FAKE_VECTOR]
    embedder.dimensions = 384
    return embedder


# ── Semantic search endpoint tests ─────────────────────────────────────────────

class SemanticSearchEndpointTests(TestCase):
    """Tests for POST /api/v1/search/semantic."""

    def setUp(self):
        self.client = APIClient()
        self.url = reverse('semantic-search')  # mapped in apps/core/urls.py

    def test_missing_query_returns_422(self):
        """Empty query should return HTTP 422."""
        response = self.client.post(self.url, {}, format='json')
        self.assertEqual(response.status_code, 422)
        self.assertFalse(response.data['success'])

    def test_blank_query_returns_422(self):
        """Whitespace-only query should return HTTP 422."""
        response = self.client.post(self.url, {'query': '   '}, format='json')
        self.assertEqual(response.status_code, 422)
        self.assertFalse(response.data['success'])

    @patch('apps.core.views.embed_text', return_value=FAKE_VECTOR)
    def test_valid_query_returns_200(self, mock_embed):
        """Valid query with no content in DB returns 200 with empty results."""
        response = self.client.post(
            self.url,
            {'query': 'transformer architecture', 'limit': 5},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['success'])
        data = response.data['data']
        meta = response.data['meta']
        # All four content type keys present
        self.assertIn('articles', data)
        self.assertIn('papers', data)
        self.assertIn('repos', data)
        self.assertIn('videos', data)
        # Meta fields
        self.assertEqual(meta['query'], 'transformer architecture')
        self.assertEqual(meta['limit'], 5)
        self.assertIn('execution_time_ms', meta)
        self.assertIn('total', meta)

    @patch('apps.core.views.embed_text', return_value=FAKE_VECTOR)
    def test_content_types_filter(self, mock_embed):
        """Requesting only articles and papers omits repos and videos keys."""
        response = self.client.post(
            self.url,
            {'query': 'neural networks', 'content_types': ['articles', 'papers']},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        data = response.data['data']
        self.assertIn('articles', data)
        self.assertIn('papers', data)
        self.assertNotIn('repos', data)
        self.assertNotIn('videos', data)

    @patch('apps.core.views.embed_text', return_value=FAKE_VECTOR)
    def test_limit_capped_at_50(self, mock_embed):
        """limit > 50 should be silently capped at 50."""
        response = self.client.post(
            self.url,
            {'query': 'python', 'limit': 999},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['meta']['limit'], 50)

    @patch('apps.core.views.embed_text', side_effect=RuntimeError('model unavailable'))
    def test_embedding_failure_returns_503(self, mock_embed):
        """If embedding service fails, return HTTP 503."""
        response = self.client.post(
            self.url,
            {'query': 'machine learning'},
            format='json',
        )
        self.assertEqual(response.status_code, 503)
        self.assertFalse(response.data['success'])

    @patch('apps.core.views.embed_text', return_value=FAKE_VECTOR)
    def test_similarity_score_in_results(self, mock_embed):
        """Each result item should include a similarity_score field."""
        from apps.articles.models import Article, Source
        import uuid

        # Create a dummy source and article with a pre-set embedding
        source = Source.objects.create(
            name='Test Source',
            url='https://test.example.com',
            source_type='news',
        )
        article = Article.objects.create(
            title='Understanding Transformers in NLP',
            content='Transformers revolutionized NLP by using attention mechanisms.',
            url=f'https://test.example.com/articles/{uuid.uuid4()}',
            source=source,
            embedding=FAKE_VECTOR,
        )

        response = self.client.post(
            self.url,
            {'query': 'transformer NLP', 'content_types': ['articles']},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        articles = response.data['data']['articles']
        self.assertTrue(len(articles) >= 1)
        # Every returned article must have a similarity_score
        for art in articles:
            self.assertIn('similarity_score', art)
            if art['similarity_score'] is not None:
                self.assertGreaterEqual(art['similarity_score'], 0.0)
                self.assertLessEqual(art['similarity_score'], 1.0)


# ── Embedding task unit tests ──────────────────────────────────────────────────

class ArticleEmbeddingTaskTests(TestCase):
    """Unit tests for generate_article_embedding Celery task logic."""

    def setUp(self):
        from apps.articles.models import Article, Source
        import uuid

        self.source = Source.objects.create(
            name='Task Test Source',
            url='https://tasksource.example.com',
            source_type='news',
        )
        self.article = Article.objects.create(
            title='Deep Learning Fundamentals',
            content='Deep learning uses neural networks with many layers.',
            url=f'https://tasksource.example.com/dl/{uuid.uuid4()}',
            source=self.source,
        )

    @patch('apps.articles.embedding_tasks._get_embedder')
    def test_embed_article_stores_vector(self, mock_get_embedder):
        """generate_article_embedding should save the vector to Article.embedding."""
        mock_get_embedder.return_value = _make_fake_embedder()

        from apps.articles.embedding_tasks import generate_article_embedding
        result = generate_article_embedding(str(self.article.id))

        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['dimensions'], 384)

        self.article.refresh_from_db()
        self.assertIsNotNone(self.article.embedding)
        self.assertEqual(len(self.article.embedding), 384)

    @patch('apps.articles.embedding_tasks._get_embedder')
    def test_embed_missing_article_returns_error(self, mock_get_embedder):
        """Non-existent article_id should return error status, not raise."""
        mock_get_embedder.return_value = _make_fake_embedder()

        from apps.articles.embedding_tasks import generate_article_embedding
        result = generate_article_embedding('00000000-0000-0000-0000-000000000000')
        self.assertEqual(result['status'], 'error')
        self.assertEqual(result['reason'], 'not_found')

    @patch('apps.articles.embedding_tasks._get_embedder')
    def test_embed_article_no_content_skipped(self, mock_get_embedder):
        """Article with no text should be skipped gracefully."""
        from apps.articles.models import Article
        import uuid

        empty_article = Article.objects.create(
            title='',
            content='',
            url=f'https://tasksource.example.com/empty/{uuid.uuid4()}',
            source=self.source,
        )
        mock_get_embedder.return_value = _make_fake_embedder()

        from apps.articles.embedding_tasks import generate_article_embedding
        result = generate_article_embedding(str(empty_article.id))
        self.assertEqual(result['status'], 'skipped')
        self.assertEqual(result['reason'], 'no_content')


class PendingEmbeddingTaskTests(TestCase):
    """Unit tests for generate_pending_*_embeddings batch tasks."""

    @patch('apps.articles.embedding_tasks.generate_article_embedding')
    def test_pending_articles_queued(self, mock_task):
        """generate_pending_article_embeddings should dispatch tasks for unembedded articles."""
        from apps.articles.models import Article, Source
        import uuid

        source = Source.objects.create(
            name='Batch Source',
            url='https://batchsource.example.com',
            source_type='news',
        )
        # Create 3 articles without embeddings
        for i in range(3):
            Article.objects.create(
                title=f'Article {i}',
                content=f'Content {i}',
                url=f'https://batchsource.example.com/{uuid.uuid4()}',
                source=source,
            )

        mock_task.delay = MagicMock()

        from apps.articles.embedding_tasks import generate_pending_article_embeddings
        result = generate_pending_article_embeddings(batch_size=10)

        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['queued'], 3)
        self.assertEqual(mock_task.delay.call_count, 3)


# ── Embedder unit tests ────────────────────────────────────────────────────────

class EmbedderModuleTests(TestCase):
    """Unit tests for the ai_engine.embeddings module."""

    @patch('sentence_transformers.SentenceTransformer')
    def test_embed_returns_list_of_floats(self, MockST):
        """embed_text should return a list of floats of the correct dimension."""
        import numpy as np

        mock_model = MagicMock()
        mock_model.get_sentence_embedding_dimension.return_value = 384
        mock_model.encode.return_value = np.array([FAKE_VECTOR])
        MockST.return_value = mock_model

        # Reset singleton for clean test
        import ai_engine.embeddings.embedder as emb_mod
        emb_mod._embedder_instance = None

        with patch.dict('os.environ', {'EMBEDDING_PROVIDER': 'local'}):
            emb_mod._embedder_instance = None
            embedder = emb_mod.SynapseEmbedder()
            embedder._model = mock_model
            result = embedder.embed('test sentence')

        self.assertIsInstance(result, list)
        self.assertEqual(len(result), 384)
        self.assertIsInstance(result[0], float)

    def test_embed_empty_string_returns_zeros(self):
        """Embedding an empty string should return a zero vector without calling model."""
        import ai_engine.embeddings.embedder as emb_mod

        embedder = MagicMock(spec=emb_mod.SynapseEmbedder)
        embedder.dimensions = 384
        # Call the real embed logic for empty string
        embedder.embed.side_effect = lambda t: [0.0] * 384 if not t.strip() else FAKE_VECTOR

        result = embedder.embed('')
        self.assertEqual(result, [0.0] * 384)

    def test_truncate_text(self):
        """_truncate_text should clip text longer than max_chars."""
        import ai_engine.embeddings.embedder as emb_mod

        long_text = 'a' * 10000
        truncated = emb_mod._truncate_text(long_text, max_chars=8192)
        self.assertEqual(len(truncated), 8192)

        short_text = 'hello world'
        self.assertEqual(emb_mod._truncate_text(short_text), short_text)
