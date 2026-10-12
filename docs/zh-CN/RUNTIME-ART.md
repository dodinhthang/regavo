# 运行时美术

[English](../en/RUNTIME-ART.md) | [Tiếng Việt](../vi/RUNTIME-ART.md) | **简体中文**

当前渲染规范，更新于 **2026 年 10 月 12 日**。源 PNG 字节保留，裁切、几何、色彩校准与效果由渲染器处理。本文描述当前选择；旧清单属于来源快照，并非当前加载器规范。

## 当前源选择

| 内容             | 当前来源/证据                                                                                                                                                                                                                                                        |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 原始五文明       | 城镇中心 v6（I）/v7（II–III）、附属建筑 v3/v6、单位/动作 v6、分文明商人/器械 v7                                                                                                                                                                                      |
| 波斯战象         | 五张 v9 PNG：[战象清单](../../public/art/units-elephant-v9.manifest.json)                                                                                                                                                                                            |
| 大越 I–II 建筑   | 原始独立图集及时代 II 城门/旗塔来源                                                                                                                                                                                                                                  |
| 大越 III 建筑    | [v9 共用图集](../../public/art/daiviet-v9.manifest.json)，主城/住宅改选 [v10](../../public/art/daiviet-v10.manifest.json)                                                                                                                                            |
| 大越建筑投影     | [v11 网格/地基证据](../../public/art/daiviet-grid-v11.manifest.json)                                                                                                                                                                                                 |
| 大越行走         | [v12 完整姿势](../../public/art/daiviet-walk-v12.manifest.json)，身体/RGB 校准                                                                                                                                                                                       |
| 大越村民/货物    | [工具校准](../../public/art/daiviet-worker-calibration.manifest.json)、[v13 货物](../../public/art/daiviet-cargo-v13.manifest.json)                                                                                                                                  |
| 大越共用龙徽     | [v4 徽记](../../public/art/daiviet-v4-emblem.manifest.json)                                                                                                                                                                                                          |
| 自然、动物、地形 | [资源](../../public/art/nature-v2.manifest.json)、[动物](../../public/art/wildlife-v3.manifest.json)、[行走 B](../../public/art/wildlife-walk-b.manifest.json)、[地面](../../public/art/terrain-v3.manifest.json)、[景物](../../public/art/scenery-v3.manifest.json) |

大越加载器当前加载 **30 张精灵图集，共 431 个注册帧，加一张徽记 PNG**。其中包括保留图集中已被更具体来源替代的帧。完整元数据还含历史建筑图集，因此历史注册总数不同于当前加载数。见[加载器](../../src/render/sheet-art.ts)、[基础元数据](../../src/render/daiviet-frames.json)、[货物元数据](../../src/render/daiviet-cargo-frames.json)。

## 几何与动作

参考缩放下地面格为 **64×32**。单位/动物使用 4× canvas，建筑/景物为 2×。四个源对角朝向通过最近方向选择覆盖八个查看方向。裁切必须包含完整轮廓、工具与操作组，图集格边界不能成为裁掉脚、帽或屋顶的理由。

主城可见地基为 **4/5/6 格**，预留区域 **8 格**，不能按预留区放大图片。大越石门地基 3×3，堡垒 5×5。投影对齐测量的左/右/前角；墙/门端点沿两轴对齐，垂直柱保持直立。放置、碰撞、预览与选择共享游戏地基规则。

行走使用完整姿势。大越步兵/村民 **A/D/B/C**、骑乘单位 **A/C/B/D**，火炮切换两组完整操作组接地姿势。相位按实际距离推进，停止则冻结，工坊按标称速度展示。旧 12/24 阶段肢体切片绑定已弃用。战斗使用独立蓄力/击发姿势，与模拟攻击阶段同步；箭/弹/闪光是原创矢量效果。

大越行走按同类型/朝向基准校准轮廓高度、上身宽度/锚点和 RGB，保持 alpha。村民工具姿势按解剖比例统一 X/Y 缩放，下蹲可比站立矮。货物按实际库存选择：木材、黄金、石料、肉类各有四方向四完整行走姿势，食物保留原篮子。其他文明用既有木材/袋子/材质标记，采集时仍显示工具。

