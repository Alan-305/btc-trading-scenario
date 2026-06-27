from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr

from app.config import Settings, get_settings
from app.dependencies import require_invited_user
from app.services.invite_service import add_invite, is_admin_email

router = APIRouter()


class InviteRequest(BaseModel):
    email: EmailStr


class InviteResponse(BaseModel):
    email: str
    message: str


@router.post("/invites", response_model=InviteResponse)
async def send_invite(
    body: InviteRequest,
    caller_email: str | None = Depends(require_invited_user),
    settings: Settings = Depends(get_settings),
):
    if not caller_email or not is_admin_email(caller_email, settings):
        raise HTTPException(status_code=403, detail="Only the owner can send invites")

    try:
        email = add_invite(str(body.email), caller_email)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return InviteResponse(
        email=email,
        message=f"{email} を招待しました。Google アカウントでログインできます。",
    )
