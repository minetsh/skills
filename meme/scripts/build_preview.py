#!/usr/bin/env python3
from __future__ import annotations

import argparse
import html
import json
from pathlib import Path
import sys


TYPE_OPTIONS = [("static", "静态表情"), ("animated", "动态表情")]
ADDITIONAL_TYPE_OPTIONS = ["真人拍摄表情", "截图表情", "卡通表情/其他"]
STYLE_OPTIONS = [
    "日常",
    "软萌可爱",
    "二次元",
    "长辈风",
    "搞笑",
    "丧/佛系",
    "魔性鬼畜",
    "恶搞",
    "简笔画",
    "赛博朋克",
    "蒸汽波",
    "像素",
    "暗黑",
    "复古",
]
THEME_OPTIONS = [
    "万能通用",
    "网络热点",
    "节日",
    "考试/学习",
    "工作/职场",
    "情侣",
    "毕业",
    "刷屏",
    "红包相关",
    "游戏",
    "运动/健身",
    "怼人/斗图",
    "群聊必备",
    "节气",
    "邀约/约起来",
    "励志鼓舞",
]
DOWNLOAD_REGION_OPTIONS = ["全球", "中国大陆"]
COPYRIGHT_CERT_OPTIONS = ["涉及肖像权授权", "涉及版权授权"]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build a self-contained WeChat sticker submission preview page.")
    parser.add_argument("--meta", required=True, help="Metadata JSON path.")
    parser.add_argument("--output", required=True, help="Generated preview HTML path.")
    parser.add_argument("--base-dir", help="Directory used to resolve image paths. Defaults to the JSON directory.")
    return parser.parse_args()


def e(value: object) -> str:
    return html.escape(str(value or ""), quote=True)


def load_meta(path: Path) -> dict:
    try:
        with path.open("r", encoding="utf-8") as file:
            data = json.load(file)
    except FileNotFoundError:
        raise ValueError(f"metadata file not found: {path}") from None
    except json.JSONDecodeError as error:
        raise ValueError(f"invalid JSON in {path}: {error.msg} at line {error.lineno}, column {error.colno}") from None
    except OSError as error:
        raise ValueError(f"could not read metadata file {path}: {error}") from None

    if not isinstance(data, dict):
        raise ValueError("metadata JSON must be an object")
    return data


def text_value(data: dict, key: str) -> str:
    value = data.get(key, "")
    if value is None:
        return ""
    return str(value)


def list_value(data: dict, key: str) -> list[str]:
    value = data.get(key, [])
    if not isinstance(value, list):
        return []
    return [str(item) for item in value]


def sticker_items(data: dict) -> list[dict]:
    value = data.get("stickers", [])
    if not isinstance(value, list):
        return []
    result = []
    for item in value:
        if isinstance(item, dict):
            result.append(item)
    return result


def selected_type_label(value: str) -> str:
    labels = dict(TYPE_OPTIONS)
    return labels.get(value, value or "未选择")


def manual_relative_path(target: Path, start: Path) -> str:
    target_parts = target.resolve(strict=False).parts
    start_parts = start.resolve(strict=False).parts
    common = 0
    for left, right in zip(target_parts, start_parts):
        if left != right:
            break
        common += 1
    rel_parts = [".."] * (len(start_parts) - common) + list(target_parts[common:])
    if not rel_parts:
        return "."
    return "/".join(rel_parts)


def image_source(path_text: str, base_dir: Path, output_dir: Path) -> str:
    image_path = Path(path_text)
    if not image_path.is_absolute():
        image_path = base_dir / image_path
    return manual_relative_path(image_path, output_dir)


def image_exists(path_text: str, base_dir: Path) -> bool:
    if not path_text:
        return False
    image_path = Path(path_text)
    if not image_path.is_absolute():
        image_path = base_dir / image_path
    return image_path.exists() and image_path.is_file()


def copy_button(value: str, label: str = "复制") -> str:
    return f'<button class="copy-button" type="button" data-copy="{e(value)}">{e(label)}</button>'


