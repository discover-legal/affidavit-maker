'use client';

import React, { type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import Tooltip from './Tooltip';
import { TOOLTIP_DEFINITIONS } from '@/lib/content/termsOfService';

// Walk children, expanding `{{term}}` markers in strings into <Tooltip>s. The TOS
// uses `{{escrow}}` etc. as inline annotations; legal terms with a known definition
// in TOOLTIP_DEFINITIONS render as a hover-revealed Tooltip, others render as plain text.
function expandTooltips(node: ReactNode): ReactNode {
  if (Array.isArray(node)) {
    return node.map((child, idx) => (
      <React.Fragment key={idx}>{expandTooltips(child)}</React.Fragment>
    ));
  }

  if (typeof node !== 'string') {
    return node;
  }

  const parts: ReactNode[] = [];
  const regex = /\{\{([^}]+)\}\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(node)) !== null) {
    if (match.index > lastIndex) {
      parts.push(node.substring(lastIndex, match.index));
    }
    const term = match[1];
    const definition =
      TOOLTIP_DEFINITIONS[term] ?? TOOLTIP_DEFINITIONS[term.toLowerCase()];

    if (definition) {
      parts.push(
        <Tooltip key={match.index} term={term} definition={definition}>
          {term}
        </Tooltip>,
      );
    } else {
      parts.push(term);
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < node.length) {
    parts.push(node.substring(lastIndex));
  }

  return parts.length > 0 ? parts : node;
}

type TermsMarkdownProps = {
  children: string;
};

export default function TermsMarkdown({ children }: TermsMarkdownProps) {
  return (
    <ReactMarkdown
      components={{
        h1: ({ children: c, ...props }) => (
          <h1 className="text-3xl font-bold mt-8 mb-4 text-gray-900" {...props}>
            {expandTooltips(c)}
          </h1>
        ),
        h2: ({ children: c, ...props }) => (
          <h2 className="text-2xl font-bold mt-6 mb-3 text-gray-900" {...props}>
            {expandTooltips(c)}
          </h2>
        ),
        h3: ({ children: c, ...props }) => (
          <h3 className="text-xl font-semibold mt-5 mb-2 text-gray-800" {...props}>
            {expandTooltips(c)}
          </h3>
        ),
        p: ({ children: c, ...props }) => (
          <p className="mb-4 text-gray-700 leading-relaxed" {...props}>
            {expandTooltips(c)}
          </p>
        ),
        ul: ({ ...props }) => <ul className="mb-4 ml-6 list-disc" {...props} />,
        li: ({ children: c, ...props }) => (
          <li className="mb-2 text-gray-700" {...props}>
            {expandTooltips(c)}
          </li>
        ),
        strong: ({ children: c, ...props }) => (
          <strong className="font-semibold text-gray-900" {...props}>
            {expandTooltips(c)}
          </strong>
        ),
        hr: ({ ...props }) => <hr className="my-6 border-gray-300" {...props} />,
        a: ({ children: c, ...props }) => (
          <a className="text-blue-600 hover:text-blue-800 underline" {...props}>
            {c}
          </a>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
