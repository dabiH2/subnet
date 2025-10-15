export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

/**
 * Build the public share path without forcing a DB migration.
 * Example: /a/123-mit-news-assistant
 */
export function buildAgentSharePath(id: string | number, title: string) {
  return `/a/${id}-${slugify(title)}`;
}
