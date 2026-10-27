// Public identity uses the existing update_league allow-list. It never changes
// visibility, status, account rights or the canonical address.
export function safeLeagueLogo(value) {
  if (!value) return null;
  try {
    const url = new URL(String(value));
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function leagueIdentityFields(input = {}) {
  const name = String(input.name ?? '').trim();
  const shortName = String(input.shortName ?? '').trim();
  const description = String(input.description ?? '').trim();
  const logo = String(input.logoUrl ?? '').trim();
  const color = String(input.color ?? '').trim();
  if (name.length < 2 || name.length > 80) return { error: 'name' };
  if (shortName.length > 24) return { error: 'shortName' };
  if (description.length > 2000) return { error: 'description' };
  if (!/^#[0-9a-f]{6}$/i.test(color)) return { error: 'color' };
  if (logo && (logo.length > 2048 || !safeLeagueLogo(logo))) return { error: 'logoUrl' };
  return { data: { name, short_name: shortName || null, description: description || null,
    logo_url: logo ? safeLeagueLogo(logo) : null, color: color.toUpperCase() } };
}

export function leagueMonogram(name) {
  return String(name || '').trim().split(/\s+/).filter(Boolean).map(word => Array.from(word)[0]).slice(0, 3).join('').toUpperCase() || '—';
}
