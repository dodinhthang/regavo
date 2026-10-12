import type { Entity } from '../game/types.ts';

/** Cargo is visible only during the engine's actual trip to a drop-off. A partly
 * filled inventory while working, waiting or moving elsewhere still uses tools. */
export function entityAppearance(e: Entity, target?: Entity): { action: string; activity: string } {
  if (e.state === 'packed') return { action: e.path.length ? 'walk' : 'idle', activity: '' };
  if (
    e.kind === 'unit' &&
    e.returning &&
    e.carry > 0 &&
    ['villager', 'engineer'].includes(e.type)
  ) {
    return {
      action: 'carry',
      activity: e.carryType === 'food' && e.carryMeat ? 'meat' : (e.carryType ?? 'food'),
    };
  }
  const order = e.orders[0];
  const activity =
    order?.kind === 'build' || order?.kind === 'repair'
      ? 'build'
      : target?.type === 'tree'
        ? 'chop'
        : target?.type === 'gold' || target?.type === 'stone'
          ? 'mine'
          : target?.kind === 'animal'
            ? target.alive
              ? 'hunt'
              : 'harvest'
            : 'harvest';
  return { action: e.state, activity };
}
