---
name: meme
description: 从文字描述或参考图制作透明背景的表情包/meme 贴纸素材，尤其是符合微信表情开放平台规范的 1:1 情绪/表情贴纸，并生成微信「提交表情专辑」提交预览页。画面风格依据参考图或用户要求而定（如 Q 版、写实、简笔画、像素、二次元等），并非固定 Q 版。当用户需要透明背景的 emoji/表情/sticker 图片、宠物/角色表情、情绪含义词（如“开心”）、固定尺寸（如 240x240）、白色描边、抠绿/chroma-key 去背、自动生成提交文案（名称/介绍/版权/含义词/风格/主题）与带复制按钮的提交预览 HTML、微信必备的横幅/封面/聊天图标/赞赏引导图/赞赏致谢图与表情合集/宣传海报，或需要可复用的微信表情制作/提交流程文档时使用。
---

# 表情包制作（Meme）

版本：1.12.1（2026-06-21 18:29）

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

| 素材名称 | 数量 | 格式 | 尺寸（像素） | 文件大小 | 备注 |
|---|---|---|---|---|---|
| 表情图 | 8～24（单品可为 1 张） | 动态：GIF；静态：PNG、JPG 或 GIF | 240×240 | ≤500KB | 必备；聊天中发送的图片 |
| 详情页横幅 | 1 | PNG 或 JPG | 750×400 | ≤500KB | 必备 |
| 表情封面图 | 1 | PNG | 240×240 | ≤500KB | 必备 |
| 聊天面板图标 | 1 | PNG | 50×50 | ≤100KB | 必备 |
| 赞赏引导图 | 1 | GIF 或 PNG | 750×560 | ≤500KB | 必备；展示在「选择赞赏金额」页面 |
| 赞赏致谢图 | 1 | GIF 或 PNG | 750×750 | ≤500KB | 必备；用户发完赞赏后展示在「答谢」页面 |

超出尺寸/大小的素材会被平台自动压缩和裁剪。表情单品仅需 1 张表情图，填写含义词并选择标签即可提交（暂不支持推广形象、推广信息或人物肖像）。赞赏引导图与赞赏致谢图为必备素材，规范要求见下文各赞赏素材小节；赞赏引导语为必备文案，规范见「文案规范」。

### 表情图（聊天中发送的图片）

1. 动态表情须为 GIF，240×240，≤500KB。
2. 静态表情须为 JPG / PNG / GIF，240×240，≤500KB。
3. 同一套专辑须统一为动态或静态。
4. 专辑数量为 8～24 之间任意数量。
5. 动态表情应循环播放，节奏流畅不卡顿。
6. 合理安排布局，每张不应有过多留白。
7. 同套各图风格须统一。
8. 同套各图应有足够差异。

> 注：本技能脚本仅支持静态 PNG 的去背/缩放/校验；动态 GIF 的合成与校验暂无脚本支持，如选动态表情需自备工具。

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

### 赞赏引导图

1. GIF 或 PNG，750×560，≤500KB，1 张。
2. 展示在「选择赞赏金额」页面。
3. 风格须与表情一致，不能出现与表情不相关的内容。
4. 色调活泼明朗，背景须与微信底色有较大区分。
5. 图中元素不能因拉伸或压扁而变形；避免使用透明背景。
6. 图中不得出现诱导分享类文案（如“转发给朋友”“分享到群里”等）。

### 赞赏致谢图

1. GIF 或 PNG，750×750，≤500KB，1 张。
2. 用户发完赞赏后展示在「答谢」页面。
3. 风格须与表情一致、色调活泼明朗、背景与微信底色有较大区分、元素不得拉伸变形、避免透明背景（要求同赞赏引导图）。
4. 可表达感谢、角色互动或赞赏后的温暖反馈。
5. 图中不得出现诱导分享类文案（如“转发给朋友”“分享到群里”等）。
6. 官方文档中所称「赞赏缩略图」即此图（同一素材的不同称呼）。

### 文案规范

文字尽量用中文，必要时用英文，避免生僻字；方言用汉字音译；不能使用表情符号和特殊字符。

- 表情名称：≤8 汉字（5 字以内显示最佳），无标点，中文不含空格，不与已有专辑重名。
- 表情介绍：≤80 汉字，体现形象特点或故事。
- 版权信息：≤10 汉字（已注册填版权信息，未注册填设计师/工作室名称，可简写）。
- 表情含义词：表达场景或情绪的关键词，≤4 汉字，避免标点，同套不重复，使用普通话。
- 赞赏引导语：引导用户发赞赏的语句，5～15 汉字；精心措辞能提升赞赏意愿，可诙谐幽默并与表情强关联（例：气泡狗如此可爱，发个赞赏可好？）。

### 文字类表情

以文字为主的表情必须有动态或图案设计，突出创新与趣味；不同含义应做差异化设计；不接受脱离含义的无意义缩放/平移/晃动/闪烁，也不接受大段歌词、诗歌、广告、标语。

### 赞赏功能规范

赞赏功能是微信用户表达对艺术家表情作品喜爱的方式，赞赏资金通过微信支付直接转账给艺术家，目前全额进入艺术家用于接收赞赏资金的账户。赞赏引导语、赞赏引导图与赞赏致谢图均为必备项：赞赏引导图与赞赏致谢图为素材，见上文「素材清单」与各自小节；赞赏引导语为文案，见「文案规范」。提交表情时须一并准备这三项（官方文档中所称「赞赏缩略图」即赞赏致谢图）。

## 默认单张表情要求（本技能默认值）

