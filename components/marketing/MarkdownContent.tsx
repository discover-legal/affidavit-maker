'use client';

import ReactMarkdown from 'react-markdown';

type MarkdownContentProps = {
  children: string;
};

export default function MarkdownContent({ children }: MarkdownContentProps) {
  return (
    <ReactMarkdown
      components={{
        h1: ({ children, ...props }) => (
          <h1 className="text-3xl font-bold mt-8 mb-4 text-gray-900" {...props}>
            {children}
          </h1>
        ),
        h2: ({ children, ...props }) => (
          <h2 className="text-2xl font-bold mt-6 mb-3 text-gray-900" {...props}>
            {children}
          </h2>
        ),
        h3: ({ children, ...props }) => (
          <h3 className="text-xl font-semibold mt-5 mb-2 text-gray-800" {...props}>
            {children}
          </h3>
        ),
        p: ({ ...props }) => <p className="mb-4 text-gray-700 leading-relaxed" {...props} />,
        ul: ({ ...props }) => <ul className="mb-4 ml-6 list-disc" {...props} />,
        li: ({ ...props }) => <li className="mb-2 text-gray-700" {...props} />,
        strong: ({ ...props }) => <strong className="font-semibold text-gray-900" {...props} />,
        hr: ({ ...props }) => <hr className="my-6 border-gray-300" {...props} />,
        a: ({ children, ...props }) => (
          <a className="text-blue-600 hover:text-blue-800 underline" {...props}>
            {children}
          </a>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
