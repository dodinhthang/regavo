"""Register complete resource-specific walking poses; retain PNG source bytes."""
import hashlib
import json
import shutil
from collections import deque
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
inputs = json.loads((ROOT / 'scripts/data/daiviet-cargo-v13-inputs.json').read_text())
metadata, assets = {}, []
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
    width, height = image.size
    mask = alpha.point(lambda value: 255 if value >= 8 else 0).tobytes()
    seen = bytearray(len(mask))
    parts = []
    for start in range(len(mask)):
        if not mask[start] or seen[start]:
            continue
        queue = deque([start])
        seen[start] = 1
        pixels = []
        x0, y0, x1, y1 = width, height, 0, 0
        while queue:
            pixel = queue.popleft()
            pixels.append(pixel)
            x, y = pixel % width, pixel // width
            x0, y0, x1, y1 = min(x0, x), min(y0, y), max(x1, x + 1), max(y1, y + 1)
            for neighbor in [pixel - 1 if x else -1, pixel + 1 if x + 1 < width else -1,
                             pixel - width if y else -1, pixel + width if y + 1 < height else -1]:
                if neighbor >= 0 and mask[neighbor] and not seen[neighbor]:
                    seen[neighbor] = 1
                    queue.append(neighbor)
        parts.append((pixels, x0, y0, x1, y1))
    major = [part for part in parts if len(part[0]) >= max(len(part[0]) for part in parts) * 0.04]
    frames = []
    for row in range(4):
        for shot in range(4):
            actors = [part for part in major
                      if int((part[1] + part[3]) / 2 / 384) == shot
                      and int((part[2] + part[4]) / 2 / 256) == row]
            assert len(actors) == 1, (spec['resource'], row, shot)
            pixels, x0, y0, x1, y1 = actors[0]
            assert x0 > 1 and y0 > 1 and x1 < width - 1 and y1 < height - 1
            # Anchor the upper torso rather than the width/weight of the carried prop.
            band = [pixel % width for pixel in pixels
                    if y0 + (y1 - y0) * 0.2 <= pixel // width < y0 + (y1 - y0) * 0.32]
            pivot = sum(band) / len(band)
            x0, y0, x1, y1 = x0 - 2, y0 - 2, x1 + 2, y1 + 2
            frames.append([x0, y0, x1 - x0, y1 - y0, round(pivot - x0, 2), y1 - y0 - 4])
    key = 'units-cargo-' + spec['resource']
    metadata[key] = {'file': destination.name, 'dimensions': list(image.size), 'frames': frames}
    assets.append({
        'resource': spec['resource'], 'file': spec['file'], 'runtimeKey': key,
        'sha256': hashlib.sha256(destination.read_bytes()).hexdigest(),
        'bytes': destination.stat().st_size, 'dimensions': list(image.size),
        'frames': frames, 'transparentPixels': alpha.histogram()[0],
    })
(ROOT / 'src/render/daiviet-cargo-frames.json').write_text(json.dumps(metadata, indent=2) + '\n')
manifest = {
    'version': 13, 'created': inputs['created'], 'generator': inputs['generator'],
    'sourceBytesUnchanged': True, 'promptSet': 'scripts/data/daiviet-cargo-v13-inputs.json',
    'method': 'Four intact walking poses A/passing D/B/passing C per resource, four headings. '
              'Wood logs, gold ore, grey stone and wrapped hunting meat replace the rice basket. '
              'Uniform X/Y scale preserves the body and carried load; upper-torso pivot excludes cargo width. '
              'Food retains the approved original basket poses. Inventory resource selects the atlas and cache identity.',
    'assets': assets,
}
(ROOT / 'public/art/daiviet-cargo-v13.manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
origins_path = ROOT / 'public/asset-origins.json'
origins = json.loads(origins_path.read_text())
runtime = origins['runtimeArt']
for path in ['src/render/cargo.ts', 'src/render/daiviet-cargo-frames.json',
             'scripts/measure-daiviet-cargo-v13.py', 'scripts/data/daiviet-cargo-v13-inputs.json']:
    if path not in runtime['sources']:
        runtime['sources'].append(path)
for asset in assets:
    runtime['generatedAssets'] = [entry for entry in runtime['generatedAssets'] if entry['file'] != asset['file']]
    runtime['generatedAssets'].append({
        'file': asset['file'], 'manifest': '/art/daiviet-cargo-v13.manifest.json',
        'sha256': asset['sha256'], 'bytes': asset['bytes'],
        'use': 'Dai Viet villager resource-specific whole walking poses: ' + asset['resource'],
    })
note = ' Dai Viet cargo v13 adds four transparent atlases /64 whole walking views for timber logs, gold ore, grey stone and hunting meat. Inventory type selects the carried load; food keeps original basket poses. Uniform body/prop scale, upper-torso anchors and distinct resource cache identities prevent wrong cargo after switching jobs.'
if note not in runtime['method']:
    runtime['method'] += note
origins_path.write_text(json.dumps(origins, indent=2) + '\n')
print('Registered', len(assets), 'resource atlases /', sum(len(asset['frames']) for asset in assets), 'complete views.')