用户未覆盖时，按以下默认值产出，与官方规范保持一致：

- 画布：1:1 正方形，最终 PNG 精确 `240×240`。
- 背景：最终纯透明背景（四角 alpha 为 0），避免白色背景与正方形硬边框。
- 生成源：使用纯平实色抠像背景，默认 `#00ff00`（绿幕），便于去背。
- 主体：居中、留白适度、不裁切，是视觉焦点；画风依据参考图或用户要求确定（Q 版只是其中一种可能，也可为写实、简笔画、像素、二次元等），不强制 Q 版。
- 风格一致性：同一套专辑各图须沿用同一画风；有参考图时以参考图画风为准。
- 含义词/图上文字（默认无字铁律）：**除非用户明确要求，表情图一律不加任何文字**——含义词、标题、字母、数字、标点一概不写，画面保持纯无字版本。生成时在 `Avoid:` 中加入 `no text, no caption, no letters`。仅当用户明确要求在图上写情绪词时，才加文字，并遵循 ≤4 汉字、底部居中、柔和气泡字（淡粉彩填充、纯白描边）、视觉宽度约为画布宽度的 25%、不得遮挡主体脸部或表情。此铁律只约束「表情图本身」；宣传海报/赞赏引导图/赞赏致谢图/表情合集等对外展示物的文字另见各自章节，不受此限。
- 含义词元数据：提交用的“含义词”仍需照常填写（≤4 汉字，见「文案规范」与 `preview.json` 的 `stickers`），与是否在图上写字无关。
- 描边：表情图（聊天发送图）可加 2px 纯白描边（常见微信风格，规范不禁止）；但封面图与聊天图标必须无白色描边、无锯齿、无正方形边框——为这两类素材生成时关闭描边（脚本传 `--outline 0`）。

比熊“开心”表情示例：白色蓬松比熊、圆身、腾空抬脚、月牙眼、嘴角吐舌、耳朵上扬、身后几条速度线（默认不写文字；如用户要求含义词，可在底部居中写“开心”）。

## 质量闸门（必须遵守）

本技能的核心质量来自“图像模型生成高质量源图 + 本地确定性后处理”。不得用低质量本地拼装、抠原图后旋转缩放、手动画五官、简单贴符号等方式替代图像模型生成整套表情。**脚本职责边界（铁律）：脚本只允许做抠图相关的确定性后处理——去背抠像、缩放、白色描边、压缩与文件尺寸校验。图片的一切创作性内容——文字、含义词、标题、排版、合集拼版、海报构图、画面元素——必须由 image2 生图功能实现，严禁用脚本把文字叠加到图片上、本地拼版排版或合成画面。**

执行时必须先生成并保存 1 张“基准源图”（通常为 `01-开心-source.png`），目视确认达到用户参考图或首张成功图的质量，再继续生成整套。基准源图必须满足：

- 主体身份稳定：宠物/角色的品种、毛色、脸型、耳朵、眼鼻嘴比例与参考图一致。
- 源图清晰自然：毛发/线条/材质细节由图像模型生成，不像剪贴拼图、液化变形或手绘涂改。
- 动作真实可信：逐张数清肢体数量（四足宠物恰为四腿四爪、一尾、两耳），关节与姿态自然，不出现多腿/多爪、重复尾、断肢、融化或分叉边缘；蓬松毛发盖住躯干时最易混进多余的腿，必须放大确认。
- 抠像背景合格：背景为视觉纯平的 `#00ff00` 或指定抠像色，无渐变、阴影、地面、纹理；允许图像模型输出存在轻微像素级亮度差异，后处理用边缘采样与阈值处理吸收这类误差。
- 贴纸构图合格：主体居中，不裁切，主体占画布主要区域，底部保留文字空间。

若基准源图不达标，必须按“定向重试策略”重试；仍不达标时，停止并向用户说明当前瓶颈，不得继续批量生成低质结果。若内置 `imagegen` 只在会话中显示图片、没有返回可复制路径，必须先把会话图保存/复制到输出目录或让用户提供该图文件，再进入后处理；不得因为找不到路径而改用本地拼装替代。

## 工作流程

