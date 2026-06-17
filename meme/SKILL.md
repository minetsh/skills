---
name: meme
description: 从文字描述或参考图制作透明背景的表情包/meme 贴纸素材，尤其是符合微信表情开放平台规范的 1:1 情绪/表情贴纸，并生成微信「提交表情专辑」提交预览页。画面风格依据参考图或用户要求而定（如 Q 版、写实、简笔画、像素、二次元等），并非固定 Q 版。当用户需要透明背景的 emoji/表情/sticker 图片、宠物/角色表情、情绪含义词（如“开心”）、固定尺寸（如 240x240）、白色描边、抠绿/chroma-key 去背、自动生成提交文案（名称/介绍/版权/含义词/风格/主题）与带复制按钮的提交预览 HTML，或需要可复用的微信表情制作/提交流程文档时使用。
---

# 表情包制作（Meme）

## 概述

通过可复用的“图像生成 + 后处理”流程制作透明背景表情包。默认产出符合微信表情开放平台规范的 240x240 PNG：透明背景、主体居中、情绪含义词置于底部且不遮挡脸部。画面风格不固定为 Q 版——有参考图时沿用参考图的画风（如写实、简笔画、像素、二次元等），无参考图时按用户要求或表情主题选择合适风格。

本技能配合内置的 `imagegen` 技能使用：先用图像生成完成创意栅格画面，再用 `scripts/prepare_sticker.py` 做确定性的去背、缩放、可选白色描边补强与校验。素材齐备后，用 `scripts/build_preview.py` 根据主题与规范自动生成微信「提交表情专辑」提交预览页 `preview.html`（含素材展示、自动文案与逐项复制按钮）。

规范来源：微信表情开放平台「表情制作规范」（https://sticker.weixin.qq.com/cgi-bin/mmemoticon-bin/readtemplate?t=guide/index.html#/makingSpecifications ）。下方约束以官方规范为准。

## 微信官方表情制作规范（核心约束）

### 表情设计原则

1. 提交的表情必须为设计者原创，或拥有版权。
2. 应充分考虑微信用户的聊天场景，适合聊天中使用。
3. 表情应生动有趣。
4. 不能违反《微信作品审核标准》。

### 素材清单

| 素材名称 | 数量 | 格式 | 尺寸（像素） | 文件大小 |
|---|---|---|---|---|
| 表情图 | 8～24（单品可为 1 张） | 动态：GIF；静态：PNG、JPG 或 GIF | 240×240 | ≤500KB |
| 详情页横幅 | 1 | PNG 或 JPG | 750×400 | ≤500KB |
| 表情封面图 | 1 | PNG | 240×240 | ≤500KB |
| 聊天面板图标 | 1 | PNG | 50×50 | ≤100KB |

超出尺寸/大小的素材会被平台自动压缩和裁剪。表情单品仅需 1 张表情图，填写含义词并选择标签即可提交（暂不支持推广形象、推广信息或人物肖像）。

### 表情图（聊天中发送的图片）

1. 动态表情须为 GIF，240×240，≤500KB。
2. 静态表情须为 JPG / PNG / GIF，240×240，≤500KB。
3. 同一套专辑须统一为动态或静态。
4. 专辑数量为 8～24 之间任意数量。
5. 动态表情应循环播放，节奏流畅不卡顿。
6. 合理安排布局，每张不应有过多留白。
7. 同套各图风格须统一。
8. 同套各图应有足够差异。

### 表情封面图

1. PNG，240×240，≤500KB。
2. 选取最具辨识度的形象，建议用正面半身像或全身像，避免只用头部。
3. 形象不应有白色描边，并避免锯齿。
4. 须透明背景。
5. 避免白色背景。
6. 不要出现正方形边框，避免主体出现生硬的直角边缘。
7. 合理布局，不应有过多留白；画面简洁，避免装饰元素。
8. 除纯文字类型外，避免出现文字。
9. 不同专辑应使用不一样的封面。

### 聊天页图标

1. PNG，50×50，≤100KB。
2. 选取最具辨识度的形象，生成的图片尽量为角色的头部（建议用仅含角色头部的正面图像）；画面简洁。
3. 形象不应有白色描边，并避免锯齿。
4. 须透明背景。
5. 避免白色背景。
6. 不要出现正方形边框。
7. 合理布局，不应有过多留白。
8. 不同专辑应使用不一样的图标。

### 详情页横幅

