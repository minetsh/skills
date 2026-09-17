---
name: codex-image2
description: >-
  使用独立、可搬迁的 Responses API CLI，通过 gpt-image-2 从文字或本地参考图生成 WebP、PNG、JPEG 图片。适用于文生图、参考图改图、指定尺寸出图，以及在 Codex 或 omp 中复用图像生成工作流。需要用户自行配置服务地址和 API key；不继承 Codex/omp 登录，不含任何密钥。Generate images from text or local references using a portable Responses-only gpt-image-2 CLI in Codex or omp, with explicit sizing, safe file output, and user-provided credentials.
---

# Codex Image2

独立运行的图像生成技能；不依赖原项目、Admin 服务、CloudBase、项目环境文件或工作站绝对路径。仅调用配置服务的 Responses API，不调用 Images Edits，不自动重试，也不提供免费服务或继承 Codex/omp 的订阅、登录和额度。

## 执行流程 / Agent workflow

1. **定位技能根目录。** 从当前实际加载的本文件路径推导 `SKILL_ROOT`：它是包含 `SKILL.md`、`package.json`、`scripts/` 和 `lib/` 的目录。不要把用户当前工作目录当作技能目录，也不要硬编码开发者机器路径。
2. **准备运行时。** 安装 Node.js **20.19+** 和 npm。第一次使用或迁移到新机器后运行 `node "<SKILL_ROOT>/scripts/setup.mjs"`。此脚本在技能自身目录执行 `npm ci --ignore-scripts --no-audit --no-fund`；路径含空格也适用，不创建凭据文件。唯一运行时依赖是锁定的 `sharp@0.35.3`，没有编译器、打包器或 Web 框架。应保留 npm 的可选平台依赖，以加载 sharp 对应平台的二进制。
3. **检查配置。** 运行 `node "<SKILL_ROOT>/scripts/generate.mjs" --check`。该操作不发起网络请求、不生成图片、不打印 key 或服务地址；它检查本地运行时、依赖可加载性及必要配置格式，**不证明远端鉴权、额度或模型可用**。
4. **缺少凭据时停下来。** 请用户在自己的机器上私密配置 `MODEL_BASE_URL` 和 `MODEL_API_KEY`。不要要求用户把 key 发到对话，不读取或复制其他项目、`~/.codex`、omp 或历史会话中的凭据，不把 key 放入参数、提示词、输出、日志或分享包。
5. **确定输入和输出。** 保留用户的主题、构图、风格和参考图意图。准备非空提示词，确认参考图路径、输出格式，以及是否真的需要固定尺寸或裁剪。输出路径相对于调用时的工作目录，父目录必须已存在；默认不要加 `--force`。
6. **执行一次真实生成。** 使用下述 CLI。只有用户明确接受裁剪才使用 `--fit cover`。遇到鉴权、限额或网络失败，报告原因，不自动重试或绕过服务要求。
7. **检查最终图片后再交付。** 用当前 harness 的图片读取/预览工具打开 JSON 中的 `output_path`，检查内容、方向、构图、文字、尺寸及参考一致性，再向用户给出文件和已验证的结果。CLI 成功只说明文件生成并保存，不代表创意质量合格。若当前工具无法预览，明确说明“已保存，尚未视觉检查”，不要声称质量已验证。

## 私密配置 / Private configuration

可将技能目录内的 `.env.example` **复制**为同目录 `.env`，由用户在本地编辑器中填写空白字段。不要覆盖已有配置。也可由用户在启动进程前私密设置环境变量。示例文件只有字段名及默认模型，不含有效地址或 key：

- `MODEL_BASE_URL`：用户自己配置的 HTTP(S) Responses 兼容服务根地址，可含 `/v1`。最终请求发往规范化地址的 `/v1/responses`。不得内嵌用户名/密码、query 或 fragment；生产环境推荐 HTTPS。
- `MODEL_API_KEY`：用户自己的有效 key，服务必须支持 Responses 的图像生成工具，并提供相应计费/额度。
- `IMAGEGEN_BRIDGE_MODEL`：可选，默认 `gpt-5.6-sol`；CLI 的 `--bridge-model` 优先于该值。

