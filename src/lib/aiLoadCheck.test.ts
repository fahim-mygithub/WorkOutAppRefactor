import { describe, it, expect } from 'vitest';
import { checkProposedLoad } from './aiLoadCheck';

describe('checkProposedLoad', () => {
  it('keeps an on-step load inside the band', () => {
    expect(checkProposedLoad(205, 225, 'lb')).toEqual({ ok: true, value: 205, snapped: false });
  });
  it('snaps an off-step load', () => {
    expect(checkProposedLoad(207, 225, 'lb')).toEqual({ ok: true, value: 205, snapped: true });
    expect(checkProposedLoad(83, 90, 'lb', 10)).toEqual({ ok: true, value: 80, snapped: true });
  });
  it('rejects loads more than 30% from the reference', () => {
    expect(checkProposedLoad(150, 225, 'lb')).toMatchObject({ ok: false });
    expect(checkProposedLoad(300, 225, 'lb')).toMatchObject({ ok: false });
  });
  it('only rounds when there is no reference', () => {
    expect(checkProposedLoad(47, null, 'kg')).toEqual({ ok: true, value: 47.5, snapped: true });
  });
  it('rejects non-positive loads', () => {
    expect(checkProposedLoad(0, 100, 'lb')).toMatchObject({ ok: false });
  });
});
