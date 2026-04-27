import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('alias', () => {
  it('resolves @/* to src/*', () => {
    expect(cn('a', false && 'b', 'c')).toBe('a c');
  });
});
