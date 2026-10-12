import { CIV_SIEGE_ROSTER, CIV_UNIT_PROFILES, UNIT_COUNTERS } from './unit-profiles.ts';
export type CivId = 'roman' | 'mongol' | 'persian' | 'tang' | 'ottoman' | 'daiviet';
export type Resource = 'food' | 'wood' | 'gold' | 'stone';
export type Cost = Partial<Record<Resource, number>>;
export type Point = { x: number; y: number };
export const WORLD = 96;
/** AoE I classic base ratios at a fast real-time cadence. This game's training
 * times are already compressed, so do not also double the whole simulation. */
export const GATHER_RATES = {
  berries: 0.9,
  tree: 1.1,
  gold: 0.9,
  stone: 0.9,
  farm: 0.8,
  meat: 0.9,
};
export const CARRY_CAPACITY = 10;
/** Four reserved start slots; the current solo match uses the first two. */
export function mapLayout(size = WORLD): Point[] {
  return size === 64
    ? [
        { x: 13, y: 42 },
        { x: 50, y: 21 },
        { x: 13, y: 21 },
        { x: 50, y: 42 },
      ]
    : [
        { x: 18, y: Math.round(size * 0.72) },
        { x: size - 18, y: Math.round(size * 0.28) },
        { x: 18, y: Math.round(size * 0.28) },
        { x: size - 18, y: Math.round(size * 0.72) },
      ];
}
export const TICK = 0.05;
export const AGE_NAMES = ['Định cư', 'Quân sự', 'Đế quốc'];
export const RESOURCE_NAMES: Record<Resource, string> = {
  food: 'Lương thực',
  wood: 'Gỗ',
  gold: 'Vàng',
  stone: 'Đá',
};
export const CIVS: Record<
  CivId,
  {
    name: string;
    subtitle: string;
    description: string;
    icon: string;
    color: string;
    signature: string[];
    animals: string[];
  }