1. 在生成或编辑栅格画面前，加载并遵循 `imagegen` 技能；使用 `imagegen` 工具生成图片时，请使用 image 2 模型或更高等级的模型。
2. 用户提供的图默认作为参考，除非明确要求编辑原像素。
3. **先做提示词自扩写（关键步骤，勿跳过）**：图像 API/工具不会像网页版那样替你“优化/扩写”提示词，直传简短描述会显著降低质量。因此每次生成前，先把用户的简短意图扩写成一段 60～120 词、连贯的“成稿式”视觉 brief（见“提示词自扩写规范”），由你自己完成网页产品层会做的扩写工作，再交给图像工具。
4. 按“提示词模板”把扩写后的 brief 落成结构化提示词，保留用户的主体、姿态、情绪词、尺寸、文字约束、描边与透明输出要求，并补齐画面级描述与质量锚点词。
5. 在纯平抠像背景上生成，而非要求生成器直接输出透明。
6. **先生成 1 张基准源图并保存到输出目录的 `source/` 子目录**；目视检查源图是否通过“质量闸门”。未通过则定向重试，不得进入批量阶段。
7. 基准源图通过后，为每个含义词分别调用 `imagegen` 生成独立源图；不得用 `n` 或本地脚本批量变形来替代不同动作/表情。每张源图都保存到 `source/[编号]-[表情名]-source.png`。
8. 逐张目视检查生成源图；若不理想，按“定向重试策略”朝固定方向补充描述后重试，而非随机更换措辞。低质源图不得进入最终交付。
9. 运行 `scripts/prepare_sticker.py` 去除抠像、缩放到目标尺寸、按需补强白色描边并写出校验 JSON；默认使用 `--auto-key border`，不要优先固定 `--key '#00ff00'`。
10. 若校验只因四角 alpha 不为 0、`alpha_bbox` 贴满画布或覆盖率异常而失败，且源图目视仍是均匀绿幕，按“绿幕去背容错”重跑后处理；不要把这类参数问题误判为源图质量失败。
11. 目视检查最终 PNG：主体不裁切、文字清晰且不遮脸、四角透明、尺寸精确。
12. 如需封面图/聊天图标/横幅，按上述规范单独产出：**封面优先从本套表情里挑一个最有特色、最具辨识度的表情（情绪 + 姿态），按封面规范用 image2 重新生成（正面半身/全身、无描边、透明抠像、无文字、无方框），不直接复用带描边的表情图**；图标建议仅角色头部正面。封面/图标用透明抠像并关闭描边；横幅为非透明海报，用 `prepare_sticker.py --keep-background --width 750 --height 400 --max-bytes 512000` 定尺寸与校验。各自使用“分素材提示词 brief”一节的专属模板扩写提示词。
13. 生成赞赏引导图（750×560）与赞赏致谢图（750×750）：属海报/banner 类，套用“海报/banner 类高级设计基调”并以本套主题构图；非透明、不变形、无诱导分享文案。**这两张须按「赞赏图文字设计要点」融入与主题契合、设计化的文字**（引导图用 `appreciation_guide`，致谢图用 ≤6 汉字致谢语），生成后逐字核对中文字形正确清晰、不遮脸、非平贴字幕；横幅仍保持无文字。用 `prepare_sticker.py --keep-background --width 750 --height 560`（致谢图改 `--height 750`）配 `--max-bytes 512000` 定尺寸与校验。
14. 生成 `表情合集.png`：把本次表情图整理成统一风格的合集预览图，便于快速浏览整套表情（使用“分素材提示词 brief”中的合集模板与「表情合集高级排版基调」）；以本套表情为主体融合高级排版锚点，合集内的标题/含义词等文字须与合集视觉设计化融合，不得平铺堆叠或直贴字幕。
15. 生成 `宣传海报.png`：围绕本套表情主题制作宣传海报图，突出角色、表情名称与风格卖点（使用“分素材提示词 brief”中的海报模板）；**尺寸 1024×1536（竖版 2:3）**，按 2:3 竖版构图生成以免拉伸，再用 `prepare_sticker.py --keep-background --width 1024 --height 1536` 定尺寸与校验。
16. 按“最终输出目录与命名”整理最终交付文件。
17. 根据表情主题与规范自动生成提交文案（含赞赏引导语 5～15 汉字），写入 `preview.json`，运行 `scripts/build_preview.py` 生成提交预览页 `预览.html`（见“提交预览页”一节）；确认预览页赞赏区无“赞赏为必备项，请补齐”告警。
18. 报告最终路径、生成方式、源图质量检查结论、校验结果与 `预览.html` 路径。

## 提示词自扩写规范

图像 API / 内置图像工具不会像 ChatGPT 网页版那样替你“优化/扩写”提示词：网页版在调用图像模型前，由对话模型把简短描述自然扩写成一段更丰富的视觉 brief。Codex/API 下若只把简短意图直传图像工具，模型只能自行脑补，质量不稳定。因此**每次生成前必须由你自己完成这一步扩写**。

把用户的简短意图扩写成一段 60～120 词、连贯成句的视觉 brief，显式覆盖以下维度（缺项即为模型随机点，必须补全）：

- 主体：具体对象、姿态、表情、动作、关键道具。
- 画风：参考图画风优先；否则按用户要求或主题选定（Q 版 / 写实 / 简笔画 / 像素 / 二次元等）。
- 材质与线条：线宽是否统一、填充质感、描边风格。
- 光照：方向、柔硬、是否有高光（贴纸通常用柔和均匀光，避免戏剧性投影）。
- 色板：主色与点缀色、整体明度倾向。
- 构图与留白：主体居中、留白比例、视觉焦点。
- 情绪氛围：要传达的情绪基调。

扩写要写成完整句子的“成稿式”描述，而非关键词罗列；保留用户原始约束（尺寸、文字、描边、透明、抠像背景）不被改写丢失。

### 质量锚点词（贴纸场景，按需取用）

为降低随机性，在 brief 中稳定加入这类画面级锚点（与所选画风兼容时）：`clean vector-style shapes`、`consistent line weight`、`soft even studio lighting`、`high-readability silhouette`、`crisp edges`、`balanced flat colors`、`centered single subject`、`sticker-ready cutout`。

## 提示词模板

以扩写后的 brief 为基础落成下方“成稿式”提示词（用完整句子，而非关键词清单）；`<...>` 处用你扩写得到的具体描述替换：

