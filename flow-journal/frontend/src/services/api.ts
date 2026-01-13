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

export default api;
