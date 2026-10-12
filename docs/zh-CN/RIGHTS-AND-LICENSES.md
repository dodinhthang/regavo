# 权利、素材来源与许可证

[English](../en/RIGHTS-AND-LICENSES.md) | [Tiếng Việt](../vi/RIGHTS-AND-LICENSES.md) | **简体中文**

更新于 **2026 年 10 月 11 日**。这是当前原型有范围限制的来源/许可证记录，并非独占权证明。第三方声明原文单独保留。仓库未向原创游戏代码、美术或音频授予公开再使用许可。

## 原创内容

原创 TypeScript/Canvas/SVG/CSS 提供模拟、渲染、UI、徽记及效果。音乐和音效由原创 Web Audio 代码合成。UI 使用系统字体，不分发第三方字体、库存图标包或外部录音。没有导入 Age of Empires 的精灵、标志、截图、UI、音频或代码。AoE 是玩法/经济参考，不属于 Regavo 品牌。

仓库公开可见不会使依赖许可证覆盖原创内容。第三方版权仍属各自作者。“Regavo” 是工作名称；本记录未包含已完成的商标检索或名称独占认定。

## 依赖证据

直接版本：**PixiJS 8.13.2**、**React/React DOM 19.2.0**、**Vite 7.3.7**、**TypeScript 5.9.3**。开发工具包括 ESLint、typescript-eslint、React Hooks lint 和 Prettier。具体安装图由审计记录，不在本文固定为永久包数。

| 组件                          | 许可证                                         | 分发记录                         |
| ----------------------------- | ---------------------------------------------- | -------------------------------- |
| PixiJS、React/React DOM、Vite | MIT                                            | 保留相关版权与许可证文本         |
| TypeScript 和部分工具         | Apache-2.0                                     | 保留相关许可证/声明及修改记录    |
| 其他已检查依赖                | ISC、BSD-2-Clause、BSD-3-Clause、BlueOak-1.0.0 | 保留相应声明/条款                |
| caniuse-lite 开发数据         | CC-BY-4.0                                      | 保留署名与许可证，原始数据未修改 |

[Blue Oak 1.0.0](https://blueoakcouncil.org/license/1.0.0) 和 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.en)仅适用于相应工具/数据，不适用于原创游戏美术。WebGL/DOM/Web Worker 是调用的 API，并非仓库分发浏览器实现代码。

包来源、哈希和声明（包括嵌入组件）见 [THIRD-PARTY-NOTICES.md](../../THIRD-PARTY-NOTICES.md)、[dependency-audit.json](../../licenses/dependency-audit.json)和[分发的许可证原文](../../public/third-party-licenses.txt)。上游补充证据见 [dependency-fallbacks.json](../../licenses/upstream/dependency-fallbacks.json)。这些文件自动生成，不编辑或翻译第三方原文。

依赖/平台变更后运行 `pnpm audit:licenses`，再运行 `pnpm check:licenses`。审计跟踪可达运行时/构建依赖，排除 store 残留项。OS/CPU 的可选平台包不同，快照不是通用包数。通过仅验证记录的依赖图/声明，不认证美术所有权或全部法律风险。

## AI 美术与参考

概念图和图集通过集成 `image_gen` 生成/编辑。输入包括项目图像**以及用户为大越提供的雕塑/建筑参考**。文明文档中的博物馆/历史链接用于研究，不授予复制图片的许可。本记录没有确定参考照片或所摄物件的独占权。

OpenAI 的 [Terms of Use](https://openai.com/policies/terms-of-use/#content) 和 [Services Agreement](https://openai.com/policies/services-agreement/)依适用法律及账户合同描述输出所有权。输出可能与他人相似。尚未核实账户合同类型，也不认证独占版权或第三方权利已清理。

运行时提示词、保留的源 PNG、SHA-256、帧及锚点见[运行时清单](RUNTIME-ART.md)。原始参考图片与多余概念图/草稿已删除。保留 PNG 的字节不变，完整姿势校准仅改变缓存几何/RGB。大越使用 v4 龙徽、v9/v10 建筑、v11 地基、v12 行走及 v13 货物。历史 SVG/绑定不代表当前渲染规范。

## 公开与私有文件

- `public/art/` 的运行时 PNG、源元数据和文档均复制到网站构建。公开来源采用仓库相对路径或生成 ID，不包含个人文件系统路径。
- `src/assets/battlefield.png` 是 UI CSS 导入的背景图，Vite 将其输出为文件名带哈希的构建资源；文明预览由运行时精灵组成。
- `scripts/data/` 保存美术测量/校准工具与测试使用的三个 JSON 输入文件，其图像源为 `public/art/` 中保留的运行时 PNG。
- 用户参考照片及多余概念图/草稿已删除。公开记录保留其设计用途说明，不发布原始输入图片。
- 原始工具路径映射及标准化前记录保存在本地忽略的 `.openai/*local*` 文件中，属于私有证据，不是可移植仓库依赖。

不要将 AI 图像标为 CC0、公共领域、“copyright-free”或保证独占。添加 LICENSE、去背景或单独重绘不代表第三方权利已清理。未来素材需合适来源/权利记录；当前记录仍受参考来源及账户合同限制。
