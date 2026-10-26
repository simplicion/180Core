export function slugify(text: string): string {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // remove non-word chars except space and dash
    .replace(/[\s_-]+/g, '-') // replace spaces, underscores, dashes with single dash
    .replace(/^-+|-+$/g, ''); // trim leading/trailing dashes
}

export function getAppSlug(app?: { id?: string; name?: string } | null): string {
  if (!app) return '';
  return slugify(app.name || '') || app.id || '';
}
