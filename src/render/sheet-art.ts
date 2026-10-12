import { isolatedFrame } from './isolated-frame.ts';
import { assetUrl } from './asset-url.ts';
import {
  selectBuildingArt,
  selectUnitArt,
  type SheetArtDefinition,
} from './civilization-art-definition.ts';
import { calibrateWalkFrame, walkingGeometry, workingGeometry } from './unit-calibration.ts';
import type { ArtSprite } from './art.ts';
import { buildingFootprintSize, type CivId } from '../game/data.ts';
import { renderBarrier } from './barrier-raster.ts';
import { isBarrier, type BarrierSockets } from './barrier-geometry.ts';
import {
  renderRasterFoundation,
  type BuildingFrame,
  type BuildingFoundation,
} from './buildings.ts';

/** One renderer for independent civilization atlases; all source choices come from data. */
export function createSheetArt(definition: SheetArtDefinition) {
  const sheets = definition.sheets;
  const activeBuildingSheets = new Set(
    Object.values(definition.buildings)
      .flat()
      .map((pose) => pose.sheet),
  );
  const unitSheetKeys = definition.unitSheets ?? [
    ...new Set(
      Object.values(definition.units).flatMap((unit) => [
        unit.reference.sheet,
        ...Object.values(unit.actions)
          .flat()
          .map((pose) => pose.sheet),
        ...Object.values(unit.cargo ?? {})
          .flat()
          .map((pose) => pose.sheet),
      ]),
    ),
  ];
  const images = new Map<string, HTMLImageElement>();
  const loading = new Map<string, Promise<boolean>>();
  const cache = new Map<string, ArtSprite>();
  let unitRevision = 0;
  let unitSerial = 0;
  let unitsActive = false;

  function loadSheet(key: string) {
    if (images.has(key)) return Promise.resolve(true);
    const pending = loading.get(key);
    if (pending) return pending;
    const promise = new Promise<boolean>((resolve) => {
      const image = new Image();
      image.onload = () => {
        const [width, height] = sheets[key].dimensions ?? [1536, 1024];
        const valid = image.naturalWidth === width && image.naturalHeight === height;
        if (valid && (activeBuildingSheets.has(key) || unitsActive)) {
          images.set(key, image);
          unitRevision++;
        }
        resolve(valid);
      };
      image.onerror = () => resolve(false);
      image.src = assetUrl('/art/' + sheets[key].file);
    }).finally(() => loading.delete(key));
    loading.set(key, promise);
    return promise;
  }

  async function loadBuildings(ages?: readonly number[]) {
    const selected = ages
      ? new Set(
          Object.values(definition.buildings)
            .flatMap((poses) => ages.map((age) => poses[age - 1]?.sheet))
            .filter(Boolean),
        )
      : activeBuildingSheets;
    return (
      await Promise.all([
        ...Object.keys(sheets)
          .filter((key) => selected.has(key))
          .map(loadSheet),
        definition.loadDecoration?.() ?? Promise.resolve(true),
      ])
    ).every(Boolean);
  }

  async function loadUnits(active: boolean, preview = false) {
    const serial = ++unitSerial;
    unitsActive = active;
    const keys = preview
      ? [
          ...new Set(
            Object.values(definition.units).flatMap((unit) => [
              unit.reference.sheet,
              ...(unit.actions.idle ?? []).map((pose) => pose.sheet),
            ]),
          ),
        ]
      : unitSheetKeys;
    if (active) {
      const results = await Promise.all(keys.map(loadSheet));
      if (serial === unitSerial) return results.every(Boolean);
    }
    if (!unitsActive) {
      for (const key of unitSheetKeys) if (!activeBuildingSheets.has(key)) images.delete(key);
      cache.clear();
      unitRevision++;
    }
    return true;
  }

  function status() {
    return {
      sheets: Object.fromEntries(Object.keys(sheets).map((key) => [key, images.has(key)])),
      decodedSourceBytes: [...images.values()].reduce(
        (n, image) => n + image.naturalWidth * image.naturalHeight * 4,
        0,
      ),
      cachedCanvasBytes: [...cache.values()].reduce(
        (n, sprite) => n + sprite.canvas.width * sprite.canvas.height * 4,
        0,
      ),
    };
  }

  function retain(key: string, sprite: ArtSprite) {
    cache.set(key, sprite);
    while (cache.size > 160) cache.delete(cache.keys().next().value!);
    return sprite;
  }

  function renderBuilding(type: string, age: number, team: number, direction = 2) {
    age = Math.max(1, Math.min(3, Math.round(age)));
    const pose = selectBuildingArt(definition, type, age);
    if (!pose) return undefined;
    const { sheet: sheetKey, row } = pose;
    const image = images.get(sheetKey);
    if (!image) return undefined;
    const axis = direction % 4 === 0 ? 'x' : 'y';
    const key = 'building:' + type + ':' + age + ':' + team + ':' + (isBarrier(type) ? axis : '');
    const cached = cache.get(key);
    if (cached) return cached;
    const sourceFrame = sheets[sheetKey].frames[row];
    const frame: BuildingFrame = [sourceFrame[0], sourceFrame[1], sourceFrame[2], sourceFrame[3]];
    const [, , width, height] = frame;
    const sockets = sheets[sheetKey].barrierSockets?.[type];
    if (sockets) {
      return retain(
        key,
        renderBarrier(
          isolatedFrame(image, frame, true),
          [sockets[0], sockets[1], sockets[2], sockets[3], sockets[4]] as BarrierSockets,
          buildingFootprintSize(type, age, definition.id as CivId),
          type.startsWith('wood'),
          axis,
        ),
      );
    }
    const sideY = height - 4 - width / 4;
    const measured = sheets[sheetKey].foundations?.[row];
    const foundation: BuildingFoundation = measured
      ? [measured[0], measured[1], measured[2], measured[3], measured[4], measured[5]]
      : [2, sideY, width - 2, sideY, width / 2, height - 4];
    const result = renderRasterFoundation(
      pose.isolated ? isolatedFrame(image, frame, true) : image,
      pose.isolated ? [0, 0, width, height] : frame,
      foundation,
      buildingFootprintSize(type, age, definition.id as CivId),
      team,
      type,
      pose.banner ? { civ: definition.id, age } : undefined,
      pose.integratedFlag,
      pose.preserveAspect,
      !!measured,
    );
    return result ? retain(key, result) : undefined;
  }

  function renderUnit(
    type: string,
    team: number,
    phase: number,
    direction: number,
    action: string,
    activity = '',
  ) {
    const selected = selectUnitArt(definition, type, phase, direction, action, activity);
    if (!selected) return undefined;
    const { unit, pose, shot, index } = selected;
    const height = unit.height;
    phase = selected.phase;
    const sheetKey = pose.sheet,
      rowIndex = pose.row;
    const image = images.get(sheetKey);
    if (!image) return undefined;
    const working = pose.geometry === 'working';
    const cargo = pose.geometry === 'cargo';
    const calibration =
      pose.geometry === 'walking' ? definition.walkCalibrations?.[sheetKey]?.[index] : undefined;
    const workerCalibration = working
      ? definition.workerCalibrations?.[sheetKey]?.[index]
      : undefined;
    const key = [
      type,
      team,
      sheetKey,
      rowIndex,
      shot,
      pose.geometry ?? 'reference',
      calibration ? 'calibrated' : 'source',
      working ? phase % 2 : 0,
      unitRevision,
    ].join(':');
    const cached = cache.get(key);
    if (cached)
      return cached as ArtSprite & { pixelRatio: 4; logicalWidth: number; logicalHeight: number };
    const [sx, sy, sw, sh, ax, ay] = selected.frame;
    const baseHeight = sheets[unit.reference.sheet].frames[unit.reference.row * 4 + shot][3];
    const geometry = cargo
      ? { scale: height / sh, scaleX: height / sh, anchorX: ax, anchorY: ay }
      : calibration
        ? walkingGeometry([sx, sy, sw, sh, ax, ay], height, calibration)
        : workerCalibration
          ? workingGeometry([sx, sy, sw, sh, ax, ay], height, workerCalibration)
          : { scale: height / baseHeight, scaleX: height / baseHeight, anchorX: ax, anchorY: ay };
    const groundX = geometry.anchorX,
      groundY = geometry.anchorY;
    const scale = geometry.scale,
      scaleX = geometry.scaleX,
      padding = 10,
      bob = working && phase % 2 ? 0.6 : 0;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil((sw * scaleX + padding * 2) * 4);
    canvas.height = Math.ceil((sh * scale + padding * 2) * 4);
    const c = canvas.getContext('2d')!;
    c.scale(4, 4);
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    const source = isolatedFrame(image, [sx, sy, sw, sh]);
    const painted = calibration ? calibrateWalkFrame(source, calibration) : source;
    c.drawImage(
      painted,
      0,
      0,
      painted.width,
      painted.height,
      padding,
      padding + bob,
      painted.width * scaleX,
      painted.height * scale,
    );
    const sprite = {
      canvas,
      pixelRatio: 4 as const,
      anchorX: (padding + groundX * scaleX) * 4,
      anchorY: (padding + groundY * scale) * 4,
      logicalWidth: canvas.width / 4,
      logicalHeight: canvas.height / 4,
    };
    retain(key, sprite);
    return sprite;
  }

  function renderPortrait(type: string) {
    const unit = definition.units[type];
    if (!unit) return undefined;
    const image = images.get(unit.reference.sheet);
    if (!image) return undefined;
    const [sx, sy, sw, sh] = sheets[unit.reference.sheet].frames[unit.reference.row * 4];
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 576;
    const c = canvas.getContext('2d')!,
      scale = Math.min(448 / sw, 528 / sh);
    c.drawImage(
      isolatedFrame(image, [sx, sy, sw, sh]),
      0,
      0,
      sw,
      sh,
      (512 - sw * scale) / 2,
      552 - sh * scale,
      sw * scale,
      sh * scale,
    );
    return canvas;
  }

  return { loadBuildings, loadUnits, renderBuilding, renderUnit, renderPortrait, status };
}
