import { describe, it, expect } from 'vitest';
import {
  escapeIcsText,
  foldLine,
  formatFloatingDateTime,
  generateWorkoutIcs,
} from './ics';

describe('ICS Generator (RFC 5545)', () => {
  it('escapes commas, semicolons, backslashes, and newlines', () => {
    const raw = 'Push Day: Bench, Squat; 100\\50%\nNext line';
    const escaped = escapeIcsText(raw);
    expect(escaped).toBe('Push Day: Bench\\, Squat\\; 100\\\\50%\\nNext line');
  });

  it('formats local floating DTSTART without UTC "Z" suffix', () => {
    const dtstart = formatFloatingDateTime('2026-10-23', '08:00');
    expect(dtstart).toBe('20261023T080000');
    expect(dtstart.endsWith('Z')).toBe(false);
    expect(formatFloatingDateTime('2026-10-23', '')).toBe('20261023T080000');
    expect(formatFloatingDateTime('2026-10-23', '   ')).toBe('20261023T080000');
    expect(formatFloatingDateTime('2026-10-23')).toBe('20261023T080000');
  });

  it('folds lines at 75 octets without breaking UTF-8 characters', () => {
    // 80 characters of ASCII -> 80 bytes
    const asciiLine = 'DESCRIPTION:' + 'A'.repeat(70); // 12 + 70 = 82 bytes
    const folded = foldLine(asciiLine);
    const lines = folded.split('\r\n');
    expect(lines.length).toBe(2);
    // Line 1 <= 75 bytes
    expect(new TextEncoder().encode(lines[0]).length).toBeLessThanOrEqual(75);
    // Line 2 starts with space
    expect(lines[1].startsWith(' ')).toBe(true);
    expect(new TextEncoder().encode(lines[1]).length).toBeLessThanOrEqual(75);

    // Multibyte characters (e.g. emoji: 4 bytes each)
    const emojiLine = 'SUMMARY:' + '🏋️‍♂️'.repeat(20);
    const foldedEmoji = foldLine(emojiLine);
    for (const l of foldedEmoji.split('\r\n')) {
      expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    }
  });

  it('generates a full .ics document with CRLF, UID, DTSTART, VALARM, and proper structure', () => {
    const ics = generateWorkoutIcs({
      uid: 'plan-1234@workoutapp',
      title: 'Heavy Push, Day A; special',
      description: 'Bench Press, Incline DB, Triceps',
      dateKey: '2026-10-23',
      reminderTime: '08:00',
      durationMinutes: 60,
      dtstamp: '20261022T140000Z',
    });

    // Check CRLF endings on all lines
    expect(ics.includes('\r\n')).toBe(true);
    const lines = ics.split('\r\n');
    // Ensure no lone \n without \r
    expect(ics.replace(/\r\n/g, '').includes('\n')).toBe(false);

    // VCALENDAR wrapper
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines[1]).toBe('VERSION:2.0');
    expect(lines[2]).toBe('PRODID:-//Workout App//Plan Ahead//EN');

    // VEVENT
    expect(ics).toContain('BEGIN:VEVENT\r\n');
    expect(ics).toContain('UID:plan-1234@workoutapp\r\n');
    expect(ics).toContain('DTSTAMP:20261022T140000Z\r\n');
    expect(ics).toContain('DTSTART:20261023T080000\r\n');
    expect(ics).toContain('DURATION:PT60M\r\n');
    expect(ics).toContain('SUMMARY:Heavy Push\\, Day A\\; special\r\n');
    expect(ics).toContain('DESCRIPTION:Bench Press\\, Incline DB\\, Triceps\r\n');

    // VALARM
    expect(ics).toContain('BEGIN:VALARM\r\n');
    expect(ics).toContain('ACTION:DISPLAY\r\n');
    expect(ics).toContain('DESCRIPTION:Reminder\r\n');
    expect(ics).toContain('TRIGGER:PT0M\r\n');
    expect(ics).toContain('END:VALARM\r\n');

    expect(ics).toContain('END:VEVENT\r\n');
    expect(ics).toContain('END:VCALENDAR\r\n');
  });
});
