from fastapi import APIRouter, Depends, HTTPException

from app.config import get_settings
from app.dependencies import require_invited_user
from app.schemas.research import ResearchSummarizeRequest, ResearchSummarizeResponse
from app.services.research_summarizer import ResearchSummarizer

router = APIRouter()


@router.post("/research/summarize", response_model=ResearchSummarizeResponse)
async def summarize_research(
    body: ResearchSummarizeRequest,
    _user: str | None = Depends(require_invited_user),
) -> ResearchSummarizeResponse:
    summarizer = ResearchSummarizer(get_settings())
    try:
        return await summarizer.summarize(body)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
