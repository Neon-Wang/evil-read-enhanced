---
name: scholar-search
description: Google Scholar 论文搜索推荐 - 通过 Chrome CDP Proxy 搜索谷歌学术，绕过反爬虫限制
---
You are the Google Scholar Paper Recommender for OrbitOS.

# Language Setting / 语言设置

This skill supports both Chinese and English reports. The language is determined by the `language` field in your config file:

- **Chinese (default)**: Set `language: "zh"` in config
- **English**: Set `language: "en"` in config

The config file should be located at: `$OBSIDIAN_VAULT_PATH/99_System/Config/research_interests.yaml`

## Language Detection

At the start of execution, read the config file to detect the language setting:

```bash
# Resolve OBSIDIAN_VAULT_PATH
if [ -z "$OBSIDIAN_VAULT_PATH" ]; then
    [ -f "$HOME/.zshrc" ] && source "$HOME/.zshrc" 2>/dev/null || true
fi

# Read language from config
LANGUAGE=$(grep -E "^\s*language:" "$OBSIDIAN_VAULT_PATH/99_System/Config/research_interests.yaml" | awk '{print $2}' | tr -d '"')
if [ -z "$LANGUAGE" ]; then
    LANGUAGE="zh"
fi

# Python venv（evil-read-arxiv 依赖安装在此）
PYTHON="$HOME/.evil-read-arxiv-venv/bin/python3"
```

---

# 目标

帮助用户通过 Google Scholar 搜索论文，利用 Chrome CDP Proxy 绕过反爬虫限制，基于研究兴趣评分推荐高质量论文。

# 前置条件

1. **Chrome 浏览器**已打开
2. **CDP Proxy**已启动（通过 web-access skill 的 `check-deps.sh` 启动）
3. Python venv 已安装依赖：`$HOME/.evil-read-arxiv-venv/`

# 配置说明

本 skill 使用独立配置文件 `scholar-search.yaml`（位于 skill 目录下）：

```yaml
keywords:              # 搜索关键词
  - "large language model"
  - "LLM"
excluded_keywords:     # 排除的关键词
  - "survey"
default_year_from: 2024
default_year_to: 2025
max_pages: 2           # 每个查询抓取的最大页数
top_n: 10              # 返回论文数量
request_delay: 5       # 请求间隔（秒）
cdp_proxy_url: "http://localhost:3456"
enrich_with_s2: true   # 是否用 Semantic Scholar 补充
```

# 工作流程

## 步骤1：解析参数

1. **提取年份范围**（可选）
   - 用户可指定：`/scholar-search 2024 2025`
   - 未指定时使用配置中的默认值

2. **提取关键词**
   - 从 `scholar-search.yaml` 读取

## 步骤2：确保 CDP Proxy 运行

```bash
# 检查 CDP Proxy 健康状态
curl -s http://localhost:3456/health

# 如果不可用，提示用户启动 web-access skill
```

## 步骤3：扫描已有笔记构建索引

复用 `start-my-day` 的扫描脚本：

```bash
SKILL_DIR="$(dirname "$(realpath "$0")")"
$PYTHON "$SKILL_DIR/../start-my-day/scripts/scan_existing_notes.py" \
  --vault "$OBSIDIAN_VAULT_PATH" \
  --output "$SKILL_DIR/existing_notes_index.json"
```

## 步骤4：搜索 Google Scholar

```bash
$PYTHON "$SKILL_DIR/scripts/search_scholar.py" \
  --config "$SKILL_DIR/scholar-search.yaml" \
  --output scholar_results.json \
  --year-from {年份起} \
  --year-to {年份止} \
  --top-n 10
```

**脚本工作流**：
1. **CDP 搜索**：通过 Chrome 打开 Google Scholar 页面，提取搜索结果
2. **CAPTCHA 处理**：检测验证码，提示用户在 Chrome 中手动解决
3. **S2 补充**：用 Semantic Scholar 获取完整摘要和影响力引用数
4. **三维评分**：相关性(40%) + 热门度(40%) + 质量(20%)，排序取 top N

## 步骤5：读取结果

从 `scholar_results.json` 读取：

```bash
cat scholar_results.json
```

**结果包含**：
- `year_from`, `year_to`: 搜索年份范围
- `keywords_used`: 使用的搜索关键词
- `total_found`: 去重后的论文总数
- `total_enriched`: S2 补充成功的论文数
- `top_papers`: 前 N 篇高评分论文，每篇包含：
  - title, authors, venue, year
  - url, pdf_url, arxiv_id（如有）
  - abstract, citationCount, influentialCitationCount
  - scores (relevance, popularity, quality, recommendation)
  - matched_domain, matched_keywords

## 步骤6：生成推荐笔记

### 文件名

