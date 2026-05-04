import { describe, it, expect } from 'vitest';
import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  CardFooter,
  cardVariants,
} from '@/components/ui/card';

describe('Card', () => {
  it('renders a <div> with default elevation 1 (shadow-e1)', () => {
    render(<Card data-testid="card">content</Card>);
    const card = screen.getByTestId('card');
    expect(card.tagName).toBe('DIV');
    expect(card.className).toMatch(/shadow-e1/);
  });

  it('applies base surface + radius classes by default', () => {
    render(<Card data-testid="card">content</Card>);
    const card = screen.getByTestId('card');
    expect(card.className).toMatch(/bg-surface-raised/);
    expect(card.className).toMatch(/rounded-lg/);
  });

  it('applies elevation 0 -> shadow-e0', () => {
    render(
      <Card data-testid="card" elevation={0}>
        x
      </Card>,
    );
    expect(screen.getByTestId('card').className).toMatch(/shadow-e0/);
  });

  it('applies elevation 1 -> shadow-e1', () => {
    render(
      <Card data-testid="card" elevation={1}>
        x
      </Card>,
    );
    expect(screen.getByTestId('card').className).toMatch(/shadow-e1/);
  });

  it('applies elevation 2 -> shadow-e2', () => {
    render(
      <Card data-testid="card" elevation={2}>
        x
      </Card>,
    );
    expect(screen.getByTestId('card').className).toMatch(/shadow-e2/);
  });

  it('applies elevation 3 -> shadow-e3', () => {
    render(
      <Card data-testid="card" elevation={3}>
        x
      </Card>,
    );
    expect(screen.getByTestId('card').className).toMatch(/shadow-e3/);
  });

  it('forwards ref to the underlying <div>', () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Card ref={ref} data-testid="card">
        x
      </Card>,
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current?.tagName).toBe('DIV');
  });

  it('merges consumer className via tailwind-merge (custom bg wins)', () => {
    render(
      <Card data-testid="card" className="bg-blue-500">
        x
      </Card>,
    );
    const card = screen.getByTestId('card');
    expect(card.className).toMatch(/bg-blue-500/);
    const tokens = card.className.split(/\s+/);
    expect(tokens).not.toContain('bg-surface-raised');
  });

  it('forwards arbitrary div props (e.g. id, role)', () => {
    render(
      <Card id="card-1" role="region" aria-label="test" data-testid="card">
        x
      </Card>,
    );
    const card = screen.getByTestId('card');
    expect(card).toHaveAttribute('id', 'card-1');
    expect(card).toHaveAttribute('role', 'region');
    expect(card).toHaveAttribute('aria-label', 'test');
  });
});

describe('CardHeader', () => {
  it('renders a <div> and accepts className', () => {
    render(
      <CardHeader data-testid="header" className="extra">
        h
      </CardHeader>,
    );
    const el = screen.getByTestId('header');
    expect(el.tagName).toBe('DIV');
    expect(el.className).toMatch(/extra/);
  });

  it('forwards ref to <div>', () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <CardHeader ref={ref} data-testid="header">
        h
      </CardHeader>,
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});

describe('CardTitle', () => {
  it('renders an <h3> and accepts className', () => {
    render(
      <CardTitle data-testid="title" className="extra">
        Title
      </CardTitle>,
    );
    const el = screen.getByTestId('title');
    expect(el.tagName).toBe('H3');
    expect(el.className).toMatch(/extra/);
  });

  it('forwards ref to the heading', () => {
    const ref = createRef<HTMLHeadingElement>();
    render(
      <CardTitle ref={ref} data-testid="title">
        Title
      </CardTitle>,
    );
    expect(ref.current).toBeInstanceOf(HTMLHeadingElement);
    expect(ref.current?.tagName).toBe('H3');
  });
});

describe('CardBody', () => {
  it('renders a <div> and accepts className', () => {
    render(
      <CardBody data-testid="body" className="extra">
        b
      </CardBody>,
    );
    const el = screen.getByTestId('body');
    expect(el.tagName).toBe('DIV');
    expect(el.className).toMatch(/extra/);
  });

  it('forwards ref to <div>', () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <CardBody ref={ref} data-testid="body">
        b
      </CardBody>,
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});

describe('CardFooter', () => {
  it('renders a <div> and accepts className', () => {
    render(
      <CardFooter data-testid="footer" className="extra">
        f
      </CardFooter>,
    );
    const el = screen.getByTestId('footer');
    expect(el.tagName).toBe('DIV');
    expect(el.className).toMatch(/extra/);
  });

  it('forwards ref to <div>', () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <CardFooter ref={ref} data-testid="footer">
        f
      </CardFooter>,
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it('uses flex layout for action rows', () => {
    render(<CardFooter data-testid="footer">f</CardFooter>);
    const el = screen.getByTestId('footer');
    expect(el.className).toMatch(/flex/);
  });
});

describe('Card composition', () => {
  it('renders Card + Header + Title + Body + Footer with correct text', () => {
    render(
      <Card data-testid="card">
        <CardHeader>
          <CardTitle>Title X</CardTitle>
        </CardHeader>
        <CardBody>Body Y</CardBody>
        <CardFooter>Footer Z</CardFooter>
      </Card>,
    );
    expect(screen.getByText('Title X').tagName).toBe('H3');
    expect(screen.getByText('Body Y')).toBeInTheDocument();
    expect(screen.getByText('Footer Z')).toBeInTheDocument();
  });
});

describe('cardVariants', () => {
  it('is exported and callable, returning class string with elevation shadow', () => {
    expect(typeof cardVariants).toBe('function');
    const cls = cardVariants({ elevation: 2 });
    expect(typeof cls).toBe('string');
    expect(cls).toMatch(/shadow-e2/);
    expect(cls).toMatch(/bg-surface-raised/);
  });

  it('defaults to elevation 1 when called with no args', () => {
    const cls = cardVariants();
    expect(cls).toMatch(/shadow-e1/);
  });
});