加载顺序严格为 **技能自身 `.env` → 技能自身 `.env.local` → 进程环境变量**，后者优先；已存在但为空的进程变量也会覆盖文件值。不会搜索调用目录、父目录、其他项目或用户认证目录。`--help` 不需要安装依赖或配置凭据。没有 `--api-key` 参数。

## 使用 / Usage

以下 `<SKILL_ROOT>` 是说明符，必须替换为当前加载技能的真实目录；不是固定安装位置。脚本本身不依赖 `cd` 到技能目录。示例中的 `./outputs` 必须先由调用者创建，`./references` 和提示词文件位于调用者工作目录。

### 文生图 / Text to image

```sh
node "<SKILL_ROOT>/scripts/generate.mjs" \
  --prompt "一只白色陶瓷花瓶置于暖灰色桌面，柔和侧光，产品摄影，无文字" \
  --out "./outputs/vase.webp"
```

### 使用参考图 / Local references

```sh
node "<SKILL_ROOT>/scripts/generate.mjs" \
  --prompt-file "./prompts/portrait.txt" \
  --image "./references/person.png" \
  --image "./references/style.jpg" \
  --size 1024x1536 --quality high --fit strict \
  --out "./outputs/portrait.png"
```

### 明确允许居中裁剪 / Explicit crop consent

```sh
node "<SKILL_ROOT>/scripts/generate.mjs" \
  --prompt "为横版文章配图设计一幅极简山水插画，无文字" \
  --size 1600x900 --fit cover --out "./outputs/article.jpg"
```