def value_row(label: str, value: str, limit: int | None = None, helper: str = "") -> str:
    display = value if value else "未填写"
    count_html = ""
    if limit is not None:
        status = "over" if len(value) > limit else "ok"
        count_html = f'<span class="counter counter-{status}">{len(value)}/{limit}</span>'
    helper_html = f'<p class="field-helper">{e(helper)}</p>' if helper else ""
    return f"""
    <div class="field-row">
      <div class="field-label-line">
        <span class="field-label">{e(label)}</span>
        {count_html}
      </div>
      <div class="copy-value"><span>{e(display)}</span>{copy_button(value)}</div>
      {helper_html}
    </div>
    """


def optional_value_row(label: str, value: str) -> str:
    if not value:
        return f"""
        <div class="field-row">
          <div class="field-label-line"><span class="field-label">{e(label)}</span></div>
          <div class="copy-value muted-value"><span>未选择</span></div>
        </div>
        """
    return value_row(label, value)


def chips(options: list, selected: set[str]) -> str:
    rendered = []
    for option in options:
        if isinstance(option, tuple):
            raw_value, label = option
        else:
            raw_value, label = option, option
        state = "selected" if str(raw_value) in selected or str(label) in selected else "dimmed"
        rendered.append(f'<span class="chip chip-{state}">{e(label)}</span>')
    return '<div class="chip-row">' + "".join(rendered) + "</div>"


def count_badge(count: int) -> str:
    if count == 1 or 8 <= count <= 24:
        return f'<span class="count-badge count-good">{count} 张</span>'
    if count == 0:
        return '<span class="count-badge count-bad">0 张 · 需补充表情图</span>'
    return f'<span class="count-badge count-warn">{count} 张 · 专辑建议 8-24 张，单品为 1 张</span>'


def image_block(label: str, path_text: str, base_dir: Path, output_dir: Path, ratio: str, caption: str, compact: bool = False) -> str:
    class_name = "asset-frame compact" if compact else "asset-frame"
    style = f"aspect-ratio:{ratio};"
    if image_exists(path_text, base_dir):
        src = image_source(path_text, base_dir, output_dir)
        media = f'<img src="{e(src)}" alt="{e(label)}">'
    else:
        missing = "未提供" if not path_text else "文件未找到"
        media = f'<div class="asset-placeholder"><strong>{e(missing)}</strong><span>{e(path_text or caption)}</span></div>'
    return f"""
    <figure class="asset-card">
      <div class="asset-title">{e(label)}</div>
      <div class="{class_name}" style="{style}">{media}</div>
      <figcaption>{e(caption)}</figcaption>
    </figure>
    """


def sticker_grid(stickers: list[dict], base_dir: Path, output_dir: Path) -> str:
    if not stickers:
        return '<div class="empty-panel">未提供表情图。请在 JSON 的 stickers 中加入 image 与 meaning。</div>'
    rendered = []
    for index, sticker in enumerate(stickers, 1):
        image = str(sticker.get("image") or "")
        meaning = str(sticker.get("meaning") or "")
        counter_state = "over" if len(meaning) > 4 else "ok"
        if image_exists(image, base_dir):
            src = image_source(image, base_dir, output_dir)
            visual = f'<img src="{e(src)}" alt="{e(meaning or "表情图")}">'
        else:
            visual = f'<div class="sticker-placeholder"><strong>未找到</strong><span>{e(image or "未提供路径")}</span></div>'
        rendered.append(
            f"""
            <article class="sticker-card" style="--index:{index};">
              <div class="sticker-image">{visual}</div>
              <div class="sticker-meta">
                <span class="sticker-index">#{index:02d}</span>
                <div class="copy-value compact-copy"><span>{e(meaning or "未填写")}</span>{copy_button(meaning)}</div>
                <span class="counter counter-{counter_state}">{len(meaning)}/4</span>
              </div>
            </article>
            """
        )
    return '<div class="sticker-grid">' + "".join(rendered) + "</div>"


