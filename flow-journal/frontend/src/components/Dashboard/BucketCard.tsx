import { BucketStats } from '../../types';

interface BucketCardProps {
  bucket: BucketStats;
  onClick?: () => void;
}

export function BucketCard({ bucket, onClick }: BucketCardProps) {
  const getMomentumIcon = () => {
    switch (bucket.momentum) {
      case 'up':
        return '↑';
      case 'down':
        return '↓';
      default:
        return '→';
    }
  };

  const getMomentumClass = () => {
    switch (bucket.momentum) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-md transition-shadow border-l-4"
      style={{ borderLeftColor: bucket.color }}
    >
      <h3 className="font-semibold text-gray-800 truncate">{bucket.name}</h3>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-gray-500 text-sm">
          💬 {bucket.comment_count}
        </span>
        <span className={`text-sm font-medium ${getMomentumClass()}`}>
          {getMomentumIcon()} {bucket.momentum === 'up' ? '順調' : bucket.momentum === 'down' ? '停滞' : '安定'}
        </span>
      </div>
      {bucket.open_issue_count > 0 && (
        <div className="mt-2 text-xs text-red-500">
          ⚠️ {bucket.open_issue_count}件の課題
        </div>
      )}
    </div>
  );
}
