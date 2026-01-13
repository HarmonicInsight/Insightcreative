import { Comment } from '../../types';
import { CommentItem } from './CommentItem';

interface CommentListProps {
  comments: Comment[];
}

export function CommentList({ comments }: CommentListProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <h2 className="text-lg font-semibold text-gray-700 mb-4">💬 ログ</h2>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {comments.map((comment) => (
          <CommentItem key={comment.id} comment={comment} />
        ))}
        {comments.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            まだコメントがありません
          </div>
        )}
      </div>
    </div>
  );
}
