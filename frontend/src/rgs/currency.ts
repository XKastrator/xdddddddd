/**
 * Currency display per the Stake Engine RGS spec: monetary values are integers
 * with six decimal places (1_000_000 == 1.00). Currency affects the display
 * layer only — never gameplay logic.
 */
export interface CurrencyMeta { symbol: string; decimals: number; symbolAfter?: boolean; }

export const CURRENCY_META: Record<string, CurrencyMeta> = {
  USD: { symbol: '$', decimals: 2 }, CAD: { symbol: 'CA$', decimals: 2 },
  JPY: { symbol: '¥', decimals: 0 }, EUR: { symbol: '€', decimals: 2 },
  RUB: { symbol: '₽', decimals: 2 }, CNY: { symbol: 'CN¥', decimals: 2 },
  PHP: { symbol: '₱', decimals: 2 }, INR: { symbol: '₹', decimals: 2 },
  IDR: { symbol: 'Rp', decimals: 0 }, KRW: { symbol: '₩', decimals: 0 },
  BRL: { symbol: 'R$', decimals: 2 }, MXN: { symbol: 'MX$', decimals: 2 },
  DKK: { symbol: 'KR', decimals: 2, symbolAfter: true },
  PLN: { symbol: 'zł', decimals: 2, symbolAfter: true },
  VND: { symbol: '₫', decimals: 0, symbolAfter: true },
  TRY: { symbol: '₺', decimals: 2 },
  CLP: { symbol: 'CLP', decimals: 0, symbolAfter: true },
  ARS: { symbol: 'ARS', decimals: 2, symbolAfter: true },
  PEN: { symbol: 'S/', decimals: 2, symbolAfter: true },
  XGC: { symbol: 'GC', decimals: 2 }, XSC: { symbol: 'SC', decimals: 2 },
};

const UNITS = 1_000_000;

/** Format an integer 6-dp amount for display. */
export function formatMoney(amountUnits: number, currency: string): string {
  const meta = CURRENCY_META[currency] ?? { symbol: currency, decimals: 2, symbolAfter: true };
  const value = (amountUnits / UNITS).toFixed(meta.decimals);
  return meta.symbolAfter ? `${value} ${meta.symbol}` : `${meta.symbol}${value}`;
}