## 首页预览与加载

首页使用相同运行时模型，但有大越**仅限预览的缩放**：主城 95%、兵营/马厩/靶场 82%、粮仓 88%、农田 94%、炮 90%。其他模型保留预览比例。不改变对局/工坊大小或逻辑地基。见[预览布局](../../src/ui/empire-preview-layout.ts)。

缓存有上限，加载器合并待完成请求并在文明切换时舍弃旧结果。普通流程优先当前来源，原型图集保留作证据/回退。[asset-origins.json](../../public/asset-origins.json)列出保留的源 PNG，包括历史素材；列入清单不等于当前会解码。

生产构建仅为渲染器或当前文明注册表引用的源图片生成无损 WebP，包括必要的回退图集。原始 PNG 和历史清单保留在仓库。图片和几何清单 URL 带有哈希，可使用不可变缓存；`dist/asset-manifest.json` 将部署副本对应到源文件哈希。`pnpm check:assets` 验证每张图片的解码 RGBA 与尺寸一致。首页预览按需加载选中文明、时代和静止姿势，不再预热其他文明；战斗与模型工坊仍加载完整动画。

## 共用文明美术注册

六个文明统一在 [civilization-art-data.ts](../../src/render/civilization-art-data.ts) 注册美术。共用图集布局保留原有五个文明列；独立图集使用 [sheet-art.ts](../../src/render/sheet-art.ts)。加载、单位/肖像渲染分派及建筑图片选择均通过此注册表。大越的来源与动作姿势声明位于 [civilizations/daiviet.ts](../../src/render/civilizations/daiviet.ts)，无需文明专用渲染器。现有裁切、校准、姿势顺序及源 PNG 保持不变。

为新文明添加美术：

1. 将运行时 PNG 放入 `public/art/`，记录来源、尺寸、裁切、锚点和哈希。独立单位图集的每个姿势行注册四个源朝向。
2. 添加 `src/render/civilizations/<id>.ts` 并导出 `SheetArtDefinition`：声明图集、单位动作/货物循环、各时代建筑及可选校准。可参考大越声明的结构；坐标与比例应针对新图片测量。
3. 在 `CIVILIZATION_ART` 注册定义。共用加载器/渲染器自动发现，无需添加文明专用分派分支或新测量脚本。仅当现有图集实际包含该文明的图片列时才适合使用 `shared` 布局。
4. 在对应模块添加文明 ID、兵种/机制、翻译、图标及菜单/预览内容。注册美术本身不会增加可玩的文明。

测量脚本与 `scripts/data/` 是当前大越美术的制作输入。新图片可以直接提供已测量元数据，校准配置可选。这些输入与运行时定义分开，不随 `dist/` 分发。

## 工具、记录与限制

工具包括[行走测量](../../scripts/measure-daiviet-walk-v12.py)、[行走校准](../../scripts/calibrate-daiviet-walk.py)、[工具校准](../../scripts/calibrate-daiviet-workers.py)、[货物测量](../../scripts/measure-daiviet-cargo-v13.py)。按导入要求使用 Python、Pillow/NumPy，正常安装/运行游戏无需这些工具。三个 JSON 输入文件位于 [scripts/data/](../../scripts/data/)，图像源为 `public/art/` 中保留的运行时 PNG。工具无需已删除的概念图或用户参考照片。

尚无完整死亡动画、建筑损坏集、完整工具动作或所有单位/时代独立制服。四个朝向及独立生成的服装差异仍存在。帧/裁切验证不能推出 400 单位 FPS。旧版数量和绑定试验保留在本地 QA 记录中；当前公开验证见[验证](VALIDATION.md)。

[权利](RIGHTS-AND-LICENSES.md)说明项目/用户输入与 AI 限制，[验证](VALIDATION.md)记录已通过检查。许可证正文保留原文。
