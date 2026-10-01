/**
 * Return-to-page after login. A merchant whose session lapses while opening an
 * order from a notification should land back on that order, not the
 * dashboard.
 */

/** `/login?next=<path>` for the page being left. */
export function loginPath(pathname: string, search = ""): string {
  if (pathname === "/" || pathname === "/login") return "/login";
  return `/login?next=${encodeURIComponent(pathname + search)}`;
}

/** `next` only when it is a path on this site — never `//host` or `/\host`,
 *  which browsers treat as another origin (open redirect). */
export function safeNext(next: string | null | undefined): string {
  return next && /^\/(?![/\\])/.test(next) ? next : "/";
}