```text
Use case: stylized-concept
Asset type: 240x240 px square transparent sticker / emoji asset
Input image: Image #1 is a visual reference for the subject AND its art style; match the reference's drawing style (line work, shading, proportions, palette feel). Do not copy the background or exact lighting unless requested.

Generate a <style> sticker of <subject>, shown <pose / action / expression in a full sentence>. Render it in <art style described in a sentence: line work, shading, proportions>, with <material & line description, e.g. clean consistent line weight and smooth flat fills>. Light the subject with soft, even, shadowless studio lighting so colors stay bright and uniform. Use a <palette description: main color + accents + overall brightness> palette. Keep a single centered subject with generous padding, a clean readable silhouette, and a sticker-ready cutout look. The overall mood should feel <emotion / vibe>.

Background: place everything on a perfectly flat solid #00ff00 chroma-key background for background removal — one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Do not use #00ff00 anywhere in the subject.

Text (optional — include only when a caption / emotion word is requested; default is no on-image text): add the Chinese emotion word "<emotion_word>" (<=4 Chinese characters) at the bottom center, in lettering that fits the chosen style, with a pure white border / outer stroke for readability. The text should be no more than 25% of canvas width in visual size, placed low enough to never cover the subject's face or expression.

Composition: square 1:1 sticker, main subject centered, generous padding, no cropping, transparent corners, no square frame. Add a consistent 2px pure white outline around the subject and important motion marks.

Anatomy: keep correct anatomy for <subject> — exactly the right number of limbs (a quadruped pet has exactly four legs and four paws, two ears, one tail), with natural joints and a clean single silhouette. No extra or duplicated legs/paws/ears/tails, no merged or hidden limbs, no melted or branching edges.

Quality anchors: clean vector-style shapes, consistent line weight, high-readability silhouette, crisp edges, balanced flat colors, anatomically correct single subject.

Avoid: any background scene, floor shadow, cast shadow, gradients in the background, watermark, extra words, text covering the face, square border / hard right-angle edges, extra limbs, extra legs, extra paws, duplicated tail, deformed or mutated anatomy, fused fur blob hiding the leg count. (Only avoid photorealism when the chosen style is non-realistic.)
```

默认不在图上写文字时，省略上面的 `Text:` 段，并在 `Avoid:` 中加入 `no text, no caption, no letters`；仅当用户明确要求含义词时才保留 `Text:` 段。

封面图/聊天图标：使用同样的抠像生成，但**不要**加白色描边，**不要**正方形边框，画面更简洁（图标建议仅头部正面），并在后处理时调整尺寸与 `--outline 0`。

### 定向重试策略

首张不理想时，朝**固定方向**补充或加强描述后重试，不要随机更换措辞，以便定位有效改动：

- 主体偏小/偏移 → 强化 `single centered subject, generous padding, fills ~70% of canvas`。
- 线条脏乱 → 强化 `clean consistent line weight, crisp edges, no sketchy strokes`。
- 颜色发灰/杂 → 强化 `bright balanced flat colors, limited palette`。
- 背景去不干净 → 先判断是否属于“绿幕去背容错”；若只是视觉纯平绿幕的像素差异，先调 `prepare_sticker.py` 阈值重跑；若背景已有阴影/渐变/地面/纹理，再强化纯色抠像约束或换更干净抠像色重生源图。
- 文字遮脸/过大 → 重申文字位置与 ≤25% 宽度约束。
- 参考形象不像 → 强化 `preserve the exact same subject identity from the reference: same species/character, key colors and markings, head shape, ears, eye/nose/mouth proportions, same expression feel`（示例·白色比熊：`same breed, fluffy white coat, round head, floppy ears, black eyes/nose`）。
- 肢体/表情怪异、多腿/多爪（尤其蓬松毛发盖住躯干时最易出现）→ 先数清四肢；重试时强化 `anatomically plausible pose for this subject, exactly four legs and four paws for a quadruped (one tail, two ears), natural joints, no extra or duplicated limbs/paws/tails, no melted or branching edges, fluffy coat must not hide or add extra legs`，并把多肢类词加进 `Avoid:`（`extra legs, extra paws, duplicated tail, deformed anatomy`）。若连续 2~3 次仍多腿，改用更收拢、四肢清晰可数的姿态（如端坐/趴卧），避免腾空乱踢这类高出错姿势。
- 源图像本地拼贴或低清 → 重试时要求 `model-generated coherent full-body subject, natural fur continuity, no cut-and-paste collage look, no manual doodle overlays on the face`。
每次只改一个方向，最多迭代 2～3 次；仍不达标则回报当前问题与已尝试方向。

## 分素材提示词 brief

横幅、封面、图标、赞赏图、合集、海报的画面诉求与贴纸不同，分别按下列要点扩写成各自的成稿式 brief（同样遵循“提示词自扩写规范”，并保持与本套表情统一画风）：