> = {
  roman: {
    name: 'La Mã',
    subtitle: 'Kỷ luật tạo nên đế chế',
    description:
      'Quân đoàn dựng khiên che xe Testudo áp sát. Onager bắn đá diện rộng đời III; công binh nối tuyến đồn.',
    icon: 'Ⅰ',
    color: '#c38760',
    signature: ['Quân đoàn & công binh', 'Testudo & Onager'],
    animals: ['deer', 'boar'],
  },
  mongol: {
    name: 'Mông Cổ',
    subtitle: 'Nhanh như gió thảo nguyên',
    description:
      'Kỵ cung cơ động, kỵ thương xung phong và trại di động. Không có xe ram; đời III dùng trebuchet đối trọng bắn xa.',
    icon: '↟',
    color: '#b7a278',
    signature: ['Kỵ cung & xung phong', 'Trebuchet đời III'],
    animals: ['gazelle', 'argali'],
  },
  persian: {
    name: 'Ba Tư',
    subtitle: 'Sức mạnh của một vương triều',
    description:
      'Cận vệ giữ tuyến, cung thủ bắn loạt và voi chiến. Đoàn lạc đà buôn tăng vàng; xe phá thành/máy đá yểm trợ.',
    icon: '✦',
    color: '#76b3ad',
    signature: ['Voi chiến đời III', 'Cận vệ & đoàn buôn'],
    animals: ['gazelle', 'goat'],
  },
  tang: {
    name: 'Đại Đường',
    subtitle: 'Trật tự, kỹ nghệ, uy lực',
    description:
      'Kiếm/thương binh và máy kéo dây công thành ngay đời II. Quân xưởng chọn tuyển nhanh hoặc giáp tốt; đời III thêm kỵ giáp nặng.',
    icon: '⌁',
    color: '#9da988',
    signature: ['Máy kéo dây đời II', 'Kiếm/thương & kỵ giáp'],
    animals: ['sika', 'boar'],
  },
  ottoman: {
    name: 'Ottoman',
    subtitle: 'Hỏa lực mở đường',
    description:
      'Kiếm và giáo bảo vệ bộ binh hỏa khí. Đời III dùng pháo đồng thay xe ram/máy đá; triển khai tại chỗ tăng nhịp bắn.',
    icon: '☽',
    color: '#bfab76',
    signature: ['Kiếm & hỏa khí', 'Pháo đồng triển khai'],
    animals: ['fallow', 'goat'],
  },
  daiviet: {
    name: 'Đại Việt',
    subtitle: 'Giữ nước bằng thế trận',
    description:
      'Bản sắc Lý–Trần–Lê: bộ binh phối hợp cung/nỏ, ngụ binh ư nông để huy động dân rồi giải ngũ. Đời III thêm tượng binh và hỏa khí sơ kỳ; cần bảo vệ kinh tế và chọn thời điểm phản công.',
    icon: '龍',
    color: '#b45d45',
    signature: ['Ngụ binh ư nông', 'Cung/nỏ & tượng binh'],
    animals: ['sika', 'boar'],
  },
};
export interface UnitDef {
  name: string;
  age: number;
  building: string;
  hp: number;
  damage: number;
  range: number;
  speed: number;
  cooldown: number;
  time: number;
  cost: Cost;
  role: 'civilian' | 'infantry' | 'ranged' | 'cavalry' | 'siege';
  civ?: CivId;
  allowedCivs?: readonly CivId[];
  trainable?: boolean;
  weapon?: 'bow' | 'crossbow' | 'firearm' | 'cannon';
  armor?: number;
  sight?: number;
  description: string;
  bonuses?: Partial<
    Record<
      'civilian' | 'infantry' | 'ranged' | 'cavalry' | 'siege' | 'building' | 'elephant',
      number
    >
  >;
  armorPenetration?: number;
  windup?: number;
  projectileSpeed?: number;
  splashRadius?: number;
  tradeYield?: number;
}
export const UNITS: Record<string, UnitDef> = {
  villager: {
    name: 'Dân',
    age: 1,
    building: 'towncenter',
    hp: 45,
    damage: 4,
    range: 0.8,
    speed: 2.2,
    cooldown: 1.2,
    time: 10,
    cost: { food: 50 },
    role: 'civilian',
    sight: 6,
    description: 'Khai thác, săn bắn, xây và sửa công trình.',
  },
  spear: {
    name: 'Giáo binh',
    age: 1,
    building: 'barracks',
    hp: 70,
    damage: 8,
    range: 1.1,
    speed: 2.25,
    cooldown: 1.3,
    time: 13,
    cost: { food: 45, wood: 20 },
    role: 'infantry',
    description: 'Sát thương lớn lên kỵ binh và voi chiến.',
  },
  scout: {
    name: 'Trinh sát',
    age: 1,
    building: 'stable',
    hp: 70,
    damage: 5,
    range: 1,
    speed: 3.6,
    cooldown: 1.1,
    time: 15,
    cost: { food: 70 },
    role: 'cavalry',
    sight: 10,
    description: 'Nhìn xa, tìm tài nguyên và thăm dò đối thủ.',
  },
  sword: {
    name: 'Bộ binh kiếm',
    age: 2,
    building: 'barracks',
    hp: 100,
    damage: 13,
    range: 0.9,
    speed: 2.2,
    cooldown: 1.2,
    time: 16,
    cost: { food: 55, gold: 25 },
    role: 'infantry',
    armor: 2,
    description: 'Giữ tuyến và áp sát cung thủ.',
  },
  archer: {
    name: 'Cung thủ',
    age: 2,
    building: 'range',
    hp: 50,
    damage: 8,
    range: 5,
    speed: 2.2,
    cooldown: 1.6,
    time: 16,
    cost: { wood: 35, gold: 30 },
    role: 'ranged',
    description: 'Bắn từ xa; cần bộ binh bảo vệ.',
  },
  lightcavalry: {
    name: 'Kỵ binh nhẹ',
    age: 2,
    building: 'stable',
    hp: 115,
    damage: 12,
    range: 1,
    speed: 3.4,
    cooldown: 1.1,
    time: 20,
    cost: { food: 80, gold: 35 },
    role: 'cavalry',
    description: 'Tập kích dân và lực lượng bắn xa.',
  },
  trader: {
    name: 'Thương nhân',
    age: 2,
    building: 'market',
    hp: 60,
    damage: 0,
    range: 0,
    speed: 2.6,
    cooldown: 1,
    time: 18,
    cost: { food: 50, wood: 50 },
    role: 'civilian',
    description: 'Chuột phải chợ thứ hai của mình để chạy tuyến vàng.',
  },
  ram: {
    name: 'Xe phá thành',
    age: 2,
    building: 'workshop',
    hp: 260,
    damage: 32,
    range: 1.2,
    speed: 1.3,
    cooldown: 2,
    time: 30,
    cost: { wood: 130, gold: 70 },
    role: 'siege',
    armor: 6,
    description: 'Chống tên, phá công trình; yếu trước quân cận chiến.',
  },
  catapult: {
    name: 'Máy bắn đá',
    age: 3,
    building: 'workshop',
    hp: 140,
    damage: 34,
    range: 7.8,
    speed: 1.3,
    cooldown: 4,
    time: 32,
    cost: { wood: 160, gold: 110 },
    role: 'siege',
    projectileSpeed: 7,
    splashRadius: 1.25,
    description: 'Bắn đạn đá có sát thương vùng nhỏ lên địch.',
  },
  legionary: {
    name: 'Quân đoàn',
    age: 2,
    building: 'barracks',
    hp: 130,
    damage: 15,
    range: 1,
    speed: 2.05,
    cooldown: 1.2,
    time: 22,
    cost: { food: 65, gold: 45 },
    role: 'infantry',
    civ: 'roman',
    armor: 3,
    description: 'Dựng khiên: giảm sát thương phía trước, đi chậm.',
  },
  engineer: {
    name: 'Công binh',
    age: 3,
    building: 'barracks',
    hp: 65,
    damage: 5,
    range: 0.9,
    speed: 2.3,
    cooldown: 1.2,
    time: 16,
    cost: { food: 55, gold: 30 },
    role: 'civilian',
    civ: 'roman',
    description: 'Xây đồn tiền tuyến và sửa nhanh gấp đôi dân.',
  },
  horsearcher: {
    name: 'Kỵ cung',
    age: 2,
    building: 'range',
    hp: 80,
    damage: 9,
    range: 5.2,
    speed: 3.6,
    cooldown: 1.5,
    time: 21,
    cost: { food: 55, wood: 35, gold: 40 },
    role: 'ranged',
    civ: 'mongol',
    description: 'Cơ động cao, giảm tốc trong nhịp khai hỏa.',
  },
  lancer: {
    name: 'Kỵ thương',
    age: 3,
    building: 'stable',
    hp: 145,
    damage: 17,
    range: 1.1,
    speed: 3.5,
    cooldown: 1.3,
    time: 27,
    cost: { food: 90, gold: 65 },
    role: 'cavalry',
    civ: 'mongol',
    description: 'Xung phong sau quãng chạy; bị giáo binh khắc chế.',
  },
  guard: {
    name: 'Cận vệ',
    age: 2,
    building: 'barracks',
    hp: 150,
    damage: 13,
    range: 1.1,
    speed: 2.1,
    cooldown: 1.2,
    time: 24,
    cost: { food: 70, gold: 50 },
    role: 'infantry',
    civ: 'persian',
    armor: 3,
    description: 'Bộ binh bền bỉ bảo vệ tuyến quân Ba Tư.',
  },
  guardarcher: {
    name: 'Cung thủ hộ vệ',
    age: 3,
    building: 'range',
    hp: 75,
    damage: 8,
    range: 5.6,
    speed: 2.1,
    cooldown: 3,
    time: 27,
    cost: { wood: 55, gold: 70 },
    role: 'ranged',
    civ: 'persian',
    description: 'Bắn ba mũi tên một loạt, cần chuẩn bị lại.',
  },
  elephant: {
    name: 'Voi chiến',
    age: 3,
    building: 'stable',
    hp: 500,
    damage: 28,
    range: 1.6,
    speed: 1.55,
    cooldown: 2,
    time: 45,
    cost: { food: 200, gold: 140 },
    role: 'cavalry',
    civ: 'persian',
    allowedCivs: ['persian', 'daiviet'],
    armor: 3,
    sight: 7,
    description: 'Đơn vị hiếm, nhiều máu, mạnh trước công trình; giáo gây sát thương lớn.',
  },
  vanguard: {
    name: 'Thương binh tiền vệ',
    age: 2,
    building: 'barracks',
    hp: 115,
    damage: 11,
    range: 1.4,
    speed: 2.15,
    cooldown: 1.2,
    time: 20,
    cost: { food: 60, wood: 30, gold: 25 },
    role: 'infantry',
    civ: 'tang',
    armor: 2,
    description: 'Giữ vị trí để chống xung phong và voi chiến.',
  },
  heavycavalry: {
    name: 'Kỵ binh giáp nặng',
    age: 3,
    building: 'stable',
    hp: 220,
    damage: 21,
    range: 1.2,
    speed: 2.8,
    cooldown: 1.3,
    time: 35,
    cost: { food: 120, gold: 95 },
    role: 'cavalry',
    civ: 'tang',
    armor: 5,
    description: 'Giáp dày, đắt và tuyển lâu.',
  },
  musketeer: {
    name: 'Bộ binh hỏa khí',
    age: 2,
    building: 'range',
    hp: 65,
    damage: 23,
    range: 5.8,
    speed: 2,
    cooldown: 3.3,
    time: 24,
    cost: { food: 45, gold: 60 },
    role: 'ranged',
    civ: 'ottoman',
    description: 'Đứng ngắm và khai hỏa, thời gian nạp dài.',
  },
  cannon: {
    name: 'Pháo đồng',
    age: 3,
    building: 'foundry',
    hp: 170,
    damage: 58,
    range: 8.5,
    speed: 1.2,
    cooldown: 5,
    time: 40,
    cost: { wood: 170, gold: 160 },
    role: 'siege',
    civ: 'ottoman',
    splashRadius: 1.25,
    description:
      'Pháo Ottoman thay máy đá/ram. Triển khai tăng nhịp bắn; di chuyển mất trạng thái chuẩn bị.',
  },
  militia: {
    name: 'Quân địa phương',
    age: 2,
    building: 'barracks',
    hp: 65,
    damage: 7,
    range: 1,
    speed: 2.3,
    cooldown: 1.5,
    time: 8,
    cost: { food: 20, wood: 10 },
    role: 'infantry',
    civ: 'daiviet',
    trainable: false,
    bonuses: { cavalry: 2, elephant: 2 },
    description:
      'Huy động từ dân tại doanh trại; yếu hơn quân thường trực. Giải ngũ để trở lại sản xuất, giữ tỷ lệ máu.',
  },
  crossbowman: {
    name: 'Nỏ binh Đại Việt',
    age: 2,
    building: 'range',
    hp: 55,
    damage: 12,
    range: 5.5,
    speed: 2.2,
    cooldown: 2,
    time: 20,
    cost: { wood: 40, gold: 40 },
    role: 'ranged',
    civ: 'daiviet',
    weapon: 'crossbow',
    bonuses: { infantry: 1.15 },
    description: 'Nỏ bắn từng tên mạnh sau tuyến bộ binh; nạp chậm, cần được bảo vệ trước kỵ binh.',
  },
  handcannoneer: {
    name: 'Bộ binh hỏa khí Đại Việt',
    age: 3,
    building: 'range',
    hp: 60,
    damage: 20,
    range: 5,
    speed: 2,
    cooldown: 3.6,
    time: 24,
    cost: { food: 45, gold: 60 },
    role: 'ranged',
    civ: 'daiviet',
    weapon: 'firearm',
    armorPenetration: 0.35,
    bonuses: { cavalry: 1.25 },
    description: 'Hỏa khí cầm tay sơ kỳ mở đời III, xuyên 35% giáp. Nạp lâu, cần bộ binh che chắn.',
  },
  daivietcannon: {
    name: 'Hỏa pháo Đại Việt',
    age: 3,
    building: 'workshop',
    hp: 135,
    damage: 38,
    range: 7,
    speed: 1.2,
    cooldown: 4.8,
    time: 36,
    cost: { wood: 150, gold: 120 },
    role: 'siege',
    civ: 'daiviet',
    weapon: 'cannon',
    splashRadius: 0.8,
    bonuses: { building: 2.2 },
    description:
      'Hỏa pháo sơ kỳ yểm trợ công thành đời III; tầm ngắn hơn pháo Ottoman, không có kỹ năng triển khai.',
  },
};
export interface BuildingDef {
  name: string;
  age: number;
  hp: number;
  size: number;
  time: number;
  cost: Cost;
  capacity?: number;
  accepts?: Resource[];
  civ?: CivId;
  damage?: number;
  range?: number;
  sight?: number;
  description: string;
}
export const BUILDINGS: Record<string, BuildingDef> = {
  towncenter: {
    name: 'Thành chính',
    age: 1,
    hp: 2000,
    size: 8,
    time: 0,
    cost: {},
    capacity: 15,
    accepts: ['food', 'wood', 'gold', 'stone'],
    damage: 8,
    range: 6,
    sight: 9,
    description:
      'Tuyển dân, lên đời, nhận mọi tài nguyên. Dành sân rộng cho kiến trúc ba đời. Không thể xây lại.',
  },
  house: {
    name: 'Nhà ở',
    age: 1,
    hp: 450,
    size: 2,
    time: 14,
    cost: { wood: 55 },
    capacity: 5,
    sight: 4,
    description: 'Thêm 5 chỗ dân; tối đa 200 mỗi bên.',
  },
  lumbercamp: {
    name: 'Trại gỗ',
    age: 1,
    hp: 450,
    size: 2,
    time: 14,
    cost: { wood: 65 },
    accepts: ['wood'],
    description: 'Nhận gỗ ở gần rừng.',
  },
  miningcamp: {
    name: 'Trại khai khoáng',
    age: 1,
    hp: 450,
    size: 2,
    time: 14,
    cost: { wood: 65 },
    accepts: ['gold', 'stone'],
    description: 'Nhận vàng và đá.',
  },
  granary: {
    name: 'Kho lương',
    age: 1,
    hp: 450,
    size: 2,
    time: 14,
    cost: { wood: 65 },
    accepts: ['food'],
    description: 'Nhận thịt, quả và lương thực từ ruộng.',
  },
  farm: {
    name: 'Ruộng',
    age: 1,
    hp: 150,
    size: 2,
    time: 10,
    cost: { wood: 55 },
    description: 'Nguồn lương thực duy trì; dân thu hoạch bằng chuột phải.',
  },
  barracks: {
    name: 'Doanh trại',
    age: 1,
    hp: 850,
    size: 3,
    time: 25,
    cost: { wood: 140 },
    description: 'Tuyển giáo binh và bộ binh.',
  },
  stable: {
    name: 'Chuồng ngựa',
    age: 1,
    hp: 850,
    size: 3,
    time: 25,
    cost: { wood: 150 },
    description: 'Tuyển trinh sát, kỵ binh và voi chiến Ba Tư đời III.',
  },
  range: {
    name: 'Trường bắn',
    age: 2,
    hp: 750,
    size: 3,
    time: 25,
    cost: { wood: 150 },
    description: 'Tuyển quân bắn xa và kỵ cung Mông Cổ.',
  },
  market: {
    name: 'Chợ',
    age: 2,
    hp: 800,
    size: 3,
    time: 25,
    cost: { wood: 130 },
    description: 'Tuyển thương nhân, giao dịch tài nguyên, chạy tuyến giữa hai chợ.',
  },
  workshop: {
    name: 'Xưởng công thành',
    age: 2,
    hp: 900,
    size: 3,
    time: 30,
    cost: { wood: 180, gold: 40 },
    description:
      'Tuyển khí giới riêng của đế chế: Testudo/Onager, xe Ba Tư, máy kéo dây Đại Đường hoặc trebuchet Mông Cổ. Ottoman dùng xưởng pháo.',
  },
  tower: {
    name: 'Tháp canh',
    age: 2,
    hp: 1000,
    size: 2,
    time: 25,
    cost: { wood: 70, stone: 110 },
    damage: 13,
    range: 7.5,
    sight: 11,
    description: 'Tầm nhìn và hỏa lực phòng thủ.',
  },
  woodwall: {
    name: 'Hàng rào gỗ',
    age: 1,
    hp: 300,
    size: 1,
    time: 6,
    cost: { wood: 12 },
    sight: 0,
    description: 'Vật cản; không tự đổi thành tường đá.',
  },
  woodgate: {
    name: 'Cổng gỗ',
    age: 1,
    hp: 380,
    size: 1,
    time: 8,
    cost: { wood: 22 },
    sight: 0,
    description: 'Quân mình đi qua, chặn quân đối phương.',
  },
  stonewall: {
    name: 'Tường đá',
    age: 2,
    hp: 1100,
    size: 1,
    time: 10,
    cost: { stone: 25 },
    sight: 0,
    description: 'Phòng thủ kiên cố, không tạo vùng nhìn.',
  },
  stonegate: {
    name: 'Cổng đá',
    age: 2,
    hp: 1200,
    size: 1,
    time: 12,
    cost: { stone: 40, wood: 20 },
    sight: 0,
    description: 'Quân mình đi qua, chặn quân đối phương.',
  },
  fortress: {
    name: 'Pháo đài',
    age: 3,
    hp: 2600,
    size: 4,
    time: 55,
    cost: { wood: 160, stone: 400 },
    damage: 30,
    range: 8,
    sight: 10,
    description: 'Giữ vị trí và bắn phòng thủ; không tuyển quân.',
  },
  outpost: {
    name: 'Đồn tiền tuyến',
    age: 3,
    hp: 950,
    size: 2,
    time: 22,
    cost: { wood: 80, stone: 65 },
    civ: 'roman',
    sight: 8,
    description: 'Đồn được nối tới thành chính hỗ trợ sửa và điểm tập kết.',
  },
  armory: {
    name: 'Quân xưởng',
    age: 2,
    hp: 750,
    size: 2,
    time: 25,
    cost: { wood: 120, gold: 60 },
    civ: 'tang',
    description: 'Chọn tuyển nhanh hoặc trang bị tốt; đổi mất 10 giây.',
  },
  foundry: {
    name: 'Xưởng pháo',
    age: 3,
    hp: 1000,
    size: 3,
    time: 35,
    cost: { wood: 200, gold: 80 },
    civ: 'ottoman',
    description: 'Tuyển pháo đồng.',
  },
};
export const AGE_COSTS: Cost[] = [
  { food: 400, gold: 180 },
  { food: 700, gold: 350 },
];
/** Town centers reserve eight tiles for future growth, while their actual wall
 * and ground footprint grows from four to six tiles across the three ages. */
