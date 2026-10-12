"""Register selected whole walking silhouettes; copy PNG bytes without re-encoding.

Run with Python + Pillow + NumPy, then calibrate-daiviet-walk.py.
Only replaces two walking sheet entries, retaining all other current metadata.
"""
import hashlib
import json
import shutil
from collections import deque
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
inputs = json.loads((ROOT / 'scripts/data/daiviet-walk-v12-inputs.json').read_text())
metadata_path = ROOT / 'src/render/daiviet-frames.json'
metadata = json.loads(metadata_path.read_text())
assets = []

def components(alpha):
    width, height = alpha.size
    mask = alpha.point(lambda value: 255 if value >= 8 else 0).tobytes()
    seen = bytearray(len(mask))
    result = []
    for start in range(len(mask)):
        if not mask[start] or seen[start]: continue
        queue = deque([start]); seen[start] = 1
        area = 0; x0 = width; y0 = height; x1 = y1 = 0
        while queue:
            pixel = queue.popleft(); x, y = pixel % width, pixel // width
            area += 1; x0 = min(x0, x); y0 = min(y0, y); x1 = max(x1, x + 1); y1 = max(y1, y + 1)
            for next_pixel in [pixel - 1 if x else -1, pixel + 1 if x + 1 < width else -1,
                               pixel - width if y else -1, pixel + width if y + 1 < height else -1]:
                if next_pixel >= 0 and mask[next_pixel] and not seen[next_pixel]:
                    seen[next_pixel] = 1; queue.append(next_pixel)
        result.append((area, x0, y0, x1, y1))
    return result

for spec in inputs['selectedAssets']:
    destination = ROOT / 'public' / spec['file'].lstrip('/')
    source = Path(spec['source'])
    if not source.is_absolute():
        source = ROOT / source
    if source.resolve() != destination.resolve():
        shutil.copyfile(source, destination)
    image = Image.open(destination)
    assert image.mode == 'RGBA' and image.size == (1536, 1024)
    alpha = image.getchannel('A')
    parts = components(alpha)
    threshold = max(p[0] for p in parts) * 0.04
    major = [p for p in parts if p[0] >= threshold]
    frames = []
    for row in range(4):
        for column in range(4):
            # Measure complete connected actors globally: helmets can cross a nominal row boundary.
            selected = [p for p in major if int((p[1] + p[3]) / 2 / 384) == column and int((p[2] + p[4]) / 2 / 256) == row]
            assert selected, (spec['group'], row, column)
            x0 = min(p[1] for p in selected); y0 = min(p[2] for p in selected)
            x1 = max(p[3] for p in selected); y1 = max(p[4] for p in selected)
            nearby = [p for p in parts if p[0] >= 24 and p[1] <= x1 + 3 and p[3] >= x0 - 3 and p[2] <= y1 + 3 and p[4] >= y0 - 3]
            x0 = min(p[1] for p in nearby); y0 = min(p[2] for p in nearby)
            x1 = max(p[3] for p in nearby); y1 = max(p[4] for p in nearby)
            assert x0 > 0 and y0 > 0 and x1 < image.width and y1 < image.height
            x0, y0 = max(0, x0 - 2), max(0, y0 - 2)
            x1, y1 = min(image.width, x1 + 2), min(image.height, y1 + 2)
            width, height = x1 - x0, y1 - y0
            frames.append([x0, y0, width, height, (width - 1) / 2, height - 4])
    key = 'units-' + spec['group'] + '-walk-d'
    metadata[key] = {'file': destination.name, 'dimensions': list(image.size), 'frames': frames}
    assets.append({**spec, 'runtimeKey': key, 'dimensions': list(image.size), 'frames': frames,
                   'sha256': hashlib.sha256(destination.read_bytes()).hexdigest(),
                   'bytes': destination.stat().st_size, 'transparentPixels': alpha.histogram()[0]})
metadata_path.write_text(json.dumps(metadata, indent=2) + '\n')
manifest = {'version': 12, 'created': '2026-10-11', 'civilization': 'daiviet',
            'generator': inputs['generator'], 'sourceBytesUnchanged': True,
            'method': 'Whole authored poses. Human walking A/D/B/C, mounted A/C/B/D, cannon alternates two whole crew contacts. No limb slicing, mesh deformation or pose crossfade. RGB calibration preserves alpha; height/body pivot fixed per type and heading. Distance-driven cycle.',
            'assets': assets}
(ROOT / 'public/art/daiviet-walk-v12.manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
origins_path = ROOT / 'public/asset-origins.json'
origins = json.loads(origins_path.read_text())
runtime = origins['runtimeArt']
runtime['sources'] = [p for p in runtime['sources'] if p not in ['src/render/walk-rig.ts', 'src/render/daiviet-walk-anchors.json']]
for path in ['scripts/measure-daiviet-walk-v12.py']:
    if path not in runtime['sources']: runtime['sources'].append(path)
for asset in assets:
    entry = {'file': asset['file'], 'manifest': '/art/daiviet-walk-v12.manifest.json',
             'sha256': asset['sha256'], 'bytes': asset['bytes'],
             'use': 'Complete human walking passing pose; replaces the v3 D sprite sheet.'}
    runtime['generatedAssets'] = [a for a in runtime['generatedAssets'] if a['file'] != entry['file']]
    runtime['generatedAssets'].append(entry)
sentence = ' Dai Viet walk v12 retires the sliced-limb/mesh rig after visible seams; all walking uses intact authored poses like combat. Two new transparent people/infantry D sheets add32 narrow passing views, with whole-pose RGB/geometry calibration and distance-driven timing. Original PNGs retained unchanged; historical 12/24-stage rig notes above are superseded.'
if sentence not in runtime['method']: runtime['method'] += sentence
origins_path.write_text(json.dumps(origins, indent=2) + '\n')
print('Registered', len(assets), 'whole-pose PNGs and', sum(len(a['frames']) for a in assets), 'views.')