- **横幅（`横幅.png`，750×400）**：与表情强相关、有故事性的场景；色调活泼明朗、与微信底色区分、非白底、非透明；**主体不要太偏上部，视觉重心在画面中部或略低**；无任何文字；元素不得拉伸变形。叠加下文「海报/banner 类高级设计基调」。
- **封面（`封面.png`，240×240）**：**优先从本套表情中挑选一个最有特色、最具辨识度的表情（情绪 + 姿态）作为封面主体**，按封面规范用 image2 重新生成一张封面源图——正面半身/全身像、避免只用头部；透明背景、非白底、无正方形硬边框、无白色描边、无锯齿；画面简洁、无装饰元素、除纯文字类型外避免出现文字。注意是按选定表情的神态/动作重新出图，**不要直接复用带白描边的表情图，也不要另起一个与本套无关的姿态**；同一形象身份须与表情套一致，不同专辑封面须彼此不同。
- **聊天图标（`图标.png`，50×50）**：尽量仅角色头部正面、极简；透明背景、无白色描边、无正方形边框；小尺寸下仍清晰。
- **赞赏引导图（`赞赏引导图.png`，750×560）**：展示在「选择赞赏金额」页的引导图；以本套角色与主题构图，色调活泼明朗、背景与微信底色区分、非白底、非透明；元素不得拉伸变形；不得出现诱导分享类文案。**须在画面中融入一句与主题契合的赞赏引导文案**（取 `preview.json` 的 `appreciation_guide`，5～15 汉字，且与图上文字一致），文字作为设计的一部分自然融入（手写体/缎带横幅/角色举牌/对话气泡/招牌等载体），有清晰主次层级与设计感，字体风格与本套画风统一，绝非平铺直贴的系统字幕。叠加下文「海报/banner 类高级设计基调」与「赞赏图文字设计要点」。
- **赞赏致谢图（`赞赏致谢图.png`，750×750）**：用户赞赏后的答谢图；可表达感谢、角色互动或温暖反馈，与引导图同一视觉系统但构图有差异；同样非白底、非透明、元素不变形、不得出现诱导分享类文案。**须在画面中融入一句与主题契合的简短致谢文案**（如「谢谢赏」「谢谢老板」「心意收到啦」等，≤6 汉字，口吻与角色/主题一致），同样设计化融入而非直贴。叠加下文「海报/banner 类高级设计基调」与「赞赏图文字设计要点」。
- **表情合集（`表情合集.png`）**：把整套表情按统一网格/排版整理成一张总览图，统一画风与间距，便于快速浏览；可使用本套主色作为底色。套用下文「表情合集高级排版基调」抬升到作品集/showcase 级质感，但以本套表情为绝对主体融合；合集内若加标题/含义词等文字，**不要平铺堆叠，要与合集视觉系统设计化融合**。
- **宣传海报（`宣传海报.png`，1024×1536）**：围绕主题的营销海报，**尺寸 1024×1536（竖版 2:3）**，须按 2:3 竖版构图生成以免拉伸变形；突出角色与风格卖点，构图有主次与层次；可含表情名称等少量文字（与微信平台必填素材的“无文字”要求无关，此为对外展示物）。套用「海报/banner 类高级设计基调」并取用下文「高级海报锚点」抬升质感，但**务必以本套角色/主题/主色为绝对主体融合，锚点只作风格修饰，不可套脱离主题的通用模板**；图上文字（如表情名称）按「赞赏图文字设计要点」同理设计化融入，不要平贴字幕。

### 海报/banner 类高级设计基调（适用于 横幅 / 赞赏引导图 / 赞赏致谢图）

这三张属于对外展示的海报/banner 图，统一采用高级商业设计基调。但**这不是固定模板**：必须先以本套表情的主题、角色、主色与画风为基调，再把下列设计取向融入该主题，让高级感服务于表情本身，不要套用脱离主题的通用排版或与角色无关的视觉。

- 追求：视觉层级清晰、构图简洁有张力、留白合理、色彩统一（沿用本套主色板）、品牌感强、设计感高级。
- 避免：文字乱码、文字堆叠、元素重复、拼贴感、廉价模板感、复杂装饰、脏乱背景、低质量渐变、AI 痕迹。
- 一致性：三张共用同一视觉系统（同色板、同角色、同画风），但各自场景/构图要有差异，不重复堆叠相同元素。
- 英文质量锚点（按需取用，与主题搭配，勿原样照搬）：`premium commercial poster design`, `clear visual hierarchy`, `clean composition with tension`, `balanced negative space`, `cohesive unified color palette`, `strong brand identity`, `high-end art direction`。
- 英文规避词：`garbled text`, `overlapping stacked text`, `duplicated repeated elements`, `collage look`, `cheap template feel`, `cluttered decoration`, `messy dirty background`, `low-quality banding gradient`, `obvious AI artifacts`, `distorted typography`, `watermark`, `amateur design`。

#### 高级海报锚点（重点用于宣传海报，也可按需用于横幅/赞赏图）

一组高级海报质感锚点，**仅作为提示词参考词库按需取用，必须与本套表情的主题、角色、主色、画风深度融合**：画面主体永远是本套角色与主题，这些锚点只是把它的质感往「高级海报」方向抬，严禁脱离主题套用通用排版或与角色无关的视觉。其中排版/字体类锚点只用于**允许文字的素材（宣传海报、赞赏图）**，横幅仍保持无文字。

```text
premium modern poster design, award-winning art direction, strong visual hierarchy, clean balanced composition, professional typography, elegant spacing, contemporary graphic design, high-end branding, editorial quality, sophisticated color palette, cinematic lighting, subtle gradients, premium textures, depth and layering, visual storytelling, minimalist yet impactful, polished details, commercial advertising quality, Behance / Dribbble featured quality, Apple-level design aesthetics, ultra refined, visually striking
```

落提示词时，先写本套角色/主题/主色/画风的具体画面描述（主体占主导），再把上面的锚点作为风格修饰拼接，并保留前文规避词（`no clutter, no messy collage, no low-quality text stacking, no distorted typography, no watermark, no amateur design`）。不要把这串锚点单独直传当成海报内容。

> 文字范围：**横幅（`横幅.png`）必须无任何文字**；仅赞赏引导图与赞赏致谢图须按下「赞赏图文字设计要点」融入文字。

### 赞赏图文字设计要点（仅 赞赏引导图 / 赞赏致谢图）

这两张要带文字，但文字必须是**画面设计的一部分**，不是事后拍上去的系统字幕。要求：

