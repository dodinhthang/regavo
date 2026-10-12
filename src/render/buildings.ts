import type { ArtSprite } from './art';
import { BUILDINGS } from '../game/data.ts';
import { drawDaiVietDragon } from './daiviet-emblem.ts';
import { foundationProjection } from './foundation-geometry.ts';
import { renderBarrier } from './barrier-raster.ts';
import { STONE_BARRIER_SOCKETS } from './barrier-sources.ts';
import { isolatedFrame } from './isolated-frame.ts';
import { sharedAtlasColumn } from './civilization-art-data.ts';

/** Source PNGs stay untouched. Points are measured in each original frame. */
export type BuildingFrame = readonly [number, number, number, number];
export type BuildingFoundation = readonly [number, number, number, number, number, number];
export type BuildingBanner = Readonly<{ civ: string; age: number }>;
const ATLASES = [
  { url: '/art/buildings-v3-a.png', width: 1536, height: 1024 },
  { url: '/art/buildings-v3-b.png', width: 1536, height: 1024 },
  { url: '/art/buildings-v3-c.png', width: 1536, height: 1024 },
  { url: '/art/buildings-v3-d.png', width: 1536, height: 1024 },
  { url: '/art/buildings-v6-age1-a.png', width: 1536, height: 1024 },
  { url: '/art/buildings-v6-age1-b.png', width: 1536, height: 1024 },
  { url: '/art/buildings-v6-age3-a.png', width: 1536, height: 1024 },
  { url: '/art/buildings-v6-age3-b.png', width: 1536, height: 1024 },
  { url: '/art/buildings-v6-age3-c.png', width: 1536, height: 1024 },
  { url: '/art/buildings-v6-age3-d.png', width: 2172, height: 724 },
] as const;
const FRAMES: readonly (readonly BuildingFrame[])[] = [
  [
    [43, 42, 248, 216],
    [355, 79, 244, 186],
    [655, 57, 236, 200],
    [942, 44, 244, 215],
    [1263, 60, 231, 199],
    [34, 275, 268, 228],
    [348, 290, 267, 212],
    [654, 281, 253, 230],
    [936, 261, 269, 246],
    [1252, 266, 258, 244],
    [30, 508, 283, 261],
    [335, 515, 285, 263],
    [633, 512, 291, 274],
    [943, 509, 267, 280],
    [1235, 510, 276, 276],
    [30, 792, 273, 199],
    [344, 790, 269, 203],
    [639, 793, 269, 194],
    [938, 784, 274, 215],
    [1248, 796, 262, 194],
  ],
  [
    [39, 100, 275, 215],
    [341, 144, 266, 172],
    [639, 125, 258, 187],
    [932, 114, 262, 200],
    [1226, 112, 266, 204],
    [36, 325, 270, 210],
    [342, 348, 252, 187],
    [638, 332, 259, 204],
    [940, 321, 237, 214],
    [1226, 325, 277, 214],
    [39, 542, 262, 174],
    [341, 542, 259, 176],
    [635, 540, 264, 178],
    [937, 539, 255, 178],
    [1229, 534, 271, 184],
    [30, 727, 286, 234],
    [341, 739, 263, 215],
    [637, 732, 262, 227],
    [931, 726, 266, 232],
    [1227, 732, 281, 229],
  ],
  [
    [9, 48, 288, 212],
    [317, 67, 287, 204],
    [615, 52, 290, 212],
    [932, 50, 284, 217],
    [1239, 46, 284, 220],
    [11, 285, 299, 233],
    [325, 301, 280, 214],
    [620, 291, 293, 227],
    [931, 287, 286, 231],
    [1232, 298, 291, 222],
    [11, 531, 286, 213],
    [309, 547, 296, 206],
    [617, 538, 291, 216],
    [927, 541, 286, 218],
    [1229, 526, 296, 233],
    [14, 765, 294, 215],
    [324, 772, 272, 209],
    [621, 765, 290, 216],
    [938, 769, 276, 212],
    [1229, 765, 290, 224],
  ],
  [
    [110, 51, 163, 209],
    [409, 28, 168, 231],
    [693, 50, 170, 210],
    [977, 38, 184, 223],
    [1289, 35, 141, 225],
    [46, 269, 294, 235],
    [350, 276, 277, 236],
    [636, 266, 281, 247],
    [924, 269, 291, 250],
    [1222, 267, 297, 253],
    [50, 541, 282, 214],
    [373, 524, 237, 245],
    [659, 547, 239, 215],
    [934, 533, 266, 235],
    [1238, 538, 267, 229],
    [60, 767, 252, 218],
    [367, 781, 230, 195],
    [652, 776, 248, 209],
    [937, 764, 260, 220],
    [1247, 763, 260, 226],
  ],
  [
    [12, 107, 300, 218],
    [331, 109, 276, 211],
    [624, 111, 287, 210],
    [928, 106, 281, 215],
    [1231, 114, 290, 208],
    [13, 384, 307, 259],
    [327, 406, 296, 234],
    [628, 406, 282, 232],
    [919, 399, 300, 242],
    [1228, 404, 296, 237],
    [17, 703, 292, 245],
    [326, 733, 289, 213],
    [624, 714, 291, 231],
    [925, 690, 285, 256],
    [1228, 704, 294, 243],
  ],
  [
    [30, 78, 297, 253],
    [338, 104, 280, 227],
    [629, 115, 287, 216],
    [923, 98, 278, 234],
    [1217, 118, 286, 217],
    [21, 393, 313, 252],
    [330, 377, 296, 268],
    [624, 382, 294, 263],
    [916, 378, 304, 267],
    [1218, 392, 301, 253],
    [10, 704, 312, 228],
    [318, 686, 300, 245],
    [619, 710, 300, 222],
    [916, 705, 306, 227],
    [1217, 709, 312, 227],
  ],
  [
    [4, 31, 301, 219],
    [316, 32, 295, 213],
    [626, 22, 295, 226],
    [932, 23, 298, 226],
    [1241, 13, 294, 233],
    [6, 266, 300, 225],
    [317, 257, 298, 237],
    [628, 257, 291, 236],
    [929, 255, 300, 235],
    [1239, 258, 295, 230],
    [8, 504, 296, 238],
    [315, 511, 300, 226],
    [628, 496, 292, 245],
    [930, 490, 299, 255],
    [1239, 497, 295, 244],
    [9, 751, 292, 208],
    [315, 755, 294, 206],
    [624, 745, 294, 214],
    [931, 752, 296, 207],
    [1239, 746, 294, 214],
  ],
  [
    [7, 19, 299, 225],
    [315, 29, 289, 213],
    [611, 18, 299, 226],
    [921, 16, 302, 227],
    [1233, 32, 294, 212],
    [9, 268, 299, 222],
    [314, 260, 295, 228],
    [612, 259, 304, 230],
    [923, 265, 304, 228],
    [1233, 268, 301, 223],
    [11, 508, 297, 223],
    [318, 513, 294, 217],
    [617, 502, 297, 230],
    [922, 500, 305, 232],
    [1233, 510, 295, 221],
    [8, 742, 305, 234],
    [318, 749, 294, 225],
    [615, 742, 301, 234],
    [923, 740, 301, 237],
    [1231, 744, 301, 233],
  ],
  [
    [7, 11, 302, 236],
    [328, 18, 284, 225],
    [618, 10, 304, 239],
    [932, 8, 292, 240],
    [1235, 13, 301, 235],
    [56, 247, 195, 230],
    [367, 244, 201, 239],
    [673, 249, 193, 232],
    [977, 246, 192, 230],
    [1299, 249, 179, 230],
    [0, 483, 316, 257],
    [315, 484, 309, 257],
    [622, 481, 295, 263],
    [917, 478, 312, 269],
    [1231, 479, 305, 267],
    [16, 751, 280, 243],
    [319, 742, 294, 251],
    [629, 743, 276, 251],
    [927, 752, 291, 244],
    [1249, 743, 273, 254],
  ],
  [
    [36, 169, 409, 401],
    [458, 158, 419, 411],
    [880, 174, 426, 399],
    [1309, 169, 416, 401],
    [1730, 146, 424, 430],
  ],
];
const FOUNDATIONS: readonly (readonly BuildingFoundation[])[] = [
  [
    [6, 160, 241, 152, 123.5, 209],
    [7, 132, 237, 122, 122, 180],
    [6, 148, 229, 137, 113, 194],
    [6, 162, 237, 149, 109.5, 208],
    [6, 146, 223, 141, 113.5, 192],
    [6, 166, 260, 165, 132.5, 221],
    [6, 153, 260, 139, 129, 205],
    [6, 176, 245, 175, 138, 224],
    [15, 194, 263, 182, 123.5, 239],
    [7, 185, 251, 186, 128.5, 237],
    [6, 204, 276, 201, 111, 254],
    [6, 210, 278, 191, 148.5, 256],
    [6, 204, 283, 201, 142.5, 268],
    [6, 214, 259, 218, 146, 274],
    [7, 207, 269, 214, 154, 269],
    [6, 129, 266, 136, 147.5, 193],
    [6, 135, 262, 139, 144.5, 196],
    [6, 124, 262, 127, 139.5, 188],
    [6, 144, 266, 153, 148.5, 208],
    [7, 129, 255, 130, 135, 187],
  ],
  [
    [6, 157, 268, 157, 121.5, 208],
    [6, 113, 259, 112, 130.5, 165],
    [6, 138, 251, 135, 143.5, 179],
    [7, 143, 254, 142, 142, 193],
    [6, 146, 259, 144, 141, 197],
    [6, 147, 263, 146, 131.5, 203],
    [6, 120, 245, 123, 130.5, 180],
    [6, 145, 252, 142, 123, 197],
    [6, 152, 229, 170, 140, 207],
    [6, 143, 270, 156, 154.5, 207],
    [6, 103, 255, 101, 131.5, 168],
    [6, 102, 252, 106, 135, 169],
    [7, 104, 257, 104, 134, 171],
    [6, 107, 248, 109, 136, 172],
    [6, 109, 264, 114, 146, 177],
    [6, 154, 278, 157, 138.5, 227],
    [6, 137, 256, 139, 131.5, 208],
    [6, 154, 255, 158, 134, 220],
    [7, 158, 259, 162, 134, 225],
    [7, 147, 274, 152, 141, 222],
  ],
  [
    [6, 139, 281, 143, 148.5, 205],
    [6, 130, 280, 136, 152.5, 197],
    [6, 138, 283, 137, 147.5, 205],
    [6, 145, 277, 145, 143, 210],
    [7, 149, 277, 146, 139.5, 213],
    [6, 147, 292, 158, 158.5, 226],
    [5, 134, 273, 144, 151, 207],
    [6, 151, 286, 152, 149.5, 220],
    [6, 156, 279, 153, 142, 224],
    [6, 148, 284, 146, 142, 215],
    [5, 146, 279, 128, 124.5, 207],
    [6, 127, 288, 131, 152, 200],
    [6, 135, 284, 141, 155, 210],
    [6, 143, 279, 141, 144.5, 211],
    [6, 153, 289, 157, 150.5, 226],
    [5, 134, 287, 137, 151, 208],
    [6, 130, 265, 142, 148.5, 202],
    [6, 137, 283, 142, 152, 209],
    [6, 138, 269, 140, 141, 205],
    [6, 149, 284, 148, 139.5, 217],
  ],
  [
    [7, 170, 151, 169, 80.5, 202],
    [7, 196, 160, 188, 86, 224],
    [6, 171, 161, 164, 92.5, 204],
    [14, 184, 174, 182, 97.5, 217],
    [7, 190, 134, 187, 72.5, 218],
    [6, 174, 286, 171, 132, 228],
    [7, 173, 269, 179, 158, 229],
    [7, 183, 273, 178, 159, 240],
    [7, 188, 282, 173, 156, 243],
    [7, 179, 289, 177, 181.5, 246],
    [6, 146, 270, 183, 224.5, 208],
    [6, 180, 228, 209, 176, 238],
    [6, 151, 229, 185, 186.5, 208],
    [7, 168, 255, 211, 215, 233],
    [6, 162, 257, 194, 206, 222],
    [6, 137, 244, 190, 202.5, 211],
    [7, 107, 221, 169, 187, 188],
    [6, 129, 239, 181, 202, 202],
    [7, 136, 252, 190, 209.5, 213],
    [7, 144, 252, 196, 210, 219],
  ],
  [
    [6, 137, 293, 135, 152, 211],
    [6, 134, 269, 134, 141.5, 204],
    [6, 132, 279, 133, 144, 204],
    [6, 137, 274, 137, 140.5, 208],
    [6, 129, 283, 131, 146, 201],
    [6, 174, 300, 173, 154.5, 252],
    [6, 151, 289, 150, 148.5, 228],
    [6, 151, 275, 154, 144.5, 225],
    [6, 158, 293, 158, 150, 235],
    [6, 153, 290, 154, 148.5, 230],
    [6, 164, 285, 162, 144, 238],
    [6, 132, 283, 132, 145, 206],
    [6, 151, 285, 149, 144.5, 225],
    [5, 176, 278, 176, 141.5, 250],
    [6, 162, 287, 160, 145, 237],
  ],
  [
    [5, 174, 291, 174, 148, 247],
    [6, 149, 274, 149, 139.5, 220],
    [5, 137, 281, 138, 141.5, 210],
    [5, 154, 272, 156, 139.5, 228],
    [5, 137, 280, 137, 139, 210],
    [5, 166, 306, 165, 152.5, 245],
    [6, 182, 290, 182, 147.5, 261],
    [6, 177, 287, 177, 149, 256],
    [6, 181, 297, 181, 147, 261],
    [6, 167, 294, 166, 147, 247],
    [5, 142, 305, 141, 150.5, 221],
    [5, 161, 297, 158, 145, 239],
    [1, 135, 293, 135, 147, 215],
    [6, 140, 299, 141, 154.5, 221],
    [6, 138, 305, 139, 154.5, 220],
  ],
  [
    [5, 143, 294, 140, 146.5, 213],
    [6, 138, 288, 137, 145.5, 207],
    [6, 149, 289, 149, 146.5, 219],
    [6, 148, 292, 147, 146.5, 220],
    [6, 158, 288, 155, 144, 227],
    [6, 146, 293, 150, 154, 218],
    [5, 158, 291, 161, 149.5, 231],
    [5, 161, 284, 160, 145, 230],
    [6, 155, 294, 155, 151, 228],
    [5, 150, 288, 151, 141.5, 224],
    [5, 162, 289, 155, 142.5, 231],
    [6, 148, 294, 144, 146, 220],
    [6, 167, 285, 167, 143, 239],
    [6, 174, 293, 174, 145, 249],
    [6, 166, 288, 167, 141.5, 237],
    [5, 122, 286, 121, 143, 201],
    [5, 118, 288, 116, 143.5, 199],
    [5, 126, 288, 125, 141.5, 207],
    [5, 118, 289, 119, 143, 201],
    [6, 126, 288, 125, 139.5, 207],
  ],
  [
    [6, 144, 292, 142, 144, 218],
    [6, 131, 282, 133, 142.5, 206],
    [5, 142, 293, 143, 149.5, 220],
    [6, 144, 295, 145, 149, 221],
    [6, 127, 288, 129, 146.5, 206],
    [6, 138, 292, 143, 146, 216],
    [6, 144, 289, 150, 144, 222],
    [6, 146, 297, 149, 147, 224],
    [5, 143, 297, 146, 147.5, 222],
    [6, 138, 294, 143, 144.5, 216],
    [6, 142, 291, 142, 142, 216],
    [6, 135, 288, 138, 144, 211],
    [5, 147, 290, 150, 143, 224],
    [5, 147, 298, 151, 148.5, 226],
    [6, 138, 288, 141, 143.5, 214],
    [6, 146, 299, 152, 152, 228],
    [5, 138, 288, 145, 145, 219],
    [6, 146, 294, 153, 150.5, 228],
    [6, 148, 294, 154, 151, 230],
    [5, 143, 295, 151, 152, 226],
  ],
  [
    [6, 160, 295, 160, 151, 229],
    [6, 152, 277, 154, 142.5, 219],
    [6, 162, 297, 162, 152, 233],
    [5, 167, 285, 165, 146, 233],
    [5, 159, 294, 159, 151, 228],
    [5, 178, 189, 178, 97.5, 224],
    [5, 186, 194, 187, 100.5, 233],
    [5, 181, 186, 181, 95.5, 225],
    [5, 179, 185, 180, 96.5, 224],
    [6, 182, 172, 183, 89.5, 223],
    [4, 170, 309, 171, 151, 251],
    [5, 171, 302, 171, 147, 251],
    [5, 175, 288, 176, 140.5, 256],
    [5, 179, 306, 179, 149.5, 262],
    [6, 183, 301, 181, 143.5, 261],
    [6, 178, 274, 161, 112.5, 236],
    [5, 184, 287, 159, 112.5, 244],
    [6, 187, 269, 168, 108.5, 244],
    [6, 178, 285, 159, 111.5, 238],
    [6, 190, 267, 172, 106.5, 248],
  ],
  [
    [6, 242, 402, 331, 288.5, 395],
    [6, 253, 413, 336, 291.5, 405],
    [5, 237, 419, 329, 303, 393],
    [6, 242, 409, 330, 290.5, 394],
    [6, 265, 418, 360, 305.5, 424],
  ],
];
const images: (HTMLImageElement | undefined)[] = [];
let pending: Promise<boolean> | undefined;
const sprites = new Map<string, ArtSprite>();

