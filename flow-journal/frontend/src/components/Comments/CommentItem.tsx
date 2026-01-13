import { format } from 'date-fns';
import { Comment } from '../../types';

interface CommentItemProps {
  comment: Comment;
}

export function CommentItem({ comment }: CommentItemProps) {
  const getActionIcon = () => {
    switch (comment.action_type) {
      case 'complete':
        return '✅';
      case 'error':
        return '⚠️';
      case 'waiting':
        return '⏳';
      case 'start':
        return '🚀';
      case 'progress':
        return '🔍';
      default:
        return '💬';
    }
  };

  const getSentimentClass = () => {
    switch (comment.sentiment) {
      case 'positive':
        return 'border-l-green-400';
      case 'negative':
        return 'border-l-red-400';
      default:
        return 'border-l-gray-300';
    }
  };

  const time = format(new Date(comment.created_at), 'HH:mm');
  const bucketName = comment.buckets?.name || '未分類';

  return (
    <div className={`p-3 bg-white rounded shadow-sm border-l-4 ${getSentimentClass()}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2 text-sm text-gray-500 mb-1">
            <span>{time}</span>
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{ backgroundColor: comment.buckets?.color || '#6B7280', color: 'white' }}
            >
              {bucketName}
            </span>
          </div>
          <p className="text-gray-800">{comment.content}</p>
        </div>
        <span className="text-xl ml-2">{getActionIcon()}</span>
      </div>
    </div>
  );
}
