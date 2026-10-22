/**
 * Pure iCalendar (.ics) generator conforming to RFC 5545.
 *
 * Requirements:
 * - CRLF (\r\n) line endings on every line
 * - Stable/explicit UID
 * - DTSTART local floating time (YYYYMMDDTHHMMSS, no trailing 'Z')
 * - VALARM with TRIGGER:PT0M at the reminder time
 * - Text escaping for commas, semicolons, backslashes, and newlines
 * - Line folding at 75 octets (UTF-8 byte length safe)
 */

export interface WorkoutIcsOptions {
  uid: string;
  title: string;
  description?: string;
  dateKey: string; // 'YYYY-MM-DD'
  reminderTime?: string; // 'HH:mm' (defaults to '08:00')
  durationMinutes?: number;
  dtstamp?: string; // Optional override for deterministic tests
}

/** Escapes special characters in RFC 5545 TEXT properties. */
export function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Folds a single line so that no line exceeds 75 octets (UTF-8 bytes).
 * Continuation lines start with a single whitespace (space ' ').
 */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const totalBytes = encoder.encode(line).length;
  if (totalBytes <= 75) return line;

  const parts: string[] = [];
  let start = 0;
  let isFirst = true;

  while (start < line.length) {
    const maxBytes = isFirst ? 75 : 74; // Account for the leading space on continuation lines
    let end = start;
    let currentBytes = 0;

    while (end < line.length) {
      // Check surrogate pairs so characters aren't split across code units
      const code = line.charCodeAt(end);
      const charLen = code >= 0xd800 && code <= 0xdbff && end + 1 < line.length ? 2 : 1;
      const charBytes = encoder.encode(line.slice(end, end + charLen)).length;

      if (currentBytes + charBytes > maxBytes) {
        break;
      }
      currentBytes += charBytes;
      end += charLen;
    }

    // Ensure forward progress in edge cases
    if (end === start) {
      const code = line.charCodeAt(start);
      end += code >= 0xd800 && code <= 0xdbff && start + 1 < line.length ? 2 : 1;
    }

    const chunk = line.slice(start, end);
    parts.push(isFirst ? chunk : ` ${chunk}`);
    start = end;
    isFirst = false;
  }

  return parts.join('\r\n');
}

/**
 * Converts a dateKey ('YYYY-MM-DD') and reminderTime ('HH:mm') to local floating DTSTART.
 * Example: '2026-10-23', '08:00' -> '20261023T080000'. No 'Z' suffix.
 */
export function formatFloatingDateTime(dateKey: string, reminderTime?: string): string {
  const [y, m, d] = dateKey.split('-').map((s) => s.padStart(2, '0'));
  const safeTime = reminderTime && reminderTime.trim().length > 0 ? reminderTime.trim() : '08:00';
  const [hh = '08', mm = '00'] = safeTime.split(':').map((s) => s.padStart(2, '0'));
  return `${y}${m}${d}T${hh}${mm}00`;
}

/**
 * Formats a Date object to RFC 5545 UTC timestamp (for DTSTAMP).
 * Example: '20261022T184500Z'.
 */
export function formatUtcDateTime(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  return `${y}${m}${d}T${hh}${mm}${ss}Z`;
}

/**
 * Generates an RFC 5545 .ics calendar string for a planned workout.
 */
export function generateWorkoutIcs(options: WorkoutIcsOptions): string {
  const {
    uid,
    title,
    description,
    dateKey,
    reminderTime,
    durationMinutes = 60,
    dtstamp = formatUtcDateTime(new Date()),
  } = options;

  const dtstart = formatFloatingDateTime(dateKey, reminderTime);
  const duration = `PT${durationMinutes}M`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Workout App//Plan Ahead//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DURATION:${duration}`,
    `SUMMARY:${escapeIcsText(title)}`,
    ...(description ? [`DESCRIPTION:${escapeIcsText(description)}`] : []),
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder',
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.map(foldLine).join('\r\n') + '\r\n';
}

/**
 * Triggers a browser download of an .ics file with the given content.
 */
export function downloadIcsFile(filename: string, content: string): void {
  const name = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