/** Failed individual loads remain nonfatal and retain the authored fallback. */
export function loadSecondaryBuildings(): Promise<boolean> {
  if (images.filter(Boolean).length === ATLASES.length) return Promise.resolve(true);
  if (pending) return pending;
  pending = Promise.all(
    ATLASES.map(
      (file, index) =>
        new Promise<boolean>((resolve) => {
          if (images[index]) {
            resolve(true);
            return;
          }
          const image = new Image();
          image.onload = () => {
            if (image.naturalWidth !== file.width || image.naturalHeight !== file.height) {
              resolve(false);
              return;
            }
            images[index] = image;
            resolve(true);
          };
          image.onerror = () => resolve(false);
          image.src = file.url;
        }),
    ),
  ).then((results) => {
    pending = undefined;
    return results.every(Boolean);
  });
  return pending;
}

function source(type: string, age: number): readonly [number, number] | undefined {
  age = Math.max(1, Math.min(3, Math.round(age)));
  const canonical =
    type === 'armory' || type === 'foundry' ? 'workshop' : type === 'outpost' ? 'tower' : type;
  if (canonical === 'house') return [0, age - 1];
  if (age === 1) {
    switch (canonical) {
      case 'lumbercamp':
        return [4, 0];
      case 'miningcamp':
        return [4, 1];
      case 'granary':
        return [4, 2];
      case 'farm':
        return [5, 0];
      case 'barracks':
        return [5, 1];
      case 'stable':
        return [5, 2];
    }
  }
  if (age === 3) {
    switch (canonical) {
      case 'lumbercamp':
        return [6, 0];
      case 'miningcamp':
        return [6, 1];
      case 'granary':
        return [6, 2];
      case 'farm':
        return [6, 3];
      case 'barracks':
        return [7, 0];
      case 'stable':
        return [7, 1];
      case 'range':
        return [7, 2];
      case 'market':
        return [7, 3];
      case 'workshop':
        return [8, 0];
      case 'tower':
        return [8, 1];
      case 'fortress':
        return [8, 2];
      case 'stonegate':
        return [8, 3];
      case 'stonewall':
        return [9, 0];
    }
  }
  switch (canonical) {
    case 'lumbercamp':
      return [0, 3];
    case 'miningcamp':
      return [1, 0];
    case 'granary':
      return [1, 1];
    case 'farm':
      return [1, 2];
    case 'barracks':
      return [1, 3];
    case 'stable':
      return [2, 0];
    case 'range':
      return [2, 1];
    case 'market':
      return [2, 2];
    case 'workshop':
      return [2, 3];
    case 'tower':
      return [3, 0];
    case 'fortress':
      return [3, 1];
    case 'stonegate':
      return [3, 2];
    case 'stonewall':
      return [3, 3];
    default:
      return undefined;
  }
}