- 文案：引导图用 `appreciation_guide`（5～15 汉字）；致谢图用一句 ≤6 汉字的主题化致谢（如「谢谢赏」「谢谢老板」「心意收到啦」）。口吻与角色/主题一致，普通话，无标点堆砌，不得出现诱导分享类文案（「转发/分享给朋友」等）。
- 设计化融入：把文字承载到画面里的实体或排版元素上——缎带横幅、招牌/木牌、角色举着的纸牌、对话气泡、礼物标签、手写涂鸦等；让它有明确的主次层级、与主体和背景产生关系，而非悬浮平贴。
- 风格统一：字形/笔触/颜色取自本套画风与主色板（如圆润手写体配软萌画风、像素字配像素画风）；可加描边/投影/高光等让文字与插画同一材质语言，但不喧宾夺主、不遮挡角色脸部。
- 中文字形正确性：图像模型常把中文渲染成错字/乱码。务必把目标短句作为**精确文本**写进提示词、保持短，生成后**逐字核对字形正确且清晰**；若反复乱码，按「定向重试策略」缩短文案或换更易渲染的载体重试，仍不行再考虑改用更短的纯主题化短语，宁可少字也不要错字。
- 英文锚点（按需取用）：`theme-integrated hand-lettering`, `text rendered as part of the illustration (ribbon / wooden sign / held placard / speech bubble / gift tag)`, `clear typographic hierarchy`, `legible correct Chinese characters`, `decorative title treatment matching the art style`。
- 英文规避词：`garbled or misspelled Chinese characters`, `flat caption slapped on top`, `plain system-font subtitle`, `text overlapping the character's face`, `watermark-like text`, `sharing/forwarding call-to-action text`。

### 表情合集高级排版基调（用于表情合集）

`表情合集.png` 是把整套表情排成一张总览图，目标是「作品集/showcase 级」的高级排布，但**主体永远是本套表情本身**，下列锚点只用来抬升排版与呈现质感，不能脱离本套画风/主色另起一套视觉。

- 排布主体：先把整套表情按统一网格/卡片有序排开（统一间距、对齐、留白、卡片或描边风格一致），各表情清晰可辨、彼此有呼吸感；底色与框架取自本套主色板，与表情风格同一视觉系统。
- 文字/标注融合：合集里若要加标题、角色名或各格的含义词标注，**不要简单平铺堆叠或直贴系统字幕**，要按「赞赏图文字设计要点」的思路与合集视觉融合——做成统一的标签条、标题区、卡片脚注等排版元素，字形/颜色随本套画风，主次清晰、不挡表情、不乱码。
- 高级合集锚点（按需取用，必须与本套主题/画风/主色融合，勿当通用模板照搬）：

```text
premium portfolio showcase design, contemporary editorial layout, professional case study presentation, clean grid system, sophisticated visual hierarchy, carefully curated composition, gallery exhibition quality, minimalist luxury aesthetics, balanced spacing, modern branding presentation, elegant framing, refined typography areas, premium design studio presentation, Behance / Dribbble showcase quality, visually organized, high-end portfolio cover, museum-grade presentation, polished details, art-directed composition, strong focal points, clean background, depth and layering, ultra professional
```

- 英文规避词：`messy ungridded layout`, `uneven spacing`, `flat caption slapped on top`, `overlapping stacked text`, `cluttered collage`, `mismatched styles`, `garbled text`, `low-quality template feel`。

## 后处理脚本

> 脚本职责边界：随附脚本只做**抠图相关的确定性后处理**——去背抠像、缩放、白色描边、压缩与文件尺寸校验。不得用脚本给图片加文字、排版、拼合集或合成海报；这些创作性内容一律由 image2 生图完成。

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
- `--edge-contract 1`：缩放前向内收缩 alpha 蒙版若干像素，去除绿边（会吃掉一圈细毛，绒毛主体慎用，优先用 `--despill-strength`）。
- `--despill-strength 1.0`：边缘（半透明绒毛带）去溢色强度 0~1，默认 1.0 把绿/品红边色完全中和，专治白色/绒毛主体的绿边；实心内部始终只做轻度去溢色，不会给淡彩主体改色。仅当确有真·绿色/品红边缘被洗淡时才调低。
- `--no-despill`：关闭绿色溢色抑制（若淡彩主体被改色时使用）。
- `--width 750 --height 560`：输出非正方形尺寸（横幅 750×400、赞赏引导图 750×560、赞赏致谢图 750×750）；不设时取 `--size` 的正方形。
- `--keep-background`：不透明海报/banner 模式，跳过抠像/去溢色/描边，仅缩放并校验（横幅、赞赏引导图、赞赏致谢图、宣传海报用）；该模式按“非透明”校验（不得有透明像素）。
- `--max-bytes 512000`：校验输出文件大小不超过该字节数（500KB=512000，100KB=102400）。

脚本默认输出透明 RGBA PNG；`--keep-background` 模式输出不透明图（横幅/赞赏图/海报）。校验项包含目标尺寸（`size_ok`）、文件大小（`bytes_ok`，需配 `--max-bytes`）、透明模式下四角透明或不透明模式下无透明像素（`transparency_ok`）、alpha 通道、包围盒与覆盖率；整体通过为 `ok: true`。

### 绿幕去背容错

图像模型生成的“绿幕”经常是视觉纯平，但像素值不一定严格等于 `#00ff00`。固定 `--key '#00ff00'` 或过窄 `--transparent-threshold` 可能导致四角残留、`alpha_bbox` 贴满画布、覆盖率接近 1.0；这属于后处理参数问题，不等于源图质量失败。

遇到这类失败时，按顺序处理：

