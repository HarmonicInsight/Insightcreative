from fastapi import APIRouter
from app.models.schemas import CommentCreate, CommentResponse
from app.services import nlp
from app.services import supabase_client as db

router = APIRouter()


@router.post("/", response_model=CommentResponse)
def create_comment(payload: CommentCreate):
    """コメントを投稿（NLP処理 + バケツ自動作成）"""

    # 1. 既存バケツ取得
    existing_buckets = db.get_buckets(payload.project_id)

    # 2. NLP解析
    nlp_result = nlp.analyze_comment(payload.content, existing_buckets)

    # 3. バケツ決定
    bucket_id = nlp_result["bucket_id"]

    if nlp_result["is_new_bucket"] and nlp_result["bucket_name"]:
        # 新規バケツ作成
        new_bucket = db.create_bucket(payload.project_id, nlp_result["bucket_name"])
        bucket_id = new_bucket["id"]
        nlp_result["bucket_id"] = bucket_id
    elif not bucket_id:
        # マッチしなければ未分類へ
        default_bucket = db.get_default_bucket(payload.project_id)
        if default_bucket:
            bucket_id = default_bucket["id"]
            nlp_result["bucket_id"] = bucket_id
            nlp_result["bucket_name"] = default_bucket["name"]

    # 4. コメント保存
    comment_data = {
        "project_id": payload.project_id,
        "bucket_id": bucket_id,
        "user_id": payload.user_id,
        "content": payload.content,
        "sentiment": nlp_result["sentiment"],
        "action_type": nlp_result["action_type"],
        "keywords": nlp_result["keywords"],
        "nouns": nlp_result["nouns"],
        "verbs": nlp_result["verbs"],
    }
    comment = db.create_comment(comment_data)

    # 5. 課題検出時は課題も作成
    if nlp_result["issue_detected"] and bucket_id:
        db.create_issue(
            {
                "project_id": payload.project_id,
                "bucket_id": bucket_id,
                "description": nlp_result["issue_detected"]["description"],
                "severity": nlp_result["issue_detected"]["severity"],
                "source_comment_id": comment["id"],
            }
        )

    return {**comment, "bucket_name": nlp_result["bucket_name"], "nlp_result": nlp_result}


@router.get("/")
def get_comments(project_id: str, limit: int = 50):
    """コメント一覧を取得"""
    return db.get_comments(project_id, limit)


@router.get("/bucket/{bucket_id}")
def get_bucket_comments(bucket_id: str, limit: int = 50):
    """バケツのコメント一覧"""
    return db.get_comments_by_bucket(bucket_id, limit)