function star(c: CanvasRenderingContext2D, x: number, y: number, radius: number, points = 8) {
  c.beginPath();
  for (let n = 0; n < points * 2; n++) {
    const angle = (n * Math.PI) / points - Math.PI / 2,
      r = n % 2 ? radius * 0.44 : radius;
    const px = x + Math.cos(angle) * r,
      py = y + Math.sin(angle) * r;
    if (n === 0) c.moveTo(px, py);
    else c.lineTo(px, py);
  }
  c.closePath();
  c.fill();
}

/** Original miniature cultural crests, authored here rather than copied logos. */
function bannerCrest(
  c: CanvasRenderingContext2D,
  civ: string,
  x: number,
  y: number,
  width: number,
) {
  c.save();
  c.translate(x, y);
  c.scale(width / 24, width / 24);
  c.fillStyle = '#e5ca83';
  c.strokeStyle = '#e5ca83';
  c.lineWidth = 1.25;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  if (civ === 'roman') {
    c.beginPath();
    c.moveTo(0, -7);
    c.lineTo(3, -4);
    c.lineTo(2, -1);
    c.lineTo(10, -8);
    c.lineTo(9, -2);
    c.lineTo(5, 3);
    c.lineTo(2, 4);
    c.lineTo(3, 8);
    c.lineTo(0, 6);
    c.lineTo(-3, 8);
    c.lineTo(-2, 4);
    c.lineTo(-5, 3);
    c.lineTo(-9, -2);
    c.lineTo(-10, -8);
    c.lineTo(-2, -1);
    c.lineTo(-1, -4);
    c.lineTo(-2, -5);
    c.closePath();
    c.fill();
    for (const direction of [-1, 1])
      for (let n = 0; n < 4; n++) {
        c.save();
        c.translate(direction * (8 + n * 0.5), 2 + n * 2);
        c.rotate(direction * 0.65);
        c.beginPath();
        c.ellipse(0, 0, 1.1, 2.2, 0, 0, Math.PI * 2);
        c.fill();
        c.restore();
      }
  } else if (civ === 'mongol') {
    // A horse-head standard: ears, arched mane, muzzle and narrow neck.
    c.beginPath();
    c.moveTo(-6, 9);
    c.lineTo(-5, -3);
    c.lineTo(-8, -7);
    c.lineTo(-4, -6);
    c.lineTo(-2, -11);
    c.lineTo(0, -6);
    c.bezierCurveTo(6, -7, 8, -2, 8, 1);
    c.lineTo(4, 3);
    c.lineTo(2, 0);
    c.lineTo(0, 3);
    c.lineTo(1, 9);
    c.closePath();
    c.fill();
    c.beginPath();
    c.moveTo(-8, 11);
    c.lineTo(5, 11);
    c.stroke();
  } else if (civ === 'persian') {
    star(c, 0, -1, 5.5);
    for (const direction of [-1, 1]) {
      c.beginPath();
      c.moveTo(direction * 3, 0);
      c.lineTo(direction * 12, -7);
      c.lineTo(direction * 10, -1);
      c.lineTo(direction * 7, 3);
      c.lineTo(direction * 3, 4);
      c.closePath();
      c.fill();
      c.beginPath();
      c.moveTo(direction * 3, 6);
      c.lineTo(direction * 6, 9);
      c.stroke();
    }
    c.beginPath();
    c.moveTo(-3, 6);
    c.lineTo(3, 6);
    c.lineTo(1, 10);
    c.lineTo(-1, 10);
    c.closePath();
    c.fill();
  } else if (civ === 'daiviet') {
    drawDaiVietDragon(c);
  } else if (civ === 'tang') {
    for (let n = 0; n < 3; n++) {
      const yy = -6 + n * 5,
        half = 5 + n * 2.4;
      c.beginPath();
      c.moveTo(-half, yy - 2);
      c.quadraticCurveTo(-half + 2, yy + 2, 0, yy - 3);
      c.quadraticCurveTo(half - 2, yy + 2, half, yy - 2);
      c.lineTo(half - 2, yy + 1);
      c.lineTo(-half + 2, yy + 1);
      c.closePath();
      c.fill();
    }
    c.fillRect(-4, -4, 1.2, 12);
    c.fillRect(2.8, -4, 1.2, 12);
    c.fillRect(-7, 8, 14, 1.5);
    c.beginPath();
    c.moveTo(0, -12);
    c.lineTo(0, -9);
    c.stroke();
  } else {
    c.beginPath();
    c.arc(-2, 0, 9, 0.55, Math.PI * 2 - 0.55);
    c.arc(2, -1, 7, Math.PI * 2 - 0.65, 0.65, true);
    c.closePath();
    c.fill();
    star(c, 7, -2, 3.6, 5);
  }
  c.restore();
}

