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
  addComment: (comment) =>
    set((state) => ({
      comments: [comment, ...state.comments],
    })),
  setIssues: (issues) => set({ issues }),
  setKeywords: (keywords) => set({ keywords }),
  setSelectedBucket: (bucketId) => set({ selectedBucketId: bucketId }),
  setLoading: (loading) => set({ isLoading: loading }),
}));
