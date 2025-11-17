import React, { useState } from 'react';

const Tooltip = ({ term, definition, children }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <span className="relative inline-block">
      <button
        type="button"
        className="border-b border-dotted border-blue-600 text-blue-600 cursor-help hover:border-blue-800 hover:text-blue-800 transition-colors"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={(e) => {
          e.preventDefault();
          setIsVisible(!isVisible);
        }}
        aria-label={`Definition of ${term}`}
      >
        {children || term}
      </button>
      {isVisible && (
        <span
          className="absolute z-10 bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg max-w-xs whitespace-normal"
          style={{ minWidth: '200px' }}
        >
          <strong className="block mb-1">{term}:</strong>
          {definition}
          <span className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></span>
        </span>
      )}
    </span>
  );
};

export default Tooltip;
