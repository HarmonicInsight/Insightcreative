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
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-700">📋 課題</h2>
        <span className="text-sm text-gray-500">[{issues.length}件]</span>
      </div>
      <div className="space-y-2">
        {issues.map((issue) => (
          <div
            key={issue.id}
            className="flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-gray-100"
          >
            <div className="flex items-center space-x-2 flex-1 min-w-0">
              <span>{getSeverityIcon(issue.severity)}</span>
              <span className="text-sm text-gray-600 truncate">
                {issue.buckets?.name}: {issue.description}
              </span>
            </div>
            <button
              onClick={() => onResolve?.(issue.id)}
              className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
            >
              解決
            </button>
          </div>
        ))}
        {issues.length === 0 && (
          <div className="text-center text-gray-400 py-4">
            未解決の課題はありません
          </div>
        )}
      </div>
    </div>
  );
}
