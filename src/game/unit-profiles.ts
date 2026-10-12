import type { CivId, UnitDef } from './data.ts';

/** Game design profiles, rather than claims of historical combat statistics. */
export const CIV_UNIT_PROFILES: Record<CivId, Record<string, Partial<UnitDef>>> = {
  daiviet: {
    spear: { name: 'Giáo binh Đại Việt' },
    sword: {
      name: 'Cấm quân Đại Việt',
      description:
        'Bộ binh thường trực giữ tuyến cho cung/nỏ; bảo vệ quân huy động và áp sát quân bắn xa.',
    },
    archer: { name: 'Cung thủ Đại Việt' },
    scout: { name: 'Kỵ trinh sát Đại Việt' },
    lightcavalry: {
      name: 'Kỵ binh nhẹ Đại Việt',
      hp: 105,
      damage: 11,
      speed: 3.2,
      description:
        'Thăm dò và tập kích tuyến buôn; ít lợi thế khi giao chiến trực diện với kỵ binh mạnh.',
    },
    trader: {
      name: 'Thương nhân Đại Việt',
      description:
        'Áo vải, khăn đầu và xe thồ gốm, giỏ hàng. Chạy tuyến vàng giữa hai chợ; cần được hộ tống.',
    },
    elephant: {
      name: 'Tượng binh Đại Việt',
      hp: 380,
      damage: 22,
      armor: 2,
      speed: 1.7,
      time: 38,
      cost: { food: 170, gold: 110 },
      description:
        'Voi cùng quản tượng Đại Việt đời III, tối đa 6 con kể cả hàng chờ. Hỗ trợ bộ binh phá tuyến; giáo binh khắc chế mạnh.',
    },
  },
  roman: {
    spear: {
      name: 'Giáo binh La Mã',
      hp: 78,
      armor: 1,
      description: 'Giáo phụ trợ giữ sườn; khắc chế ngựa và voi, cần khiên bảo vệ trước cung.',
    },
    sword: {
      name: 'Kiếm binh La Mã',
      hp: 105,
      armor: 3,
      description: 'Bộ binh giáp tốt áp sát cung thủ; phối hợp quân đoàn dựng khiên.',
    },
    archer: {
      name: 'Cung thủ La Mã',
      hp: 55,
      range: 4.8,
      description: 'Hỗ trợ sau tuyến khiên; yếu trước kỵ binh tập kích.',
    },
    scout: { name: 'Kỵ trinh sát La Mã', hp: 80, speed: 3.4 },
    lightcavalry: {
      name: 'Kỵ phụ trợ La Mã',
      hp: 125,
      armor: 1,
      speed: 3.15,
      description: 'Đánh sườn quân bắn xa; cần tránh đội giáo.',
    },
    trader: {
      name: 'Thương nhân đường La Mã',
      hp: 65,
      armor: 1,
      speed: 2.4,
      description:
        'Áo tunic, la thồ và hàng gốm. Chạy tuyến vàng giữa hai chợ của mình; giáp nhẹ, cần được hộ tống.',
    },
    ram: {
      name: 'Xe công thành Testudo',
      hp: 300,
      damage: 30,
      armor: 7,
      speed: 1.05,
      cost: { wood: 150, gold: 80 },
      windup: 0.5,
      description:
        'Xe bọc mái kiểu La Mã, kíp công binh áo đỏ. Chịu tên tốt và phá cổng ở cự ly gần; chậm, cần bộ binh hộ tống.',
    },
    catapult: {
      name: 'Onager La Mã',
      hp: 150,
      range: 7.2,
      speed: 1.1,
      windup: 0.55,
      splashRadius: 1.35,
      bonuses: { building: 1.35 },
      description:
        'Máy bắn đá xoắn dây, kíp La Mã. Đạn đá có vùng sát thương rộng; yếu khi kỵ binh áp sát.',
    },
  },
  mongol: {
    spear: {
      name: 'Giáo binh thảo nguyên',
      hp: 60,
      damage: 9,
      speed: 2.45,
      description: 'Giáo cơ động chặn ngựa/voi; giáp nhẹ, không hợp giữ tuyến trước cung.',
    },
    sword: {
      name: 'Kiếm binh Mông Cổ',
      hp: 85,
      damage: 14,
      armor: 1,
      speed: 2.5,
      description: 'Bộ binh nhẹ áp sát quân bắn xa; thua tuyến giáp nặng nếu đánh lâu.',
    },
    archer: {
      name: 'Cung thủ Mông Cổ',
      cooldown: 1.3,
      speed: 2.4,
      description: 'Nhịp bắn nhanh, hỗ trợ kỵ cung; cần tránh kỵ binh và khiên.',
    },
    scout: { name: 'Kỵ trinh sát Mông Cổ', speed: 4.1, sight: 11 },
    lightcavalry: {
      name: 'Kỵ đột kích Mông Cổ',
      hp: 105,
      damage: 13,
      speed: 3.9,
      cooldown: 1,
      description: 'Kỵ nhẹ nhanh nhất, săn dân và cung thủ; giáp mỏng, rất yếu trước giáo.',
    },
    trader: {
      name: 'Thương nhân thảo nguyên',
      hp: 55,
      speed: 3.05,
      cost: { food: 45, wood: 45 },
      description:
        'Áo deel xanh, mũ lông và ngựa thồ nhỏ chở cuộn nỉ. Tuyến thương mại nhanh, nhưng dễ bị tập kích.',
    },
    catapult: {
      name: 'Trebuchet Mông Cổ',
      hp: 170,
      damage: 50,
      range: 9.5,
      speed: 0.9,
      cooldown: 5.5,
      time: 38,
      cost: { wood: 200, gold: 150 },
      windup: 0.65,
      projectileSpeed: 6,
      splashRadius: 1,
      bonuses: { building: 2, ranged: 1 },
      description:
        'Máy đối trọng đời III, gợi giai đoạn tiếp nhận kỹ thuật công thành thế kỷ XIII. Bắn xa và phá nhà mạnh, nạp chậm; không có xe ram ở đời II.',
    },
  },
  persian: {
    spear: {
      name: 'Giáo binh Ba Tư',
      hp: 85,
      armor: 1,
      speed: 2.05,
      description: 'Giáo bền giữ sườn cho cung và voi; khắc chế kỵ binh.',
    },
    sword: {
      name: 'Kiếm binh Ba Tư',
      hp: 110,
      damage: 12,
      armor: 3,
      speed: 2.05,
      description: 'Kiếm giáp tốt bảo vệ cung thủ; áp sát quân bắn xa, ít cơ động.',
    },
    archer: {
      name: 'Cung thủ Ba Tư',
      damage: 9,
      range: 5.2,
      cooldown: 1.65,
      description: 'Cung mạnh sau tuyến cận vệ; kỵ binh có thể phá tuyến nếu thiếu giáo.',
    },
    scout: { name: 'Kỵ trinh sát Ba Tư', hp: 75, speed: 3.5 },
    lightcavalry: {
      name: 'Kỵ hoàng triều Ba Tư',
      hp: 135,
      armor: 2,
      speed: 3.25,
      description: 'Kỵ bền đánh sườn cung thủ; không dùng để lao vào giáo.',
    },
    trader: {
      name: 'Đoàn buôn Ba Tư',
      hp: 75,
      speed: 2.4,
      tradeYield: 1.3,
      description:
        'Áo dài xanh ngọc và lạc đà thồ thảm. Mỗi chặng nhận thêm 30% vàng, cần bảo vệ tuyến để nuôi quân voi.',
    },
    ram: {
      name: 'Xe phá thành Ba Tư',
      hp: 280,
      damage: 34,
      speed: 1.15,
      windup: 0.5,
      description:
        'Xe bọc da, kíp công thành Ba Tư mặc xanh ngọc. Phá công trình ở cự ly gần; phối hợp cận vệ và voi, yếu trước quân cận chiến.',
    },
    catapult: {
      name: 'Máy bắn đá Ba Tư',
      hp: 160,
      damage: 36,
      range: 7.5,
      speed: 1.15,
      cooldown: 4.4,
      windup: 0.5,
      splashRadius: 1.1,
      bonuses: { building: 1.4 },
      description:
        'Máy bắn đá với kíp Ba Tư, lấy cảm hứng công thành thời Sasanian. Hỗ trợ voi/cận vệ phá nhà; cần tránh kỵ binh đánh sườn.',
    },
  },
  tang: {
    spear: {
      name: 'Giáo binh Đại Đường',
      hp: 80,
      damage: 9,
      range: 1.25,
      description: 'Giáo dài chặn ngựa và voi; cung thủ có thể tiêu hao từ ngoài tầm.',
    },
    sword: {
      name: 'Kiếm binh Đại Đường',
      hp: 110,
      damage: 16,
      speed: 2.15,
      description: 'Kiếm mạnh giữ tuyến và áp sát cung/hỏa khí; phối hợp thương binh chống kỵ.',
    },
    archer: {
      name: 'Cung thủ Đại Đường',
      range: 5.5,
      description: 'Tầm cung xa yểm trợ tuyến kiếm/thương; cần được che chắn trước kỵ binh.',
    },
    scout: { name: 'Kỵ trinh sát Đại Đường', hp: 80, speed: 3.4 },
    lightcavalry: {
      name: 'Kỵ binh Đại Đường',
      hp: 125,
      damage: 14,
      armor: 3,
      speed: 3.1,
      description: 'Kỵ giáp tốt đánh quân bắn xa; giáo/voi vẫn là mối đe dọa.',
    },
    trader: {
      name: 'Thương nhân tơ lụa',
      hp: 70,
      speed: 2.45,
      cost: { food: 45, wood: 45 },
      description:
        'Áo dài đỏ, mũ mềm đen và lạc đà hai bướu chở tơ. Tuyển rẻ hơn, chạy tuyến vàng giữa hai chợ của mình.',
    },
    catapult: {
      name: 'Máy kéo dây Đại Đường',
      age: 2,
      hp: 120,
      damage: 23,
      range: 6.5,
      speed: 1.35,
      cooldown: 3,
      time: 26,
      cost: { wood: 130, gold: 70 },
      windup: 0.35,
      projectileSpeed: 8,
      splashRadius: 0.75,
      bonuses: { building: 1.6, ranged: 1 },
      description:
        'Máy bắn đá kéo dây bằng sức người, kíp áo đỏ; mở từ đời II. Rẻ và bắn nhanh hơn máy đối trọng, tầm ngắn và sát thương thấp; không có xe ram.',
    },
  },
  ottoman: {
    spear: {
      name: 'Giáo binh Ottoman',
      hp: 65,
      cost: { food: 40, wood: 18 },
      description: 'Giáo rẻ che sườn cho hỏa khí/pháo, chặn kỵ và voi; yếu trước cung.',
    },
    sword: {
      name: 'Kiếm binh Ottoman',
      hp: 90,
      damage: 17,
      armor: 1,
      speed: 2.35,
      cooldown: 1.35,
      description: 'Kiếm cong đánh mạnh khi áp sát; bảo vệ hỏa khí nhưng giáp nhẹ.',
    },
    archer: {
      name: 'Cung thủ Ottoman',
      hp: 55,
      damage: 9,
      range: 4.8,
      cooldown: 1.5,
      description: 'Cung nhẹ cho giai đoạn đầu; đời II thêm hỏa khí xuyên giáp.',
    },
    scout: { name: 'Kỵ trinh sát Ottoman', hp: 65, speed: 3.8 },
    lightcavalry: {
      name: 'Kỵ binh Ottoman',
      hp: 130,
      damage: 15,
      speed: 3.2,
      description: 'Đánh sườn cung và pháo; không thay giáo bảo vệ tuyến hỏa khí.',
    },
    trader: {
      name: 'Đoàn buôn Ottoman',
      hp: 80,
      speed: 2.3,
      armor: 1,
      description:
        'Áo kaftan xanh, khăn quấn trắng và lạc đà chở vải. Đoàn buôn bền hơn, đi chậm; tuyến vàng cần kiếm/giáo hộ tống.',
    },
  },
};

