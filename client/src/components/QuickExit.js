import React, { useEffect } from 'react';
import { X } from 'lucide-react';

const QuickExit = () => {
  const handleQuickExit = () => {
    try {
      sessionStorage.clear();
    } catch (_) {
      // Ignore storage errors
    }
    window.location.replace('https://google.com');
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleQuickExit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col items-start gap-1">
      <button
        onClick={handleQuickExit}
        aria-label="Leave this site quickly (or press Escape)"
        title="Leave this site quickly (or press Escape)"
        className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-500 bg-gray-100 border border-gray-200 rounded opacity-70 hover:opacity-100 hover:bg-gray-200 hover:text-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-gray-400"
      >
        <X className="h-3 w-3" />
        <span>Quick Exit</span>
      </button>
      <span className="text-[10px] text-gray-400 pl-1 select-none" aria-hidden="true">
        Press ESC to exit quickly
      </span>
    </div>
  );
};

export default QuickExit;
