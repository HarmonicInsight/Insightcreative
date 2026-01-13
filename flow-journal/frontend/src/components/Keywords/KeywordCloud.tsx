import { KeywordStat } from '../../types';

interface KeywordCloudProps {
  keywords: KeywordStat[];
}

export function KeywordCloud({ keywords }: KeywordCloudProps) {
  const getKeywordStyle = (keyword: KeywordStat) => {
    const ratio = keyword.positive_count / (keyword.positive_count + keyword.negative_count + 0.1);
    if (ratio > 0.6) return 'bg-green-100 text-green-700';
    if (ratio < 0.4) return 'bg-red-100 text-red-700';
    return 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-lg font-semibold text-gray-700 mb-4">🏷️ キーワード</h2>
      <div className="flex flex-wrap gap-2">
        {keywords.map((keyword) => (
          <span
            key={keyword.keyword}
            className={`px-3 py-1 rounded-full text-sm ${getKeywordStyle(keyword)}`}
          >
            {keyword.keyword}:{keyword.count}
          </span>
        ))}
        {keywords.length === 0 && (
          <span className="text-gray-400">キーワードはまだありません</span>
        )}
      </div>
    </div>
  );
}
