/**
 * Turning a typed block of text into a list of titles.
 *
 * In `shared` rather than beside the dialog because it is domain logic, not
 * presentation: it decides what the user meant, and both the renderer that
 * collects the text and the tests that exercise capture end to end need the same
 * answer. Nothing here renders anything.
 *
 * Isomorphic: no React, no DOM, no Node.
 */

/**
 * One title per line: trimmed, blanks dropped, order preserved.
 *
 * Blank lines are discarded rather than rejected because they are how people
 * actually type a list — a trailing newline, a gap between two groups — and
 * refusing the paste over them would be pedantry. Order is preserved because a
 * set list is an order, and sorting it would be the application deciding it
 * knows better than the person who typed it.
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