def copy_all_payload(data: dict, stickers: list[dict]) -> str:
    lines = [
        f"名称：{text_value(data, 'name')}",
        f"介绍：{text_value(data, 'intro')}",
        f"版权：{text_value(data, 'copyright')}",
        f"角色/内容：{text_value(data, 'role') or '未选择'}",
        "含义词：",
    ]
    if stickers:
        for index, sticker in enumerate(stickers, 1):
            lines.append(f"{index:02d}. {str(sticker.get('meaning') or '')}")
    else:
        lines.append("未提供")
    lines.extend(
        [
            f"附加类型：{text_value(data, 'additional_type') or '未选择'}",
            f"表情风格：{'、'.join(list_value(data, 'styles')) or '未选择'}",
            f"表情主题：{text_value(data, 'theme') or '未选择'}",
            f"下载地区：{text_value(data, 'download_region') or '未选择'}",
        ]
    )
    return "\n".join(lines)


def render_html(data: dict, base_dir: Path, output_path: Path) -> str:
    output_dir = output_path.parent
    stickers = sticker_items(data)
    sticker_count = len(stickers)
    pack_type = text_value(data, "type")
    name = text_value(data, "name")
    intro = text_value(data, "intro")
    copyright = text_value(data, "copyright")
    additional_type = text_value(data, "additional_type")
    role = text_value(data, "role")
    styles = list_value(data, "styles")
    theme = text_value(data, "theme")
    download_region = text_value(data, "download_region")
    appreciation = bool(data.get("appreciation", False))
    appreciation_guide = text_value(data, "appreciation_guide")
    appreciation_guide_image = text_value(data, "appreciation_guide_image")
    appreciation_thanks_image = text_value(data, "appreciation_thanks_image")
    copyright_cert = set(list_value(data, "copyright_cert"))
    style_warning = "" if 1 <= len(styles) <= 2 else '<p class="inline-warning">表情风格需选择 1-2 项。</p>'
    copy_all = json.dumps(copy_all_payload(data, stickers), ensure_ascii=False).replace("</", "<\\/")

    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{e(name or '表情专辑')} · 提交预览</title>
  <style>
    :root {{
      --paper: #f6f3ed;
      --paper-deep: #ebe4d8;
      --ink: #252118;
      --muted: #71695b;
      --soft: #fffaf1;
      --line: rgba(74, 61, 43, 0.16);
      --accent: #2f6f62;
      --accent-soft: #d8ece4;
      --warn: #a66b1f;
      --warn-soft: #fff0d3;
      --bad: #b4483e;
      --bad-soft: #ffe2de;
      --good: #237054;
      --good-soft: #dff1e8;
      --shadow: 0 24px 70px rgba(57, 45, 27, 0.12);
      --radius-lg: 30px;
      --radius-md: 20px;
      --radius-sm: 12px;
      --space-1: 4px;
      --space-2: 8px;
      --space-3: 12px;
      --space-4: 16px;
      --space-5: 24px;
      --space-6: 32px;
      --space-7: 44px;
    }}

    * {{ box-sizing: border-box; }}

    body {{
      margin: 0;
      min-height: 100dvh;
      color: var(--ink);
      font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "Source Han Sans SC", sans-serif;
      background:
        radial-gradient(circle at 12% 8%, rgba(47, 111, 98, 0.16), transparent 28rem),
        radial-gradient(circle at 86% 16%, rgba(166, 107, 31, 0.12), transparent 24rem),
        linear-gradient(135deg, var(--paper) 0%, #faf7ef 52%, var(--paper-deep) 100%);
    }}

    body::before {{
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
      opacity: 0.38;
      background-image:
        linear-gradient(rgba(37, 33, 24, 0.035) 1px, transparent 1px),
        linear-gradient(90deg, rgba(37, 33, 24, 0.035) 1px, transparent 1px);
      background-size: 36px 36px;
    }}

    .page {{
      width: min(1180px, calc(100% - 32px));
      margin: 0 auto;
      padding: var(--space-7) 0;
      position: relative;
    }}

    .hero {{
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) minmax(260px, 0.65fr);
      gap: var(--space-6);
      align-items: end;
      margin-bottom: var(--space-6);
    }}

    .eyebrow {{
      color: var(--accent);
      font-size: 13px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      font-weight: 700;
    }}

    h1, h2, h3 {{ margin: 0; }}

    h1 {{
      max-width: 760px;
      margin-top: var(--space-3);
      font-size: clamp(38px, 7vw, 76px);
      line-height: 0.96;
      letter-spacing: -0.06em;
      font-weight: 800;
    }}

    .hero p {{
      max-width: 62ch;
      color: var(--muted);
      line-height: 1.78;
      margin: var(--space-4) 0 0;
    }}

    .hero-panel {{
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      padding: var(--space-5);
      background: rgba(255, 250, 241, 0.76);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72), var(--shadow);
      backdrop-filter: blur(18px);
    }}

    .copy-all {{
      width: 100%;
      border: 0;
      border-radius: 999px;
      padding: 14px 18px;
      color: #fffaf1;
      background: var(--accent);
      font-weight: 800;
      cursor: pointer;
      transition: transform 180ms ease, background 180ms ease;
    }}

    .copy-all:hover {{ background: #265f54; }}
    .copy-all:active, .copy-button:active {{ transform: translateY(1px) scale(0.99); }}

    .summary-list {{
      display: grid;
      gap: var(--space-3);
      margin-top: var(--space-4);
      color: var(--muted);
      font-size: 14px;
    }}

    .summary-list strong {{ color: var(--ink); }}

    .form-card {{
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      background: rgba(255, 250, 241, 0.88);
      box-shadow: var(--shadow);
      overflow: hidden;
      margin-top: var(--space-6);
    }}

    .card-header {{
      display: flex;
      justify-content: space-between;
      gap: var(--space-4);
      align-items: flex-start;
      padding: var(--space-6);
      border-bottom: 1px solid var(--line);
      background: linear-gradient(120deg, rgba(255, 250, 241, 0.94), rgba(216, 236, 228, 0.45));
    }}

    .card-header h2 {{
      font-size: clamp(24px, 3vw, 36px);
      letter-spacing: -0.04em;
    }}

    .card-header p {{
      margin: var(--space-2) 0 0;
      color: var(--muted);
      line-height: 1.7;
    }}

    .section {{
      padding: var(--space-6);
      border-top: 1px solid var(--line);
    }}

    .section:first-of-type {{ border-top: 0; }}

    .section-title {{
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--space-5);
    }}

    .section-title h3 {{
      font-size: 20px;
      letter-spacing: -0.03em;
    }}

    .count-badge {{
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 7px 11px;
      font-size: 13px;
      font-weight: 750;
      border: 1px solid transparent;
    }}

    .count-good {{ color: var(--good); background: var(--good-soft); border-color: rgba(35, 112, 84, 0.18); }}
    .count-warn {{ color: var(--warn); background: var(--warn-soft); border-color: rgba(166, 107, 31, 0.22); }}
    .count-bad {{ color: var(--bad); background: var(--bad-soft); border-color: rgba(180, 72, 62, 0.24); }}

    .chip-row {{ display: flex; flex-wrap: wrap; gap: var(--space-2); }}

    .chip {{
      border-radius: 999px;
      padding: 8px 12px;
      font-size: 13px;
      border: 1px solid var(--line);
      transition: opacity 180ms ease, transform 180ms ease;
    }}

    .chip-selected {{
      color: #fffaf1;
      border-color: var(--accent);
      background: var(--accent);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.24);
    }}

    .chip-dimmed {{ color: var(--muted); background: rgba(255, 255, 255, 0.45); opacity: 0.62; }}

    .field-grid {{ display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-4); }}

    .field-row {{
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      padding: var(--space-4);
      background: rgba(255, 255, 255, 0.48);
    }}

    .field-label-line {{ display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); }}
    .field-label {{ color: var(--muted); font-size: 13px; font-weight: 750; }}
    .field-helper {{ margin: var(--space-2) 0 0; color: var(--muted); font-size: 12px; line-height: 1.55; }}

    .copy-value {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      margin-top: var(--space-3);
      font-weight: 760;
      line-height: 1.6;
      word-break: break-word;
    }}

    .copy-value span:first-child {{ min-width: 0; }}
    .muted-value {{ color: var(--muted); }}

    .copy-button {{
      flex: 0 0 auto;
      border: 1px solid rgba(47, 111, 98, 0.24);
      border-radius: 999px;
      color: var(--accent);
      background: var(--accent-soft);
      padding: 7px 10px;
      font-size: 12px;
      font-weight: 800;
      cursor: pointer;
      transition: transform 180ms ease, background 180ms ease;
    }}

    .copy-button:hover {{ background: #cce5dc; }}

    .counter {{ font-size: 12px; font-weight: 800; }}
    .counter-ok {{ color: var(--muted); }}
    .counter-over {{ color: var(--bad); }}

    .sticker-grid {{
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(156px, 1fr));
      gap: var(--space-4);
    }}

    .sticker-card {{
      opacity: 0;
      transform: translateY(12px);
      animation: rise 520ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
      animation-delay: calc(var(--index) * 45ms);
    }}

    @keyframes rise {{ to {{ opacity: 1; transform: translateY(0); }} }}

    .sticker-image, .asset-frame {{
      display: grid;
      place-items: center;
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      overflow: hidden;
      background-color: #fbf7ee;
      background-image:
        linear-gradient(45deg, rgba(47, 111, 98, 0.10) 25%, transparent 25%),
        linear-gradient(-45deg, rgba(47, 111, 98, 0.10) 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, rgba(47, 111, 98, 0.10) 75%),
        linear-gradient(-45deg, transparent 75%, rgba(47, 111, 98, 0.10) 75%);
      background-position: 0 0, 0 10px, 10px -10px, -10px 0;
      background-size: 20px 20px;
    }}

    .sticker-image {{ aspect-ratio: 1; padding: var(--space-4); }}
    .sticker-image img, .asset-frame img {{ max-width: 100%; max-height: 100%; object-fit: contain; display: block; }}
    .sticker-meta {{ display: grid; gap: var(--space-2); margin-top: var(--space-3); }}
    .sticker-index {{ color: var(--muted); font-size: 12px; font-weight: 800; letter-spacing: 0.08em; }}
    .compact-copy {{ margin-top: 0; }}

    .sticker-placeholder, .asset-placeholder {{
      display: grid;
      gap: var(--space-2);
      place-items: center;
      width: 100%;
      height: 100%;
      padding: var(--space-4);
      color: var(--muted);
      text-align: center;
      overflow-wrap: anywhere;
    }}

    .sticker-placeholder strong, .asset-placeholder strong {{ color: var(--ink); }}

    .asset-grid {{ display: grid; grid-template-columns: 1.45fr 1fr 0.72fr; gap: var(--space-4); align-items: start; }}
    .asset-grid.two {{ grid-template-columns: 1fr 1fr; }}
    .asset-card {{ margin: 0; }}
    .asset-title {{ font-size: 13px; color: var(--muted); font-weight: 800; margin-bottom: var(--space-2); }}
    .asset-frame {{ width: 100%; padding: var(--space-3); }}
    .asset-frame.compact {{ max-width: 180px; }}
    figcaption {{ color: var(--muted); font-size: 12px; margin-top: var(--space-2); }}

    .info-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }}
    .wide {{ grid-column: 1 / -1; }}
    .static-row {{ color: var(--muted); line-height: 1.7; }}
    .static-row strong {{ color: var(--ink); }}
    .toggle-state {{
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 8px 12px;
      font-weight: 800;
      color: {('#fffaf1' if appreciation else 'var(--muted)')};
      background: {('var(--accent)' if appreciation else 'rgba(255,255,255,0.5)')};
      border: 1px solid {('var(--accent)' if appreciation else 'var(--line)')};
    }}

    .check-list {{ display: grid; gap: var(--space-2); }}
    .check-item {{ display: flex; align-items: center; gap: var(--space-2); color: var(--muted); }}
    .check-mark {{ width: 16px; height: 16px; border-radius: 5px; border: 1px solid var(--line); background: rgba(255,255,255,0.5); }}
    .check-item.selected {{ color: var(--ink); font-weight: 750; }}
    .check-item.selected .check-mark {{ border-color: var(--accent); background: linear-gradient(135deg, var(--accent), #5a9586); }}
    .inline-warning {{ color: var(--warn); background: var(--warn-soft); border: 1px solid rgba(166, 107, 31, 0.22); border-radius: var(--radius-sm); padding: var(--space-2) var(--space-3); margin: var(--space-3) 0 0; }}
    .empty-panel {{ border: 1px dashed var(--line); border-radius: var(--radius-md); padding: var(--space-6); color: var(--muted); background: rgba(255,255,255,0.36); }}

    @media (max-width: 840px) {{
      .page {{ width: min(100% - 24px, 680px); padding: var(--space-6) 0; }}
      .hero, .field-grid, .asset-grid, .info-grid {{ grid-template-columns: 1fr; }}
      .card-header, .section {{ padding: var(--space-5); }}
      .asset-frame.compact {{ max-width: 100%; }}
    }}

    @media (prefers-reduced-motion: reduce) {{
      *, *::before, *::after {{ animation-duration: 1ms !important; transition-duration: 1ms !important; }}
    }}
  </style>
</head>
<body>
  <main class="page">
    <header class="hero">
      <div>
        <div class="eyebrow">WeChat Sticker Submission Preview</div>
        <h1>{e(name or '未命名表情专辑')}</h1>
        <p>只读预览已按微信“提交表情专辑”表单组织，资产、选项与文案集中核对；每个可复制文本旁都有复制按钮，可直接搬运到正式提交页。</p>
      </div>
      <aside class="hero-panel">
        <button class="copy-all" type="button" data-copy-all>复制全部文案</button>
        <div class="summary-list">
          <div><strong>表情类型</strong>：{e(selected_type_label(pack_type))}</div>
          <div><strong>素材数量</strong>：{sticker_count} 张</div>
          <div><strong>下载地区</strong>：{e(download_region or '未选择')}</div>
        </div>
      </aside>
    </header>

    <section class="form-card">
      <div class="card-header">
        <div>
          <h2>提交表情专辑</h2>
          <p>上传表情与填写基本信息的最终核对视图。</p>
        </div>
        {count_badge(sticker_count)}
      </div>

      <div class="section">
        <div class="section-title"><h3>上传表情</h3></div>
        {chips(TYPE_OPTIONS, {pack_type})}
        <div style="height: var(--space-5);"></div>
        {sticker_grid(stickers, base_dir, output_dir)}
      </div>

      <div class="section">
        <div class="section-title"><h3>填写基本信息</h3></div>
        <div class="field-grid">
          {value_row('名称', name, 8, '官方限制：不超过 8 汉字。')}
          {value_row('介绍', intro, 80, '官方限制：不超过 80 汉字。')}
          {value_row('版权', copyright, 10, '官方限制：不超过 10 汉字。')}
        </div>
        <div style="height: var(--space-5);"></div>
        <div class="asset-grid">
          {image_block('横幅', text_value(data, 'banner'), base_dir, output_dir, '750 / 400', '750×400 PNG/JPG')}
          {image_block('封面', text_value(data, 'cover'), base_dir, output_dir, '1 / 1', '240×240 PNG')}
          {image_block('图标', text_value(data, 'icon'), base_dir, output_dir, '1 / 1', '50×50 PNG', True)}
        </div>
      </div>
    </section>

    <section class="form-card">
      <div class="card-header">
        <div>
          <h2>填写附加信息</h2>
          <p>附加类型、风格主题与授权证明选项。</p>
        </div>
      </div>

      <div class="section">
        <div class="info-grid">
          <div class="field-row wide">
            <div class="field-label-line"><span class="field-label">类型</span></div>
            <div style="height: var(--space-3);"></div>
            {chips(ADDITIONAL_TYPE_OPTIONS, {additional_type})}
          </div>
          {optional_value_row('角色/内容', role)}
          <div class="field-row">
            <div class="field-label-line"><span class="field-label">上架地区</span></div>
            <div class="copy-value muted-value"><span>中国大陆</span></div>
          </div>
          <div class="field-row wide">
            <div class="field-label-line"><span class="field-label">表情风格</span></div>
            <div style="height: var(--space-3);"></div>
            {chips(STYLE_OPTIONS, set(styles))}
            {style_warning}
          </div>
          <div class="field-row wide">
            <div class="field-label-line"><span class="field-label">表情主题</span></div>
            <div style="height: var(--space-3);"></div>
            {chips(THEME_OPTIONS, {theme})}
          </div>
          <div class="field-row">
            <div class="field-label-line"><span class="field-label">下载地区</span></div>
            <div style="height: var(--space-3);"></div>
            {chips(DOWNLOAD_REGION_OPTIONS, {download_region})}
          </div>
          <div class="field-row">
            <div class="field-label-line"><span class="field-label">表情赞赏</span></div>
            <div style="height: var(--space-3);"></div>
            <span class="toggle-state">{'接受赞赏：开启' if appreciation else '接受赞赏：关闭'}</span>
          </div>
          <div class="field-row">
            <div class="field-label-line"><span class="field-label">版权证明</span></div>
            <div style="height: var(--space-3);"></div>
            <div class="check-list">
              {''.join(f'<div class="check-item {"selected" if option in copyright_cert else ""}"><span class="check-mark"></span><span>{e(option)}</span></div>' for option in COPYRIGHT_CERT_OPTIONS)}
            </div>
          </div>
          <div class="field-row">
            <div class="field-label-line"><span class="field-label">证明文件</span></div>
            <p class="static-row">选填，支持 JPG/PNG/BMP/PDF，各≤10MB。</p>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title"><h3>赞赏功能</h3></div>
        <div class="field-grid">
          {value_row('赞赏引导语', appreciation_guide, 15, '官方要求：5-15 个汉字，建议与表情强关联。') if appreciation else optional_value_row('赞赏引导语', '')}
          <div class="field-row">
            <div class="field-label-line"><span class="field-label">赞赏状态</span></div>
            <div style="height: var(--space-3);"></div>
            <span class="toggle-state">{'已准备赞赏素材' if appreciation else '未开启赞赏'}</span>
          </div>
          <div class="field-row">
            <div class="field-label-line"><span class="field-label">素材限制</span></div>
            <p class="static-row">引导图 750×560，致谢图 750×750；PNG/GIF，均≤500KB，避免透明背景。</p>
          </div>
        </div>
        <div style="height: var(--space-5);"></div>
        <div class="asset-grid two">
          {image_block('赞赏引导图', appreciation_guide_image, base_dir, output_dir, '750 / 560', '750×560 PNG/GIF ≤500KB')}
          {image_block('赞赏致谢图', appreciation_thanks_image, base_dir, output_dir, '1 / 1', '750×750 PNG/GIF ≤500KB')}
        </div>
      </div>
    </section>
  </main>

  <script>
    const COPY_ALL_TEXT = {copy_all};

    function fallbackCopy(text) {{
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      try {{
        document.execCommand('copy');
      }} finally {{
        document.body.removeChild(textarea);
      }}
    }}

    function writeCopy(text) {{
      if (navigator.clipboard && window.isSecureContext) {{
        return navigator.clipboard.writeText(text).catch(function () {{ fallbackCopy(text); }});
      }}
      fallbackCopy(text);
      return Promise.resolve();
    }}

    function flashButton(button) {{
      const original = button.textContent;
      button.textContent = '已复制';
      button.disabled = true;
      window.setTimeout(function () {{
        button.textContent = original;
        button.disabled = false;
      }}, 1200);
    }}

    document.querySelectorAll('[data-copy]').forEach(function (button) {{
      button.addEventListener('click', function () {{
        writeCopy(button.getAttribute('data-copy') || '').then(function () {{ flashButton(button); }});
      }});
    }});

    document.querySelectorAll('[data-copy-all]').forEach(function (button) {{
      button.addEventListener('click', function () {{
        writeCopy(COPY_ALL_TEXT).then(function () {{ flashButton(button); }});
      }});
    }});
  </script>
</body>
</html>
"""


def main() -> int:
    args = parse_args()
    meta_path = Path(args.meta)
    output_path = Path(args.output)
    try:
        data = load_meta(meta_path)
        base_dir = Path(args.base_dir) if args.base_dir else meta_path.parent
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(render_html(data, base_dir, output_path), encoding="utf-8")
    except ValueError as error:
        print(f"build_preview.py: {error}", file=sys.stderr)
        return 1
    except OSError as error:
        print(f"build_preview.py: could not write preview: {error}", file=sys.stderr)
        return 1
    print(output_path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
