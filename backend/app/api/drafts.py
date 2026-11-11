from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Request

from app.db.repositories.resume_draft_repository import (
    DraftExpiredError,
    DraftNotFoundError,
    DraftQuotaExceededError,
    DraftSizeExceededError,
    resume_draft_repo,
)

router = APIRouter(prefix="/drafts", tags=["Resume Drafts"])


def _require_user(request: Request):
    user = getattr(request.state, "current_user", None)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Autentikasi diperlukan untuk mengakses draf akun.",
        )
    return user


@router.get("")
def list_user_drafts(request: Request):
    """Mengambil daftar ringkasan draf aktif pengguna terautentikasi."""
    user = _require_user(request)
    resume_draft_repo.purge_expired()
    return resume_draft_repo.list_drafts(user_id=user.id)


@router.get("/{draft_id}")
def get_user_draft(draft_id: str, request: Request):
    """Mengambil konten lengkap draf CV milik pengguna terautentikasi."""
    user = _require_user(request)
    resume_draft_repo.purge_expired()
    draft = resume_draft_repo.get_draft(draft_id=draft_id, user_id=user.id)
    if not draft:
        raise HTTPException(
            status_code=404,
            detail="Draf tidak ditemukan atau telah kedaluwarsa.",
        )
    return draft


@router.post("")
def create_user_draft(payload: dict[str, Any], request: Request):
    """Menyimpan draf CV baru terikat dengan akun pengguna di basis data PostgreSQL."""
    user = _require_user(request)
    resume_draft_repo.purge_expired()
    try:
        return resume_draft_repo.create_draft(user_id=user.id, draft_dict=payload)
    except DraftSizeExceededError as e:
        raise HTTPException(status_code=413, detail=str(e)) from e
    except DraftQuotaExceededError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e


@router.put("/{draft_id}")
def update_user_draft(draft_id: str, payload: dict[str, Any], request: Request):
    """Memperbarui konten draf CV dan memperpanjang masa retensi 30 hari."""
    user = _require_user(request)
    try:
        return resume_draft_repo.update_draft(
            draft_id=draft_id,
            user_id=user.id,
            draft_dict=payload,
        )
    except DraftNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except DraftExpiredError as e:
        raise HTTPException(status_code=410, detail=str(e)) from e
    except DraftSizeExceededError as e:
        raise HTTPException(status_code=413, detail=str(e)) from e
    except DraftQuotaExceededError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e


@router.delete("/{draft_id}")
def soft_delete_user_draft(draft_id: str, request: Request):
    """Memindahkan draf ke tempat sampah dengan jendela pembatalan (undo) 10 detik."""
    user = _require_user(request)
    deleted = resume_draft_repo.soft_delete(draft_id=draft_id, user_id=user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Draf tidak ditemukan.")
    return {
        "success": True,
        "message": "Draf dipindahkan ke tempat sampah (tersedia pembatalan 10 detik).",
    }


@router.post("/{draft_id}/restore")
def restore_user_draft(draft_id: str, request: Request):
    """Mengembalikan draf yang dihapus sebelum batas pembatalan 10 detik berakhir."""
    user = _require_user(request)
    restored = resume_draft_repo.restore_draft(draft_id=draft_id, user_id=user.id)
    if not restored:
        raise HTTPException(
            status_code=404,
            detail="Draf tidak ditemukan atau masa pembatalan 10 detik telah berakhir.",
        )
    return restored


@router.delete("/{draft_id}/permanent")
def hard_delete_user_draft(draft_id: str, request: Request):
    """Menghapus draf secara permanen setelah masa pembatalan berakhir."""
    user = _require_user(request)
    resume_draft_repo.hard_delete(draft_id=draft_id, user_id=user.id)
    return {"success": True}
