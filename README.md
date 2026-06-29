# evil-read-enhanced

> 邪修的论文阅读工作流 - 自动化论文搜索、推荐、分析和整理（增强版：支持多源论文查询、Google Scholar、Nature 与浏览器辅助检索）

## Start My Day Full Loop

Current closed-loop entry:

```powershell
.\.venv\Scripts\python.exe tools\start_my_day_orchestrator.py `
  --workspace C:\GitClient\windows\repos\evilread-workspace `
  --date <YYYY-MM-DD> `
  --send-email
```

Windows Task Scheduler can call the checked-in wrapper:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\O2\Documents\GitHub\evil-read-enhanced\scripts\run-start-my-day.ps1"
```

The wrapper uses the repo `.venv`, defaults to `C:\GitClient\windows\repos\evilread-workspace`, checks required mail environment variables without printing values, and then runs the orchestrator with `--send-email`. For validation, use `-NoSendEmail -SkipGit -SkipZoteroImport` against a temporary workspace.

This runs Collections PDF import, Zotero mirror sync, `zotero/INDEX.md`, `vault/20_Research` note completion, translated Chinese PDF packaging, Markdown daily report generation, workspace commit/push, and CAT-compatible email delivery. The email body is the generated Markdown daily report file content verbatim.

After Zotero mirror and translation sync, `tools/package_translated_pdfs.py` scans `C:\GitClient\windows\repos\evilread-workspace\zotero\library\items\*.zh.pdf`, compares each file by `sha256 + size + mtime`, writes incremental zip batches under `C:\GitClient\windows\repos\evilread-workspace\downloads\translated-pdfs\batches\<YYYY-MM-DD>\`, and records `manifest.csv`. The daily report includes the current batch link as `https://code-file.jiashengfan.space/downloads/<run_id>.zip`; `translated-pdf-station` serves that manifest and the persisted zip files.

The reusable code-server workbench contract lives in `deploy/code-server/evilread.code-workspace` and is explained in `deploy/code-server/WORKSPACE_GUIDE.md`. That workspace opens both `C:\GitClient\windows\repos\evilread-workspace` and this repository, and includes VS Code tasks for production Start My Day, dry-run validation, smoke checks, and the translated PDF station.

Email sending is self-contained in `tools/cat_mailer.py`; it does not import from an external CAT checkout. Credentials are read only from environment variables such as `CAT_EMAIL_PROVIDER`, `CAT_CF_RELAY_URL`, and `CAT_CF_RELAY_SECRET`.

## 语言 / Language

- [中文版](README.md)
- [English Version](README_en.md)

## 简介

这是一套 Claude Code 技能（Skills）集合，用于自动化研究论文的搜索、推荐、分析和整理工作流。通过调用 arXiv、Semantic Scholar、DBLP、**Google Scholar**（Chrome CDP Proxy）和 **Nature**（浏览器辅助检索），每天为你推荐高质量论文，并自动生成详细笔记和关系图谱。新增的 `paper-query` 统一入口会合并多来源结果、保留来源证据、识别 PDF 链接，并可结合 Claude Code 的 `deep-research` 工作流生成综合研究报告。

## 更新日志

| 日期 | 版本 | 更新内容 |
|------|------|----------|
| 2026-06-25 | v1.5 | 闭环改为 `evilread-workspace` monorepo：`vault/` 与 `zotero/` 同仓同步，Obsidian 使用相对链接指向 Zotero PDF 镜像，Zotero 本体保留原 PDF 与翻译 PDF stored attachments |
| 2026-06-25 | v1.4 | 新增 Zotero ↔ Obsidian ↔ Skills 闭环 v1：本地 Gitea 双仓 `evilread-vault` / `evilread-zotero`、Zotero ingest、PDF2zh 翻译检测、Zotero artifact sync、daily 评论回写偏好与全文索引 |
| 2026-06-25 | v1.3 | 新增 `paper-query` 技能：统一多源论文查询框架，首批覆盖 arXiv、Semantic Scholar、DBLP、Google Scholar、Nature；支持 CDP/Kimi WebBridge 浏览器后端、PDF 链接识别、来源 provenance、verification status 与 deep-research 式综合报告 |
| 2026-03-31 | v1.2 | 新增 `scholar-search` 技能：通过 Chrome CDP Proxy 搜索 Google Scholar，绕过反爬虫限制，三维评分推荐，独立配置文件；新增 `CLAUDE.md` 项目文档；新增 `reportlab` 依赖支持 PDF 生成 |
| 2026-03-13 | v1.1 | 新增 `conf-papers` 技能：支持搜索 CVPR/ICCV/ECCV/ICLR/AAAI/NeurIPS/ICML 等顶级会议论文，基于 DBLP + Semantic Scholar 双数据源，独立配置文件，三维评分推荐 |
| 2026-03-01 | v1.0 | 初始版本：start-my-day 每日推荐、paper-analyze 论文分析、extract-paper-images 图片提取、paper-search 论文搜索 |

