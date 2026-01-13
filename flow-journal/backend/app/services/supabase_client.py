from supabase import create_client, Client
from app.config import settings

supabase: Client = create_client(settings.supabase_url, settings.supabase_service_key)


# ============================================
# バケツ操作
# ============================================
def get_buckets(project_id: str) -> list[dict]:
    """プロジェクトのバケツ一覧を取得"""
    response = supabase.table("buckets").select("*").eq("project_id", project_id).execute()
    return response.data


def create_bucket(project_id: str, name: str) -> dict:
    """バケツを新規作成"""
    from app.services.nlp import normalize_text

    response = (
        supabase.table("buckets")
        .insert(
            {"project_id": project_id, "name": name, "name_normalized": normalize_text(name)}
        )
        .execute()
    )
    return response.data[0]


def get_or_create_bucket(project_id: str, name: str) -> dict:
    """バケツを取得、なければ作成"""
    from app.services.nlp import normalize_text

    normalized = normalize_text(name)

    # 既存チェック
    response = (
        supabase.table("buckets")
        .select("*")
        .eq("project_id", project_id)
        .eq("name_normalized", normalized)
        .execute()
    )

    if response.data:
        return response.data[0]

    # 新規作成
    return create_bucket(project_id, name)


def get_default_bucket(project_id: str) -> dict:
    """未分類バケツを取得"""
    response = (
        supabase.table("buckets")
        .select("*")
        .eq("project_id", project_id)
        .eq("is_default", True)
        .execute()
    )
    return response.data[0] if response.data else None


# ============================================
# コメント操作
# ============================================
def create_comment(data: dict) -> dict:
    """コメントを作成"""
    response = supabase.table("comments").insert(data).execute()
    return response.data[0]


def get_comments(project_id: str, limit: int = 50) -> list[dict]:
    """コメント一覧を取得（時系列降順）"""
    response = (
        supabase.table("comments")
        .select("*, profiles(display_name), buckets(name, color)")
        .eq("project_id", project_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return response.data


def get_comments_by_bucket(bucket_id: str, limit: int = 50) -> list[dict]:
    """バケツのコメント一覧"""
    response = (
        supabase.table("comments")
        .select("*, profiles(display_name)")
        .eq("bucket_id", bucket_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return response.data


# ============================================
# 課題操作
# ============================================
def create_issue(data: dict) -> dict:
    """課題を作成"""
    response = supabase.table("issues").insert(data).execute()
    return response.data[0]


def get_open_issues(project_id: str) -> list[dict]:
    """未解決の課題一覧"""
    response = (
        supabase.table("issues")
        .select("*, buckets(name, color)")
        .eq("project_id", project_id)
        .eq("is_resolved", False)
        .order("severity")
        .execute()
    )
    return response.data


def resolve_issue(issue_id: str) -> dict:
    """課題を解決済みにする"""
    response = (
        supabase.table("issues")
        .update({"is_resolved": True, "resolved_at": "now()"})
        .eq("id", issue_id)
        .execute()
    )
    return response.data[0]


# ============================================
# 統計
# ============================================
def get_bucket_stats(project_id: str) -> list[dict]:
    """バケツごとの統計を取得"""
    response = (
        supabase.table("bucket_stats").select("*").eq("project_id", project_id).execute()
    )
    return response.data


def get_keyword_stats(project_id: str, limit: int = 20) -> list[dict]:
    """キーワード統計を取得"""
    response = (
        supabase.table("keyword_stats")
        .select("*")
        .eq("project_id", project_id)
        .order("count", desc=True)
        .limit(limit)
        .execute()
    )
    return response.data
