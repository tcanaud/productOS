'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

/**
 * Renders markdown text with chat-friendly styling.
 * Supports GFM (tables, strikethrough, task lists, autolinks).
 */
export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <ReactMarkdown
      className={className}
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em>{children}</em>,
        del: ({ children }) => <del className="line-through opacity-60">{children}</del>,
        code: ({ children, className: codeClassName }) => {
          const isBlock = codeClassName?.includes('language-');
          if (isBlock) {
            return (
              <code className="block my-2 rounded bg-muted px-3 py-2 text-xs font-mono overflow-x-auto whitespace-pre">
                {children}
              </code>
            );
          }
          return <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">{children}</code>;
        },
        pre: ({ children }) => <>{children}</>,
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 text-primary hover:text-primary/80"
          >
            {children}
          </a>
        ),
        ul: ({ children }) => <ul className="mb-2 ml-4 list-disc last:mb-0">{children}</ul>,
        ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal last:mb-0">{children}</ol>,
        li: ({ children }) => <li className="mb-0.5">{children}</li>,
        input: ({ checked }) => (
          <input type="checkbox" checked={checked} disabled className="mr-1.5 align-middle" />
        ),
        h1: ({ children }) => <p className="mb-1 text-base font-bold">{children}</p>,
        h2: ({ children }) => <p className="mb-1 font-bold">{children}</p>,
        h3: ({ children }) => <p className="mb-1 font-semibold">{children}</p>,
        h4: ({ children }) => <p className="mb-1 font-medium">{children}</p>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-border pl-3 italic mb-2 last:mb-0">
            {children}
          </blockquote>
        ),
        table: ({ children }) => (
          <div className="my-2 overflow-x-auto rounded border border-border last:mb-0">
            <table className="w-full text-xs">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-muted/60 font-semibold">{children}</thead>,
        tbody: ({ children }) => <tbody>{children}</tbody>,
        tr: ({ children }) => <tr className="border-b border-border last:border-0">{children}</tr>,
        th: ({ children }) => <th className="px-2 py-1.5 text-left font-semibold">{children}</th>,
        td: ({ children }) => <td className="px-2 py-1.5">{children}</td>,
        hr: () => <hr className="my-2 border-border" />,
        img: ({ src, alt }) => (
          <img src={src} alt={alt ?? ''} className="my-2 max-w-full rounded" />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