## 功能特点

### 1. start-my-day - 每日论文推荐
- 作为 Zotero ↔ Obsidian ↔ Skills 闭环入口，按 Fetch、Reflect、Discover、Ingest + Translate + Sync、Daily Note 五阶段运行
- 先从 `evilread-workspace` monorepo 拉取最新内容，再把 daily 评论回写到 `vault/99_System/Config/research_interests.yaml`
- 使用 `paper-query` 生成 Confirmed 与 Exploration 两类候选
- 通过 Zotero Connector 写入 Zotero，并用 `evilread:collection:Library/...` 标签记录 Confirmed/Exploration 归属；随后可用 `tools/zotero_runjs_collections.py` 通过 Zotero Run JavaScript 补齐 native collection
- 检测 PDF2zh 翻译产物，并将原 PDF、翻译 PDF、BibTeX 同步到 `evilread-workspace/zotero`
- `tools/start_my_day_daily.py --workspace C:\GitClient\windows\repos\evilread-workspace` 会在生成 Daily note 前自动调用 Zotero local API，将本机 Zotero 顶层条目全量镜像到 workspace；也可单独运行 `tools/zotero_sync.py --all --workspace C:\GitClient\windows\repos\evilread-workspace` 做补跑或排障
- 在 Zotero 本体中给论文条目挂载原 PDF 与翻译 PDF stored attachments
- 生成包含 Zotero 镜像、相对 PDF 链接、今日概览、阅读建议、每篇论文 insight block 和空评论模板的 Obsidian daily note
- Daily insight 默认用标题、摘要、mirror note 和 PDF 可用性做规则版分析；可选接入 OpenAI-compatible LLM 增强总结，环境变量为 `EVILREAD_LLM_BASE_URL`、`EVILREAD_LLM_MODEL`、`EVILREAD_LLM_API_KEY`

### 2. paper-analyze - 论文深度分析
- 深度分析单篇论文
- 生成结构化笔记，包含：
  - 摘要翻译和要点提炼
  - 研究背景与动机
  - 方法概述和架构
  - 实验结果分析
  - 研究价值评估
  - 优势和局限性分析
  - 与相关论文对比
- 自动提取论文图片并插入笔记
- 更新知识图谱

### 3. extract-paper-images - 论文图片提取
- 优先从 arXiv 源码包提取高质量图片
- 支持从 PDF 提取图片作为备选
- 自动生成图片索引
- 保存到笔记目录的 images 子目录

### 4. paper-search - 论文笔记搜索
- 在已有笔记中搜索论文
- 支持按标题、作者、关键词、领域搜索
- 相关性评分排序

### 5. conf-papers - 顶会论文搜索推荐
- 搜索 CVPR/ICCV/ECCV/ICLR/AAAI/NeurIPS/ICML 等顶级会议论文
- 基于 DBLP API 获取论文列表 + Semantic Scholar 补充引用和摘要
- 独立配置文件 `conf-papers.yaml`（关键词、排除词、默认年份/会议）
- 两阶段过滤：标题关键词轻量筛选 → S2 补充 → 三维评分（相关性 40% + 热门度 40% + 质量 20%）
- 前三篇论文自动生成详细分析（需有 arXiv ID）

### 6. scholar-search - Google Scholar 搜索推荐
- **通过 Chrome CDP Proxy 搜索 Google Scholar，绕过反爬虫限制**
- 需要 Chrome 浏览器开启远程调试 + CDP Proxy 运行（来自 `web-access` skill，默认端口 `3457`）
- 支持关键词搜索、年份过滤、分页抓取
- 可选 Semantic Scholar 补充完整摘要和影响力引用数
- 三维评分（相关性 40% + 热门度 40% + 质量 20%）
- CAPTCHA 自动检测，提示用户在 Chrome 中手动解决
- 独立配置文件 `scholar-search.yaml`
- 覆盖面比 arXiv 更广（含已发表期刊/会议论文）

