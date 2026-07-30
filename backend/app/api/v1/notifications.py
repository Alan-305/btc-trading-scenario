from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse

from app.config import Settings, get_settings
from app.dependencies import require_invited_user
from app.services.digest_subscribers import disable_morning_digest_by_token
from app.services.invite_service import is_admin_email
from app.services.morning_digest_service import list_recent_digest_logs

public_router = APIRouter()
protected_router = APIRouter()


def _unsubscribe_html(*, success: bool) -> str:
    if success:
        body = """
          <h1 style="font-size:20px;">配信を停止しました</h1>
          <p>毎朝ダイジェストメールの配信を停止しました。再度受け取る場合は、アプリのサポート画面から設定をオンにしてください。</p>
        """
    else:
        body = """
          <h1 style="font-size:20px;">リンクが無効です</h1>
          <p>この配信停止リンクは無効か、すでに使用済みです。アプリにログインして通知設定を確認してください。</p>
        """
    return f"""\
<!DOCTYPE html>
<html lang="ja">
<body style="font-family:sans-serif;line-height:1.6;color:#1e293b;max-width:560px;margin:40px auto;padding:16px;">
  {body}
</body>
</html>"""


@public_router.get("/unsubscribe/{token}", response_class=HTMLResponse)
async def unsubscribe_morning_digest(token: str):
    success = disable_morning_digest_by_token(token)
    return HTMLResponse(content=_unsubscribe_html(success=success))


@protected_router.get("/digest-logs")
async def get_digest_logs(
    limit: int = 10,
    caller_email: str | None = Depends(require_invited_user),
    settings: Settings = Depends(get_settings),
):
    if not caller_email or not is_admin_email(caller_email, settings):
        raise HTTPException(status_code=403, detail="Admin only")
    safe_limit = max(1, min(limit, 30))
    return {"logs": list_recent_digest_logs(limit=safe_limit)}
