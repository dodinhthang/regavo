# Economy and cargo

**English** | [Tiếng Việt](../vi/ECONOMY.md) | [简体中文](../zh-CN/ECONOMY.md)

Current rules, reviewed on **11 October 2026**. Food, wood, gold and stone are shared stockpiles. Hunting meat is a food source, not a fifth currency. Resources enter the stockpile only after delivery to a completed, valid drop-off.

## Gathering rates

Base rates are resources per villager per simulation second, before travel, congestion or work interruptions. Match speed changes elapsed simulation time, not these base values.

| Source         | Resource | Rate |
| -------------- | -------- | ---: |
| Berries        | Food     | 0.90 |
| Trees          | Wood     | 1.10 |
| Gold deposit   | Gold     | 0.90 |
| Stone deposit  | Stone    | 0.90 |
| Farm           | Food     | 0.80 |
| Animal carcass | Food     | 0.90 |

Villagers carry at most **10** resources. Changing resource type first delivers the old load; cargo is lost on death. Current cargo appearance follows inventory rather than the newly assigned job. Villagers use work tools while gathering, and carrying poses during the return trip.

## Effective income

A useful approximation for one villager is:

```text
income ≈ C / (C/r + 2d/v + t)
```

`C` is cargo capacity, `r` gathering rate, `d` one-way travel distance, `v` movement speed and `t` delivery time. Real paths, work slots and blocked access can make this estimate optimistic. Six berry gatherers near a drop-off can sustain the baseline villager cost of **50 food every 10 seconds** in a favorable setup; distant or crowded sources need more villagers or a closer drop-off. One bush has limited work slots. Economy tests measure delivered stockpile income and do not count undelivered cargo.

Trade runs between two of your own completed markets. Longer routes pay more gold per trip but also take more time; Persian trade has a ×1.3 multiplier before rounding. Trade needs safe access at both ends.

## Đại Việt: production versus reserves

From age II, mobilizing a villager costs **20 food + 10 wood** and removes that worker from production. Existing cargo is delivered first; travel and delivery are additional to **8 seconds** of barracks training. Without a valid drop-off, a loaded villager waits rather than discarding or crediting cargo automatically.

Demobilization costs no resources, requires another eight seconds at the barracks and refunds no used equipment. Cancel before training for a full mobilization refund; during training, the refund is `remaining/8 × cost`. Death loses cargo and refunds nothing. Conversion preserves HP percentage. The militia cap of **12** includes mobilizing, active and demobilizing reserves. AI keeps at least ten economic villagers and demobilizes after 30 seconds without a visible local threat.

Đại Việt has baseline gathering/carry/trade yields. Rice-field art changes by age, with the same farm mechanics. Maintaining production while preparing defenses is the central tradeoff; militia are temporary reserves rather than free soldiers.

## Calibration references

The starting rhythm was informed by Claude Pitre's 27 May 1998 [Bronze Time Study](https://groups.google.com/g/microsoft.public.ageofempires/c/ZGElKA11ea8): 2.28/2.56/1.75 villager-seconds per resource for forage/farm/wood and 20-second villager recruitment. Its measurement settings are not documented well enough to treat these as official raw statistics. The [Forgotten Empires DE changelog](https://www.forgottenempires.net/age-of-empires-definitive-edition/balance-changelog) also distinguishes DE balance from the original game.

Regavo uses chosen approximate base rates of 0.45 berries/meat/gold/stone, 0.55 wood and 0.40 farming, multiplied by two to match its ten-second villager rhythm. Gold/stone rates, this multiplier and carry capacity are project tuning choices; no reference above proves them as original AoE statistics. Global simulation speed is not simultaneously forced to 2×.

Implementation: [rates and capacity](../../src/game/data.ts), [gathering/delivery/trade](../../src/game/engine.ts), [gathering tests](../../tests/gathering.test.ts) and [cargo tests](../../tests/cargo.test.ts). See [civilizations](CIVILIZATIONS.md) for conversion rules and [force deployment](FORCE-DEPLOYMENT.md) for protecting the economy.