### 7. paper-query - 多源论文查询与 deep-research 综合推荐（新增）
- 统一查询 arXiv、Semantic Scholar、DBLP、Google Scholar、Nature
- 将不同来源标准化为同一 `PaperRecord` 输出，保留 provenance 和 verification status
- 支持 DOI、arXiv ID、Semantic Scholar URL、归一化标题去重
- 支持 PDF 链接识别和状态记录；默认不下载 PDF，显式请求才下载
- 浏览器后端支持 Kimi WebBridge（真实登录态）和 Chrome CDP Proxy（兼容旧 Scholar 流程）
- 可将结构化候选交给 Claude Code `deep-research` 做交叉核验、阅读顺序和推荐理由综合

## 安装

### 前置要求

1. **Claude Code CLI** - 需要安装并配置 Claude Code
2. **Python 3.8+** - 用于运行搜索和分析脚本
3. **依赖库**：
   ```bash
   pip install -r requirements.txt
   ```
4. **浏览器后端**（`scholar-search` 与 `paper-query` 的 Google Scholar/Nature 来源需要）：
   - Chrome CDP Proxy：Chrome 浏览器需开启远程调试；需要 `web-access` skill 的 CDP Proxy（Node.js 22+）；默认端口 `3457`
   - Kimi WebBridge（可选）：用于真实浏览器登录态、Nature 文章页和 PDF 链接处理；daemon 地址 `http://127.0.0.1:10086`
   - CDP 启动方式：`bash ~/.claude/skills/web-access/scripts/check-deps.sh`（或手动运行 `CDP_PROXY_PORT=3457 node cdp-proxy.mjs`）

### 安装步骤

1. 将此仓库克隆或复制到你的 Claude Code skills 目录：
   ```bash
   # Windows PowerShell
   Copy-Item -Recurse evil-read-arxiv\start-my-day $env:USERPROFILE\.claude\skills\
   Copy-Item -Recurse evil-read-arxiv\paper-analyze $env:USERPROFILE\.claude\skills\
   Copy-Item -Recurse evil-read-arxiv\extract-paper-images $env:USERPROFILE\.claude\skills\
   Copy-Item -Recurse evil-read-arxiv\paper-search $env:USERPROFILE\.claude\skills\
   Copy-Item -Recurse evil-read-arxiv\conf-papers $env:USERPROFILE\.claude\skills\
   Copy-Item -Recurse evil-read-arxiv\scholar-search $env:USERPROFILE\.claude\skills\
   Copy-Item -Recurse evil-read-arxiv\paper-query $env:USERPROFILE\.claude\skills\

   # macOS/Linux
   cp -r evil-read-arxiv/start-my-day ~/.claude/skills/
   cp -r evil-read-arxiv/paper-analyze ~/.claude/skills/
   cp -r evil-read-arxiv/extract-paper-images ~/.claude/skills/
   cp -r evil-read-arxiv/paper-search ~/.claude/skills/
   cp -r evil-read-arxiv/conf-papers ~/.claude/skills/
   cp -r evil-read-arxiv/scholar-search ~/.claude/skills/
   cp -r evil-read-arxiv/paper-query ~/.claude/skills/
   ```

2. 配置环境变量和路径（见下文"配置"部分）

3. 重启 Claude Code CLI

## 配置

> **强烈建议**：先阅读 [QUICKSTART.md](QUICKSTART.md) 快速完成设置。

### 步骤1：设置环境变量（推荐）

所有脚本统一通过 `OBSIDIAN_VAULT_PATH` 环境变量读取 Obsidian Vault 路径，这是最简单的配置方式：

```bash
# Windows PowerShell（临时生效）
$env:OBSIDIAN_VAULT_PATH = "C:/Users/YourName/Documents/Obsidian Vault"

# Windows PowerShell（永久生效）
[System.Environment]::SetEnvironmentVariable("OBSIDIAN_VAULT_PATH", "C:/Users/YourName/Documents/Obsidian Vault", "User")

# macOS/Linux（添加到 ~/.bashrc 或 ~/.zshrc）
export OBSIDIAN_VAULT_PATH="/Users/yourname/Documents/Obsidian Vault"
```

