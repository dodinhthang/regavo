import assert from 'node:assert/strict';
import test from 'node:test';
import { previewSceneFit } from '../src/ui/preview-scene-fit.ts';

test('a taller palace roof and its flags remain complete without changing settlement placement', () => {
  const models = [
    { left: 280, top: -90, right: 760, bottom: 390 },
    { left: 180, top: 320, right: 440, bottom: 568 },
  ];
  const fit = previewSceneFit(models);
  assert.ok(fit.zoom > 0 && fit.zoom < 1);
  for (const model of models) {
    assert.ok(model.left * fit.zoom + fit.x >= 8);
    assert.ok(model.top * fit.zoom + fit.y >= 8);
    assert.ok(model.right * fit.zoom + fit.x <= 992);
    assert.ok(model.bottom * fit.zoom + fit.y <= 532);
  }
  assert.deepEqual(previewSceneFit([{ left: 280, top: 18, right: 760, bottom: 390 }]), {
    zoom: 1,
    x: 0,
    y: 0,
  });
});
