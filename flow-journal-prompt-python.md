# Flow Journal - 詳細開発プロンプト（Python + Supabase版）

## 概要

「Flow Journal」は、音声/テキストによるつぶやきを入力し、**Pythonの自然言語処理**で自動分類・分析して、進捗と課題を可視化する次世代タスク管理システム。

### 設計思想
- **AI API不要**: MeCab/Janomeで品詞分解、ルールベースで分類
- **低コスト**: Claude API呼び出しなし、サーバー代のみ
- **高速**: ローカル処理なので即座にレスポンス
- **シンプル**: バケツ（タグ）は名前だけ、AIが勝手に作成

### アーキテクチャ

```
[React フロントエンド]
    ↓ POST /api/comment
[Python FastAPI バックエンド]
    ├─ Janome: 品詞分解
    ├─ ルールエンジン: 分類・センチメント
    └─ Supabase: データ保存
    ↓ リアルタイム同期
[React フロントエンド 更新]
```

---

## Phase 0: 環境構築

### 0-1. Supabaseプロジェクト作成

1. https://supabase.com → 「Start your project」
2. GitHubでサインイン
3. 「New project」:
   - Name: `flow-journal`
   - Database Password: 強力なパスワード（保存しておく）
   - Region: `Northeast Asia (Tokyo)`
4. 作成完了まで待機（2-3分）

### 0-2. 環境変数の取得

Supabaseダッシュボードから：
- Settings → API → Project URL → `SUPABASE_URL`
- Settings → API → service_role secret → `SUPABASE_SERVICE_KEY`（バックエンド用）
- Settings → API → anon public → `SUPABASE_ANON_KEY`（フロントエンド用）

### 0-3. プロジェクト構成

```
flow-journal/
├── backend/                 # Python FastAPI
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py          # FastAPIエントリーポイント
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── comments.py
│   │   │   ├── buckets.py
│   │   │   └── projects.py
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── nlp.py       # 品詞分解・分類
│   │   │   ├── sentiment.py # センチメント分析
│   │   │   └── supabase.py  # DB操作
│   │   ├── models/
│   │   │   └── schemas.py   # Pydanticモデル
│   │   └── config.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env
├── frontend/                # React
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── types/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── .env.local
└── README.md
```

---

## Phase 1: データベース構築（DDL）

### Supabase SQL Editorで実行

