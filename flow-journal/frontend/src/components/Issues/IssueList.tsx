import { Issue } from '../../types';

interface IssueListProps {
  issues: Issue[];
  onResolve?: (issueId: string) => void;
}

export function IssueList({ issues, onResolve }: IssueListProps) {
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '🔴';
      case 'warning':
        return '🟡';
      case 'minor':
        return '🟢';
      case 'waiting':
        return '⏳';
      default:
        return '⚪';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-3 sm:p-4">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h2 className="text-base sm:text-lg font-semibold text-gray-700">課題</h2>
        <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
          {issues.length}件
        </span>
      </div>
      <div className="space-y-2">
        {issues.map((issue) => (
          <div
            key={issue.id}
            className="flex items-start sm:items-center justify-between p-3 bg-gray-50 rounded-lg"
          >
            <div className="flex items-start sm:items-center gap-2 flex-1 min-w-0">
              <span className="text-lg flex-shrink-0">{getSeverityIcon(issue.severity)}</span>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-gray-400 block sm:inline sm:mr-2">
                  {issue.buckets?.name}
                </span>
                <span className="text-sm text-gray-700 block sm:inline break-words">
                  {issue.description}
                </span>
              </div>
            </div>
            <button
              onClick={() => onResolve?.(issue.id)}
              className="ml-2 px-4 py-2 min-h-[44px] text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 active:bg-green-300 transition-colors touch-manipulation flex-shrink-0"
            >
              解決
            </button>
          </div>
        ))}
        {issues.length === 0 && (
          <div className="text-center text-gray-400 py-6">
            未解決の課題はありません
          </div>
        )}
      </div>
    </div>
  );
}
