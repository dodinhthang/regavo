export type CarryResource = 'food' | 'meat' | 'wood' | 'gold' | 'stone' | 'generic';

/** Shared by all faction renderers; the engine supplies the held load, not the next job. */
export function carryResource(activity: string): CarryResource {
  const value = activity.toLowerCase();
  if (/meat|hunt|deer|boar/.test(value)) return 'meat';
  if (/wood|chop|tree|lumber|timber/.test(value)) return 'wood';
  if (value.includes('gold')) return 'gold';
  if (value.includes('stone')) return 'stone';
  if (/food|harvest|grain|berry|berries|farm/.test(value)) return 'food';
  return 'generic';
}
