from __future__ import annotations

import re
from html import unescape
from urllib.parse import quote

import httpx
import structlog

from app.config import Settings, get_settings
from app.llm.gemini_client import GeminiClient, GeminiClientError
from app.schemas.research import ResearchSummarizeRequest, ResearchSummarizeResponse

logger = structlog.get_logger()

MAX_CONTENT_CHARS = 12_000
EXCERPT_CHARS = 500
MAX_SUMMARY_CHARS = 1200
MAX_SUMMARY_BULLETS = 10
MIN_SUMMARY_BULLETS = 2


class ResearchSummarizer:
    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()

    async def summarize(self, body: ResearchSummarizeRequest) -> ResearchSummarizeResponse:
        source_text = await self._resolve_source_text(body)
        if not source_text.strip():
            raise ValueError("分析する本文を取得できませんでした")

        trimmed = source_text[:MAX_CONTENT_CHARS]
        summary_line = await self._summarize_with_llm(body.title, trimmed)
        return ResearchSummarizeResponse(
            summary_line=summary_line,
            content_excerpt=trimmed[:EXCERPT_CHARS],
        )

    async def _resolve_source_text(self, body: ResearchSummarizeRequest) -> str:
        if body.source_type == "text":
            return (body.content or "").strip()

        url = (body.url or "").strip()
        if not url:
            raise ValueError("URL を入力してください")

        if body.source_type == "youtube":
            meta = await self._fetch_youtube_metadata(url)
            if body.content:
                return meta + "\n\n【ユーザー追記】\n" + body.content.strip()
            return meta + "\n（動画字幕は未取り込み。要点をテキスト欄に追記すると精度が上がります）"

        if body.source_type == "pdf":
            if body.content:
                return body.content.strip()
            raise ValueError("PDF は本文テキストの貼り付けが必要です（ファイル解析は今後対応）")

        return await self._fetch_url_text(url)

    async def _fetch_url_text(self, url: str) -> str:
        if not url.startswith("https://"):
            raise ValueError("https:// の URL のみ対応しています")
        async with httpx.AsyncClient(
            timeout=20.0,
            follow_redirects=True,
            headers={"User-Agent": "BTC-Scenario-Research/1.0"},
        ) as client:
            response = await client.get(url)
            response.raise_for_status()
            html = response.text
        text = _html_to_text(html)
        if len(text) < 80:
            raise ValueError("ページから十分なテキストを取得できませんでした")
        return text

    async def _fetch_youtube_metadata(self, url: str) -> str:
        oembed_url = f"https://www.youtube.com/oembed?url={quote(url, safe='')}&format=json"
        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                response = await client.get(
                    oembed_url,
                    headers={"User-Agent": "BTC-Scenario-Research/1.0"},
                )
                if response.is_success:
                    data = response.json()
                    video_title = (data.get("title") or "").strip()
                    author = (data.get("author_name") or "").strip()
                    lines = [f"YouTube URL: {url}"]
                    if video_title:
                        lines.append(f"動画タイトル: {video_title}")
                    if author:
                        lines.append(f"チャンネル: {author}")
                    return "\n".join(lines)
        except Exception as exc:  # noqa: BLE001
            logger.warning("youtube_oembed_failed", url=url, error=str(exc))
        return f"YouTube URL: {url}"

    def _model_candidates(self) -> tuple[str, ...]:
        primary = self.settings.gemini_model.strip()
        fallbacks = tuple(
            m.strip() for m in self.settings.gemini_model_fallbacks.split(",") if m.strip()
        )
        if primary:
            return (primary, *(m for m in fallbacks if m != primary))
        return fallbacks or ("gemini-2.5-flash",)

    async def _summarize_with_llm(self, title: str, content: str) -> str:
        if self.settings.llm_provider != "gemini" or not self.settings.gemini_api_key.strip():
            raise ValueError("AI要約機能は未設定です。管理者に GEMINI_API_KEY の設定を依頼してください。")

        prompt = f"""あなたはBTCトレード向けの調査メモ要約者です。
以下の資料を読み、「今後のシナリオ分析に使える要点」を日本語の箇条書きでまとめてください。

【行数の目安（資料の情報量に応じて調整）】
- 情報が少ない: {MIN_SUMMARY_BULLETS}〜3行
- 普通: 4〜7行
- 文字起こしなど情報が多い: 最大 {MAX_SUMMARY_BULLETS} 行（それ以上は書かない）
- 重要度の高い順。重複・枝葉の細部は省略

【厳守】
- 各行は「・」で始める。合計 {MAX_SUMMARY_CHARS} 文字以内
- 投資助言口調にしない。「〜の可能性」「〜に注意」など参考情報として
- 資料にない具体価格を作らない
- BTC/Bitcoin との関連が薄い場合はその旨を1行で
- 見出し・Markdown・番号リストは使わない

【タイトル】{title}

【資料本文（抜粋）】
{content[:8000]}

【出力】
箇条書きのみ（{MIN_SUMMARY_BULLETS}〜{MAX_SUMMARY_BULLETS} 行）。"""
        try:
            client = GeminiClient(self.settings.gemini_api_key, self._model_candidates())
            result = await client.generate_text(prompt, temperature=0.2)
            summary = _normalize_summary(result.text)
            if not summary:
                raise ValueError("AI要約が空で返されました。時間をおいて再度お試しください。")
            return summary
        except GeminiClientError as exc:
            logger.warning("research_summarize_gemini_failed", error=str(exc))
            raise ValueError(_gemini_error_message(exc)) from exc


def _normalize_summary(text: str) -> str:
    lines: list[str] = []
    for raw in text.replace("\r", "").split("\n"):
        line = raw.strip()
        if not line:
            continue
        for prefix in ("・", "-", "*", "•"):
            if line.startswith(prefix):
                line = line[len(prefix) :].strip()
                break
        if line and not line[0].isdigit():
            lines.append(f"・{line}")
        elif line:
            lines.append(f"・{line.lstrip('0123456789.)、 ')}")

    if not lines:
        compact = " ".join(text.split()).strip()
        return compact[:MAX_SUMMARY_CHARS] if compact else ""

    if len(lines) > MAX_SUMMARY_BULLETS:
        lines = lines[:MAX_SUMMARY_BULLETS]

    normalized = "\n".join(lines)
    return normalized[:MAX_SUMMARY_CHARS]


def _html_to_text(html: str) -> str:
    html = re.sub(r"(?is)<(script|style).*?>.*?</\1>", " ", html)
    html = re.sub(r"(?i)<br\s*/?>", "\n", html)
    html = re.sub(r"(?i)</p>", "\n", html)
    text = re.sub(r"<[^>]+>", " ", html)
    text = unescape(text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _gemini_error_message(exc: GeminiClientError) -> str:
    msg = str(exc).lower()
    if "429" in msg or "quota" in msg or "resource_exhausted" in msg:
        return (
            "AI要約サービスの利用上限に達しました。"
            "しばらく待ってから再度お試しください。"
            "（Google AI Studio の課金・クォータ設定もご確認ください）"
        )
    return "AI要約の生成に失敗しました。時間をおいて再度お試しください。"
