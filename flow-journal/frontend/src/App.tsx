import { useEffect } from 'react';
import { MainLayout } from './components/Layout/MainLayout';
import { Dashboard } from './components/Dashboard/Dashboard';
import { IssueList } from './components/Issues/IssueList';
import { KeywordCloud } from './components/Keywords/KeywordCloud';
import { CommentList } from './components/Comments/CommentList';
import { ChatInput } from './components/Input/ChatInput';
import { useFlowJournal } from './hooks/useFlowJournal';

// デモ用の固定プロジェクトID・ユーザーID
const DEMO_PROJECT_ID = import.meta.env.VITE_DEMO_PROJECT_ID || 'demo-project-id';
const DEMO_USER_ID = import.meta.env.VITE_DEMO_USER_ID || 'demo-user-id';

function App() {
  const {
    bucketStats,
    comments,
    issues,
    keywords,
    isLoading,
    setCurrentProject,
    submitComment,
    resolveIssue,
  } = useFlowJournal();

  useEffect(() => {
    setCurrentProject(DEMO_PROJECT_ID);
  }, [setCurrentProject]);

  const handleSubmit = async (content: string) => {
    await submitComment(content, DEMO_USER_ID);
  };

  return (
    <MainLayout>
      {isLoading ? (
        <div className="text-center py-8 text-gray-500">読み込み中...</div>
      ) : (
        <div className="space-y-6">
          {/* バケツダッシュボード */}
          <Dashboard bucketStats={bucketStats} />

          {/* 課題一覧 */}
          <IssueList issues={issues} onResolve={resolveIssue} />

          {/* キーワード */}
          <KeywordCloud keywords={keywords} />

          {/* コメントログ */}
          <CommentList comments={comments} />

          {/* 入力欄 */}
          <ChatInput onSubmit={handleSubmit} />
        </div>
      )}
    </MainLayout>
  );
}

export default App;
