import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  walkingGeometry,
  workingGeometry,
  calibrateWalkPixels,
  type WalkCalibration,
  type WorkerCalibration,
} from '../src/render/unit-calibration.ts';

test('every authored walking pose keeps the same screen height and a valid body pivot', () => {
  const report = JSON.parse(
    readFileSync(
      new URL('../public/art/daiviet-walk-calibration.manifest.json', import.meta.url),
      'utf8',
    ),
  );
  for (const source of report.sources) {
    const png = readFileSync(new URL('../public' + source.file, import.meta.url));
    assert.equal(
      createHash('sha256').update(png).digest('hex'),
      source.sha256,
      'calibration must be remeasured when source artwork changes',
    );
  }
  const sheets = JSON.parse(
    readFileSync(new URL('../src/render/daiviet-frames.json', import.meta.url), 'utf8'),
  );
  const profiles: Record<string, WalkCalibration[]> = JSON.parse(
    readFileSync(new URL('../src/render/daiviet-walk-calibration.json', import.meta.url), 'utf8'),
  );
  for (const [key, list] of Object.entries(profiles))
    for (const [index, profile] of list.entries()) {
      const frame = sheets[key].frames[index];
      const geometry = walkingGeometry(frame, 50, profile);
      assert.ok(Math.abs(frame[3] * geometry.scale - 50) < 0.00001, key);
      assert.ok(
        Math.abs(
          profile.bodyWidth * geometry.scaleX -
            (profile.referenceBodyWidth * 50) / profile.referenceHeight,
        ) < 0.00001,
        key,
      );
      assert.ok(geometry.anchorX >= 0 && geometry.anchorX <= frame[2]);
      assert.ok(geometry.anchorY >= 0 && geometry.anchorY <= frame[3]);
      assert.equal(profile.sourceHeight, frame[3]);
      for (let i = 1; i < profile.luma.length; i++) {
        assert.ok(profile.luma[i] > profile.luma[i - 1]);
        assert.ok(profile.referenceLuma[i] > profile.referenceLuma[i - 1]);
      }
    }
});

test('working anatomy uses one uniform scale per pose and lets crouching shorten the silhouette', () => {
  const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
  const report = read('../public/art/daiviet-worker-calibration.manifest.json');
  const sheets = read('../src/render/daiviet-frames.json');
  const profiles: WorkerCalibration[] = read('../src/render/daiviet-worker-calibration.json');
  assert.equal(profiles.length, 16);
  assert.deepEqual(sheets['units-worker-tools'].frames, report.frames);
  for (const source of report.sources) {
    const png = readFileSync(new URL('../public' + source.file, import.meta.url));
    assert.equal(createHash('sha256').update(png).digest('hex'), source.sha256);
  }
  const landmarks = readFileSync(
    new URL('../scripts/data/daiviet-worker-landmarks.json', import.meta.url),
  );
  assert.equal(createHash('sha256').update(landmarks).digest('hex'), report.landmarksSha256);
  for (const [index, profile] of profiles.entries()) {
    const frame = sheets['units-worker-tools'].frames[index];
    const geometry = workingGeometry(frame, 48, profile);
    assert.equal(geometry.scaleX, geometry.scale, 'whole poses must not stretch horizontally');
    const referenceHead = (48 * profile.referenceHeadSize) / profile.referenceHeight;
    assert.ok(Math.abs(profile.headSize * geometry.scale - referenceHead) < 0.00001);
    assert.equal(profile.sourceHeight, frame[3]);
    assert.ok(geometry.anchorX > 0 && geometry.anchorX < frame[2]);
    assert.equal(geometry.anchorY, frame[3] - 4);
    if (index < 4 || index >= 8)
      assert.ok(
        frame[3] * geometry.scale < 48,
        'bent/kneeling workers must stay lower than standing',
      );
    assert.equal(profile.headSize, profiles[Math.floor(index / 4) * 4].headSize);
  }
  for (const frame of report.frames.slice(4, 8)) {
    assert.ok(frame[1] < 256, 'raised tool/head extends above the nominal chopping row');
    assert.ok(frame[1] + frame[3] > 512, 'chopping feet extend below the nominal row');
  }
  for (const frame of report.frames.slice(8, 12))
    assert.ok(frame[1] > 512, 'mining crops exclude disconnected feet from the row above');
});

test('tone correction changes painted RGB once while preserving transparency and the reference pose', () => {
  const profile: WalkCalibration = {
    sourceHeight: 200,
    pivotX: 80,
    bodyWidth: 90,
    referenceBodyWidth: 90,
    referenceHeight: 200,
    luma: [0, 64, 128, 192, 255],
    referenceLuma: [0, 48, 96, 160, 255],
    saturation: 1,
    identity: false,
  };
  const rgba = new Uint8ClampedArray([128, 128, 128, 255, 128, 128, 128, 128, 73, 56, 33, 0]);
  calibrateWalkPixels(rgba, profile);
  assert.deepEqual([...rgba], [96, 96, 96, 255, 96, 96, 96, 128, 73, 56, 33, 0]);
  const unchanged = rgba.slice();
  calibrateWalkPixels(rgba, { ...profile, identity: true });
  assert.deepEqual(rgba, unchanged);
});
