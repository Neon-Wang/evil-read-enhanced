# 快速开始指南

这是使用 evil-read-enhanced 的快速设置指南。

## 第一步：安装依赖

在终端运行：

```bash
pip install -r requirements.txt
```

> 如果 Homebrew Python 报错 `externally-managed-environment`，使用 venv：
> ```bash
> python3 -m venv ~/.evil-read-arxiv-venv
> source ~/.evil-read-arxiv-venv/bin/activate
> pip install -r requirements.txt
> # 将 venv 加入 PATH（添加到 ~/.zshrc 或 ~/.bashrc）
> export PATH="$HOME/.evil-read-arxiv-venv/bin:$PATH"
> ```

## 第二步：配置

### 2.1 设置环境变量

设置 `OBSIDIAN_VAULT_PATH` 环境变量，指向你的 Obsidian Vault 路径。所有脚本会自动读取此变量，无需手动修改脚本中的路径。

```bash
# Windows PowerShell（永久生效，设置后需重启终端）
[System.Environment]::SetEnvironmentVariable("OBSIDIAN_VAULT_PATH", "C:/Users/YourName/Documents/Obsidian Vault", "User")

# macOS/Linux（添加到 ~/.bashrc 或 ~/.zshrc）
echo 'export OBSIDIAN_VAULT_PATH="/Users/yourname/Documents/Obsidian Vault"' >> ~/.bashrc
source ~/.bashrc
```

### 2.2 创建配置文件

```bash
cd evil-read-arxiv
cp config.example.yaml config.yaml
```

编辑 `config.yaml`，修改：

```yaml
# 将此路径改为你的 Obsidian Vault 路径
vault_path: "/path/to/your/obsidian/vault"

# 根据你的研究兴趣修改关键词
research_domains:
  "你的研究领域1":
    keywords:
      - "keyword1"
      - "keyword2"
```

### 2.3 将配置文件放入 Vault

```bash
# macOS/Linux
cp config.yaml "$OBSIDIAN_VAULT_PATH/99_System/Config/research_interests.yaml"

# Windows PowerShell
Copy-Item config.yaml "$env:OBSIDIAN_VAULT_PATH\99_System\Config\research_interests.yaml"
```

### 2.4 将技能安装到 Claude Code

将 evil-read-arxiv 目录中的四个技能文件夹复制到你的 Claude Code skills 目录：

```bash
# macOS/Linux
cp -r evil-read-arxiv/start-my-day ~/.claude/skills/
cp -r evil-read-arxiv/paper-analyze ~/.claude/skills/
cp -r evil-read-arxiv/extract-paper-images ~/.claude/skills/
cp -r evil-read-arxiv/paper-search ~/.claude/skills/
cp -r evil-read-arxiv/conf-papers ~/.claude/skills/
cp -r evil-read-arxiv/scholar-search ~/.claude/skills/

# Windows PowerShell
Copy-Item -Recurse evil-read-arxiv\start-my-day $env:USERPROFILE\.claude\skills\
Copy-Item -Recurse evil-read-arxiv\paper-analyze $env:USERPROFILE\.claude\skills\
Copy-Item -Recurse evil-read-arxiv\extract-paper-images $env:USERPROFILE\.claude\skills\
Copy-Item -Recurse evil-read-arxiv\paper-search $env:USERPROFILE\.claude\skills\
Copy-Item -Recurse evil-read-arxiv\conf-papers $env:USERPROFILE\.claude\skills\
Copy-Item -Recurse evil-read-arxiv\scholar-search $env:USERPROFILE\.claude\skills\
```

### 2.5 配置 Chrome CDP Proxy（仅 `scholar-search` 需要）

`scholar-search` 技能通过真实 Chrome 浏览器访问 Google Scholar，绕过反爬虫限制。需要：

1. **Chrome 开启远程调试**：打开 `chrome://flags`，搜索 `remote-debugging`，启用后重启 Chrome
2. **安装 web-access skill**（提供 CDP Proxy）：确保 `~/.claude/skills/web-access/` 存在
3. **启动 CDP Proxy**：
   ```bash
   bash ~/.claude/skills/web-access/scripts/check-deps.sh
   # 如果默认 3456 端口被占用：
   CDP_PROXY_PORT=3457 node ~/.claude/skills/web-access/scripts/cdp-proxy.mjs &
   ```
4. **验证**：`curl -s http://localhost:3457/targets` 应返回 JSON 数组

> 如果不使用 `scholar-search`，可以跳过此步骤，其他 5 个技能不依赖 Chrome。

## 第三步：创建 Obsidian 目录结构

在你的 Obsidian Vault 中创建以下目录：

```
你的Vault/
├── 10_Daily/
├── 20_Research/
│   └── Papers/
├── 99_System/
│   └── Config/
│       └── research_interests.yaml  # 第二步中已复制
```

## 开始使用

### 1. 打开 Claude Code

在你的 Obsidian Vault 目录中打开终端：

```bash
# 切换到你的 Obsidian Vault 目录
cd "$OBSIDIAN_VAULT_PATH"

# 启动 Claude Code
claude-code
```

### 2. 开始每日论文推荐

在 Claude Code 中输入：

```
start my day
```

### 3. 分析单篇论文

在 Claude Code 中输入：

```
paper-analyze 2602.12345
```

### 4. 搜索 Google Scholar 论文

在 Claude Code 中输入（需 Chrome CDP Proxy 运行）：

```
scholar-search
# 或指定年份
scholar-search 2024 2025
```

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

## 故障排除

### 问题："未指定 vault 路径" 或 "Papers directory not found"

**解决**：
1. 确认环境变量已设置：
   ```bash
   # Windows PowerShell
   echo $env:OBSIDIAN_VAULT_PATH

   # macOS/Linux
   echo $OBSIDIAN_VAULT_PATH
   ```
2. 如果为空，回到第二步设置环境变量
3. 确认目录结构已正确创建

### 问题：论文图片提取失败

**解决**：
1. 确认安装了 PyMuPDF：`pip install PyMuPDF`
2. 检查 arXiv ID 格式是否正确（如 2602.12345）

### 问题：关键词自动链接不准确

**解决**：编辑 `start-my-day/scripts/link_keywords.py` 中的 `COMMON_WORDS` 集合，添加你不需要自动链接的词。

## 需要帮助？

- 查看 [README.md](README.md) 获取详细说明
- 提交 Issue 到 GitHub 仓库
