export type WalkCalibration = {
  sourceHeight: number;
  pivotX: number;
  bodyWidth: number;
  referenceBodyWidth: number;
  referenceHeight: number;
  luma: number[];
  referenceLuma: number[];
  saturation: number;
  identity: boolean;
};
export type WalkAnchor = Pick<
  WalkCalibration,
  'sourceHeight' | 'pivotX' | 'bodyWidth' | 'referenceBodyWidth' | 'referenceHeight'
>;

export type WorkerCalibration = {
  sourceHeight: number;
  referenceHeight: number;
  referenceHeadSize: number;
  headSize: number;
};

/** Keep anatomy uniform while bent/kneeling poses retain their shorter silhouette. */
export function workingGeometry(
  frame: readonly number[],
  height: number,
  profile: WorkerCalibration,
) {
  const scale = (height * profile.referenceHeadSize) / (profile.referenceHeight * profile.headSize);
  return { scale, scaleX: scale, anchorX: frame[4], anchorY: frame[5] };
}

/** Whole silhouettes share a fixed height and body pivot, independent of atlas position. */
export function walkingGeometry(frame: readonly number[], height: number, profile: WalkAnchor) {
  return {
    scale: height / frame[3],
    scaleX: (height * profile.referenceBodyWidth) / (profile.referenceHeight * profile.bodyWidth),
    anchorX: profile.pivotX,
    anchorY: frame[5],
  };
}

export function calibratedLuminance(value: number, profile: WalkCalibration) {
  let segment = 1;
  while (segment < profile.luma.length - 1 && value > profile.luma[segment]) segment++;
  const low = segment - 1;
  const fraction = (value - profile.luma[low]) / (profile.luma[segment] - profile.luma[low]);
  return (
    profile.referenceLuma[low] +
    fraction * (profile.referenceLuma[segment] - profile.referenceLuma[low])
  );
}

const lookupTables = new WeakMap<WalkCalibration, Float32Array>();

/** Preserve alpha and hue while matching the contact A lighting and saturation. */
export function calibrateWalkPixels(data: Uint8ClampedArray, profile: WalkCalibration) {
  if (profile.identity) return;
  let lut = lookupTables.get(profile);
  if (!lut) {
    lut = Float32Array.from({ length: 256 }, (_, i) => calibratedLuminance(i, profile));
    lookupTables.set(profile, lut);
  }
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue;
    const y = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    const low = Math.floor(y),
      high = Math.min(255, low + 1);
    const mapped = lut[low] + (y - low) * (lut[high] - lut[low]);
    const gain = mapped / Math.max(1, y);
    for (let channel = 0; channel < 3; channel++)
      data[i + channel] = (y + profile.saturation * (data[i + channel] - y)) * gain;
  }
}

/** Calibrate an isolated native-resolution frame once, before caching its rendered sprite. */
export function calibrateWalkFrame(canvas: HTMLCanvasElement, profile: WalkCalibration) {
  if (profile.identity) return canvas;
  const context = canvas.getContext('2d')!;
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  calibrateWalkPixels(pixels.data, profile);
  context.putImageData(pixels, 0, 0);
  return canvas;
}
