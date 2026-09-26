import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('alias', () => {
  it('resolves @/* to src/*', () => {
    expect(cn('a', false && 'b', 'c')).toBe('a c');
  });
});

describe('framer-motion', () => {
  // Cold-transforming framer-motion competes with the whole parallel suite and
  // can exceed the 5s default on a loaded machine; this asserts resolution,
  // not speed, so give it headroom.
  it('imports', async () => {
    const { motion } = await import('framer-motion');
    expect(motion.div).toBeDefined();
  }, 20_000);
});