1. JPG 或 PNG，750×400，≤500KB。
2. 避免出现任何文字信息。
3. 色调活泼明朗，与微信底色有区分，避免白色背景。
4. 内容须与表情有关，画面丰富、有故事性。
5. 元素不能因拉伸/压扁而变形；避免透明背景。
6. 主体不要太偏上部，视觉重心应保持在画面中部或略低位置，避免顶部拥挤、下方大面积空置。

### 文案规范

文字尽量用中文，必要时用英文，避免生僻字；方言用汉字音译；不能使用表情符号和特殊字符。

- 表情名称：≤8 汉字（5 字以内显示最佳），无标点，中文不含空格，不与已有专辑重名。
- 表情介绍：≤80 汉字，体现形象特点或故事。
- 版权信息：≤10 汉字（已注册填版权信息，未注册填设计师/工作室名称，可简写）。
- 表情含义词：表达场景或情绪的关键词，≤4 汉字，避免标点，同套不重复，使用普通话。

### 文字类表情

以文字为主的表情必须有动态或图案设计，突出创新与趣味；不同含义应做差异化设计；不接受脱离含义的无意义缩放/平移/晃动/闪烁，也不接受大段歌词、诗歌、广告、标语。

### 赞赏功能规范

赞赏功能是微信用户表达对艺术家表情作品喜爱的方式，赞赏资金通过微信支付直接转账给艺术家，目前全额进入艺术家用于接收赞赏资金的账户。当表情开放平台账号满足开赞赏条件时，艺术家可为提交的表情开通赞赏功能。仅在用户希望开通赞赏（`appreciation: true`）时才需要准备本节素材。

开通表情赞赏要求：

1. 艺术家已填写艺术家资料并通过审核。
2. 个人账号绑定了微信号，且微信号满足接收赞赏资金要求（微信支付账号异常会影响赞赏功能正常使用）。
3. 企业账号绑定了用于接收赞赏资金的微信支付商户号。
4. 账号没有违规行为。
5. 提交表情时上传了符合要求的赞赏引导语、赞赏引导图和赞赏致谢图。
6. 同意《微信表情开放平台赞赏功能使用协议》。

赞赏素材清单：

| 素材名称 | 数量 | 格式 | 尺寸（像素） | 文件大小 | 用途 |
|---|---|---|---|---|---|
| 赞赏引导语 | 1 | 文字（5～15 汉字） | — | — | 引导用户发赞赏的语句 |
| 赞赏引导图 | 1 | GIF 或 PNG | 750×560 | ≤500KB | 展示在「选择赞赏金额」页面 |
| 赞赏致谢图 | 1 | GIF 或 PNG | 750×750 | ≤500KB | 用户发完赞赏后展示在「答谢」页面 |

- 赞赏引导语：5～15 个汉字；精心措辞能提升用户发赞赏的意愿；文案可诙谐幽默，建议与表情强关联（例：气泡狗如此可爱，发个赞赏可好？）。
- 赞赏引导图：GIF 或 PNG，750×560，≤500KB，1 张；风格须与表情一致，不能出现与表情不相关的内容；色调活泼明朗，背景须与微信底色有较大区分；图中元素不能因拉伸或压扁而变形；避免使用透明背景；图中不得出现诱导分享类文案（如“转发给朋友”“分享到群里”等）。
- 赞赏致谢图：GIF 或 PNG，750×750，≤500KB，1 张；要求同引导图；可表达感谢、角色互动或赞赏后的温暖反馈，但图中不得出现诱导分享类文案（如“转发给朋友”“分享到群里”等）。

注：官方「开通要求」中第 5 条所称「赞赏缩略图」即此处的赞赏致谢图（同一素材的不同称呼）。

## 默认单张表情要求（本技能默认值）

用户未覆盖时，按以下默认值产出，与官方规范保持一致：

- 画布：1:1 正方形，最终 PNG 精确 `240×240`。
- 背景：最终纯透明背景（四角 alpha 为 0），避免白色背景与正方形硬边框。
- 生成源：使用纯平实色抠像背景，默认 `#00ff00`（绿幕），便于去背。
- 主体：居中、留白适度、不裁切，是视觉焦点；画风依据参考图或用户要求确定（Q 版只是其中一种可能，也可为写实、简笔画、像素、二次元等），不强制 Q 版。
- 风格一致性：同一套专辑各图须沿用同一画风；有参考图时以参考图画风为准。
- 含义词：图上情绪词建议 ≤4 汉字（提交用的“含义词”元数据强制 ≤4 汉字）。
- 含义词位置：底部居中，柔和气泡字，淡粉彩填充，纯白边/描边。
- 含义词大小：视觉宽度约为画布宽度的 25%。
- 脸部安全：文字不得遮挡主体脸部或表情。
- 描边：表情图（聊天发送图）可加 2px 纯白描边（常见微信风格，规范不禁止）；但封面图与聊天图标必须无白色描边、无锯齿、无正方形边框——为这两类素材生成时关闭描边（脚本传 `--outline 0`）。

