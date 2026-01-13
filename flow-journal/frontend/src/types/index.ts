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

export interface NLPResult {
  bucket_id: string | null;
  bucket_name: string | null;
  is_new_bucket: boolean;
  sentiment: SentimentType;
  action_type: ActionType;
  keywords: string[];
  nouns: string[];
  verbs: string[];
  issue_detected: { description: string; severity: string } | null;
}

export interface CommentResponse extends Comment {
  bucket_name: string | null;
  nlp_result: NLPResult;
}
