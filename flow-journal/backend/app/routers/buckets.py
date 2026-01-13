from fastapi import APIRouter
from app.services import supabase_client as db

router = APIRouter()


@router.get("/")
def get_buckets(project_id: str):
    """バケツ一覧"""
    return db.get_buckets(project_id)


@router.get("/stats")
def get_bucket_stats(project_id: str):
    """バケツ統計"""
    return db.get_bucket_stats(project_id)


@router.get("/keywords")
def get_keywords(project_id: str, limit: int = 20):
    """キーワード統計"""
    return db.get_keyword_stats(project_id, limit)


@router.get("/issues")
def get_issues(project_id: str):
    """未解決課題一覧"""
    return db.get_open_issues(project_id)


@router.post("/issues/{issue_id}/resolve")
def resolve_issue(issue_id: str):
    """課題を解決"""
    return db.resolve_issue(issue_id)
