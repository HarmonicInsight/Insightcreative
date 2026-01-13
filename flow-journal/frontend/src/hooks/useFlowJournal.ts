import { useCallback, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { commentsApi, bucketsApi } from '../services/api';

export function useFlowJournal() {
  const {
    currentProjectId,
    bucketStats,
    comments,
    issues,
    keywords,
    isLoading,
    setCurrentProject,
    setBucketStats,
    setComments,
    addComment,
    setIssues,
    setKeywords,
    setLoading,
  } = useAppStore();

  const loadData = useCallback(async (projectId: string) => {
    setLoading(true);
    try {
      const [statsRes, commentsRes, issuesRes, keywordsRes] = await Promise.all([
        bucketsApi.stats(projectId),
        commentsApi.list(projectId),
        bucketsApi.issues(projectId),
        bucketsApi.keywords(projectId),
      ]);

      setBucketStats(statsRes.data);
      setComments(commentsRes.data);
      setIssues(issuesRes.data);
      setKeywords(keywordsRes.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, [setBucketStats, setComments, setIssues, setKeywords, setLoading]);

  const submitComment = useCallback(async (content: string, userId: string) => {
    if (!currentProjectId) return;

    try {
      const response = await commentsApi.create(currentProjectId, userId, content);
      addComment(response.data);
      // 統計も更新
      const statsRes = await bucketsApi.stats(currentProjectId);
      setBucketStats(statsRes.data);
      // 課題も更新
      const issuesRes = await bucketsApi.issues(currentProjectId);
      setIssues(issuesRes.data);
      return response.data;
    } catch (error) {
      console.error('Failed to submit comment:', error);
      throw error;
    }
  }, [currentProjectId, addComment, setBucketStats, setIssues]);

  const resolveIssue = useCallback(async (issueId: string) => {
    if (!currentProjectId) return;

    try {
      await bucketsApi.resolveIssue(issueId);
      const issuesRes = await bucketsApi.issues(currentProjectId);
      setIssues(issuesRes.data);
    } catch (error) {
      console.error('Failed to resolve issue:', error);
      throw error;
    }
  }, [currentProjectId, setIssues]);

  useEffect(() => {
    if (currentProjectId) {
      loadData(currentProjectId);
    }
  }, [currentProjectId, loadData]);

  return {
    currentProjectId,
    bucketStats,
    comments,
    issues,
    keywords,
    isLoading,
    setCurrentProject,
    submitComment,
    resolveIssue,
    refreshData: () => currentProjectId && loadData(currentProjectId),
  };
}
