from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.config import Settings, get_settings
from app.dependencies import require_invited_user
from app.services.email_service import send_support_email

router = APIRouter()

SUPPORT_CATEGORIES = frozenset({"bug", "feature", "account", "other"})


class SupportRequest(BaseModel):
    category: str = Field(min_length=1, max_length=32)
    subject: str = Field(min_length=1, max_length=200)
    message: str = Field(min_length=10, max_length=5000)


class SupportResponse(BaseModel):
    message: str


@router.post("/support", response_model=SupportResponse)
async def submit_support(
    body: SupportRequest,
    caller_email: str | None = Depends(require_invited_user),
    settings: Settings = Depends(get_settings),
):
    if not caller_email:
        raise HTTPException(status_code=401, detail="ログインが必要です。")

    category = body.category.strip().lower()
    if category not in SUPPORT_CATEGORIES:
        raise HTTPException(status_code=400, detail="カテゴリが不正です。")

    try:
        send_support_email(
            from_email=caller_email,
            category=category,
            subject=body.subject.strip(),
            message=body.message.strip(),
            settings=settings,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return SupportResponse(
        message="お問い合わせを送信しました。サポートチームからご連絡いたします。",
    )
