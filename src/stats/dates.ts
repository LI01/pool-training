const pad = (n: number) => String(n).padStart(2, '0');
export const localDate = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const utc = (date: string) => { const [y, m, d] = date.split('-').map(Number); return Date.UTC(y, m - 1, d); };
export const daysBetween = (a: string, b: string): number => Math.round((utc(b) - utc(a)) / 86400000);
export const addDays = (date: string, n: number): string => {
  const d = new Date(utc(date) + n * 86400000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
