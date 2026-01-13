from fastapi import APIRouter
from app.services import supabase_client as db

router = APIRouter()


@router.get("/")
def get_projects():
    """プロジェクト一覧（将来的な拡張用）"""
    return {"message": "Projects endpoint - implement with auth"}