function drawCulturalBanner(
  c: CanvasRenderingContext2D,
  banner: BuildingBanner,
  team: number,
  x: number,
  y: number,
  height: number,
  width: number,
) {
  const age = Math.max(1, Math.min(3, banner.age));
  const top = y - height + 8,
    clothHeight = age === 1 ? 34 : age === 2 ? 44 : 56;
  const colors: Record<string, readonly [string, string]> = {
    roman: ['#b14a3d', '#6d2424'],
    mongol: ['#426f9d', '#203b62'],
    persian: ['#42a2a6', '#1d5d68'],
    tang: ['#b95342', '#7c2824'],
    ottoman: ['#4d9277', '#1e5448'],
    daiviet: ['#b75a3f', '#702a23'],
  };
  const [light, dark] = colors[banner.civ] ?? colors.roman;
  c.save();
  c.fillStyle = 'rgba(34,26,15,.26)';
  c.beginPath();
  c.ellipse(x + 1, y + 2, 6, 2.7, 0, 0, Math.PI * 2);
  c.fill();
  const pole = c.createLinearGradient(x - 1, y, x + 2, y);
  pole.addColorStop(0, '#6b4c2d');
  pole.addColorStop(0.45, '#c7a667');
  pole.addColorStop(1, '#745230');
  c.fillStyle = pole;
  c.fillRect(x - 1.5, y - height, 3, height);
  c.strokeStyle = age === 1 ? '#96754a' : '#d2b67a';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(x - 3, top - 2);
  c.lineTo(x + width + 3, top - 2);
  c.stroke();
  c.fillStyle = age === 1 ? '#b19b6b' : '#ddc484';
  star(c, x, y - height - 3, age === 3 ? 4 : 3, 4);
  const cloth = c.createLinearGradient(x, top, x + width, top + clothHeight);
  cloth.addColorStop(0, light);
  cloth.addColorStop(0.4, dark);
  cloth.addColorStop(0.68, light);
  cloth.addColorStop(1, dark);
  c.fillStyle = cloth;
  c.beginPath();
  c.moveTo(x + 1, top);
  c.lineTo(x + width, top + 1);
  c.lineTo(x + width - 2, top + clothHeight);
  c.lineTo(x + width * 0.52, top + clothHeight - 5);
  c.lineTo(x + 2, top + clothHeight);
  c.closePath();
  c.fill();
  c.strokeStyle = age === 1 ? '#b99f63' : '#dabd79';
  c.lineWidth = age === 3 ? 1.4 : 0.9;
  c.stroke();
  c.strokeStyle = team === 0 ? '#87d3c5' : '#d67665';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(x + 3, top + 2);
  c.lineTo(x + 3, top + clothHeight - 2);
  c.stroke();
  c.strokeStyle = 'rgba(255,224,160,.16)';
  c.lineWidth = 0.7;
  for (let n = 1; n <= 2; n++) {
    c.beginPath();
    c.moveTo(x + (width * n) / 3, top + 2);
    c.lineTo(x + (width * n) / 3 - 1, top + clothHeight - 8);
    c.stroke();
  }
  bannerCrest(c, banner.civ, x + width * 0.53, top + clothHeight * 0.45, width * 0.75);
  if (age === 3) {
    c.fillStyle = '#d1b578';
    for (const dx of [3, width - 3]) {
      c.beginPath();
      c.moveTo(x + dx, top + clothHeight);
      c.lineTo(x + dx + 1.5, top + clothHeight + 5);
      c.lineTo(x + dx - 1.5, top + clothHeight + 5);
      c.closePath();
      c.fill();
    }
  }
  c.restore();
}