比熊“开心”表情示例：白色蓬松比熊、圆身、腾空抬脚、月牙眼、嘴角吐舌、耳朵上扬、身后几条速度线，底部居中写“开心”。

## 工作流程

1. 在生成或编辑栅格画面前，加载并遵循 `imagegen` 技能；使用 `imagegen` 工具生成图片时，请使用 image 2 模型或更高等级的模型。
2. 用户提供的图默认作为参考，除非明确要求编辑原像素。
3. 编写结构化提示词，保留用户的主体、姿态、情绪词、尺寸、文字约束、描边与透明输出要求。
4. 在纯平抠像背景上生成，而非要求生成器直接输出透明。
5. 将选定的生成源图复制到工作目录或任务输出目录。
6. 运行 `scripts/prepare_sticker.py` 去除抠像、缩放到目标尺寸、按需补强白色描边并写出校验 JSON。
7. 目视检查最终 PNG：主体不裁切、文字清晰且不遮脸、四角透明、尺寸精确。
8. 如需封面图/聊天图标/横幅，按上述规范单独产出（封面/图标关闭描边、调整尺寸）。
9. 生成 `表情合集.png`：把本次表情图整理成统一风格的合集预览图，便于快速浏览整套表情。
10. 生成 `宣传海报.png`：围绕本套表情主题制作宣传海报图，突出角色、表情名称与风格卖点。
11. 按“最终输出目录与命名”整理最终交付文件。
12. 根据表情主题与规范自动生成提交文案，写入 `preview.json`，运行 `scripts/build_preview.py` 生成提交预览页 `预览.html`（见“提交预览页”一节）。
13. 报告最终路径、生成方式、校验结果与 `预览.html` 路径。

## 提示词模板

以此为起点，按需调整主体、画风与情绪细节（`<style>` 处填入参考图画风或用户要求的风格）：

```text
Use case: stylized-concept
Asset type: 240x240 px square transparent sticker / emoji asset
Input image: Image #1 is a visual reference for the subject AND its art style; match the reference's drawing style (line work, shading, proportions, palette feel). Do not copy the background or exact lighting unless requested.

Create a <style> <subject> sticker on a perfectly flat solid #00ff00 chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Do not use #00ff00 anywhere in the subject.

Style: <art style; if a reference image is given, match its style; otherwise use the user-requested or theme-appropriate style, e.g. chibi / realistic / flat line-art / pixel / anime>.

Subject: <specific subject, pose, expression, motion, props if any>.

Text: add the Chinese emotion word "<emotion_word>" (<=4 Chinese characters) at the bottom center, in lettering that fits the chosen style, with a pure white border / outer stroke for readability. The text should be no more than 25% of canvas width in visual size, placed low enough to never cover the subject's face or expression.

Composition: square 1:1 sticker, main subject centered, generous padding, no cropping, transparent corners, no square frame. Add a consistent 2px pure white outline around the subject and important motion marks. Keep a palette consistent with the chosen style, clean sticker look, crisp readable silhouette.

Avoid: any background scene, floor shadow, cast shadow, gradients in the background, watermark, extra words, text covering the face, square border / hard right-angle edges. (Only avoid photorealism when the chosen style is non-realistic.)
```

封面图/聊天图标：使用同样的抠像生成，但**不要**加白色描边，**不要**正方形边框，画面更简洁（图标建议仅头部正面），并在后处理时调整尺寸与 `--outline 0`。

## 后处理脚本

图像生成后运行随附脚本：

```bash
python scripts/prepare_sticker.py \
  --input source_chroma.png \
  --output final-sticker.png \
  --size 240 \
  --auto-key border \
  --outline 2 \
  --report final-sticker.validation.json
```

若系统 Python 缺少 Pillow，使用 `load_workspace_dependencies` 返回的 Codex 桌面内置 Python。

常用参数：

