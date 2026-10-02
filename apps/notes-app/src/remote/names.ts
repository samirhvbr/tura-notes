/**
 * The path a person typed for a remote note, as the server needs it.
 *
 * The server only takes Markdown notes, so a name without `.md` used to be
 * refused with a warning that asked the person to type the extension, which
 * the application could have added itself. Now it is added: `ideas/today`
 * becomes `ideas/today.md`, and a name that already ends in `.md` or
 * `.markdown` (in any case) is left as it is.
 *
 * What is still refused is what has no right answer: nothing typed, a name
 * ending in `/` (a folder, not a note), and `.` or `..` segments. A leading
 * `/` is dropped, since every remote path is relative to the folder's root.
 * The server checks the rest, such as names illegal on another platform, and
 * says so.
 */
export function remoteNotePath(typed: string): string | null {
  const path = typed.trim().replace(/^\/+/, "");
  if (!path || path.endsWith("/")) return null;
  const segments = path.split("/");
  if (segments.some((s) => !s.trim() || s === "." || s === "..")) return null;
  return /\.(md|markdown)$/i.test(path) ? path : `${path}.md`;
}
