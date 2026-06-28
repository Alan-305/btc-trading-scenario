import pytest

from app.schemas.research import ResearchSummarizeRequest
from app.services.research_summarizer import ResearchSummarizer, _gemini_error_message, _html_to_text
from app.config import Settings
from app.llm.gemini_client import GeminiClientError


def test_html_to_text_strips_tags():
    html = "<html><body><p>Hello <b>BTC</b></p></body></html>"
    assert "Hello BTC" in _html_to_text(html)


def test_gemini_error_message_quota():
    msg = _gemini_error_message(GeminiClientError("gemini-2.5-flash: HTTP 429 quota exceeded"))
    assert "利用上限" in msg


@pytest.mark.asyncio
async def test_summarize_text_without_gemini_raises():
    summarizer = ResearchSummarizer(Settings(gemini_api_key=""))
    with pytest.raises(ValueError, match="未設定"):
        await summarizer.summarize(
            ResearchSummarizeRequest(
                source_type="text",
                title="ETF流入",
                content="Bitcoin ETF saw inflows this week amid risk-on sentiment.",
            )
        )