- `--auto-key border`：从图像边缘采样抠像色，适用于生成的平实背景。
- `--key '#00ff00'`：边缘采样不可靠时强制指定已知抠像色。
- `--transparent-threshold 12`：与抠像色极接近的像素变为全透明。
- `--opaque-threshold 220`：远离抠像色的像素保持全不透明。
- `--outline 2`：缩放后为非透明画面补一圈 2px 纯白外描边；**封面图/聊天图标用 `--outline 0`**。
- `--outline-color '#ffffff'`：描边颜色（默认纯白）。
- `--edge-contract 1`：缩放前向内收缩 alpha 蒙版若干像素，去除绿边。
- `--no-despill`：关闭绿色溢色抑制（若淡彩主体被改色时使用）。

脚本输出 RGBA PNG，并校验尺寸、alpha 通道、四角透明、可见内容非空、包围盒、覆盖率与文件大小。

封面图示例（240×240，无描边）：

```bash
python scripts/prepare_sticker.py --input source_chroma.png --output cover.png --size 240 --auto-key border --outline 0
```

聊天图标示例（50×50，无描边）：

```bash
python scripts/prepare_sticker.py --input head_chroma.png --output icon.png --size 50 --auto-key border --outline 0
```

## 最终输出目录与命名

每次生成完成后，将最终交付文件统一放入 `outputs/[当前日期]-[对这次生成的中文总结名称]/`，例如 `outputs/2026-06-17-气泡狗日常表情/`。日期使用当前本地日期 `YYYY-MM-DD`，中文总结名称应简短、可读、能概括本次生成主题。

目录根层级应包含以下最终文件：

- 表情图：`[编号]-[表情名称].png`，编号建议使用两位数字，如 `01-开心.png`、`02-委屈.png`；常规专辑数量为 8～24 张，单品为 1 张。
- 横幅：`横幅.png`。
- 封面：`封面.png`。
- 图标：`图标.png`。
- 赞赏引导图：`赞赏引导图.png`（仅开通赞赏时需要）。
- 赞赏致谢图：`赞赏致谢图.png`（仅开通赞赏时需要）。
- 表情合集图片：`表情合集.png`。
- 宣传海报图片：`宣传海报.png`。
- 预览网页：`预览.html`。

工作过程中的源图、校验 JSON、`preview.json` 等中间文件可以保留在同目录或子目录中，但最终交付时必须明确标出上述文件；`预览.html` 应引用并展示横幅、封面、图标、全部表情图，以及开通赞赏时的赞赏引导图和赞赏致谢图。`表情合集.png` 与 `宣传海报.png` 属于最终交付展示物，不作为微信表情开放平台必填素材，但必须随输出目录一并交付。

## 提交预览页（preview.html）

素材齐备后，作为最后一步生成一个自包含的提交预览页 `预览.html`，复刻微信「提交表情专辑」+「填写附加信息」表单：展示已生成的素材、按主题与规范自动填好的文案，每个文本值后都带“复制”按钮，可直接搬运到正式提交页。开通赞赏时，预览页还应展示赞赏引导语、赞赏引导图和赞赏致谢图，便于一起核对。

### 自动生成文案的规则

先根据本套表情的主题与画面，自动撰写符合官方限制的文案，写入 `preview.json`：

- `type`：`static`（静态表情）或 `animated`（动态表情），与实际素材一致。
- `name`：表情名称，≤8 汉字（5 字以内最佳），无标点、无空格、不与已有专辑重名。
- `intro`：表情介绍，≤80 汉字，体现形象特点或故事。
- `copyright`：版权信息，≤10 汉字（无注册版权则填设计师/工作室名称）。
- `additional_type`：附加类型，取 `真人拍摄表情` / `截图表情` / `卡通表情/其他`（本技能产出的均为插画，无论 Q 版/写实/像素等画风统一填 `卡通表情/其他`；`真人拍摄表情` 仅用于真实照片）。
- `role`：角色/内容，表情主角名称（角色出现的张数应≥总数三分之一）。
- `styles`：表情风格，从固定列表中选 1～2 项：日常、软萌可爱、二次元、长辈风、搞笑、丧/佛系、魔性鬼畜、恶搞、简笔画、赛博朋克、蒸汽波、像素、暗黑、复古。
- `theme`：表情主题，从固定列表中选 1 项（相关张数应≥总数一半）：万能通用、网络热点、节日、考试/学习、工作/职场、情侣、毕业、刷屏、红包相关、游戏、运动/健身、怼人/斗图、群聊必备、节气、邀约/约起来、励志鼓舞。
- `download_region`：下载地区，`全球` 或 `中国大陆`。
- `appreciation`：是否接受赞赏（选填，默认 `false`）。置为 `true` 时需另行准备「赞赏功能规范」中的赞赏引导语、赞赏引导图（750×560）与赞赏致谢图（750×750），并满足开通赞赏的账号要求。
- `appreciation_guide`：赞赏引导语，5～15 个汉字。
- `appreciation_guide_image` / `appreciation_thanks_image`：赞赏引导图/赞赏致谢图素材路径（相对 `--base-dir`，最终文件建议命名为 `赞赏引导图.png`、`赞赏致谢图.png`）；预览页会在“赞赏功能”区域展示。
- `copyright_cert`：版权证明（选填），`涉及肖像权授权` / `涉及版权授权` 的子集，原创卡通表情通常留空 `[]`。
- `banner` / `cover` / `icon`：横幅/封面/图标素材路径（相对 `--base-dir`，默认相对 JSON 所在目录；最终文件建议命名为 `横幅.png`、`封面.png`、`图标.png`），缺失时预览页显示占位框。
- `stickers`：表情图数组，每项 `{"image": 路径, "meaning": 含义词}`；含义词 ≤4 汉字、避免标点、同套不重复、用普通话；专辑 8～24 张，单品 1 张。