```sql
-- ============================================
-- Flow Journal DDL (Python版)
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. ユーザープロファイル
-- ============================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- 新規ユーザー時に自動プロファイル作成
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, display_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- 2. プロジェクト
-- ============================================
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    is_personal BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. プロジェクトメンバー
-- ============================================
CREATE TYPE member_role AS ENUM ('owner', 'admin', 'member', 'viewer');

CREATE TABLE project_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role member_role NOT NULL DEFAULT 'member',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- RLSポリシー
CREATE POLICY "Project members can view project" ON projects
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = projects.id
            AND project_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Project owner can update project" ON projects
    FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Users can create projects" ON projects
    FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Project members can view members" ON project_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM project_members pm
            WHERE pm.project_id = project_members.project_id
            AND pm.user_id = auth.uid()
        )
    );

-- ============================================
-- 4. バケツ（情報の集約先）
-- ============================================
-- シンプルに名前だけ。Pythonが自動で作成・紐付け。
-- 進捗やステータスはビューで集計。

CREATE TABLE buckets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    name_normalized TEXT NOT NULL, -- 検索用（ひらがな・小文字化）
    color TEXT DEFAULT '#6B7280',
    is_default BOOLEAN DEFAULT FALSE, -- 「未分類」バケツ
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, name_normalized)
);

ALTER TABLE buckets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view buckets" ON buckets
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = buckets.project_id
            AND project_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Project members can create buckets" ON buckets
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = buckets.project_id
            AND project_members.user_id = auth.uid()
        )
    );

-- インデックス
CREATE INDEX idx_buckets_project ON buckets(project_id);
CREATE INDEX idx_buckets_normalized ON buckets(project_id, name_normalized);

-- ============================================
-- 5. コメント（つぶやきログ）
-- ============================================
CREATE TYPE sentiment_type AS ENUM ('positive', 'neutral', 'negative');
CREATE TYPE action_type AS ENUM ('start', 'progress', 'complete', 'error', 'waiting', 'info', 'other');

CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    bucket_id UUID REFERENCES buckets(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES profiles(id),
    content TEXT NOT NULL,
    -- NLP解析結果
    sentiment sentiment_type DEFAULT 'neutral',
    action_type action_type DEFAULT 'other',
    keywords TEXT[] DEFAULT '{}',
    nouns TEXT[] DEFAULT '{}',      -- 抽出された名詞
    verbs TEXT[] DEFAULT '{}',      -- 抽出された動詞
    -- メタデータ
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view comments" ON comments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = comments.project_id
            AND project_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Project members can create comments" ON comments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = comments.project_id
            AND project_members.user_id = auth.uid()
        )
        AND user_id = auth.uid()
    );

-- インデックス
CREATE INDEX idx_comments_project_created ON comments(project_id, created_at DESC);
CREATE INDEX idx_comments_bucket ON comments(bucket_id, created_at DESC);

-- ============================================
-- 6. 課題（Issue）
-- ============================================
CREATE TYPE issue_severity AS ENUM ('critical', 'warning', 'minor', 'waiting');

CREATE TABLE issues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    bucket_id UUID NOT NULL REFERENCES buckets(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    severity issue_severity NOT NULL DEFAULT 'minor',
    is_resolved BOOLEAN DEFAULT FALSE,
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    source_comment_id UUID REFERENCES comments(id)
);

ALTER TABLE issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view issues" ON issues
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = issues.project_id
            AND project_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Project members can manage issues" ON issues
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = issues.project_id
            AND project_members.user_id = auth.uid()
        )
    );

CREATE INDEX idx_issues_project_unresolved ON issues(project_id, is_resolved, severity);

-- ============================================
-- 7. 集計ビュー
-- ============================================

-- バケツごとの統計
CREATE OR REPLACE VIEW bucket_stats AS
SELECT 
    b.id AS bucket_id,
    b.project_id,
    b.name,
    b.color,
    COUNT(c.id) AS comment_count,
    COUNT(c.id) FILTER (WHERE c.sentiment = 'positive') AS positive_count,
    COUNT(c.id) FILTER (WHERE c.sentiment = 'negative') AS negative_count,
    COUNT(c.id) FILTER (WHERE c.action_type = 'complete') AS complete_count,
    COUNT(c.id) FILTER (WHERE c.action_type = 'error') AS error_count,
    COUNT(i.id) FILTER (WHERE i.is_resolved = FALSE) AS open_issue_count,
    MAX(c.created_at) AS last_activity,
    -- 勢い判定: 直近24時間のポジネガ比率
    CASE 
        WHEN COUNT(c.id) FILTER (WHERE c.created_at > NOW() - INTERVAL '24 hours' AND c.sentiment = 'positive') >
             COUNT(c.id) FILTER (WHERE c.created_at > NOW() - INTERVAL '24 hours' AND c.sentiment = 'negative')
        THEN 'up'
        WHEN COUNT(c.id) FILTER (WHERE c.created_at > NOW() - INTERVAL '24 hours' AND c.sentiment = 'negative') >
             COUNT(c.id) FILTER (WHERE c.created_at > NOW() - INTERVAL '24 hours' AND c.sentiment = 'positive')
        THEN 'down'
        ELSE 'stable'
    END AS momentum
FROM buckets b
LEFT JOIN comments c ON c.bucket_id = b.id
LEFT JOIN issues i ON i.bucket_id = b.id
GROUP BY b.id, b.project_id, b.name, b.color;

-- キーワード集計
CREATE OR REPLACE VIEW keyword_stats AS
SELECT 
    project_id,
    unnest(keywords) AS keyword,
    COUNT(*) AS count,
    COUNT(*) FILTER (WHERE sentiment = 'positive') AS positive_count,
    COUNT(*) FILTER (WHERE sentiment = 'negative') AS negative_count
FROM comments
GROUP BY project_id, unnest(keywords);

-- ============================================
-- 8. トリガー
-- ============================================

-- 更新日時自動更新
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 初回ログイン時に個人プロジェクト＋未分類バケツ自動作成
CREATE OR REPLACE FUNCTION create_personal_project()
RETURNS TRIGGER AS $$
DECLARE
    new_project_id UUID;
BEGIN
    -- 個人用プロジェクトを作成
    INSERT INTO projects (name, description, owner_id, is_personal)
    VALUES ('マイプロジェクト', '個人用', NEW.id, TRUE)
    RETURNING id INTO new_project_id;
    
    -- オーナーとしてメンバー登録
    INSERT INTO project_members (project_id, user_id, role)
    VALUES (new_project_id, NEW.id, 'owner');
    
    -- 未分類バケツを作成
    INSERT INTO buckets (project_id, name, name_normalized, is_default)
    VALUES (new_project_id, '未分類', '未分類', TRUE);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_created
    AFTER INSERT ON profiles
    FOR EACH ROW EXECUTE FUNCTION create_personal_project();
```