设置环境变量后，**无需修改任何脚本中的路径**。

### 步骤2：创建配置文件

复制 `config.example.yaml` 并修改：

```bash
cp config.example.yaml config.yaml
```

编辑 `config.yaml`，根据你的研究兴趣修改关键词：

```yaml
vault_path: "/path/to/your/obsidian/vault"

research_domains:
  "你的研究领域1":
    keywords:
      - "keyword1"
      - "keyword2"
    arxiv_categories:
      - "cs.AI"
      - "cs.LG"
```

然后将修改后的 `config.yaml` 复制到 Vault 中：
```bash
cp config.yaml "$OBSIDIAN_VAULT_PATH/99_System/Config/research_interests.yaml"
```

### 步骤3（可选）：通过 CLI 参数覆盖路径

如果不想设置环境变量，也可以在每次调用脚本时通过参数指定路径：

```bash
python scripts/search_arxiv.py --config "/your/path/research_interests.yaml"
python scripts/scan_existing_notes.py --vault "/your/obsidian/vault"
python scripts/generate_note.py --vault "/your/obsidian/vault" --paper-id "2402.12345" --title "Paper Title" --authors "Author" --domain "大模型"
python scripts/update_graph.py --vault "/your/obsidian/vault" --paper-id "2402.12345" --title "Paper Title" --domain "大模型"
```

### 路径格式说明

- **Windows**：可以使用正斜杠 `/` 或双反斜杠 `\\`
  - 正确：`C:/Users/Name/Documents/Vault`
  - 正确：`C:\\Users\\Name\\Documents\\Vault`
  - 错误：`C:\Users\Name\Documents\Vault`（单反斜杠在 Python 字符串中需要转义）

- **macOS/Linux**：使用正斜杠 `/`
  - 正确：`/Users/name/Documents/Vault`

### Obsidian 目录结构要求

你的 Obsidian Vault 需要包含以下目录结构：

```
你的Vault/
├── 10_Daily/                    # 每日推荐笔记（自动创建）
│   └── YYYY-MM-DD论文推荐.md
├── 20_Research/
│   └── Papers/                  # 论文详细笔记目录
│       ├── 大模型/
│       │   └── 论文标题.md
│       │       └── images/      # 论文图片
│       ├── 多模态技术/
│       └── 智能体/
└── 99_System/
    └── Config/
        └── research_interests.yaml  # 研究兴趣配置（复制 config.yaml 到这里）
```

## 使用方法

### 开始每天的论文推荐

在你的 Obsidian Vault 目录下打开终端，输入：

```bash
start my day
```

这会：
1. 拉取 `C:/GitClient/windows/repos/evilread-workspace`
2. 解析最近 daily note 的 `+interest:`、`-avoid:`、`!deepen:`、`?question:` 评论并更新研究偏好
3. 运行 `paper-query` 生成 Confirmed 与 Exploration 候选
4. 通过 Zotero Connector 写入条目，并用 collection intent tag 与 `30_Inbox/Zotero/` 镜像记录当天分组；如需 Zotero 侧原生 collection，打开 Zotero Run JavaScript 窗口后执行 `tools/zotero_runjs_collections.py --confirmed-result confirmed.json --exploration-result exploration.json --date <YYYY-MM-DD> --execute`
5. 检查 PDF2zh 翻译产物，同步 PDF、翻译 PDF 和 BibTeX 到 `evilread-workspace/zotero`
6. 通过 `tools/zotero_runjs_attachments.py` 将原 PDF 与翻译 PDF 导入 Zotero 本体 stored attachments
7. 生成今日推荐笔记（保存到 `10_Daily/` 目录）

### 分析单篇论文

如果你想深入阅读某篇论文：

```bash
paper-analyze 2602.12345
# 或使用论文标题
paper-analyze "论文标题"
```

这会：
1. 下载论文 PDF
2. 提取图片
3. 生成详细的分析笔记
4. 更新知识图谱

### 提取论文图片

```bash
extract-paper-images 2602.12345
```

### 搜索已有论文

```bash
paper-search "关键词"
```

### 多源查询论文（arXiv / S2 / DBLP / Scholar / Nature）

```bash
paper-query "form meaning mappings language"
```