1. 保留同一张源图，改用边缘自动采样：`--auto-key border`。
2. 若仍有角落残留，将 `--transparent-threshold` 提高到 `24`、`32` 或 `45`，并加 `--edge-contract 1` 去绿边；宠物/白色主体且画面中无绿色元素时可用更宽阈值。
3. 只有当源图背景目视存在明显渐变、阴影、地面、纹理，或边缘采样得到的 `key_color` 明显不是背景色时，才把它判为源图背景不合格并重生图。

#### 白色/绒毛主体绿边（fringe）

白色蓬松主体（如比熊、萨摩、棉花娃娃）边缘是一根根半透明细毛，会把绿幕的光「吃」进去染成淡绿；普通色键按阈值切完，这层细毛要么被切掉要么留一圈绿边，是白毛配绿幕最典型的残留。脚本默认已对半透明边缘带做强力去溢色（`--despill-strength 1.0`），多数情况无需额外参数即可消除绿边。若仍肉眼可见绿边，按顺序：

1. 确认没误加 `--no-despill`；保持默认 `--despill-strength 1.0`。
2. 适度放宽边缘带：把 `--transparent-threshold` 提到 `24~32`，让更多染绿细毛进入「半透明带」从而被中和（注意画面内不能有该绿色的主体元素）。
3. 仍有顽固硬边再叠加 `--edge-contract 1`（最多 1~2px，避免吃掉太多毛发轮廓）。
4. 从源头规避：白色绒毛主体生成时优先换更远的抠像色（如品红 `#ff00ff` 或正蓝 `#0000ff`），与白毛色差更大、溢色更易去；提示词里务必声明背景纯色且主体不得出现该色。

```bash
python scripts/prepare_sticker.py \
  --input source_chroma.png \
  --output final-sticker.png \
  --size 240 \
  --auto-key border \
  --transparent-threshold 28 \
  --despill-strength 1.0 \
  --edge-contract 1 \
  --outline 2 \
  --report final-sticker.validation.json
```

容错重跑示例：

```bash
python scripts/prepare_sticker.py \
  --input source_chroma.png \
  --output final-sticker.png \
  --size 240 \
  --auto-key border \
  --transparent-threshold 32 \
  --opaque-threshold 220 \
  --edge-contract 1 \
  --outline 2 \
  --report final-sticker.validation.json
```

封面图示例（240×240，无描边）：

```bash
python scripts/prepare_sticker.py --input source_chroma.png --output cover.png --size 240 --auto-key border --outline 0
```

聊天图标示例（50×50，无描边）：

```bash
python scripts/prepare_sticker.py --input head_chroma.png --output icon.png --size 50 --auto-key border --outline 0
```

横幅示例（750×400，不透明，校验大小）：

```bash
python scripts/prepare_sticker.py --input banner_source.png --output 横幅.png --keep-background --width 750 --height 400 --max-bytes 512000 --report reports/横幅.json
```

赞赏引导图/致谢图示例（750×560 / 750×750，不透明）：

```bash
python scripts/prepare_sticker.py --input guide_source.png --output 赞赏引导图.png --keep-background --width 750 --height 560 --max-bytes 512000
python scripts/prepare_sticker.py --input thanks_source.png --output 赞赏致谢图.png --keep-background --width 750 --height 750 --max-bytes 512000
```

宣传海报示例（1024×1536 竖版，不透明；属展示物，无微信 500KB 限制，可不加 `--max-bytes`）：

```bash
python scripts/prepare_sticker.py --input poster_source.png --output 宣传海报.png --keep-background --width 1024 --height 1536 --report reports/宣传海报.json
```

## 最终输出目录与命名

每次生成完成后，将最终交付文件统一放入 `outputs/[当前日期]-[对这次生成的中文总结名称]/`，例如 `outputs/2026-06-17-气泡狗日常表情/`。日期使用当前本地日期 `YYYY-MM-DD`，中文总结名称应简短、可读、能概括本次生成主题。

目录根层级应包含以下最终文件：

- 表情图：`[编号]-[表情名称].png`，编号建议使用两位数字，如 `01-开心.png`、`02-委屈.png`；常规专辑数量为 8～24 张，单品为 1 张。
- 横幅：`横幅.png`。
- 封面：`封面.png`。
- 图标：`图标.png`。
- 赞赏引导图：`赞赏引导图.png`。
- 赞赏致谢图：`赞赏致谢图.png`。
- 表情合集图片：`表情合集.png`。
- 宣传海报图片：`宣传海报.png`。
- 预览网页：`预览.html`。

工作过程中的源图、校验 JSON、`preview.json` 等中间文件可以保留在同目录或子目录中，但最终交付时必须明确标出上述文件；`预览.html` 应引用并展示横幅、封面、图标、全部表情图，以及赞赏引导图和赞赏致谢图。`表情合集.png` 与 `宣传海报.png` 属于最终交付展示物，不作为微信表情开放平台必填素材，但必须随输出目录一并交付。

## 提交预览页（preview.html）

