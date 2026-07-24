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

export function readLaunchParams(search: string = location.search): LaunchParams {
  const q = new URLSearchParams(search);
  const device = (q.get('device') === 'mobile' ? 'mobile' : 'desktop') as
    'mobile' | 'desktop';
  return {
    sessionID: q.get('sessionID') ?? '',
    lang: q.get('lang') ?? 'en',
    device,
    rgsUrl: q.get('rgs_url') ?? '',
  };
}