---

## Phase 2: Pythonバックエンド

### 2-1. 依存関係

```txt
# backend/requirements.txt
fastapi==0.109.0
uvicorn[standard]==0.27.0
supabase==2.3.0
python-dotenv==1.0.0
janome==0.5.0
pydantic==2.5.3
httpx==0.26.0
```

### 2-2. 設定ファイル

```python
# backend/app/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    supabase_url: str
    supabase_service_key: str
    cors_origins: list[str] = ["http://localhost:5173"]
    
    class Config:
        env_file = ".env"

settings = Settings()
```

### 2-3. Pydanticモデル

```python
# backend/app/models/schemas.py
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
```

### 2-4. NLP処理（コア）

```python
# backend/app/services/nlp.py
from janome.tokenizer import Tokenizer
from janome.analyzer import Analyzer
from janome.charfilter import UnicodeNormalizeCharFilter
from janome.tokenfilter import POSKeepFilter, LowerCaseFilter
import re
import unicodedata

tokenizer = Tokenizer()

# ============================================
# センチメント辞書
# ============================================
POSITIVE_WORDS = {
    # 完了系
    "完了", "できた", "終わった", "直った", "解決", "成功", "OK", "おk",
    "終了", "完成", "達成", "クリア", "解消", "修正完了", "対応完了",
    # ポジティブ動詞
    "進んだ", "進む", "決まった", "決まる", "うまくいった", "うまくいく",
    # 状態
    "良い", "いい", "順調", "問題なし", "大丈夫",
}

NEGATIVE_WORDS = {
    # エラー系
    "エラー", "バグ", "問題", "失敗", "できない", "動かない", "落ちた",
    "クラッシュ", "止まった", "フリーズ", "例外", "exception", "error",
    # 困難系
    "難しい", "わからない", "不明", "困った", "詰まった", "ハマった",
    # 否定
    "ダメ", "無理", "厳しい", "やばい",
}

WAITING_WORDS = {
    "待ち", "待機", "保留", "ペンディング", "確認中", "調査中", "検討中",
    "返事待ち", "レビュー待ち", "承認待ち",
}

START_WORDS = {
    "開始", "着手", "始める", "始めた", "スタート", "取り掛かる",
    "やる", "やります", "対応する",
}

COMPLETE_WORDS = {
    "完了", "終了", "終わった", "できた", "完成", "リリース", "納品",
    "提出", "送った", "送信", "提出済み",
}

# ============================================
# 品詞分解
# ============================================
def tokenize(text: str) -> dict:
    """テキストを品詞分解して名詞・動詞を抽出"""
    tokens = tokenizer.tokenize(text)
    
    nouns = []
    verbs = []
    all_words = []
    
    for token in tokens:
        pos = token.part_of_speech.split(',')[0]
        base = token.base_form if token.base_form != '*' else token.surface
        surface = token.surface
        
        all_words.append(surface)
        
        if pos == '名詞':
            # 数字単体や1文字は除外
            if not surface.isdigit() and len(surface) > 1:
                nouns.append(surface)
        elif pos == '動詞':
            verbs.append(base)  # 原形で保存
    
    return {
        "nouns": nouns,
        "verbs": verbs,
        "all_words": all_words,
        "raw_text": text
    }

# ============================================
# センチメント判定
# ============================================
def analyze_sentiment(tokens: dict) -> str:
    """ポジティブ/ネガティブ/ニュートラルを判定"""
    text = tokens["raw_text"]
    all_words = set(tokens["all_words"] + tokens["verbs"])
    
    # 否定形のチェック
    has_negation = any(neg in text for neg in ["ない", "ません", "できない", "しない"])
    
    pos_score = sum(1 for w in all_words if w in POSITIVE_WORDS)
    neg_score = sum(1 for w in all_words if w in NEGATIVE_WORDS)
    
    # テキスト全体でもチェック
    for w in POSITIVE_WORDS:
        if w in text:
            pos_score += 1
    for w in NEGATIVE_WORDS:
        if w in text:
            neg_score += 1
    
    if neg_score > pos_score:
        return "negative"
    elif pos_score > neg_score:
        return "positive"
    else:
        return "neutral"

# ============================================
# アクションタイプ判定
# ============================================
def detect_action_type(tokens: dict) -> str:
    """アクションの種類を判定"""
    text = tokens["raw_text"]
    all_words = set(tokens["all_words"] + tokens["verbs"])
    
    # 優先順位: error > complete > waiting > start > progress
    for w in NEGATIVE_WORDS:
        if w in text or w in all_words:
            return "error"
    
    for w in COMPLETE_WORDS:
        if w in text or w in all_words:
            return "complete"
    
    for w in WAITING_WORDS:
        if w in text or w in all_words:
            return "waiting"
    
    for w in START_WORDS:
        if w in text or w in all_words:
            return "start"
    
    # 動詞があれば progress
    if tokens["verbs"]:
        return "progress"
    
    return "info"

# ============================================
# バケツ名マッチング
# ============================================
def normalize_text(text: str) -> str:
    """正規化: 全角→半角、大文字→小文字、ひらがな→カタカナ"""
    # NFKC正規化
    text = unicodedata.normalize('NFKC', text)
    # 小文字化
    text = text.lower()
    return text

def extract_bucket_candidates(tokens: dict) -> list[str]:
    """バケツ名の候補を抽出"""
    candidates = []
    text = tokens["raw_text"]
    
    # パターン1: 「〇〇の」「〇〇、」で始まる → バケツ名の可能性高
    match = re.match(r'^([^\s、。の]+)[、の]', text)
    if match:
        candidates.append(match.group(1))
    
    # パターン2: 名詞の連続（固有名詞っぽいもの）
    for noun in tokens["nouns"]:
        # 2文字以上、一般的すぎない名詞
        if len(noun) >= 2 and noun not in {"こと", "もの", "ところ", "よう", "ため"}:
            candidates.append(noun)
    
    return candidates

def find_matching_bucket(candidates: list[str], existing_buckets: list[dict]) -> dict | None:
    """既存バケツとのマッチング"""
    for candidate in candidates:
        normalized = normalize_text(candidate)
        for bucket in existing_buckets:
            # 完全一致
            if bucket["name_normalized"] == normalized:
                return bucket
            # 部分一致（バケツ名が候補に含まれる、または逆）
            if normalized in bucket["name_normalized"] or bucket["name_normalized"] in normalized:
                return bucket
    return None

# ============================================
# メイン処理
# ============================================
def analyze_comment(text: str, existing_buckets: list[dict]) -> dict:
    """コメントを解析してNLP結果を返す"""
    tokens = tokenize(text)
    sentiment = analyze_sentiment(tokens)
    action_type = detect_action_type(tokens)
    
    # バケツマッチング
    candidates = extract_bucket_candidates(tokens)
    matched_bucket = find_matching_bucket(candidates, existing_buckets)
    
    # 新規バケツ作成判定
    new_bucket_name = None
    if not matched_bucket and candidates:
        # 最初の候補を新規バケツ名に
        new_bucket_name = candidates[0]
    
    # 課題検出
    issue_detected = None
    if action_type == "error" or sentiment == "negative":
        issue_detected = {
            "description": text[:100],  # 最初の100文字
            "severity": "warning" if action_type == "error" else "minor"
        }
    
    # キーワード = 名詞 + 動詞（重要なもの）
    keywords = list(set(tokens["nouns"][:5] + tokens["verbs"][:3]))
    
    return {
        "bucket_id": matched_bucket["id"] if matched_bucket else None,
        "bucket_name": matched_bucket["name"] if matched_bucket else new_bucket_name,
        "is_new_bucket": matched_bucket is None and new_bucket_name is not None,
        "sentiment": sentiment,
        "action_type": action_type,
        "keywords": keywords,
        "nouns": tokens["nouns"],
        "verbs": tokens["verbs"],
        "issue_detected": issue_detected
    }
```