素材齐备后，作为最后一步生成一个自包含的提交预览页 `预览.html`，复刻微信「提交表情专辑」表单（上传表情 + 填写基本信息 + 赞赏功能）：展示已生成的素材、按主题与规范自动填好的文案，每个文本值后都带“复制”按钮，可直接搬运到正式提交页。预览页还应展示赞赏引导语、赞赏引导图和赞赏致谢图，便于一起核对。附加信息（类型/风格/主题/地区等）不在预览页单独展示，但这些字段的文案仍包含在「复制全部文案」中，便于填写正式提交页；版权证明等其余项直接在微信提交页填写即可。

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
- `appreciation`：是否接受赞赏，固定为 `true`（赞赏为必备素材）；预览页据此展示赞赏区域，须提供赞赏引导语、赞赏引导图（750×560）与赞赏致谢图（750×750）。
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
- 预览页会按官方限制实时显示字数（如 `名称 10/8` 超限标红），并对透明 PNG 使用棋盘格背景便于查看；展示上传表情、基本信息、封面/横幅/图标与赞赏引导图、赞赏致谢图。
- 每个文本值后有“复制”按钮，顶部另有“复制全部文案”一次性复制全部字段。

## 校验清单

完成前确认：

- 已保存所有模型生成源图到 `source/` 子目录；每张最终表情都能追溯到对应 `source/[编号]-[表情名]-source.png`。
- 已打开/查看基准源图，并确认它达到“质量闸门”的源图质量；尺寸校验通过不等于质量通过。
- 已确认最终表情不是由本地脚本拼接、旋转、手动画五官、简单贴符号或脚本叠加文字替代生成的低质图；图上任何文字均来自 image2 生图，而非脚本绘制。
- 已打开/查看最终 PNG。
- 表情图为 `240×240`、≤500KB；封面图 `240×240` PNG ≤500KB；聊天图标 `50×50` PNG ≤100KB（除非用户另有要求）。
- `RGBA` 模式且四角 alpha 均为 `0`；无白色背景、无正方形硬边框。
- 抠像去背后无绿色残边；白色/绒毛主体边缘已无淡绿 fringe（默认 `--despill-strength 1.0` 已处理，仍有则按「白色/绒毛主体绿边」放宽阈值或换抠像色）。
- 已数清主体肢体数量：四足宠物恰为四条腿四只爪、一条尾、两只耳；无多腿/多爪/重复尾、无断肢或融化分叉边缘（蓬松毛发盖住躯干时尤其要逐张确认）。
- 若第一次去背校验失败，已区分是源图背景不合格还是抠像参数过严；视觉纯平绿幕只因像素差异失败时，已用 `--auto-key border` 与更宽阈值重跑。
- 主体为主要视觉焦点。
- 默认无字：未经用户明确要求时，表情图上无任何文字（含义词/标题/字母/数字/标点均无）。仅当用户要求写字时，才检查情绪/含义词正确、简短（≤4 汉字）、底部居中、不遮脸、无标点。
- 表情图的白色描边在小尺寸下清晰可见；封面图与聊天图标无白色描边、无锯齿。
- 聊天图标尽量为角色头部（建议仅头部正面图像），画面简洁。
- 横幅主体不要太偏上部，视觉重心在画面中部或略低位置，整体构图均衡。
- 赞赏引导图为 `750×560`、赞赏致谢图为 `750×750`，均 PNG/GIF ≤500KB、非透明背景、元素不变形、无诱导分享类文案；可用 `prepare_sticker.py --keep-background --max-bytes 512000` 校验（报告 `ok: true`）。
- 宣传海报为 `1024×1536`（竖版 2:3）、非透明背景、按 2:3 构图无拉伸变形；可用 `prepare_sticker.py --keep-background --width 1024 --height 1536` 校验（报告 `ok: true`）。
- 赞赏引导图与赞赏致谢图已融入主题化文字且为设计的一部分（缎带/招牌/举牌/气泡等载体，非平贴字幕）：引导图文字与 `appreciation_guide` 一致（5～15 汉字），致谢图为 ≤6 汉字致谢语；逐字核对中文字形正确清晰、不遮角色脸部、字体风格与本套画风统一；横幅仍无任何文字。
- 赞赏引导语 5～15 汉字、与表情强关联、无表情符号/特殊字符。
- `preview.json` 中 `appreciation` 为 `true`，预览页赞赏区正常展示赞赏引导语/引导图/致谢图，且无“赞赏为必备项，请补齐”告警。
- 同套专辑各图风格统一且彼此有足够差异。
- 最终交付文件已放入 `outputs/[当前日期]-[对这次生成的中文总结名称]/`，并使用 `[编号]-[表情名称].png`、`横幅.png`、`封面.png`、`图标.png`、`赞赏引导图.png`、`赞赏致谢图.png`、`表情合集.png`、`宣传海报.png`、`预览.html` 等命名。
- 已生成 `预览.html`，素材正常显示；赞赏引导图与赞赏致谢图也正常展示；文案字数均未超官方上限（无标红超限）、复制按钮可用。

## 失败处理

若主体含细密毛发、烟雾、玻璃或半透明边缘导致抠像失败，先按“绿幕去背容错”重跑后处理；若源图背景本身不纯，再用更干净的提示词与更多留白重试一次。若确需原生透明输出，说明默认内置路径采用抠像 + 本地去背，并在切换到任何需要 `OPENAI_API_KEY` 的 CLI 兜底方案前先征求用户同意。

若内置 `imagegen` 输出只显示在会话中而没有可访问文件路径，先尝试在 `$CODEX_HOME/generated_images`、当前会话临时目录、用户提供的附件路径中定位；仍无法定位时，请用户把会话图另存或重新作为附件提供。不要用本地低质合成方案替代。

若图像模型连续 2～3 次无法生成达标基准源图，停止交付并报告：失败的具体质量项、已尝试的定向重试方向、可选的下一步（继续手动筛选/用户挑选首张/切换 CLI fallback）。不得为了完成数量而提交明显低质结果。
