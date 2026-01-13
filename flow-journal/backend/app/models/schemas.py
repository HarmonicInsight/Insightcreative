from pydantic import BaseModel
from datetime import datetime
from enum import Enum


class SentimentType(str, Enum):
    positive = "positive"
    neutral = "neutral"
    negative = "negative"


class ActionType(str, Enum):
    start = "start"
    progress = "progress"
    complete = "complete"
    error = "error"
    waiting = "waiting"
    info = "info"
    other = "other"


class IssueSeverity(str, Enum):
    critical = "critical"
    warning = "warning"
    minor = "minor"
    waiting = "waiting"


# リクエスト
class CommentCreate(BaseModel):
    project_id: str
    content: str
    user_id: str


# レスポンス
class NLPResult(BaseModel):
    bucket_id: str | None
    bucket_name: str | None
    is_new_bucket: bool
    sentiment: SentimentType
    action_type: ActionType
    keywords: list[str]
    nouns: list[str]
    verbs: list[str]
    issue_detected: dict | None = None


class CommentResponse(BaseModel):
    id: str
    project_id: str
    bucket_id: str | None
    bucket_name: str | None
    user_id: str
    content: str
    sentiment: SentimentType
    action_type: ActionType
    keywords: list[str]
    created_at: datetime
    nlp_result: NLPResult


class BucketStats(BaseModel):
    bucket_id: str
    name: str
    color: str
    comment_count: int
    positive_count: int
    negative_count: int
    complete_count: int
    error_count: int
    open_issue_count: int
    last_activity: datetime | None
    momentum: str


class Issue(BaseModel):
    id: str
    bucket_id: str
    bucket_name: str
    description: str
    severity: IssueSeverity
    is_resolved: bool
    detected_at: datetime