### 2-5. Supabaseサービス

```python
# backend/app/services/supabase_client.py
from supabase import create_client, Client
from app.config import settings

supabase: Client = create_client(
    settings.supabase_url,
    settings.supabase_service_key
)

# ============================================
# バケツ操作
# ============================================
def get_buckets(project_id: str) -> list[dict]:
    """プロジェクトのバケツ一覧を取得"""
    response = supabase.table("buckets")\
        .select("*")\
        .eq("project_id", project_id)\
        .execute()
    return response.data

def create_bucket(project_id: str, name: str) -> dict:
    """バケツを新規作成"""
    from app.services.nlp import normalize_text
    
    response = supabase.table("buckets").insert({
        "project_id": project_id,
        "name": name,
        "name_normalized": normalize_text(name)
    }).execute()
    return response.data[0]

def get_or_create_bucket(project_id: str, name: str) -> dict:
    """バケツを取得、なければ作成"""
    from app.services.nlp import normalize_text
    
    normalized = normalize_text(name)
    
    # 既存チェック
    response = supabase.table("buckets")\
        .select("*")\
        .eq("project_id", project_id)\
        .eq("name_normalized", normalized)\
        .execute()
    
    if response.data:
        return response.data[0]
    
    # 新規作成
    return create_bucket(project_id, name)

def get_default_bucket(project_id: str) -> dict:
    """未分類バケツを取得"""
    response = supabase.table("buckets")\
        .select("*")\
        .eq("project_id", project_id)\
        .eq("is_default", True)\
        .execute()
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
    response = supabase.table("comments")\
        .select("*, profiles(display_name), buckets(name, color)")\
        .eq("project_id", project_id)\
        .order("created_at", desc=True)\
        .limit(limit)\
        .execute()
    return response.data

def get_comments_by_bucket(bucket_id: str, limit: int = 50) -> list[dict]:
    """バケツのコメント一覧"""
    response = supabase.table("comments")\
        .select("*, profiles(display_name)")\
        .eq("bucket_id", bucket_id)\
        .order("created_at", desc=True)\
        .limit(limit)\
        .execute()
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
    response = supabase.table("issues")\
        .select("*, buckets(name, color)")\
        .eq("project_id", project_id)\
        .eq("is_resolved", False)\
        .order("severity")\
        .execute()
    return response.data

def resolve_issue(issue_id: str) -> dict:
    """課題を解決済みにする"""
    response = supabase.table("issues")\
        .update({"is_resolved": True, "resolved_at": "now()"})\
        .eq("id", issue_id)\
        .execute()
    return response.data[0]

# ============================================
# 統計
# ============================================
def get_bucket_stats(project_id: str) -> list[dict]:
    """バケツごとの統計を取得"""
    response = supabase.table("bucket_stats")\
        .select("*")\
        .eq("project_id", project_id)\
        .execute()
    return response.data

def get_keyword_stats(project_id: str, limit: int = 20) -> list[dict]:
    """キーワード統計を取得"""
    response = supabase.table("keyword_stats")\
        .select("*")\
        .eq("project_id", project_id)\
        .order("count", desc=True)\
        .limit(limit)\
        .execute()
    return response.data
```

