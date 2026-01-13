import { BucketStats } from '../../types';
import { BucketCard } from './BucketCard';

interface DashboardProps {
  bucketStats: BucketStats[];
  onBucketClick?: (bucketId: string) => void;
}

export function Dashboard({ bucketStats, onBucketClick }: DashboardProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <h2 className="text-lg font-semibold text-gray-700 mb-4">
        バケツ（自動生成）
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {bucketStats.map((bucket) => (
          <BucketCard
            key={bucket.bucket_id}
            bucket={bucket}
            onClick={() => onBucketClick?.(bucket.bucket_id)}
          />
        ))}
        {bucketStats.length === 0 && (
          <div className="col-span-full text-center text-gray-400 py-8">
            まだバケツがありません。コメントを入力すると自動で作成されます。
          </div>
        )}
      </div>
    </div>
  );
}
