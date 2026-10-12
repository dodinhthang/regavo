"""Measure rendering calibration only. Never edits or re-encodes source PNGs.

Run with Python + Pillow + NumPy. Runtime applies the recorded tone curves to
isolated cached frames; transparent pixels are excluded from all measurements.
"""
import json, hashlib
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
metadata = json.loads((ROOT / 'src/render/daiviet-frames.json').read_text())
profiles = {}
report = []
images = {}

def measure(sheet, index):
    x, y, w, h, *_ = sheet['frames'][index]
    file = sheet['file']
    if file not in images: images[file] = np.asarray(Image.open(ROOT / 'public/art' / file))
    rgba = images[file][y:y+h, x:x+w]
    rgb = rgba[rgba[:, :, 3] >= 240, :3].astype(float)
    luma = rgb @ np.array([.2126, .7152, .0722])
    alpha = rgba[:, :, 3].astype(float) / 255
    # Body/hip pivot excludes alternating feet and most raised weapon tips.
    band = alpha[int(h * .35):int(h * .65)]
    pivot = (band.sum(0) * np.arange(w)).sum() / band.sum()
    cumulative = np.cumsum(band.sum(0))
    left, right = np.interp([.05 * cumulative[-1], .95 * cumulative[-1]], cumulative, np.arange(w))
    return rgb, luma, float(pivot), h, float(right - left)

def saturation(rgb):
    return (rgb.max(1) - rgb.min(1)) / np.maximum(1, rgb.max(1))

for group in ['infantry', 'people', 'mounted', 'cannon']:
    base = metadata[f'units-{group}-walk-a']
    for pose in ('abcd' if group != 'cannon' else 'a'):
        key = f'units-{group}-walk-{pose}'
        sheet = metadata[key]
        profiles[key] = []
        for index in range(len(sheet['frames'])):
            base_index = index if group != 'cannon' else index % 4
            rgb, luma, pivot, height, body_width = measure(sheet, index)
            ref_rgb, ref_luma, _, ref_height, ref_body_width = measure(base, base_index)
            curve = [0, *np.percentile(luma, [10, 50, 90]), 255]
            reference = [0, *np.percentile(ref_luma, [10, 50, 90]), 255]
            mapped = np.interp(luma, curve, reference)
            target_sat = float(np.median(saturation(ref_rgb)))
            lo, hi = .5, 1.5
            for _ in range(24):
                factor = (lo + hi) / 2
                adjusted = np.clip(luma[:, None] + factor * (rgb - luma[:, None]), 0, 255)
                if np.median(saturation(adjusted)) < target_sat: lo = factor
                else: hi = factor
            sat = (lo + hi) / 2
            corrected = np.clip((luma[:, None] + sat * (rgb - luma[:, None])) * (mapped / np.maximum(1, luma))[:, None], 0, 255)
            corrected_luma = corrected @ np.array([.2126, .7152, .0722])
            identity = key.endswith('-a') and (group != 'cannon' or index < 4)
            if identity: sat = 1
            profile = {
                'sourceHeight': height,
                'pivotX': round(pivot, 4),
                'bodyWidth': round(body_width, 4),
                'referenceBodyWidth': round(ref_body_width, 4),
                'referenceHeight': ref_height,
                'luma': [round(float(n), 4) for n in curve],
                'referenceLuma': [round(float(n), 4) for n in reference],
                'saturation': round(sat, 6),
                'identity': identity,
            }
            profiles[key].append(profile)
            # Only the first two cannon rows are walking contacts.
            if group == 'cannon' and index >= 8: continue
            report.append({
                'sheet': key, 'frame': index,
                'heightBeforeRelativeToA': round(height / ref_height, 4),
                'bodyWidthBeforeRelativeToA': round(body_width / ref_body_width, 4),
                'lumaBefore': round(float(np.median(luma)), 3),
                'referenceLuma': round(float(np.median(ref_luma)), 3),
                'lumaAfter': round(float(np.median(corrected_luma)), 3),
                'saturationBefore': round(float(np.median(saturation(rgb))), 4),
                'referenceSaturation': round(target_sat, 4),
                'saturationAfter': round(float(np.median(saturation(corrected))), 4),
            })

(ROOT / 'src/render/daiviet-walk-calibration.json').write_text(json.dumps(profiles, indent=2) + '\n')
(ROOT / 'public/art/daiviet-walk-calibration.manifest.json').write_text(json.dumps({
    'version': 12, 'date': '2026-10-11', 'sourcePNGsUnchanged': True,
    'method': 'Opaque-pixel luminance quantile matching and saturation calibration to the same unit and heading in contact A. Per-pose fixed silhouette height, body-width quantile normalization and body/hip centroid pivot. Alpha preserved. Rendering only, no source PNG edits.',
    'calibration': 'src/render/daiviet-walk-calibration.json',
    'measurementScript': 'scripts/calibrate-daiviet-walk.py',
    'sources': [{'file': '/art/' + file, 'sha256': hashlib.sha256((ROOT / 'public/art' / file).read_bytes()).hexdigest()} for file in images],
    'measurements': report,
}, indent=2) + '\n')
print('Measured', len(report), 'walking views. Maximum corrected median luminance difference:', max(abs(r['lumaAfter'] - r['referenceLuma']) for r in report))