Bun 可执行同一 ESM CLI：`bun --no-env-file "<SKILL_ROOT>/scripts/generate.mjs" --check`，或将上述生成命令的 `node` 替换为 `bun --no-env-file`。**必须加 `--no-env-file`**，禁止 Bun 自动加载调用者项目的 `.env`；脚本随后只读取技能自身配置，并保留进程环境优先级。Node 是首选运行方式；仍推荐用提供的 Node/npm setup 和随附 lockfile 安装依赖，不携带另一台机器的 `node_modules`。Windows 可把多行示例合并为一行；PowerShell 的续行方式不同于上面的 POSIX shell `\`。

完整帮助：`node "<SKILL_ROOT>/scripts/generate.mjs" --help`。若已在技能目录内，可使用 `npm run check`、`npm run generate -- --prompt "..." --out "./outputs/image.webp"`；npm scripts 的工作目录是技能目录，因此希望按项目目录解析路径时优先使用上面的绝对脚本路径形式。

## 参数、默认值和边界

| 参数 | 默认 / 规则 |
| --- | --- |
| `--prompt` / `--prompt-file` | 必须且只能提供其中一个；文本不能全为空白；文件为 UTF-8 |
| `--image` | 默认无参考图，可重复 0–16 次；只接受本地单帧 JPEG、PNG、WebP，每张 ≤10 MiB、≤64,000,000 像素 |
| `--size` | 默认 `auto`；显式 `WxH` 的每边为整数 256–4096；发送给上游的尺寸会规范化为最近的支持尺寸，并添加一次比例提示 |
| `--quality` | `high`；可选 `low`、`medium`、`high` |
| `--fit` | `strict`；行为见下方，不会默认静默裁剪 |
| `--out` | 必须；`.webp`、`.png`、`.jpg`、`.jpeg` 后缀决定实际编码，父目录必须存在 |
| `--force` | 默认关闭；允许原子替换已有普通输出文件，但永不覆盖输入图片、提示词文件及其别名，也拒绝输出符号链接 |
| `--timeout` | 默认 600 秒；正数，最大 2147483.647 秒；没有自动重试 |
| `--bridge-model` | 默认环境配置或 `gpt-5.6-sol`；图像工具模型固定为 `gpt-image-2` |

**尺寸与适配：**

- `auto`：上游工具收到 `size: auto`，所有 fit 模式都保留实际返回的宽高。
- 显式尺寸 + `strict`：只在返回比例与目标比例像素等价时缩放到目标；比例不匹配报 `ASPECT_MISMATCH`，不保存伪装成成功的裁剪图。比例提示不能保证上游严格遵守，因此此错误是必要的保护。
- 显式尺寸 + `cover`：居中裁剪并缩放到目标尺寸，可能丢失边缘内容；需用户明确同意。
- 显式尺寸 + `raw`：显式尺寸仍作为上游生成目标，但保存实际返回宽高，不强制变成请求尺寸。

所有输出先校正 EXIF 方向并转为 sRGB；`raw` 也会重新编码，并非原始字节直通。WebP 使用 quality 90、effort 6、alphaQuality 90；PNG 可保留透明度，JPEG 无透明通道。输出上限为 80 MiB、4096² 像素。不会调用 Images Edits，不依赖实时 Admin 服务。

## 输出与错误 / Output and errors

生成成功时 stdout 只有一条 JSON：`success: true`，`data` 包含 `output_path`、`content_type`、`image_size: { width, height }`、`bridge_model`、`image_model`、`source`。`source` 标识所选的 completed、output_item、forwarded-completed、partial 或 JSON 响应路径；即使使用 partial 结果也必须检查最终图像。

失败时 stderr 输出 `success: false`、`error: { code, message }`，并以非零状态退出；不打印响应正文、提示词、key 或堆栈。常见处理：

- `NOT_READY` / `CONFIG_ERROR`：按提示私密补齐或修正自己的配置。
- `DEPENDENCIES_UNAVAILABLE`：在新机器运行 setup，保留引擎文件和 lockfile。
- `INVALID_ARGUMENT` / `INPUT_ERROR`：检查参数、输入类型/体积、调用者工作目录及文件路径。
- `OUTPUT_EXISTS` / `OUTPUT_SYMLINK` / `INPUT_OVERWRITE`：选新路径；不要用 `--force` 破坏输入。
- `AUTH_FAILED`：由用户检查私密配置和账号授权，不转发原始错误正文。
- `ASPECT_MISMATCH`：选择 `auto` 或 `raw` 保留构图；只有明确接受裁剪才选 `cover`。
- `TIMEOUT` / `ABORTED` / `UPSTREAM_ERROR`：解释中断或服务失败；是否再次付费生成由用户决定。

输出通过同目录临时文件原子发布；默认使用原子 no-clobber 操作，即使另一进程抢先创建目标也不会覆盖。错误时清理本次创建的临时文件。生成请求不会携带 Authorization 跟随重定向。返回图片 URL 仅允许经公网地址检查的 HTTPS 下载，限制重定向、字节数和超时，且不附带 API key。

## Codex、omp 发现与迁移 / Discovery and relocation

将完整 `codex-image2` 文件夹放入 **当前 Codex 或 omp 配置的技能搜索目录**，或将其实际位置加入对应 harness 的技能路径配置，然后刷新/重启技能发现。不要只复制 `SKILL.md` 或只链接某个脚本。Codex 可用 `$codex-image2` 调用已发现的技能；omp 可在启用 skill commands 时用 `/skill:codex-image2`，也可明确要求加载当前目录的 `SKILL.md`。如果未被自动发现，直接提供此文件的实际路径并让 agent 加载它，所有操作仍从该路径推导 `SKILL_ROOT`。`agents/openai.yaml` 只包含通用展示信息，不含机器路径。

可安全分享的**代码白名单**：

- `SKILL.md`、`agents/openai.yaml`
- `package.json`、`package-lock.json`
- `scripts/generate.mjs`、`scripts/setup.mjs`、`lib/responses.mjs`
- `test/*.test.mjs`（仅合成或本地隔离测试数据）
- `.gitignore`、空凭据 `.env.example`

只打包审核过的 tracked 文件。例如在技能仓库根目录执行 `git archive --format=tar.gz --output=codex-image2.tar.gz HEAD codex-image2`，不要直接压缩整个工作目录。即使有 `.gitignore`，手动压缩仍会夹带私密文件；也不要强制添加凭据到 git。**排除** `.env`、`.env.local`、任何其他凭据配置、`node_modules`、生成图片、参考图、提示词、日志、临时文件及真实请求/响应快照。

解压到任意目录后重新执行 setup，并配置接收者自己的服务和 key；不要复制其他机器的依赖二进制或凭据。`npm test` 使用 Node 内置 test runner 自动发现本技能的测试文件；测试不是依赖安装或真实生成的前提，也不应发出付费请求。
