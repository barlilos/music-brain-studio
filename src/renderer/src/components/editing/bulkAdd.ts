/**
 * Turning a typed block of text into a list of titles.
 *
 * Its own module so it can be tested without rendering a dialog, and so the
 * dialog file exports only a component.
 */

/**
 * One title per line: trimmed, blanks dropped, order preserved.
 *
 * Blank lines are discarded rather than rejected because they are how people
 * actually type a list — a trailing newline, a gap between two groups — and
 * refusing the paste over them would be pedantry. Order is preserved because a
 * set list is an order, and sorting it would be the application deciding it
 * knows better.
 *
 * `\r\n` is handled explicitly: this is a Windows application, and text pasted
 * from a text editor arrives with carriage returns that would otherwise end up
 * inside every title.
 */
export function parseBulkLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}
