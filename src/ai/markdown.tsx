// In-house safe Markdown renderer for AI assistant messages.
// Parses markdown into React elements without dangerouslySetInnerHTML.
// Supports bold, bullet & ordered lists, line breaks, simple tables, and escapes HTML tags.
import * as React from 'react';
import { cn } from '../lib/utils';

export interface MarkdownProps {
  text: string;
  className?: string;
}

/** Render inline text styling (bold, inline code, or plain text). */
export function renderInline(text: string): React.ReactNode {
  if (!text) return null;

  // Match bold (**text**) or inline code (`code`)
  const regex = /(\*\*[^*\n]+?\*\*|`[^`\n]+?`)/g;
  const parts = text.split(regex);

  if (parts.length === 1) {
    return text;
  }

  return parts.map((part, i) => {
    if (!part) return null;
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={i} className="font-semibold text-ink">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code key={i} className="rounded bg-surface-raised px-1 py-0.5 font-mono text-body-sm text-ink">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function splitRow(row: string): string[] {
  let s = row.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((c) => c.trim());
}

function isTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes('-')) return false;
  const cells = splitRow(trimmed);
  return cells.length >= 1 && cells.every((c) => /^:?-{2,}:?$/.test(c));
}

type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'bullet-list'; items: string[] }
  | { type: 'ordered-list'; items: string[] }
  | { type: 'quote'; lines: string[] }
  | { type: 'paragraph'; lines: string[] };

function parseBlocks(rawText: string): Block[] {
  const rawLines = rawText.split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < rawLines.length) {
    const line = rawLines[i];
    const trimmed = line.trim();

    // Skip blank lines
    if (trimmed === '') {
      i++;
      continue;
    }

    // Heading: ^(#{1,4})\s+(.*)$
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2],
      });
      i++;
      continue;
    }

    // Table: header row followed by separator row
    if (i + 1 < rawLines.length && isTableSeparator(rawLines[i + 1]) && line.includes('|')) {
      const headers = splitRow(line);
      i += 2; // skip header and separator
      const rows: string[][] = [];
      while (i < rawLines.length) {
        const rowLine = rawLines[i].trim();
        if (rowLine === '' || !rowLine.includes('|')) break;
        rows.push(splitRow(rowLine));
        i++;
      }
      blocks.push({ type: 'table', headers, rows });
      continue;
    }

    // Bullet list item: ^\s*[-*]\s+(.*)$
    const bulletMatch = line.match(/^\s*[-*]\s+(.*)$/);
    if (bulletMatch) {
      const items: string[] = [bulletMatch[1]];
      i++;
      while (i < rawLines.length) {
        const nextMatch = rawLines[i].match(/^\s*[-*]\s+(.*)$/);
        if (!nextMatch) break;
        items.push(nextMatch[1]);
        i++;
      }
      blocks.push({ type: 'bullet-list', items });
      continue;
    }

    // Ordered list item: ^\s*(\d+)\.\s+(.*)$
    const orderedMatch = line.match(/^\s*\d+\.\s+(.*)$/);
    if (orderedMatch) {
      const items: string[] = [orderedMatch[1]];
      i++;
      while (i < rawLines.length) {
        const nextMatch = rawLines[i].match(/^\s*\d+\.\s+(.*)$/);
        if (!nextMatch) break;
        items.push(nextMatch[1]);
        i++;
      }
      blocks.push({ type: 'ordered-list', items });
      continue;
    }

    // Blockquote: ^\s*>\s?(.*)$
    const quoteMatch = line.match(/^\s*>\s?(.*)$/);
    if (quoteMatch) {
      const qLines: string[] = [quoteMatch[1]];
      i++;
      while (i < rawLines.length) {
        const nextQuote = rawLines[i].match(/^\s*>\s?(.*)$/);
        if (!nextQuote) break;
        qLines.push(nextQuote[1]);
        i++;
      }
      blocks.push({ type: 'quote', lines: qLines });
      continue;
    }

    // Paragraph: collect lines until next structural block or blank line
    const pLines: string[] = [line];
    i++;
    while (i < rawLines.length) {
      const nextLine = rawLines[i];
      const nextTrimmed = nextLine.trim();
      if (nextTrimmed === '') break;
      if (nextTrimmed.match(/^#{1,4}\s+/)) break;
      if (nextLine.match(/^\s*[-*]\s+/)) break;
      if (nextLine.match(/^\s*\d+\.\s+/)) break;
      if (nextLine.match(/^\s*>/)) break;
      if (i + 1 < rawLines.length && isTableSeparator(rawLines[i + 1]) && nextLine.includes('|')) break;
      pLines.push(nextLine);
      i++;
    }
    blocks.push({ type: 'paragraph', lines: pLines });
  }

  return blocks;
}

export function Markdown({ text, className }: MarkdownProps) {
  if (!text) return null;
  const blocks = parseBlocks(text);

  return (
    <div className={cn('space-y-2 text-body text-ink', className)}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'heading': {
            if (block.level === 1) {
              return (
                <h1 key={idx} className="text-title-lg font-bold text-ink">
                  {renderInline(block.text)}
                </h1>
              );
            }
            if (block.level === 2) {
              return (
                <h2 key={idx} className="text-title-sm font-semibold text-ink">
                  {renderInline(block.text)}
                </h2>
              );
            }
            return (
              <h3 key={idx} className="text-body font-semibold text-ink">
                {renderInline(block.text)}
              </h3>
            );
          }
          case 'table': {
            return (
              <div key={idx} className="my-2 overflow-x-auto rounded-lg border border-edge">
                <table className="min-w-full border-collapse text-body-sm">
                  <thead className="border-b border-edge bg-surface-raised">
                    <tr>
                      {block.headers.map((h, hIdx) => (
                        <th key={hIdx} className="border-r border-edge px-3 py-2 text-left font-semibold text-ink last:border-r-0">
                          {renderInline(h)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-edge bg-surface">
                    {block.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="even:bg-surface-raised/40">
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="border-r border-edge px-3 py-2 text-ink last:border-r-0">
                            {renderInline(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
          case 'bullet-list': {
            return (
              <ul key={idx} className="my-1.5 ml-4 list-disc space-y-1 text-ink">
                {block.items.map((item, iIdx) => (
                  <li key={iIdx} className="text-body text-ink">
                    {renderInline(item)}
                  </li>
                ))}
              </ul>
            );
          }
          case 'ordered-list': {
            return (
              <ol key={idx} className="my-1.5 ml-4 list-decimal space-y-1 text-ink">
                {block.items.map((item, iIdx) => (
                  <li key={iIdx} className="text-body text-ink">
                    {renderInline(item)}
                  </li>
                ))}
              </ol>
            );
          }
          case 'quote': {
            return (
              <blockquote key={idx} className="my-1.5 border-l-2 border-edge pl-3 italic text-ink-muted">
                {block.lines.map((l, lIdx) => (
                  <React.Fragment key={lIdx}>
                    {lIdx > 0 && <br />}
                    {renderInline(l)}
                  </React.Fragment>
                ))}
              </blockquote>
            );
          }
          case 'paragraph': {
            return (
              <p key={idx} className="leading-relaxed">
                {block.lines.map((l, lIdx) => (
                  <React.Fragment key={lIdx}>
                    {lIdx > 0 && <br />}
                    {renderInline(l)}
                  </React.Fragment>
                ))}
              </p>
            );
          }
        }
      })}
    </div>
  );
}
