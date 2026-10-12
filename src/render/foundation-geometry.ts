export type FoundationCorners = readonly [number, number, number, number, number, number];

/** Align the two visible ground faces without tilting the building's vertical columns. */
export function foundationProjection(foundation: FoundationCorners, size: number) {
  const [lx, ly, rx, ry, fx, fy] = foundation;
  if (size <= 0 || fx <= lx || fx >= rx || fy <= Math.max(ly, ry))
    throw new Error('Invalid building foundation');
  const halfWidth = size * 32,
    halfDepth = size * 16,
    d = (halfWidth * 2) / (rx - lx),
    leftA = halfWidth / (fx - lx),
    rightA = halfWidth / (rx - fx),
    leftB = (halfDepth - d * (fy - ly)) / (fx - lx),
    rightB = (-halfDepth - d * (ry - fy)) / (rx - fx);
  const segments = [
    { a: leftA, b: leftB, d, tx: -leftA * fx, ty: halfDepth - leftB * fx - d * fy },
    { a: rightA, b: rightB, d, tx: -rightA * fx, ty: halfDepth - rightB * fx - d * fy },
  ] as const;
  const project = (x: number, y: number): [number, number] => {
    const m = segments[x <= fx ? 0 : 1];
    return [m.a * x + m.tx, m.b * x + m.d * y + m.ty];
  };
  const footprint: readonly [number, number][] = [
    [0, -halfDepth],
    [halfWidth, 0],
    [0, halfDepth],
    [-halfWidth, 0],
  ];
  return { project, segments, splitX: fx, footprint };
}
