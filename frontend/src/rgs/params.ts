/**
 * Read launch parameters from the game URL, per the Stake Engine RGS spec:
 *   ...index.html?sessionID=...&lang=...&device=...&rgs_url=...
 * `rgs_url` must NOT be hardcoded — it can change dynamically.
 */
export interface LaunchParams {
  sessionID: string;
  lang: string;
  device: 'mobile' | 'desktop';
  rgsUrl: string;
}

/**
 * Turn whatever arrives in `rgs_url` into an ABSOLUTE base URL.
 *
 * This is not defensive tidying — it is the difference between the game working
 * and not. `rgs_url` is delivered without a scheme, so using it raw makes
 * `fetch('some.host/wallet/authenticate')` a RELATIVE url: the browser resolves
 * it against the page, the POST lands on the static host the game itself was
 * served from, and that host answers **405 Method Not Allowed**. The error says
 * nothing about a URL, so it reads like a broken API rather than a broken path.
 *
 * The page's own protocol is used rather than a hardcoded `https:` so the same
 * code path is exercisable over plain HTTP in tests.
 */
export function normalizeRgsUrl(raw: string, pageProtocol = location.protocol): string {
  const s = raw.trim();
  if (!s) return '';
  const withScheme = /^https?:\/\//i.test(s) ? s
    : s.startsWith('//') ? `${pageProtocol}${s}`
      : `${pageProtocol}//${s}`;
  try {
    const u = new URL(withScheme);
    // endpoint paths are appended as `/wallet/...`, so the base must not end
    // in a slash or every request would carry a double slash
    return (u.origin + u.pathname).replace(/\/+$/, '');
  } catch {
    return '';
  }
}

export function readLaunchParams(search: string = location.search): LaunchParams {
  const q = new URLSearchParams(search);
  const device = (q.get('device') === 'mobile' ? 'mobile' : 'desktop') as
    'mobile' | 'desktop';
  return {
    sessionID: q.get('sessionID') ?? '',
    lang: q.get('lang') ?? 'en',
    device,
    rgsUrl: normalizeRgsUrl(q.get('rgs_url') ?? ''),
  };
}
