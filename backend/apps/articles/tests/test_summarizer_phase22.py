from __future__ import annotations

from unittest.mock import MagicMock, patch
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient


class SummarizationPhase22Tests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse('ai-summarize')

    @patch('apps.core.views_nlp.summarize', return_value=None)
    @patch('apps.core.views_nlp.clean_text', return_value='some clean text ' * 20)
    def test_summarize_endpoint_model_unavailable(self, mock_clean, mock_sum):
        resp = self.client.post(self.url, {'text': 'hello world'}, format='json')
        self.assertEqual(resp.status_code, 503)
        self.assertFalse(resp.data['success'])

    def test_summarizer_respects_min_max_length(self):
        import ai_engine.nlp.summarizer as summ

        fake_summary = ' '.join(['token'] * 60)
        mock_pipe = MagicMock(return_value=[{'summary_text': fake_summary}])
        with patch.object(summ, '_get_summarizer', return_value=mock_pipe):
            result = summ.summarize(' '.join(['x'] * 200), max_length=150, min_length=50)
            # should return the mocked summary text unchanged
            self.assertEqual(result, fake_summary)
            # verify pipeline called with provided min/max
            mock_pipe.assert_called()
            args, kwargs = mock_pipe.call_args
            self.assertEqual(kwargs.get('max_length'), 150)
            self.assertEqual(kwargs.get('min_length'), 50)

    def test_rouge_score_nonzero_for_matching_summary(self):
        # When hypothesis equals reference, ROUGE-L F1 should be 1.0
        from rouge_score import rouge_scorer
        reference = 'OpenAI releases a new language model for research.'
        hypothesis = reference
        scorer = rouge_scorer.RougeScorer(['rougeL'], use_stemmer=True)
        scores = scorer.score(reference, hypothesis)
        self.assertIn('rougeL', scores)
        self.assertGreaterEqual(scores['rougeL'].fmeasure, 0.9)