### 2-6. APIエンドポイント

```python
# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import comments, buckets, projects

app = FastAPI(title="Flow Journal API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(comments.router, prefix="/api/comments", tags=["comments"])
app.include_router(buckets.router, prefix="/api/buckets", tags=["buckets"])
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])

@app.get("/health")
def health_check():
    return {"status": "ok"}
```

```python
# backend/app/routers/comments.py
from fastapi import APIRouter, HTTPException
from app.models.schemas import CommentCreate, CommentResponse
from app.services import nlp, supabase_client as db

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
        db.create_issue({
            "project_id": payload.project_id,
            "bucket_id": bucket_id,
            "description": nlp_result["issue_detected"]["description"],
            "severity": nlp_result["issue_detected"]["severity"],
            "source_comment_id": comment["id"]
        })
    
    return {
        **comment,
        "bucket_name": nlp_result["bucket_name"],
        "nlp_result": nlp_result
    }

@router.get("/")
def get_comments(project_id: str, limit: int = 50):
    """コメント一覧を取得"""
    return db.get_comments(project_id, limit)

@router.get("/bucket/{bucket_id}")
def get_bucket_comments(bucket_id: str, limit: int = 50):
    """バケツのコメント一覧"""
    return db.get_comments_by_bucket(bucket_id, limit)
```