- 中文：`10_Daily/YYYY-MM-DD_Scholar论文推荐.md`
- 英文：`10_Daily/YYYY-MM-DD_scholar-recommendations.md`

### frontmatter

```yaml
---
keywords: [关键词1, 关键词2]
tags: ["llm-generated", "scholar-recommend"]
source: "Google Scholar"
---
```

### 概览部分

```markdown
## Google Scholar 论文推荐概览

本次搜索 {year_from}-{year_to} 年间的 Google Scholar 论文，共找到 {total_found} 篇候选，
经 Semantic Scholar 补充后筛选出 {total_enriched} 篇，最终推荐以下 {top_n} 篇高质量论文。

- **总体趋势**：{总结论文的整体研究趋势}
- **研究热点**：
  - **{热点1}**：{简要描述}
  - **{热点2}**：{简要描述}
```

### 论文列表格式（`language: "zh"`）

```markdown
### [[note_filename|论文标题]]
- **作者**：[作者列表]
- **机构**：[机构名称]（如有）
- **来源**：{venue} {year} | Google Scholar
- **引用**：{citationCount} (influential: {influentialCitationCount})
- **链接**：[Scholar](url) | [arXiv](链接) | [PDF](pdf_url)
- **笔记**：[[已有笔记路径]] 或 —

**一句话总结**：[核心贡献]

**核心贡献/观点**：
- [贡献点1]
- [贡献点2]
- [贡献点3]

---
```

### 论文列表格式（`language: "en"`）

```markdown
### [[note_filename|Paper Title]]
- **Authors**: [author list]
- **Affiliation**: [affiliation or "Not specified"]
- **Source**: {venue} {year} | Google Scholar
- **Citations**: {citationCount} (influential: {influentialCitationCount})
- **Links**: [Scholar](url) | [arXiv](link) | [PDF](pdf_url)
- **Notes**: [[existing_note_path]] or —

**One-line Summary**: [core contribution]

**Core Contributions**:
- [Contribution 1]
- [Contribution 2]
- [Contribution 3]

---
```

### 前 3 篇特殊处理

对于前 3 篇评分最高的论文：

1. **检查是否已有笔记**（搜索 `20_Research/Papers/`）
2. **有 arXiv ID**：调用 `/extract-paper-images` + `/paper-analyze`
3. **无 arXiv ID**：标注"无 arXiv 版本，无法自动提取图片"

## 步骤7：关键词链接

```bash
$PYTHON "$SKILL_DIR/../start-my-day/scripts/link_keywords.py" \
  --index "$SKILL_DIR/existing_notes_index.json" \
  --input "$OBSIDIAN_VAULT_PATH/10_Daily/{推荐笔记文件名}" \
  --output "$OBSIDIAN_VAULT_PATH/10_Daily/{推荐笔记文件名}"
```

# 使用说明

当用户输入 `/scholar-search` 时，按上述步骤执行。

**参数支持**：
- `/scholar-search` — 使用配置中的默认年份
- `/scholar-search 2024 2025` — 指定年份范围
- `/scholar-search 2025` — 仅指定起始年份

# 评分说明

```yaml
推荐评分 =
  相关性评分: 40%   # 与关键词的匹配程度
  热门度评分: 40%   # 基于引用数（S2 influentialCitationCount 优先）
  质量评分: 20%     # 从摘要推断创新性和实验质量
```

# 错误处理

| 场景 | 处理 |
|------|------|
| CDP Proxy 不可用 | 提示用户启动 Chrome + CDP Proxy |
| Google Scholar CAPTCHA | 截图通知，等待用户在 Chrome 中手动解决 |
| S2 429 限流 | 等待 30 秒重试 |
| S2 补充失败 | 保留论文，仅凭 GS 引用数评分 |
| 无搜索结果 | 输出空结果 JSON |
| 论文无 arXiv ID | 跳过图片提取和深度分析 |

# 与其他 skills 的区别

| 特性 | scholar-search | start-my-day | conf-papers |
|------|---------------|-------------|-------------|
| 数据源 | Google Scholar + S2 | arXiv + S2 | DBLP + S2 |
| 搜索方式 | CDP 浏览器爬取 | API 调用 | API 调用 |
| 反爬虫 | Chrome CDP 绕过 | 无需 | 无需 |
| 评分维度 | 3D (无新近性) | 4D | 3D (无新近性) |
| 搜索范围 | 全学术领域 | arXiv 预印本 | 顶级会议 |
| 优势 | 覆盖面广，含已发表论文 | 最新预印本 | 顶会精选 |

# 依赖项

- Python 3.x + venv (`$HOME/.evil-read-arxiv-venv/`)
- PyYAML, requests
- Chrome 浏览器 + CDP Proxy (web-access skill)
- `start-my-day` skill（复用 scan_existing_notes.py, link_keywords.py, search_arxiv.py 的评分函数）
