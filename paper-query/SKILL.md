---
name: paper-query
description: 多源论文查询与深度研究推荐 - 聚合 arXiv、Semantic Scholar、DBLP、Google Scholar、Nature，并支持浏览器辅助和 deep-research 式核验
---

You are the Multi-Source Paper Query Orchestrator for evil-read-enhanced.

# 目标

按用户的研究主题从多个学术来源检索论文，合并重复结果，保留来源证据，验证 DOI/PDF/标题匹配，并生成可继续进入 Obsidian 阅读工作流的推荐结果。

本 skill 是外部论文检索入口；`paper-search` 仍只用于搜索已有 Obsidian 笔记。

# 支持来源

| 来源 | 类型 | 浏览器要求 | 主要用途 | PDF 行为 |
|------|------|------------|----------|----------|
| arXiv | API | 否 | 最新预印本 | 解析 PDF 链接 |
| Semantic Scholar | API | 否 | 引用、摘要、ID 补充 | arXiv ID 可反推 PDF |
| DBLP | API | 否 | 顶会/出版物元数据 | 通常无 PDF |
| Google Scholar | 浏览器 | 是 | 覆盖更广的已发表论文 | 解析侧栏 PDF 链接 |
| Nature | 浏览器 | 是 | Nature 系列期刊文章 | 解析文章页 PDF 链接，默认不下载 |

# 浏览器后端

`paper-query` 支持两类浏览器后端：

1. **Kimi WebBridge**（优先）
   - daemon: `http://127.0.0.1:10086`
   - 使用真实浏览器和登录态，适合 Nature 文章页、PDF 链接查找、手动验证码/登录处理。
   - 已安装时优先使用。

2. **Chrome CDP Proxy**
   - 默认地址：`http://localhost:3457`
   - 兼容旧 `scholar-search` / `web-access` 工作流。
   - 适合脚本化 Google Scholar 批量抓取。

配置位于 `paper-query.yaml`：

```yaml
browser:
  backend: auto          # auto | webbridge | cdp | none
  webbridge_url: "http://127.0.0.1:10086"
  cdp_proxy_url: "http://localhost:3457"
```

# 工作模式

## 1. multi-source search

用于普通论文查询：

```bash
python paper-query/scripts/run_query.py \
  --query "browser assisted scholarly search" \
  --sources arxiv,semantic_scholar,dblp \
  --year-from 2024 \
  --year-to 2026 \
  --top-n 10
```

输出 JSON 包含：

- `top_papers`
- `sources` / provenance
- `scores`
- `verification_status`
- `doi` / `arxiv_id` / `s2_url`
- `pdf_url` / `pdf_status`
- `manual_required` / `blocked_reason`

## 2. browser-assisted search

当用户需要 Google Scholar、Nature 或真实网页/PDF 时使用：

```bash
python paper-query/scripts/run_query.py \
  --query "form meaning mappings language" \
  --sources google_scholar,nature \
  --max-pages 1 \
  --top-n 10
```

重要边界：

- 遇到 CAPTCHA、登录或 paywall 时，记录 `manual_required` / `blocked_reason`，不要绕过访问控制。
- PDF 默认只解析和验证链接，不下载。
- 只有用户明确要求或 `--download-pdfs` 时才下载 PDF。

## 3. deep-research mode

当用户要求“深入研究/综合推荐/核验来源”时：

1. 先运行 `run_query.py` 获取结构化候选。
2. 对候选做 DOI、title similarity、Semantic Scholar、PDF URL、primary source URL 核验。
3. 调用 Claude Code 的 `deep-research` skill 综合：
   - 对来源一致性做交叉检查。
   - 区分已验证信息、snippet 信息和待人工确认信息。
   - 生成推荐理由、可信度、阅读顺序和后续分析建议。
4. 写入 Obsidian 推荐笔记时，继续遵循项目规则：wikilink 使用 display alias，图片使用 Obsidian `![[file.png|600]]` 语法。

# 推荐执行流程

1. 解析用户主题、年份范围、来源范围、是否允许浏览器、是否下载 PDF。
2. 若用户未指定来源，默认使用 `paper-query.yaml` 的 `sources`。
3. 若浏览器后端不可用：
   - 继续运行 API-only 来源。
   - 在结果中标记 Google Scholar/Nature 需要浏览器。
4. 运行：
   ```bash
   python paper-query/scripts/run_query.py --query "{主题}" --sources "{来源列表}" --output paper_query_results.json
   ```
5. 读取 JSON，按推荐分数和 verification status 排序总结。
6. 如果用户要求 deep research，基于 JSON 调用 `/deep-research` 做综合报告。
7. 如需写 Obsidian note，复用 `start-my-day/scripts/link_keywords.py` 做关键词链接。

# 错误处理

| 场景 | 处理 |
|------|------|
| Kimi WebBridge 不可用 | 自动尝试 CDP；仍不可用则跳过浏览器来源 |
| CDP Proxy 不可用 | 标记浏览器来源 `manual_required`，保留 API-only 结果 |
| Google Scholar CAPTCHA | 截图/提示用户手动处理，不绕过 |
| Nature 登录/paywall | 标记 `blocked_reason`，保留 article URL |
| S2 429 | 降级跳过 enrichment，保留原始来源字段 |
| PDF 无法访问 | `pdf_status=failed` 或 `blocked`，不影响论文推荐 |

# 与现有 skills 的关系

- `start-my-day`：每日 arXiv/S2 推荐，仍可独立使用。
- `conf-papers`：顶会 DBLP/S2 推荐，仍可独立使用。
- `scholar-search`：Google Scholar 专用入口，仍可独立使用；底层逐步复用 `paper_query.browser`。
- `paper-search`：本地 Obsidian 论文笔记搜索，不做外部检索。
- `paper-analyze` / `extract-paper-images`：对高价值论文做后续深度分析；非 arXiv 论文优先通过 PDF URL/local PDF 进入后续流程。

# 验证命令

```bash
python paper-query/scripts/smoke_offline.py
python -m py_compile paper-query/scripts/run_query.py
python -m py_compile paper-query/scripts/smoke_offline.py
python -m py_compile scholar-search/scripts/search_scholar.py
```
