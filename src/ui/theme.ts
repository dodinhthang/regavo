import { CIVS, type CivId } from '../game/data.ts';
// All screens share the green/brass shell. Era changes trim, faction changes accents.
const eraTrim = ['#9c8353', '#b3955d', '#c9ac71'];
export const MATERIALS: Record<CivId, string[]> = {
  roman: ['Gỗ & da', 'Đá & đồng', 'Cẩm thạch & vàng'],
  mongol: ['Da & gỗ', 'Nỉ & đồng', 'Nỉ thêu & vàng'],
  persian: ['Đất nện & gỗ', 'Đá cát & men lam', 'Đá chạm & vàng'],
  tang: ['Gỗ & ngói', 'Sơn mài & đồng', 'Ngọc & sơn son'],
  ottoman: ['Gỗ & da', 'Đá & đồng', 'Gỗ óc chó & vàng'],
  daiviet: ['Gỗ & đất nung', 'Gạch & men xanh', 'Sơn son & rồng chạm'],
};
export function themeStyle(civ: CivId, age: number): Record<string, string> {
  const phase = Math.max(1, Math.min(3, Math.round(age)));
  return {
    '--surface': 'var(--ui-panel)',
    '--recess': 'var(--ui-recess)',
    '--ink': 'var(--ui-text)',
    '--hud-muted': 'var(--ui-muted)',
    '--trim': eraTrim[phase - 1],
    '--accent': CIVS[civ].color,
    '--civ-color': CIVS[civ].color,
    '--edge-light': 'var(--ui-raised)',
    '--phase': String(phase),
  };
}