/**
 * Geometry is relative to the side foundation corners, not the bitmap center.
 * Optional ground correction aligns visible corners while keeping vertical walls upright.
 */
export function renderRasterFoundation(
  image: HTMLImageElement | HTMLCanvasElement,
  frame: BuildingFrame,
  foundation: BuildingFoundation,
  size: number,
  team: number,
  type: string,
  banner?: BuildingBanner,
  integratedFlag = false,
  preserveAspect = false,
  alignGround = false,
): ArtSprite | undefined {
  const [sx, sy, sw, sh] = frame;
  const [lx, ly, rx, ry, fx, fy] = foundation;
  const centerX = (lx + rx) / 2,
    centerY = (ly + ry) / 2,
    width = size * 64,
    depth = size * 32;
  if (rx <= lx || fy <= centerY) return undefined;
  const projection = alignGround ? foundationProjection(foundation, size) : undefined;
  const scaleX = width / (rx - lx),
    scaleY = preserveAspect ? scaleX : depth / (2 * (fy - centerY));
  const sourcePoints: readonly [number, number][] = [
    [lx + rx - fx, ly + ry - fy],
    [rx, ry],
    [fx, fy],
    [lx, ly],
  ];
  // A thin wall/gate source must retain the atlas camera and reserve the same grid as construction.
  const footprint: readonly [number, number][] =
    projection?.footprint ??
    (preserveAspect
      ? [
          [0, -depth / 2],
          [width / 2, 0],
          [0, depth / 2],
          [-width / 2, 0],
        ]
      : sourcePoints.map(([x, y]) => [(x - centerX) * scaleX, (y - centerY) * scaleY]));
  const flag = !banner && !integratedFlag && !['farm', 'stonewall', 'towncenter'].includes(type);
  const flagX = banner ? width / 2 + 10 : footprint[1][0] * 0.7 + footprint[2][0] * 0.3;
  const flagY = banner ? depth * 0.04 : footprint[1][1] * 0.7 + footprint[2][1] * 0.3;
  const flagHeight = banner
    ? [64, 80, 94][Math.max(1, Math.min(3, banner.age)) - 1]
    : size >= 4
      ? 33
      : size <= 2
        ? 24
        : 28;
  const flagWidth = banner ? [24, 30, 34][Math.max(1, Math.min(3, banner.age)) - 1] : 10;
  const hasFlag = flag || !!banner;
  const big = size >= 4,
    small = size <= 2 && !['farm', 'stonegate', 'stonewall', 'armory'].includes(type);
  const minWidth = big ? 304 : small ? 180 : 248,
    minHeight = big ? 268 : small ? 210 : 234,
    minAnchorY = big ? 185 : small ? 149 : 168;
  const corners = projection
    ? [0, projection.splitX, sw].flatMap((x) => [
        projection.project(x, 0),
        projection.project(x, sh),
      ])
    : [
        [-centerX * scaleX, -centerY * scaleY],
        [(sw - centerX) * scaleX, (sh - centerY) * scaleY],
      ];
  const minX = Math.floor(Math.min(-minWidth / 2, ...corners.map(([x]) => x - 12)));
  const maxX = Math.ceil(
    Math.max(minWidth / 2, ...corners.map(([x]) => x + 12), hasFlag ? flagX + flagWidth + 12 : 0),
  );
  const minY = Math.floor(
    Math.min(-minAnchorY, ...corners.map(([, y]) => y - 12), hasFlag ? flagY - flagHeight - 12 : 0),
  );
  const maxY = Math.ceil(
    Math.max(minHeight - minAnchorY, ...corners.map(([, y]) => y + 12), hasFlag ? flagY + 8 : 0),
  );
  const pixelRatio = 2,
    anchorX = -minX,
    anchorY = -minY;
  const canvas = document.createElement('canvas');
  canvas.width = (maxX - minX) * pixelRatio;
  canvas.height = (maxY - minY) * pixelRatio;
  const c = canvas.getContext('2d');
  if (!c) return undefined;
  c.scale(pixelRatio, pixelRatio);
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
  if (projection) {
    projection.segments.forEach((m, i) => {
      const from = i === 0 ? 0 : projection.splitX,
        to = i === 0 ? projection.splitX : sw;
      c.save();
      c.translate(anchorX, anchorY);
      c.transform(m.a, m.b, 0, m.d, m.tx, m.ty);
      c.beginPath();
      c.rect(from, 0, to - from, sh);
      c.clip();
      c.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
      c.restore();
    });
  } else
    c.drawImage(
      image,
      sx,
      sy,
      sw,
      sh,
      anchorX - centerX * scaleX,
      anchorY - centerY * scaleY,
      sw * scaleX,
      sh * scaleY,
    );
  if (banner) {
    drawCulturalBanner(c, banner, team, anchorX + flagX, anchorY + flagY, flagHeight, flagWidth);
  } else if (flag) {
    const x = anchorX + flagX,
      y = anchorY + flagY;
    c.strokeStyle = '#75613e';
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x, y - flagHeight);
    c.stroke();
    const cloth = c.createLinearGradient(x, y - flagHeight, x + 10, y - flagHeight + 9);
    cloth.addColorStop(0, team === 0 ? '#9cd4ca' : '#e7a093');
    cloth.addColorStop(1, team === 0 ? '#2d7974' : '#8e3e32');
    c.fillStyle = cloth;
    c.beginPath();
    c.moveTo(x, y - flagHeight);
    c.lineTo(x + 10, y - flagHeight + 2);
    c.lineTo(x + 8, y - flagHeight + 9);
    c.lineTo(x, y - flagHeight + 7);
    c.closePath();
    c.fill();
  }
  return {
    canvas,
    anchorX: anchorX * pixelRatio,
    anchorY: anchorY * pixelRatio,
    pixelRatio,
    footprint,
  };
}