### preview.json 示例

```json
{
  "type": "static",
  "name": "气泡狗日常",
  "intro": "圆滚滚的气泡狗，陪你度过每天的聊天时刻。",
  "copyright": "气泡工作室",
  "additional_type": "卡通表情/其他",
  "role": "气泡狗",
  "styles": ["软萌可爱", "搞笑"],
  "theme": "群聊必备",
  "download_region": "全球",
  "appreciation": true,
  "appreciation_guide": "喜欢就赞赏一下",
  "appreciation_guide_image": "赞赏引导图.png",
  "appreciation_thanks_image": "赞赏致谢图.png",
  "copyright_cert": [],
  "banner": "横幅.png",
  "cover": "封面.png",
  "icon": "图标.png",
  "stickers": [
    {"image": "01-开心.png", "meaning": "开心"},
    {"image": "02-委屈.png", "meaning": "委屈"}
  ]
}
```

### 生成预览页

```bash
python scripts/build_preview.py --meta preview.json --output 预览.html
```

- `--base-dir DIR`：素材路径解析的基准目录（默认取 `preview.json` 所在目录）。预览页用相对路径引用素材，与素材放在一起即可直接打开。
- 仅用 Python 标准库，无需 Pillow 或联网。
- 预览页会按官方限制实时显示字数（如 `名称 10/8` 超限标红）、用色块高亮已选/未选的类型·风格·主题·地区，并对透明 PNG 使用棋盘格背景便于查看；开通赞赏时会展示赞赏引导图与赞赏致谢图。
- 每个文本值后有“复制”按钮，顶部另有“复制全部文案”一次性复制全部字段。

## 校验清单

完成前确认：

- 已打开/查看最终 PNG。
- 表情图为 `240×240`、≤500KB；封面图 `240×240` PNG ≤500KB；聊天图标 `50×50` PNG ≤100KB（除非用户另有要求）。
- `RGBA` 模式且四角 alpha 均为 `0`；无白色背景、无正方形硬边框。
- 抠像去背后无绿色残边。
- 主体为主要视觉焦点。
- 情绪/含义词正确、简短（≤4 汉字）、底部居中、不遮脸；无标点。
- 表情图的白色描边在小尺寸下清晰可见；封面图与聊天图标无白色描边、无锯齿。
- 聊天图标尽量为角色头部（建议仅头部正面图像），画面简洁。
- 横幅主体不要太偏上部，视觉重心在画面中部或略低位置，整体构图均衡。
- 同套专辑各图风格统一且彼此有足够差异。
- 最终交付文件已放入 `outputs/[当前日期]-[对这次生成的中文总结名称]/`，并使用 `[编号]-[表情名称].png`、`横幅.png`、`封面.png`、`图标.png`、`赞赏引导图.png`、`赞赏致谢图.png`、`表情合集.png`、`宣传海报.png`、`预览.html` 等命名。
- 已生成 `预览.html`，素材正常显示；开通赞赏时，赞赏引导图与赞赏致谢图也正常展示；文案字数均未超官方上限（无标红超限）、复制按钮可用。

## 失败处理

若主体含细密毛发、烟雾、玻璃或半透明边缘导致抠像失败，用更干净的提示词与更多留白重试一次。若确需原生透明输出，说明默认内置路径采用抠像 + 本地去背，并在切换到任何需要 `OPENAI_API_KEY` 的 CLI 兜底方案前先征求用户同意。
