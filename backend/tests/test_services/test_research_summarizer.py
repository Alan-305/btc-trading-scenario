import pytest

from app.schemas.research import ResearchSummarizeRequest
from app.services.research_summarizer import ResearchSummarizer, _gemini_error_message, _html_to_text, _normalize_summary
from app.config import Settings
from app.llm.gemini_client import GeminiClientError


def test_html_to_text_strips_tags():
    html = "<html><body><p>Hello <b>BTC</b></p></body></html>"
    assert "Hello BTC" in _html_to_text(html)


def test_gemini_error_message_quota():
    msg = _gemini_error_message(GeminiClientError("gemini-2.5-flash: HTTP 429 quota exceeded"))
    assert "利用上限" in msg


def test_normalize_summary_bullets():
    raw = "- ETF流入継続\n・規制懸念は限定的\n2) 半減期後の供給減"
    out = _normalize_summary(raw)
    assert out.count("・") >= 3
    assert len(out) <= 1200


def test_normalize_summary_caps_at_ten_bullets():
    raw = "\n".join(f"・要点{i}" for i in range(1, 15))
    out = _normalize_summary(raw)
    assert out.count("・") == 10


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
