'use client';

import Link from 'next/link';
import ReactMarkdown from 'react-markdown';

type ArticleMarkdownProps = {
  children: string;
};

export default function ArticleMarkdown({ children }: ArticleMarkdownProps) {
  return (
    <ReactMarkdown
      components={{
        h1: ({ children: c, ...props }) => (
          <h1
            className="text-3xl sm:text-4xl font-bold mt-8 mb-4 text-gray-900"
            {...props}
          >
            {c}
          </h1>
        ),
        h2: ({ children: c, ...props }) => (
          <h2
            className="text-2xl sm:text-3xl font-bold mt-6 mb-3 text-gray-900"
            {...props}
          >
            {c}
          </h2>
        ),
        h3: ({ children: c, ...props }) => (
          <h3
            className="text-xl sm:text-2xl font-semibold mt-5 mb-2 text-gray-800"
            {...props}
          >
            {c}
          </h3>
        ),
        h4: ({ children: c, ...props }) => (
          <h4
            className="text-lg sm:text-xl font-semibold mt-4 mb-2 text-gray-800"
            {...props}
          >
            {c}
          </h4>
        ),
        p: ({ ...props }) => <p className="mb-4 text-gray-700 leading-relaxed" {...props} />,
        ul: ({ ...props }) => <ul className="mb-4 ml-6 list-disc space-y-2" {...props} />,
        ol: ({ ...props }) => <ol className="mb-4 ml-6 list-decimal space-y-2" {...props} />,
        li: ({ ...props }) => <li className="text-gray-700" {...props} />,
        strong: ({ ...props }) => (
          <strong className="font-semibold text-gray-900" {...props} />
        ),
        em: ({ ...props }) => <em className="italic" {...props} />,
        hr: ({ ...props }) => <hr className="my-8 border-gray-300" {...props} />,
        a: ({ href, children: c, ...props }) => {
          if (href && href.startsWith('/')) {
            return (
              <Link
                href={href}
                className="text-blue-600 hover:text-blue-800 underline font-semibold"
              >
                {c}
              </Link>
            );
          }
          return (
            <a
              href={href}
              className="text-blue-600 hover:text-blue-800 underline"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            >
              {c}
            </a>
          );
        },
        blockquote: ({ ...props }) => (
          <blockquote
            className="border-l-4 border-blue-500 pl-4 py-2 my-4 italic text-gray-700 bg-blue-50"
            {...props}
          />
        ),
        code: ({ children: c, ...props }) => (
          <code
            className="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-gray-800"
            {...props}
          >
            {c}
          </code>
        ),
        pre: ({ ...props }) => (
          <pre className="bg-gray-100 p-4 rounded overflow-x-auto my-4" {...props} />
        ),
        table: ({ ...props }) => (
          <div className="overflow-x-auto my-6">
            <table className="min-w-full divide-y divide-gray-300" {...props} />
          </div>
        ),
        thead: ({ ...props }) => <thead className="bg-gray-50" {...props} />,
        tbody: ({ ...props }) => (
          <tbody className="divide-y divide-gray-200 bg-white" {...props} />
        ),
        tr: ({ ...props }) => <tr {...props} />,
        th: ({ ...props }) => (
          <th
            className="px-4 py-3 text-left text-sm font-semibold text-gray-900"
            {...props}
          />
        ),
        td: ({ ...props }) => <td className="px-4 py-3 text-sm text-gray-700" {...props} />,
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
