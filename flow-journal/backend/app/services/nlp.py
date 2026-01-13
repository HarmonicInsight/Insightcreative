from janome.tokenizer import Tokenizer
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
        pos = token.part_of_speech.split(",")[0]
        base = token.base_form if token.base_form != "*" else token.surface
        surface = token.surface

        all_words.append(surface)

        if pos == "名詞":
            # 数字単体や1文字は除外
            if not surface.isdigit() and len(surface) > 1:
                nouns.append(surface)
        elif pos == "動詞":
            verbs.append(base)  # 原形で保存

    return {"nouns": nouns, "verbs": verbs, "all_words": all_words, "raw_text": text}


# ============================================
# センチメント判定
# ============================================
def analyze_sentiment(tokens: dict) -> str:
    """ポジティブ/ネガティブ/ニュートラルを判定"""
    text = tokens["raw_text"]
    all_words = set(tokens["all_words"] + tokens["verbs"])

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
    text = unicodedata.normalize("NFKC", text)
    # 小文字化
    text = text.lower()
    return text


def extract_bucket_candidates(tokens: dict) -> list[str]:
    """バケツ名の候補を抽出"""
    candidates = []
    text = tokens["raw_text"]

    # パターン1: 「〇〇の」「〇〇、」で始まる → バケツ名の可能性高
    match = re.match(r"^([^\s、。の]+)[、の]", text)
    if match:
        candidates.append(match.group(1))

    # パターン2: 名詞の連続（固有名詞っぽいもの）
    for noun in tokens["nouns"]:
        # 2文字以上、一般的すぎない名詞
        if len(noun) >= 2 and noun not in {"こと", "もの", "ところ", "よう", "ため"}:
            candidates.append(noun)

    return candidates


def find_matching_bucket(
    candidates: list[str], existing_buckets: list[dict]
) -> dict | None:
    """既存バケツとのマッチング"""
    for candidate in candidates:
        normalized = normalize_text(candidate)
        for bucket in existing_buckets:
            # 完全一致
            if bucket["name_normalized"] == normalized:
                return bucket
            # 部分一致（バケツ名が候補に含まれる、または逆）
            if (
                normalized in bucket["name_normalized"]
                or bucket["name_normalized"] in normalized
            ):
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
            "severity": "warning" if action_type == "error" else "minor",
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
        "issue_detected": issue_detected,
    }
