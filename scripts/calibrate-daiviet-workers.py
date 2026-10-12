"""Measure complete worker poses and match anatomy, retaining the original PNG bytes.

Run with Python + Pillow. Head landmarks are reviewed in source pixel coordinates,
so crouching does not get enlarged to the height of an upright villager.
"""
import hashlib
import json
import math
from collections import deque
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
landmark_path = ROOT / 'scripts/data/daiviet-worker-landmarks.json'
landmarks = json.loads(landmark_path.read_text())
metadata_path = ROOT / 'src/render/daiviet-frames.json'
metadata = json.loads(metadata_path.read_text())
reference = metadata[landmarks['referenceSheet']]
sheet = metadata[landmarks['sourceSheet']]
image = Image.open(ROOT / 'public/art' / sheet['file'])
width, height = image.size
mask = image.getchannel('A').point(lambda value: 255 if value >= 8 else 0).tobytes()
seen = bytearray(len(mask))
parts = []
for start in range(len(mask)):
    if not mask[start] or seen[start]:
        continue
    queue = deque([start])
    seen[start] = 1
    area = 0
    x0, y0, x1, y1 = width, height, 0, 0
    while queue:
        pixel = queue.popleft()
        x, y = pixel % width, pixel // width
        area += 1
        x0, y0, x1, y1 = min(x0, x), min(y0, y), max(x1, x + 1), max(y1, y + 1)
        for neighbor in [pixel - 1 if x else -1, pixel + 1 if x + 1 < width else -1,
                         pixel - width if y else -1, pixel + width if y + 1 < height else -1]:
            if neighbor >= 0 and mask[neighbor] and not seen[neighbor]:
                seen[neighbor] = 1
                queue.append(neighbor)
    parts.append((area, x0, y0, x1, y1))

major = [part for part in parts if part[0] >= max(part[0] for part in parts) * 0.04]
reference_head = sum(math.sqrt(box[2] * box[3]) for box in landmarks['referenceHeads']) / 4
profiles, frames = [], []
for row in range(4):
    heads = landmarks['workingHeads'][row * 4:row * 4 + 4]
    source_head = sum(math.sqrt(box[2] * box[3]) for box in heads) / 4
    for shot in range(4):
        # Complete connected actors can cross the nominal atlas row boundary.
        actor = [part for part in major
                 if int((part[1] + part[3]) / 2 / 384) == shot
                 and int((part[2] + part[4]) / 2 / 256) == row]
        assert len(actor) == 1, (row, shot, actor)
        _, x0, y0, x1, y1 = actor[0]
        assert x0 > 1 and y0 > 1 and x1 < width - 1 and y1 < height - 1
        x0, y0, x1, y1 = x0 - 2, y0 - 2, x1 + 2, y1 + 2
        old = sheet['frames'][row * 4 + shot]
        ground_x = round(old[0] + old[4] - x0, 2)
        frame = [x0, y0, x1 - x0, y1 - y0, ground_x, y1 - y0 - 4]
        head = heads[shot]
        assert x0 <= head[0] and y0 <= head[1]
        assert head[0] + head[2] <= x1 and head[1] + head[3] <= y1
        frames.append(frame)
        profiles.append({
            'sourceHeight': frame[3],
            'referenceHeight': reference['frames'][shot][3],
            'referenceHeadSize': round(reference_head, 6),
            'headSize': round(source_head, 6),
        })

sheet['frames'] = frames
metadata_path.write_text(json.dumps(metadata, indent=2) + '\n')
(ROOT / 'src/render/daiviet-worker-calibration.json').write_text(json.dumps(profiles, indent=2) + '\n')
sources = []
for source in [reference, sheet]:
    file = ROOT / 'public/art' / source['file']
    sources.append({'file': '/art/' + source['file'], 'sha256': hashlib.sha256(file.read_bytes()).hexdigest()})
report = {
    'created': '2026-10-11',
    'method': landmarks['measurement'],
    'sourceBytesUnchanged': True,
    'sources': sources,
    'landmarksSha256': hashlib.sha256(landmark_path.read_bytes()).hexdigest(),
    'frames': frames,
    'scaleRatios': [round(reference_head / profiles[row * 4]['headSize'], 6) for row in range(4)],
}
(ROOT / 'public/art/daiviet-worker-calibration.manifest.json').write_text(json.dumps(report, indent=2) + '\n')
print('Measured 16 complete worker poses; anatomy ratios:', report['scaleRatios'])
