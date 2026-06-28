from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

ResearchSourceType = Literal["text", "url", "youtube", "pdf"]


class ResearchSummarizeRequest(BaseModel):
    source_type: ResearchSourceType
    title: str = Field(min_length=1, max_length=200)
    content: str | None = Field(default=None, max_length=50_000)
    url: str | None = Field(default=None, max_length=2000)


class ResearchSummarizeResponse(BaseModel):
    summary_line: str
    content_excerpt: str
