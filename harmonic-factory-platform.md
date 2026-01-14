# ハーモニックファクトリー 開発基盤

**凡例**: 🟢 = 標準採用 / ⚪ = 必要時採用 / ❌ = 不採用

---

## 1. 基本方針

| 方針 | 内容 |
|------|------|
| **開発手法** | 🟢 Claude Code によるAI駆動開発 |
| **ノーコードツール** | ❌ 不採用（自社構築で代替） |
| **インフラ選定** | 月商規模に応じた最適選定 |
| **顧客提案** | 正直な技術選定、成長に合わせた移行 |

---

## 2. 標準技術スタック

| カテゴリ | 標準ツール | 採用 |
|---------|-----------|------|
| **フロントエンド** | Vercel + React | 🟢 標準 |
| **バックエンド** | Render (Python) | 🟢 標準 |
| **認証** | Firebase Auth | 🟢 標準 |
| **DB（NoSQL）** | Firebase Firestore | 🟢 標準 |
| **DB（SQL）** | Supabase | ⚪ 業務系のみ |
| **ベクトルDB** | Pinecone | ⚪ AI連携時 |
| **ストレージ** | Firebase Storage | 🟢 標準 |
| **CI/CD** | GitHub Actions | 🟢 標準 |
| **CDN / セキュリティ** | Cloudflare | 🟢 標準 |
| **メール送信** | Resend | ⚪ 必要時 |
| **監視** | Sentry | ⚪ 本番運用時 |
| **AI（LLM）** | Claude API | 🟢 標準 |

---

## 3. アプリ種類別 DB選定表

| アプリ種類 | DB選択 | 採用 |
|-----------|--------|------|
| **ECサイト** | Supabase | ⚪ |
| **業務システム** | Supabase | ⚪ |
| **CRM・顧客管理** | Supabase | ⚪ |
| **予約システム** | Supabase | ⚪ |
| **チャットアプリ** | Firebase | 🟢 |
| **SNS・タイムライン** | Firebase | 🟢 |
| **スマホアプリ** | Firebase | 🟢 |
| **ゲーム** | Firebase | 🟢 |
| **IoT・センサー** | Firebase | 🟢 |
| **ブログ・CMS** | Supabase | ⚪ |
| **Todoアプリ** | Firebase | 🟢 |
| **AI/NLPアプリ** | Firebase | 🟢 |
| **データウェアハウス** | BigQuery / Supabase | ⚪ |

---

## 4. アプリ種別 × インフラ × 小規模製品

| インフラ | 静的サイト | フロントアプリ | サーバー必要 | 採用 |
|---------|-----------|---------------|-------------|------|
| **フロントエンド** | Vercel | Vercel | Vercel | 🟢 |
| **バックエンド** | - | - | Render | 🟢 |
| **DB** | - | Firebase | Firebase | 🟢 |
| **認証** | - | Firebase Auth | Firebase Auth | 🟢 |
| **ストレージ** | - | Firebase Storage | Firebase Storage | 🟢 |
| **監視** | - | - | Sentry | ⚪ |
| **CI/CD** | GitHub Actions | GitHub Actions | GitHub Actions | 🟢 |
| **CDN** | Vercel内蔵 | Vercel内蔵 | Cloudflare | 🟢 |
| **メール** | - | Resend | Resend | ⚪ |
| **ベクトルDB** | - | - | Pinecone | ⚪ |
| **セキュリティ** | Cloudflare | Cloudflare | Cloudflare | 🟢 |

---

## 5. DB種類別 用途一覧

| 種類 | 代表製品 | 用途 | 採用 |
|------|---------|------|------|
| **RDB（SQL）** | Supabase | 業務システム、EC | ⚪ 業務系のみ |
| **ドキュメントDB** | Firebase | チャット、SNS、ログ | 🟢 標準 |
| **キーバリュー** | Upstash | キャッシュ | ⚪ 必要時 |
| **ベクトルDB** | Pinecone | AI意味検索 | ⚪ AI連携時 |
| **時系列DB** | InfluxDB | IoT、監視 | ⚪ 特殊案件 |
| **検索エンジン** | Algolia | 全文検索 | ⚪ 検索重視時 |

---

## 6. 規模別インフラ選定

| 月商 | 構成 | 月額目安 | 採用 |
|------|------|---------|------|
| **〜100万円** | Render + Firebase（無料） | **0円** | 🟢 標準 |
| **100〜1,000万円** | Railway + Firebase/Supabase Pro | **3〜8万円** | ⚪ 成長時 |
| **1,000万円〜** | Cloud Run + Cloud SQL | **10〜50万円** | ⚪ 大規模時 |

---

## 7. 不採用ツール一覧

| ツール | 用途 | 月額 | 採用 | 代替 |
|--------|------|------|------|------|
| **Dify** | RAG構築 | $59〜 | ❌ | Claude Code |
| **n8n** | ワークフロー | $20〜 | ❌ | Claude Code |
| **Zapier** | 連携 | $29〜 | ❌ | Claude Code |
| **Make** | 自動化 | $10〜 | ❌ | Claude Code |
| **Flowise** | AIフロー | 無料〜 | ❌ | Claude Code |
| **Bubble** | アプリ構築 | $32〜 | ❌ | Claude Code |
| **Retool** | 管理画面 | $10〜 | ❌ | Claude Code |

---

## 8. AI連携案件

| 案件 | ベクトルDB | 採用 |
|------|-----------|------|
| 社内ナレッジ検索 | Pinecone | ⚪ 必要時 |
| カスタマーサポートBot | Pinecone | ⚪ 必要時 |
| 契約書レビュー | Pinecone | ⚪ 必要時 |
| 議事録検索 | Pinecone | ⚪ 必要時 |
| 翻訳・要約 | 不要 | - |
| 感情分析 | 不要 | - |

---

## 9. 標準構成まとめ

```
🟢 標準構成（全案件共通）
├── Vercel（フロント）
├── Render（バックエンド）
├── Firebase Auth（認証）
├── Firebase Firestore（DB）
├── Firebase Storage（ストレージ）
├── GitHub Actions（CI/CD）
├── Cloudflare（CDN・セキュリティ）
└── Claude API（AI）

⚪ オプション（必要時追加）
├── Supabase（SQL必要時）
├── Pinecone（AI連携時）
├── Resend（メール送信時）
└── Sentry（本番監視時）
```

---

## 10. 御社の強み

```
✅ ノーコードツール不要（Claude Codeで構築）
✅ 顧客規模に合った正直な提案
✅ 成長に合わせた移行サポート
✅ 大手が言わない情報を公開
```