/** Defenses retain their original facade and footprint through age upgrades. */
export function renderSecondaryBuilding(
  type: string,
  civ: string,
  age: number,
  team: number,
  direction = 2,
): ArtSprite | undefined {
  const column = sharedAtlasColumn(civ);
  const sockets = STONE_BARRIER_SOCKETS[type]?.[column],
    location = source(type, sockets ? 2 : age),
    def = BUILDINGS[type];
  if (column < 0 || !location || !def || !images[location[0]]) return undefined;
  const [atlas, row] = location,
    axis = direction % 4 === 0 ? 'x' : 'y',
    key = `${type}:${column}:${atlas}:${row}:${team === 0 ? 0 : 1}:${sockets ? axis : ''}`;
  const cached = sprites.get(key);
  if (cached) return cached;
  const index = row * 5 + column;
  if (sockets) {
    const result = renderBarrier(
      isolatedFrame(images[atlas]!, FRAMES[atlas][index]),
      sockets,
      def.size,
      false,
      axis,
    );
    sprites.set(key, result);
    return result;
  }
  const result = renderRasterFoundation(
    images[atlas]!,
    FRAMES[atlas][index],
    FOUNDATIONS[atlas][index],
    def.size,
    team,
    type,
  );
  if (result) sprites.set(key, result);
  return result;
}