```python
# backend/app/routers/buckets.py
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
```

### 2-7. 起動

```bash
# backend/.env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJxxxxx

# 起動
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

---

## Phase 3: Reactフロントエンド

### 3-1. セットアップ

```bash
cd frontend
npm create vite@latest . -- --template react-ts
npm install @supabase/supabase-js zustand date-fns axios
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### 3-2. 型定義

```typescript
// frontend/src/types/index.ts

export type SentimentType = 'positive' | 'neutral' | 'negative';
export type ActionType = 'start' | 'progress' | 'complete' | 'error' | 'waiting' | 'info' | 'other';
export type IssueSeverity = 'critical' | 'warning' | 'minor' | 'waiting';

export interface Bucket {
  id: string;
  project_id: string;
  name: string;
  color: string;
  is_default: boolean;
  created_at: string;
}

export interface BucketStats {
  bucket_id: string;
  project_id: string;
  name: string;
  color: string;
  comment_count: number;
  positive_count: number;
  negative_count: number;
  complete_count: number;
  error_count: number;
  open_issue_count: number;
  last_activity: string | null;
  momentum: 'up' | 'stable' | 'down';
}

export interface Comment {
  id: string;
  project_id: string;
  bucket_id: string | null;
  user_id: string;
  content: string;
  sentiment: SentimentType;
  action_type: ActionType;
  keywords: string[];
  created_at: string;
  // JOIN
  profiles?: { display_name: string };
  buckets?: { name: string; color: string };
}

export interface Issue {
  id: string;
  project_id: string;
  bucket_id: string;
  description: string;
  severity: IssueSeverity;
  is_resolved: boolean;
  detected_at: string;
  // JOIN
  buckets?: { name: string; color: string };
}

export interface KeywordStat {
  keyword: string;
  count: number;
  positive_count: number;
  negative_count: number;
}
```

### 3-3. API呼び出し

```typescript
// frontend/src/services/api.ts
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE,
});

export const commentsApi = {
  create: (projectId: string, userId: string, content: string) =>
    api.post('/api/comments/', { project_id: projectId, user_id: userId, content }),
  
  list: (projectId: string, limit = 50) =>
    api.get('/api/comments/', { params: { project_id: projectId, limit } }),
  
  byBucket: (bucketId: string, limit = 50) =>
    api.get(`/api/comments/bucket/${bucketId}`, { params: { limit } }),
};

export const bucketsApi = {
  list: (projectId: string) =>
    api.get('/api/buckets/', { params: { project_id: projectId } }),
  
  stats: (projectId: string) =>
    api.get('/api/buckets/stats', { params: { project_id: projectId } }),
  
  keywords: (projectId: string, limit = 20) =>
    api.get('/api/buckets/keywords', { params: { project_id: projectId, limit } }),
  
  issues: (projectId: string) =>
    api.get('/api/buckets/issues', { params: { project_id: projectId } }),
  
  resolveIssue: (issueId: string) =>
    api.post(`/api/buckets/issues/${issueId}/resolve`),
};
```

### 3-4. 状態管理

