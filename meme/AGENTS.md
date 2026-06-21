# meme 技能维护约定

## 版本号与时间戳（每次更新必做）

每次修改本 `meme` 技能（`SKILL.md`、`scripts/`、`agents/` 等任意文件）后，必须自动更新 `SKILL.md` 第一处的版本行：

```
版本：<x.y.z>（YYYY-MM-DD HH:MM）
```

规则：
- 版本号按语义化版本递增：缺陷修复 / 小维护进 patch（z）；新增功能进 minor（y）；不兼容改动进 major（x）。
- 括号内时间为本次更新的本地时间（时区 Asia/Shanghai），**精确到分钟**（`YYYY-MM-DD HH:MM`），用 `date "+%Y-%m-%d %H:%M"` 获取。
- 全仓库版本号仅此一处，更新时无需改动其他文件。