/** Curated game roster. Exclusion is a design choice, not a claim that a
 * civilization never used or encountered another siege technology. */
export const CIV_SIEGE_ROSTER: Record<CivId, readonly string[]> = {
  daiviet: ['daivietcannon'],
  roman: ['ram', 'catapult'],
  mongol: ['catapult'],
  persian: ['ram', 'catapult'],
  tang: ['catapult'],
  ottoman: ['cannon'],
};

export const UNIT_COUNTERS: Record<string, NonNullable<UnitDef['bonuses']>> = {
  spear: { cavalry: 3, elephant: 4 },
  vanguard: { cavalry: 3, elephant: 4 },
  sword: { ranged: 1.3 },
  legionary: { ranged: 1.25 },
  guard: { infantry: 1.2 },
  archer: { infantry: 1.15 },
  guardarcher: { infantry: 1.15 },
  scout: { ranged: 1.2, civilian: 1.2 },
  lightcavalry: { ranged: 1.4, civilian: 1.3 },
  horsearcher: { civilian: 1.35 },
  lancer: { ranged: 1.35 },
  heavycavalry: { ranged: 1.4 },
  elephant: { building: 2, infantry: 1.2 },
  ram: { building: 3 },
  catapult: { ranged: 1.2 },
  cannon: { building: 2.2 },
  musketeer: { cavalry: 1.25 },
};