export function buildingSize(type: string, civ?: CivId) {
  if (civ === 'daiviet' && type === 'stonegate') return 3;
  if (civ === 'daiviet' && type === 'fortress') return 5;
  return BUILDINGS[type]?.size ?? 1;
}

export function buildingFootprintSize(type: string, age = 1, civ?: CivId) {
  return type === 'towncenter'
    ? 3 + Math.max(1, Math.min(3, Math.round(age)))
    : buildingSize(type, civ);
}
export const AGE_TIMES = [40, 55];
export const ANIMAL_NAMES: Record<string, string> = {
  deer: 'Hươu đỏ',
  boar: 'Lợn rừng',
  gazelle: 'Linh dương',
  argali: 'Cừu hoang argali',
  goat: 'Dê hoang bezoar',
  fallow: 'Hươu fallow',
  sika: 'Hươu sao',
};
export const ANIMAL_FOOD: Record<string, number> = {
  deer: 180,
  boar: 320,
  gazelle: 180,
  argali: 320,
  goat: 320,
  fallow: 180,
  sika: 180,
};
const unitProfiles = new Map<string, UnitDef>();
export function unitDefinition(type: string, civ: CivId): UnitDef {
  const base = UNITS[type];
  if (!base) return base;
  const key = type + ':' + civ,
    cached = unitProfiles.get(key);
  if (cached) return cached;
  const profile = CIV_UNIT_PROFILES[civ]?.[type];
  const value = {
    ...base,
    ...profile,
    bonuses: { ...UNIT_COUNTERS[type], ...base.bonuses, ...profile?.bonuses },
    ...(type === 'musketeer'
      ? {
          armorPenetration: 0.5,
          description:
            'Hỏa khí xuyên một nửa giáp, mạnh trước kỵ giáp; bắn chậm, cần kiếm/giáo bảo vệ khi bị áp sát.',
        }
      : {}),
  };
  unitProfiles.set(key, value);
  return value;
}
export function unitAvailable(type: string, civ: CivId, age: number) {
  const d = unitDefinition(type, civ);
  return (
    !!d &&
    d.age <= age &&
    (d.allowedCivs ? d.allowedCivs.includes(civ) : !d.civ || d.civ === civ) &&
    (d.role !== 'siege' || CIV_SIEGE_ROSTER[civ].includes(type))
  );
}
export function civilizationUnits(civ: CivId, age: number) {
  return Object.keys(UNITS)
    .filter((type) => unitAvailable(type, civ, age))
    .map((type) => [type, unitDefinition(type, civ)] as const);
}
export function availableUnits(building: string, civ: CivId, age: number) {
  return civilizationUnits(civ, age).filter(
    ([, d]) => d.building === building && d.trainable !== false,
  );
}
export function buildingName(type: string, civ: CivId) {
  if (civ === 'daiviet' && type === 'tower') return 'Cột cờ';
  if (civ === 'daiviet' && type === 'stonegate') return 'Cổng thành';
  return BUILDINGS[type]?.name ?? '';
}

export function buildingAvailable(type: string, civ: CivId, age: number) {
  const d = BUILDINGS[type];
  return (
    !!d &&
    type !== 'towncenter' &&
    d.age <= age &&
    (!d.civ || d.civ === civ) &&
    !(type === 'workshop' && (civ === 'ottoman' || (civ === 'daiviet' && age < 3)))
  );
}
export function availableBuildings(civ: CivId, age: number) {
  return Object.entries(BUILDINGS).filter(([type]) => buildingAvailable(type, civ, age));
}
