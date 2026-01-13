import { useState, KeyboardEvent, useEffect } from 'react';

interface ChatInputProps {
  onSubmit: (content: string) => Promise<void>;
  disabled?: boolean;
}

function getVoiceInputHint(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) {
    return 'キーボードのマイクアイコンで音声入力';
  }
  if (/Android/.test(ua)) {
    return 'キーボードのマイクで音声入力';
  }
  return 'Win+H で音声入力';
}

export function ChatInput({ onSubmit, disabled }: ChatInputProps) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [voiceHint, setVoiceHint] = useState('');

  useEffect(() => {
    setVoiceHint(getVoiceInputHint());
  }, []);

  const handleSubmit = async () => {
    if (!content.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit(content.trim());
      setContent('');
    } catch (error) {
      console.error('Failed to submit:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 sm:p-4 safe-area-bottom">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="つぶやきを入力..."
            disabled={disabled || isSubmitting}
            rows={2}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 resize-none text-base"
          />
          <button
            onClick={handleSubmit}
            disabled={disabled || isSubmitting || !content.trim()}
            className="px-6 py-3 min-h-[48px] bg-blue-600 text-white text-lg font-medium rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors sm:self-end"
          >
            {isSubmitting ? '送信中...' : '送信'}
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-400 text-center sm:text-left">
          {voiceHint}
        </p>
      </div>
    </div>
  );
}
