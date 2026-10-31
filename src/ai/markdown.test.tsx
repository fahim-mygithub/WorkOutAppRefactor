import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Markdown } from './markdown';

describe('Markdown', () => {
  it('renders bold formatting with proper classes', () => {
    const { container } = render(<Markdown text="Here is **important information** for you." />);
    const strong = container.querySelector('strong');
    expect(strong).not.toBeNull();
    expect(strong?.textContent).toBe('important information');
    expect(strong?.className).toContain('font-semibold');
    expect(strong?.className).toContain('text-ink');
    expect(container.textContent).toBe('Here is important information for you.');
  });

  it('renders bullet lists using - or * markers', () => {
    const md = '- Bench Press 3x5\n* Overhead Press 3x8\n- Barbell Row 3x10';
    const { container } = render(<Markdown text={md} />);
    const ul = container.querySelector('ul');
    expect(ul).not.toBeNull();
    const items = container.querySelectorAll('li');
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toBe('Bench Press 3x5');
    expect(items[1].textContent).toBe('Overhead Press 3x8');
    expect(items[2].textContent).toBe('Barbell Row 3x10');
  });

  it('renders ordered lists with 1. 2. markers', () => {
    const md = '1. Warm up for 5 minutes\n2. Do 3 working sets\n3. Cool down';
    const { container } = render(<Markdown text={md} />);
    const ol = container.querySelector('ol');
    expect(ol).not.toBeNull();
    const items = container.querySelectorAll('li');
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toBe('Warm up for 5 minutes');
    expect(items[1].textContent).toBe('Do 3 working sets');
    expect(items[2].textContent).toBe('Cool down');
  });

  it('renders line breaks within a paragraph and separate paragraphs on empty lines', () => {
    const md = 'First line\nSecond line with break\n\nNew paragraph here';
    const { container } = render(<Markdown text={md} />);
    const paragraphs = container.querySelectorAll('p');
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0].querySelector('br')).not.toBeNull();
    expect(paragraphs[0].textContent).toBe('First lineSecond line with break');
    expect(paragraphs[1].textContent).toBe('New paragraph here');
  });

  it('renders markdown tables with headers, rows and design tokens', () => {
    const md = `| Date | Exercise | Weight |
| --- | --- | --- |
| 2026-10-20 | **Bench Press** | 225 lbs |
| 2026-10-22 | Squat | 315 lbs |`;
    const { container } = render(<Markdown text={md} />);
    const table = container.querySelector('table');
    expect(table).not.toBeNull();
    const headers = container.querySelectorAll('th');
    expect(headers).toHaveLength(3);
    expect(headers[0].textContent).toBe('Date');
    expect(headers[1].textContent).toBe('Exercise');
    expect(headers[2].textContent).toBe('Weight');

    const rows = container.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(2);

    const firstRowCells = rows[0].querySelectorAll('td');
    expect(firstRowCells[0].textContent).toBe('2026-10-20');
    expect(firstRowCells[1].querySelector('strong')?.textContent).toBe('Bench Press');
    expect(firstRowCells[2].textContent).toBe('225 lbs');

    // Token checks
    expect(headers[0].className).toContain('text-ink');
    expect(headers[0].className).toContain('border-edge');
    expect(container.querySelector('thead')?.className).toContain('bg-surface-raised');
    expect(container.querySelector('tbody')?.className).toContain('bg-surface');
  });

  it('escapes <script> tags and arbitrary HTML safely without executing or creating elements', () => {
    const md = "Malicious payload: <script>alert('xss')</script> and <img src=x onerror=evil() />";
    const { container } = render(<Markdown text={md} />);

    // Must NOT create script or img DOM nodes
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();

    // Renders the literal text safely
    expect(container.textContent).toContain("<script>alert('xss')</script>");
    expect(container.textContent).toContain('<img src=x onerror=evil() />');
  });

  it('renders headings cleanly', () => {
    const md = '# Title\n## Subtitle\n### Section';
    const { container } = render(<Markdown text={md} />);
    expect(container.querySelector('h1')?.textContent).toBe('Title');
    expect(container.querySelector('h2')?.textContent).toBe('Subtitle');
    expect(container.querySelector('h3')?.textContent).toBe('Section');
  });

  it('handles empty or blank text gracefully', () => {
    const { container } = render(<Markdown text="" />);
    expect(container.firstChild).toBeNull();
  });
});