或直接运行脚本：

```bash
python paper-query/scripts/run_query.py \
  --query "form meaning mappings language" \
  --sources arxiv,semantic_scholar,dblp,google_scholar,nature \
  --year-from 2024 \
  --year-to 2026 \
  --top-n 10
```

`paper-query` 会输出统一 JSON：包含来源 provenance、verification status、DOI/arXiv/S2 ID、PDF 链接状态和推荐分数。Google Scholar 与 Nature 需要浏览器后端；如果浏览器不可用，会跳过这些来源并保留 API-only 结果。

### 搜索 Google Scholar 论文（需 Chrome CDP Proxy）

```bash
scholar-search
# 或指定年份范围
scholar-search 2024 2025
```

> **注意**：`scholar-search` 需要 Chrome 浏览器已打开并开启远程调试，且 CDP Proxy 正在运行。首次使用前请参考上方"前置要求"第 4 点配置 Chrome。如果遇到 CAPTCHA 验证码，脚本会暂停并提示你在 Chrome 中手动完成验证。

## 目录结构

```
evil-read-enhanced/
├── README.md                 # 本文件
├── QUICKSTART.md             # 快速开始指南
├── CLAUDE.md                 # Claude Code 项目文档
├── config.example.yaml       # 配置模板（需要复制并修改）
├── requirements.txt          # Python 依赖
├── tools/                    # Zotero/Obsidian 闭环工具
│   ├── safety_scan.py        # commit 前敏感信息扫描
│   ├── start_my_day_reflect.py # daily 评论回写研究偏好
│   ├── start_my_day_daily.py # 生成闭环 daily note
│   ├── zotero_ingest.py      # paper-query 结果写入 Zotero Connector 并记录 collection intent
│   ├── zotero_runjs_collections.py # 通过 Zotero Run JavaScript 补齐 native collections
│   ├── translate_watch.py    # PDF2zh 健康检查与翻译产物检测
│   ├── zotero_sync.py        # PDF / 翻译 PDF / BibTeX 同步到 evilread-workspace/zotero
│   ├── zotero_runjs_attachments.py # 导入 monorepo PDF 为 Zotero stored attachments
│   ├── zotero_index.py       # Zotero storage 全文索引
│   └── tests/
│       └── smoke_loop.py     # 闭环工具离线 smoke
├── start-my-day/             # 每日推荐技能
│   ├── SKILL.md              # 技能定义文件
│   └── scripts/
│       ├── search_arxiv.py   # arXiv/Semantic Scholar 搜索脚本
│       ├── scan_existing_notes.py  # 扫描现有笔记
│       └── link_keywords.py  # 关键词自动链接脚本
├── paper-analyze/            # 论文分析技能
│   ├── SKILL.md
│   └── scripts/
│       ├── generate_note.py  # 生成笔记模板
│       └── update_graph.py   # 更新知识图谱
├── extract-paper-images/     # 图片提取技能
│   ├── SKILL.md
│   └── scripts/
│       └── extract_images.py # 图片提取脚本
├── paper-search/             # 论文搜索技能
│   └── SKILL.md
├── conf-papers/              # 顶会论文搜索推荐技能
│   ├── SKILL.md
│   ├── conf-papers.yaml      # 独立配置（关键词、会议、年份）
│   └── scripts/
│       └── search_conf_papers.py  # DBLP搜索 + S2补充 + 评分
├── scholar-search/           # Google Scholar 搜索推荐技能
│   ├── SKILL.md              # 技能定义文件
│   ├── scholar-search.yaml   # 独立配置（关键词、年份、CDP端口）
│   └── scripts/
│       └── search_scholar.py # Chrome CDP 爬取 + S2补充 + 评分
└── paper-query/              # 多源论文查询与 deep-research 编排技能（新增）
    ├── SKILL.md
    ├── paper-query.yaml
    └── scripts/
        ├── run_query.py
        ├── smoke_offline.py
        └── paper_query/      # 统一模型、来源 adapters、浏览器/PDF/评分工具
```

## 评分机制

论文推荐评分基于多维度加权：

| 数据源 | 相关性 | 新近性 | 热门度 | 质量 |
|--------|--------|--------|--------|------|
| 每日推荐 (arXiv) | 40% | 20% | 30% | 10% |
| 顶会推荐 (DBLP) | 40% | — | 40% | 20% |
| Scholar 推荐 (Google Scholar) | 40% | — | 40% | 20% |
| 多源查询 (paper-query) | 40% | 可选 | 30% | 20% + verification 10% |

