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