```typescript
// frontend/src/store/appStore.ts
import { create } from 'zustand';
import { BucketStats, Comment, Issue, KeywordStat } from '../types';

interface AppState {
  // データ
  bucketStats: BucketStats[];
  comments: Comment[];
  issues: Issue[];
  keywords: KeywordStat[];
  
  // UI状態
  currentProjectId: string | null;
  selectedBucketId: string | null;
  isLoading: boolean;
  
  // アクション
  setCurrentProject: (projectId: string) => void;
  setBucketStats: (stats: BucketStats[]) => void;
  setComments: (comments: Comment[]) => void;
  addComment: (comment: Comment) => void;
  setIssues: (issues: Issue[]) => void;
  setKeywords: (keywords: KeywordStat[]) => void;
  setSelectedBucket: (bucketId: string | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  bucketStats: [],
  comments: [],
  issues: [],
  keywords: [],
  currentProjectId: null,
  selectedBucketId: null,
  isLoading: false,
  
  setCurrentProject: (projectId) => set({ currentProjectId: projectId }),
  setBucketStats: (stats) => set({ bucketStats: stats }),
  setComments: (comments) => set({ comments }),
  addComment: (comment) => set((state) => ({ 
    comments: [comment, ...state.comments] 
  })),
  setIssues: (issues) => set({ issues }),
  setKeywords: (keywords) => set({ keywords }),
  setSelectedBucket: (bucketId) => set({ selectedBucketId: bucketId }),
  setLoading: (loading) => set({ isLoading: loading }),
}));
```

### 3-5. メインレイアウト（概要）

```
frontend/src/
├── components/
│   ├── Dashboard/
│   │   ├── Dashboard.tsx       # バケツカード一覧
│   │   └── BucketCard.tsx      # 個別バケツカード
│   ├── Issues/
│   │   └── IssueList.tsx       # 課題一覧
│   ├── Keywords/
│   │   └── KeywordCloud.tsx    # キーワード表示
│   ├── Comments/
│   │   ├── CommentList.tsx     # コメント一覧
│   │   └── CommentItem.tsx     # 個別コメント
│   ├── Input/
│   │   └── ChatInput.tsx       # 入力欄
│   └── Layout/
│       └── MainLayout.tsx      # 全体レイアウト
```

---

## 画面イメージ

```
┌─────────────────────────────────────────────────────────────────┐
│ Flow Journal                                        [ログアウト] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ バケツ（自動生成）                                        │   │
│  │ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐            │   │
│  │ │ 特許1  │ │ 特許2  │ │ 竹中   │ │ 未分類 │            │   │
│  │ │ 💬12   │ │ 💬5    │ │ 💬8    │ │ 💬3    │            │   │
│  │ │ ↑順調  │ │ →停滞  │ │ ↑順調  │ │        │            │   │
│  │ └────────┘ └────────┘ └────────┘ └────────┘            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 📋 課題                                         [3件]    │   │
│  │ 🔴 特許2: 3日間動きなし                                  │   │
│  │ 🟡 竹中: 見積もり確認待ち                                │   │
│  │ 🟡 特許1: ビルドエラー（14:01）                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🏷️ [エラー:3] [完了:5] [請求項:4] [修正:6] [待ち:2]      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 💬 ログ                                                  │   │
│  │ 14:32 [特許1] エラー直った ✅                            │   │
│  │ 14:28 [特許2] 請求項の書き方調査中 🔍                    │   │
│  │ 14:15 [竹中] 見積もり、確認待ち ⏳                       │   │
│  │ 14:01 [特許1] ビルドエラー発生 ⚠️                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ [＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿] [送信]        │   │
│  │ Win+H で音声入力                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## デプロイ

### バックエンド（Render推奨）

```yaml
# render.yaml
services:
  - type: web
    name: flow-journal-api
    env: python
    buildCommand: pip install -r backend/requirements.txt
    startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_KEY
        sync: false
```

### フロントエンド（Vercel推奨）

```bash
cd frontend
npm run build
vercel --prod
```

---

## 成功基準

- つぶやき入力から分類まで **500ms以内**（AI API不要なので高速）
- バケツは勝手に増える、ユーザーは意識しない
- 課題一覧で今日やることが10秒でわかる
- PC・携帯どちらからも同じ体験