**评分细则**：
- **相关性**：标题关键词匹配（+0.5/个）、摘要关键词匹配（+0.3/个）、类别匹配（+1.0）
- **新近性**：30天内（+3）、30-90天（+2）、90-180天（+1）、180天以上（0）
- **热门度**：高影响力引用 > 100（+3）、50-100（+2）、< 50（+1）
- **质量**：多维度指标（强创新词 > 弱创新词 > 方法指标 > 量化结果 > 实验指标）

## 常用 arXiv 分类

| 分类代码 | 名称 | 说明 |
|----------|------|------|
| cs.AI | Artificial Intelligence | 人工智能 |
| cs.LG | Learning | 机器学习 |
| cs.CL | Computation and Language | 计算语言学/NLP |
| cs.CV | Computer Vision | 计算机视觉 |
| cs.MM | Multimedia | 多媒体 |
| cs.MA | Multiagent Systems | 多智能体系统 |
| cs.RO | Robotics | 机器人学 |

## 常见问题

### Q: 搜索没有结果？
A: 检查以下几点：
1. 确认网络连接正常
2. 检查配置文件中的关键词是否正确
3. 尝试扩大搜索的 arXiv 分类范围

### Q: 图片提取失败？
A:
1. 确保安装了 PyMuPDF：`pip install PyMuPDF`
2. 检查 arXiv ID 格式是否正确（如 2602.12345）

### Q: 关键词自动链接不准确？
A: 可以在 `start-my-day/scripts/link_keywords.py` 中修改 `COMMON_WORDS` 集合，添加你不需要自动链接的词

### Q: "Papers directory not found" 错误？
A:
1. 检查 `OBSIDIAN_VAULT_PATH` 环境变量是否正确设置
2. 确认 Obsidian Vault 中的目录结构是否正确创建（20_Research/Papers/）

### Q: "未指定 vault 路径" 错误？
A: 设置 `OBSIDIAN_VAULT_PATH` 环境变量，或在调用脚本时通过 `--vault` / `--config` 参数指定路径。

## 高级配置

### 修改搜索的 arXiv 分类

在调用 `search_arxiv.py` 时通过 `--categories` 参数指定：

```bash
python scripts/search_arxiv.py --categories "cs.AI,cs.LG,cs.CL,cs.CV"
```

### 修改每天推荐的论文数量

在调用 `search_arxiv.py` 时通过 `--top-n` 参数指定：

```bash
python scripts/search_arxiv.py --top-n 15
```

### 修改评分权重

在 `start-my-day/scripts/search_arxiv.py` 的 `calculate_recommendation_score` 函数中调整权重。

## 工作原理

```
用户输入 "start my day"
         ↓
    1. Fetch 两个本地 Gitea 工作树
    2. Reflect daily 评论并更新研究偏好
         ↓
    3. Discover：paper-query 多源检索
    4. Ingest：写入 Zotero 并记录 Confirmed / Exploration intent
         ↓
    5. Translate：检测 PDF2zh 产物
    6. Sync：同步 PDF / 翻译 PDF / BibTeX
         ↓
    7. Daily Note：生成 Obsidian 推荐笔记和评论模板
```

## 贡献

欢迎提交 Issue 和 Pull Request！

如果你觉得这个项目对你有帮助，请给个 Star ⭐️ 支持一下！

[![Star History Chart](https://api.star-history.com/svg?repos=juliye2025/evil-read-arxiv&type=Date)](https://star-history.com/#juliye2025/evil-read-arxiv&Date)

## 许可证

MIT License

## 致谢

- [arXiv](https://arxiv.org/) - 开放获取的学术论文预印本平台
- [Semantic Scholar](https://www.semanticscholar.org/) - AI 驱动的学术研究平台
- [Google Scholar](https://scholar.google.com/) - 学术搜索引擎
- [DBLP](https://dblp.org/) - 计算机科学文献数据库
- [Claude Code](https://claude.ai/claude-code) - AI 辅助的代码和写作工具
- [Obsidian](https://obsidian.md/) - 强大的知识管理工具
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/) - Chrome 远程调试协议
