#!/usr/bin/env python3
"""
Google Scholar 论文搜索脚本
使用 Chrome CDP Proxy 访问 Google Scholar，绕过反爬虫限制
支持关键词搜索、年份过滤、分页抓取
评分：相关性(40%) + 热门度(40%) + 质量(20%)
"""

import json
import os
import re
import sys
import time
import logging
import argparse
from typing import List, Dict, Optional, Tuple
import urllib.request
import urllib.parse

logger = logging.getLogger(__name__)


def title_to_note_filename(title: str) -> str:
    """将论文标题转换为 Obsidian 笔记文件名（与 generate_note.py 保持一致）。"""
    filename = re.sub(r'[ /\\:*?"<>|]+', '_', title).strip('_')
    return filename


try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False
    logger.warning("requests library not found, using urllib")

try:
    import yaml
    HAS_YAML = True
except ImportError:
    HAS_YAML = False

# ---------------------------------------------------------------------------
# 复用 search_arxiv.py 的评分函数
# ---------------------------------------------------------------------------
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_START_MY_DAY_SCRIPTS = os.path.join(
    os.path.dirname(os.path.dirname(_SCRIPT_DIR)),
    'start-my-day', 'scripts'
)
if _START_MY_DAY_SCRIPTS not in sys.path:
    sys.path.insert(0, _START_MY_DAY_SCRIPTS)

from search_arxiv import (
    calculate_relevance_score,
    calculate_quality_score,
    SCORE_MAX,
    S2_RATE_LIMIT_WAIT,
)

# ---------------------------------------------------------------------------
# 评分权重（3 维，同 conf-papers，无新近性）
# ---------------------------------------------------------------------------
WEIGHTS_SCHOLAR = {
    'relevance': 0.40,
    'popularity': 0.40,
    'quality': 0.20,
}

POPULARITY_INFLUENTIAL_CITATION_FULL_SCORE = 100

# Semantic Scholar API
SEMANTIC_SCHOLAR_API_URL = "https://api.semanticscholar.org/graph/v1/paper/search"
SEMANTIC_SCHOLAR_FIELDS = (
    "title,abstract,publicationDate,citationCount,"
    "influentialCitationCount,url,authors,authors.affiliations,externalIds"
)

# CAPTCHA 等待时间（秒）
CAPTCHA_WAIT = 30
CAPTCHA_MAX_RETRIES = 2

# ---------------------------------------------------------------------------
# Google Scholar JS 提取代码
# ---------------------------------------------------------------------------

# 检测 CAPTCHA 的 JS
JS_DETECT_CAPTCHA = r"""
(function() {
    if (document.querySelector('#gs_captcha_ccl') ||
        document.querySelector('#recaptcha') ||
        document.querySelector('form[action*="sorry"]') ||
        document.title.indexOf('Sorry') !== -1 ||
        (document.body && document.body.textContent.indexOf('unusual traffic') !== -1)) {
        return 'CAPTCHA';
    }
    return 'OK';
})()
"""

# 提取搜索结果的 JS
JS_EXTRACT_RESULTS = r"""
(function() {
    var results = [];
    var items = document.querySelectorAll('.gs_r.gs_or.gs_scl');
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var ri = item.querySelector('.gs_ri') || item;

        // Title
        var titleEl = ri.querySelector('h3.gs_rt');
        var title = '';
        var url = '';
        if (titleEl) {
            var link = titleEl.querySelector('a');
            if (link) {
                title = link.textContent.trim();
                url = link.href;
            } else {
                title = titleEl.textContent
                    .replace(/^\[(PDF|HTML|CITATION|BOOK)\]\s*/i, '')
                    .trim();
            }
        }

        // Authors, venue, year (raw text)
        var authEl = ri.querySelector('.gs_a');
        var authorsRaw = authEl ? authEl.textContent.trim() : '';

        // Snippet / abstract
        var snipEl = ri.querySelector('.gs_rs');
        var snippet = snipEl ? snipEl.textContent.trim() : '';

        // Citation count
        var citedBy = 0;
        var flLinks = ri.querySelectorAll('.gs_fl a');
        for (var j = 0; j < flLinks.length; j++) {
            var text = flLinks[j].textContent;
            var m = text.match(/Cited by (\d+)/i) ||
                    text.match(/被引用次数[：:]*\s*(\d+)/);
            if (m) {
                citedBy = parseInt(m[1], 10);
                break;
            }
        }

        // PDF link
        var pdfUrl = '';
        var sideLinks = item.querySelectorAll('.gs_or_ggsm a, .gs_ggs a');
        for (var k = 0; k < sideLinks.length; k++) {
            var href = sideLinks[k].href || '';
            if (href.match(/\.pdf/i)) {
                pdfUrl = href;
                break;
            }
        }

        if (title) {
            results.push({
                title: title,
                url: url,
                authors_raw: authorsRaw,
                snippet: snippet,
                citationCount: citedBy,
                pdf_url: pdfUrl
            });
        }
    }
    return JSON.stringify(results);
})()
"""

# 获取结果总数的 JS
JS_GET_RESULT_COUNT = r"""
(function() {
    var stats = document.querySelector('#gs_ab_md .gs_ab_mdw');
    if (stats) return stats.textContent.trim();
    return '';
})()
"""


# ---------------------------------------------------------------------------
# 配置加载
# ---------------------------------------------------------------------------

def load_scholar_config(config_path: str) -> Dict:
    """加载 scholar-search.yaml 配置文件。"""
    if HAS_YAML:
        with open(config_path, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)
    else:
        # 简易 YAML 解析（仅支持顶层 key-value 和简单列表）
        config = {}
        current_key = None
        current_list = None
        with open(config_path, 'r', encoding='utf-8') as f:
            for line in f:
                stripped = line.strip()
                if not stripped or stripped.startswith('#'):
                    continue
                if stripped.startswith('- '):
                    if current_list is not None:
                        val = stripped[2:].strip().strip('"').strip("'")
                        current_list.append(val)
                    continue
                if ':' in stripped:
                    if current_list is not None and current_key:
                        config[current_key] = current_list
                    parts = stripped.split(':', 1)
                    key = parts[0].strip()
                    val = parts[1].strip()
                    if val == '':
                        current_key = key
                        current_list = []
                    else:
                        current_key = None
                        current_list = None
                        val = val.strip('"').strip("'")
                        # 自动类型转换
                        if val.lower() == 'true':
                            config[key] = True
                        elif val.lower() == 'false':
                            config[key] = False
                        else:
                            try:
                                config[key] = int(val)
                            except ValueError:
                                try:
                                    config[key] = float(val)
                                except ValueError:
                                    config[key] = val
            if current_list is not None and current_key:
                config[current_key] = current_list

    # 默认值
    config.setdefault('keywords', [])
    config.setdefault('excluded_keywords', [])
    config.setdefault('default_year_from', 2024)
    config.setdefault('default_year_to', 2025)
    config.setdefault('max_pages', 2)
    config.setdefault('top_n', 10)
    config.setdefault('request_delay', 5)
    config.setdefault('cdp_proxy_url', 'http://localhost:3456')
    config.setdefault('enrich_with_s2', True)

    return config


# ---------------------------------------------------------------------------
# CDP Proxy 交互
# ---------------------------------------------------------------------------

def _http_get(url: str, timeout: int = 30) -> str:
    """HTTP GET 请求（优先用 requests，fallback 到 urllib）。"""
    if HAS_REQUESTS:
        resp = requests.get(url, timeout=timeout)
        return resp.text
    else:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read().decode('utf-8')


def _http_post(url: str, data: str, timeout: int = 30) -> str:
    """HTTP POST 请求。"""
    if HAS_REQUESTS:
        resp = requests.post(url, data=data.encode('utf-8'), timeout=timeout)
        return resp.text
    else:
        req = urllib.request.Request(url, data=data.encode('utf-8'), method='POST')
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read().decode('utf-8')


def cdp_health_check(proxy_url: str) -> bool:
    """检查 CDP Proxy 是否可用。"""
    try:
        result = _http_get(f"{proxy_url}/targets", timeout=5)
        # /targets 返回 JSON 数组表示可用
        if result.strip().startswith('['):
            logger.info("[CDP] Health check OK (targets endpoint)")
            return True
        # 也尝试 /health
        result = _http_get(f"{proxy_url}/health", timeout=5)
        logger.info("[CDP] Health check OK: %s", result.strip()[:100])
        return True
    except Exception as e:
        logger.error("[CDP] Health check failed: %s", e)
        return False


def cdp_open_tab(url: str, proxy_url: str) -> Optional[str]:
    """
    在 Chrome 中打开新标签页。

    Returns:
        target_id 或 None
    """
    try:
        encoded_url = urllib.parse.quote(url, safe=':/?&=+%#')
        result = _http_get(f"{proxy_url}/new?url={encoded_url}", timeout=30)
        data = json.loads(result)
        target_id = data.get('targetId') or data.get('id')
        logger.info("[CDP] Opened tab: %s (target: %s)", url[:80], target_id)
        return target_id
    except Exception as e:
        logger.error("[CDP] Failed to open tab: %s", e)
        return None


def cdp_eval(target_id: str, js_code: str, proxy_url: str) -> Optional[str]:
    """
    在指定标签页中执行 JavaScript。

    CDP Proxy 返回 {"value": ...} 格式，本函数提取 value 字段返回。

    Returns:
        JS 返回值（已从 {"value": ...} 中解包），或 None
    """
    try:
        raw = _http_post(
            f"{proxy_url}/eval?target={target_id}",
            data=js_code,
            timeout=30
        )
        # CDP Proxy 返回 {"value": "..."} 格式
        try:
            wrapper = json.loads(raw)
            if isinstance(wrapper, dict) and 'value' in wrapper:
                return wrapper['value']
        except (json.JSONDecodeError, TypeError):
            pass
        return raw
    except Exception as e:
        logger.error("[CDP] Eval failed: %s", e)
        return None


def cdp_close_tab(target_id: str, proxy_url: str):
    """关闭标签页。"""
    try:
        _http_get(f"{proxy_url}/close?target={target_id}", timeout=10)
        logger.debug("[CDP] Closed tab: %s", target_id)
    except Exception as e:
        logger.warning("[CDP] Failed to close tab: %s", e)


def cdp_screenshot(target_id: str, filepath: str, proxy_url: str):
    """截图保存到文件。"""
    try:
        _http_get(
            f"{proxy_url}/screenshot?target={target_id}&file={filepath}",
            timeout=15
        )
        logger.info("[CDP] Screenshot saved: %s", filepath)
    except Exception as e:
        logger.warning("[CDP] Screenshot failed: %s", e)


def cdp_wait_for_load(target_id: str, proxy_url: str, max_wait: int = 10):
    """等待页面加载完成。"""
    for _ in range(max_wait):
        try:
            result = _http_get(
                f"{proxy_url}/info?target={target_id}", timeout=5
            )
            data = json.loads(result)
            if data.get('readyState') == 'complete':
                return True
        except Exception:
            pass
        time.sleep(1)
    return False


# ---------------------------------------------------------------------------
# Google Scholar 搜索
# ---------------------------------------------------------------------------

def build_scholar_url(
    query: str,
    year_from: Optional[int] = None,
    year_to: Optional[int] = None,
    start: int = 0
) -> str:
    """构建 Google Scholar 搜索 URL。"""
    params = {
        'q': query,
        'hl': 'en',
        'as_sdt': '0',
        'start': str(start),
    }
    if year_from:
        params['as_ylo'] = str(year_from)
    if year_to:
        params['as_yhi'] = str(year_to)

    return f"https://scholar.google.com/scholar?{urllib.parse.urlencode(params)}"


def build_search_queries(keywords: List[str], max_keywords_per_query: int = 6) -> List[str]:
    """
    将关键词列表组合成 Google Scholar 查询。

    多词关键词会加引号，每个查询最多 max_keywords_per_query 个关键词用 OR 连接。
    """
    queries = []
    for i in range(0, len(keywords), max_keywords_per_query):
        chunk = keywords[i:i + max_keywords_per_query]
        parts = []
        for kw in chunk:
            if ' ' in kw:
                parts.append(f'"{kw}"')
            else:
                parts.append(kw)
        queries.append(' OR '.join(parts))
    return queries


def parse_authors_raw(raw: str) -> Tuple[List[str], str, str]:
    """
    解析 Google Scholar 的作者/出处原始文本。

    输入格式: "A Name, B Name - Journal Name, 2024 - publisher.com"
    Google Scholar 可能使用不同 dash 类型（-, –, —）和空白字符。
    返回: (authors_list, venue, year)
    """
    # 用 regex 分割，兼容各种 dash 和空白
    parts = re.split(r'\s*[\-–—]+\s*', raw)
    authors = []
    venue = ''
    year = ''

    if len(parts) >= 1:
        author_str = parts[0].strip()
        authors = [
            a.strip() for a in author_str.split(',')
            if a.strip() and a.strip() not in ('…', '...')
        ]

    if len(parts) >= 2:
        venue_year = parts[1].strip()
        year_match = re.search(r'\b(19|20)\d{2}\b', venue_year)
        if year_match:
            year = year_match.group(0)
            venue = venue_year[:year_match.start()].rstrip(', ').strip()
        else:
            venue = venue_year

    return authors, venue, year


def detect_captcha(target_id: str, proxy_url: str) -> bool:
    """检测页面是否展示了 CAPTCHA。"""
    result = cdp_eval(target_id, JS_DETECT_CAPTCHA, proxy_url)
    if result and 'CAPTCHA' in result:
        return True
    return False


def handle_captcha(target_id: str, proxy_url: str) -> bool:
    """
    处理 CAPTCHA：截图通知用户，等待用户在 Chrome 中手动解决。

    Returns:
        True 如果 CAPTCHA 已解决，False 如果超时
    """
    screenshot_path = '/tmp/scholar_captcha.png'
    cdp_screenshot(target_id, screenshot_path, proxy_url)
    logger.warning(
        "[CAPTCHA] Google Scholar 触发了验证码！"
        "请在 Chrome 浏览器中手动完成验证。截图: %s",
        screenshot_path
    )

    for attempt in range(CAPTCHA_MAX_RETRIES):
        logger.info(
            "[CAPTCHA] 等待 %d 秒后重新检测... (第 %d/%d 次)",
            CAPTCHA_WAIT, attempt + 1, CAPTCHA_MAX_RETRIES
        )
        time.sleep(CAPTCHA_WAIT)

        if not detect_captcha(target_id, proxy_url):
            logger.info("[CAPTCHA] 验证码已解决，继续执行")
            return True

    logger.error("[CAPTCHA] 验证码未在规定时间内解决，跳过当前查询")
    return False


def extract_results_from_page(
    target_id: str, proxy_url: str
) -> List[Dict]:
    """从当前页面提取 Google Scholar 搜索结果。"""
    result = cdp_eval(target_id, JS_EXTRACT_RESULTS, proxy_url)
    if not result:
        return []

    # CDP eval 返回值可能被双重 JSON 编码
    try:
        # 尝试直接解析
        parsed = json.loads(result)
        if isinstance(parsed, str):
            parsed = json.loads(parsed)
        if isinstance(parsed, list):
            return parsed
    except (json.JSONDecodeError, TypeError):
        pass

    # 尝试从返回文本中提取 JSON 数组
    match = re.search(r'\[.*\]', result, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    logger.warning("[Extract] Failed to parse results from page")
    return []


def search_google_scholar(
    keywords: List[str],
    year_from: int,
    year_to: int,
    max_pages: int,
    proxy_url: str,
    delay: int
) -> List[Dict]:
    """
    使用 CDP Proxy 搜索 Google Scholar。

    Args:
        keywords: 搜索关键词列表
        year_from: 起始年份
        year_to: 截止年份
        max_pages: 每个查询抓取的最大页数
        proxy_url: CDP Proxy 地址
        delay: 请求间隔（秒）

    Returns:
        去重后的论文列表
    """
    queries = build_search_queries(keywords)
    all_papers = []
    seen_titles = set()

    logger.info("=" * 70)
    logger.info("Google Scholar Search: %d queries, year %d-%d, max %d pages/query",
                len(queries), year_from, year_to, max_pages)
    logger.info("=" * 70)

    for qi, query in enumerate(queries):
        logger.info("[Query %d/%d] %s", qi + 1, len(queries), query[:80])

        for page in range(max_pages):
            start = page * 10
            url = build_scholar_url(query, year_from, year_to, start)
            logger.info("  Page %d (start=%d): %s", page + 1, start, url[:100])

            target_id = cdp_open_tab(url, proxy_url)
            if not target_id:
                logger.error("  Failed to open tab, skipping")
                continue

            # 等待页面加载
            time.sleep(3)
            cdp_wait_for_load(target_id, proxy_url, max_wait=10)

            # CAPTCHA 检测
            if detect_captcha(target_id, proxy_url):
                solved = handle_captcha(target_id, proxy_url)
                if not solved:
                    cdp_close_tab(target_id, proxy_url)
                    logger.warning("  Skipping query due to CAPTCHA")
                    break  # 跳过此查询的后续页面

            # 提取结果
            raw_results = extract_results_from_page(target_id, proxy_url)
            logger.info("  Extracted %d results from page", len(raw_results))

            # 获取结果统计
            if page == 0:
                stats = cdp_eval(target_id, JS_GET_RESULT_COUNT, proxy_url)
                if stats:
                    logger.info("  Results stats: %s", stats.strip()[:100])

            cdp_close_tab(target_id, proxy_url)

            if not raw_results:
                logger.info("  No results on this page, stopping pagination")
                break

            # 解析并去重
            for raw in raw_results:
                title = raw.get('title', '').strip()
                if not title:
                    continue

                title_normalized = re.sub(
                    r'[^a-z0-9\s]', '', title.lower()
                ).strip()
                if title_normalized in seen_titles:
                    continue
                seen_titles.add(title_normalized)

                authors, venue, year = parse_authors_raw(
                    raw.get('authors_raw', '')
                )

                paper = {
                    'title': title,
                    'authors': authors,
                    'venue': venue,
                    'year': year,
                    'abstract': raw.get('snippet', ''),
                    'summary': raw.get('snippet', ''),
                    'citationCount': raw.get('citationCount', 0),
                    'influentialCitationCount': 0,
                    'url': raw.get('url', ''),
                    'pdf_url': raw.get('pdf_url', ''),
                    'source': 'google_scholar',
                    'categories': [],
                    'arxiv_id': '',
                    'note_filename': title_to_note_filename(title),
                }
                all_papers.append(paper)

            # 请求间隔
            if page < max_pages - 1:
                logger.info("  Waiting %d seconds before next page...", delay)
                time.sleep(delay)

        # 查询间隔
        if qi < len(queries) - 1:
            logger.info("  Waiting %d seconds before next query...", delay)
            time.sleep(delay)

    logger.info("Total unique papers from Google Scholar: %d", len(all_papers))
    return all_papers


# ---------------------------------------------------------------------------
# Semantic Scholar 补充
# ---------------------------------------------------------------------------

def title_similarity(a: str, b: str) -> float:
    """基于 Jaccard 相似度比较两个标题。"""
    words_a = set(re.sub(r'[^a-z0-9\s]', '', a.lower()).split())
    words_b = set(re.sub(r'[^a-z0-9\s]', '', b.lower()).split())
    if not words_a or not words_b:
        return 0.0
    intersection = words_a & words_b
    union = words_a | words_b
    return len(intersection) / len(union)


def enrich_with_semantic_scholar(
    papers: List[Dict],
    max_retries: int = 3
) -> List[Dict]:
    """
    用 Semantic Scholar 补充论文信息：完整摘要、影响力引用数、arXiv ID。

    Args:
        papers: 论文列表
        max_retries: 单篇论文的最大重试次数

    Returns:
        补充后的论文列表
    """
    logger.info("=" * 70)
    logger.info("Enriching %d papers with Semantic Scholar", len(papers))
    logger.info("=" * 70)

    enriched_count = 0

    for i, paper in enumerate(papers):
        title = paper.get('title', '')
        if not title:
            continue

        logger.info(
            "  [%d/%d] Searching S2 for: %s",
            i + 1, len(papers), title[:60]
        )

        s2_paper = _search_s2_by_title(title, max_retries)

        if s2_paper and title_similarity(title, s2_paper.get('title', '')) >= 0.6:
            # 匹配成功
            if s2_paper.get('abstract'):
                paper['abstract'] = s2_paper['abstract']
                paper['summary'] = s2_paper['abstract']

            paper['citationCount'] = (
                s2_paper.get('citationCount') or paper.get('citationCount', 0)
            )
            paper['influentialCitationCount'] = (
                s2_paper.get('influentialCitationCount') or 0
            )

            # arXiv ID
            ext_ids = s2_paper.get('externalIds') or {}
            if ext_ids.get('ArXiv'):
                paper['arxiv_id'] = ext_ids['ArXiv']
                paper['pdf_url'] = (
                    paper.get('pdf_url')
                    or f"https://arxiv.org/pdf/{ext_ids['ArXiv']}"
                )

            if s2_paper.get('url'):
                paper['s2_url'] = s2_paper['url']

            # 机构信息
            affiliations = []
            for author in (s2_paper.get('authors') or []):
                for aff in (author.get('affiliations') or []):
                    if aff and aff not in affiliations:
                        affiliations.append(aff)
            if affiliations:
                paper['affiliations'] = affiliations

            paper['s2_matched'] = True
            enriched_count += 1
            logger.info("    -> Matched (citations: %d, inf: %d)",
                        paper['citationCount'],
                        paper['influentialCitationCount'])
        else:
            paper['s2_matched'] = False
            logger.info("    -> No match")

        # 速率限制
        time.sleep(1)

    logger.info("S2 enrichment complete: %d/%d matched", enriched_count, len(papers))
    return papers


def _search_s2_by_title(title: str, max_retries: int = 3) -> Optional[Dict]:
    """通过标题搜索 Semantic Scholar，返回最佳匹配。"""
    query = re.sub(r'[^\w\s]', ' ', title).strip()
    params = {
        'query': query,
        'limit': '3',
        'fields': SEMANTIC_SCHOLAR_FIELDS,
    }
    url = f"{SEMANTIC_SCHOLAR_API_URL}?{urllib.parse.urlencode(params)}"

    for attempt in range(max_retries):
        try:
            if HAS_REQUESTS:
                resp = requests.get(url, timeout=30)
                if resp.status_code == 429:
                    logger.warning(
                        "    S2 rate limited, waiting %d seconds...",
                        S2_RATE_LIMIT_WAIT
                    )
                    time.sleep(S2_RATE_LIMIT_WAIT)
                    continue
                if resp.status_code != 200:
                    logger.warning("    S2 returned %d", resp.status_code)
                    continue
                data = resp.json()
            else:
                req = urllib.request.Request(url)
                with urllib.request.urlopen(req, timeout=30) as resp:
                    if resp.status == 429:
                        time.sleep(S2_RATE_LIMIT_WAIT)
                        continue
                    data = json.loads(resp.read().decode('utf-8'))

            results = data.get('data', [])
            if results:
                return results[0]
            return None

        except Exception as e:
            logger.warning("    S2 request error (attempt %d): %s", attempt + 1, e)
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt * 2)

    return None


# ---------------------------------------------------------------------------
# 评分
# ---------------------------------------------------------------------------

def calculate_popularity_score(paper: Dict) -> float:
    """
    基于引用数计算热门度评分。

    优先使用 influentialCitationCount（来自 S2），
    fallback 到 Google Scholar 的 citationCount。
    """
    inf_cit = paper.get('influentialCitationCount', 0) or 0
    cit = paper.get('citationCount', 0) or 0

    if inf_cit > 0:
        score = min(
            inf_cit / (POPULARITY_INFLUENTIAL_CITATION_FULL_SCORE / SCORE_MAX),
            SCORE_MAX
        )
    elif cit > 0:
        # Google Scholar 引用数通常较高，调整归一化
        score = min(cit / 200 * SCORE_MAX, SCORE_MAX * 0.7)
    else:
        score = 0.0

    return score


def filter_and_score_papers(
    papers: List[Dict],
    config: Dict,
    top_n: int = 10
) -> List[Dict]:
    """
    对论文进行三维评分（相关性 + 热门度 + 质量），排序取 top N。
    使用 scholar-search.yaml 的关键词构建虚拟 domain 用于评分。
    """
    domains = {
        "scholar_search": {
            "keywords": config.get('keywords', []),
            "arxiv_categories": [],
        }
    }
    excluded_keywords = config.get('excluded_keywords', [])

    scored_papers = []

    for paper in papers:
        # 兼容 calculate_relevance_score
        if paper.get('abstract') and not paper.get('summary'):
            paper['summary'] = paper['abstract']

        relevance, matched_domain, matched_keywords = calculate_relevance_score(
            paper, domains, excluded_keywords
        )

        if relevance == 0:
            continue

        popularity = calculate_popularity_score(paper)

        summary = paper.get('summary', '') or paper.get('abstract', '') or ''
        quality = calculate_quality_score(summary)

        normalized = {
            'relevance': (relevance / SCORE_MAX) * 10,
            'popularity': (popularity / SCORE_MAX) * 10,
            'quality': (quality / SCORE_MAX) * 10,
        }
        final_score = sum(normalized[k] * WEIGHTS_SCHOLAR[k] for k in WEIGHTS_SCHOLAR)
        final_score = round(final_score, 2)

        paper['scores'] = {
            'relevance': round(relevance, 2),
            'popularity': round(popularity, 2),
            'quality': round(quality, 2),
            'recommendation': final_score,
        }
        paper['matched_domain'] = matched_domain
        paper['matched_keywords'] = matched_keywords

        scored_papers.append(paper)

    scored_papers.sort(
        key=lambda x: x['scores']['recommendation'], reverse=True
    )

    logger.info("[Score] %d papers scored, returning top %d",
                len(scored_papers), top_n)
    return scored_papers[:top_n]


# ---------------------------------------------------------------------------
# 主函数
# ---------------------------------------------------------------------------

def main():
    default_config = os.path.join(
        os.path.dirname(_SCRIPT_DIR), 'scholar-search.yaml'
    )

    parser = argparse.ArgumentParser(
        description='Search Google Scholar via Chrome CDP Proxy'
    )
    parser.add_argument(
        '--config', type=str, default=default_config,
        help='Path to scholar-search.yaml config file'
    )
    parser.add_argument(
        '--output', type=str, default='scholar_results.json',
        help='Output JSON file path'
    )
    parser.add_argument(
        '--year-from', type=int, default=None,
        help='Start year (default: from config)'
    )
    parser.add_argument(
        '--year-to', type=int, default=None,
        help='End year (default: from config)'
    )
    parser.add_argument(
        '--top-n', type=int, default=None,
        help='Number of top papers to return (default: from config)'
    )
    parser.add_argument(
        '--max-pages', type=int, default=None,
        help='Max pages per query (default: from config)'
    )
    parser.add_argument(
        '--skip-enrichment', action='store_true',
        help='Skip Semantic Scholar enrichment'
    )
    parser.add_argument(
        '--cdp-url', type=str, default=None,
        help='CDP Proxy URL (default: from config)'
    )

    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s [%(levelname)s] %(message)s',
        datefmt='%H:%M:%S',
        stream=sys.stderr,
    )

    # 加载配置
    if not os.path.exists(args.config):
        logger.error("配置文件不存在: %s", args.config)
        return 1

    logger.info("Loading config from: %s", args.config)
    config = load_scholar_config(args.config)
    logger.info(
        "Config: %d keywords, %d excluded, year %d-%d",
        len(config['keywords']),
        len(config['excluded_keywords']),
        config['default_year_from'],
        config['default_year_to'],
    )

    # 合并命令行参数
    year_from = args.year_from or config['default_year_from']
    year_to = args.year_to or config['default_year_to']
    top_n = args.top_n or config['top_n']
    max_pages = args.max_pages or config['max_pages']
    proxy_url = args.cdp_url or config['cdp_proxy_url']
    delay = config['request_delay']

    # 检查 CDP Proxy
    logger.info("Checking CDP Proxy at %s ...", proxy_url)
    if not cdp_health_check(proxy_url):
        logger.error(
            "CDP Proxy 不可用！请确保：\n"
            "  1. Chrome 浏览器已打开\n"
            "  2. 已启用远程调试（chrome://flags → remote-debugging）\n"
            "  3. CDP Proxy 已启动（运行 web-access skill 的 check-deps.sh）"
        )
        return 1

    # ========== 第一步：Google Scholar 搜索 ==========
    all_papers = search_google_scholar(
        keywords=config['keywords'],
        year_from=year_from,
        year_to=year_to,
        max_pages=max_pages,
        proxy_url=proxy_url,
        delay=delay,
    )

    if not all_papers:
        logger.warning("No papers found from Google Scholar!")
        output = {
            "year_from": year_from,
            "year_to": year_to,
            "total_found": 0,
            "total_enriched": 0,
            "top_papers": [],
        }
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
        print(json.dumps(output, ensure_ascii=False, indent=2))
        return 0

    total_found = len(all_papers)

    # ========== 第二步：Semantic Scholar 补充 ==========
    total_enriched = 0
    if not args.skip_enrichment and config.get('enrich_with_s2', True):
        all_papers = enrich_with_semantic_scholar(all_papers)
        total_enriched = sum(1 for p in all_papers if p.get('s2_matched'))
    else:
        logger.info("Skipping Semantic Scholar enrichment")

    # ========== 第三步：评分排序 ==========
    logger.info("=" * 70)
    logger.info("Scoring and ranking")
    logger.info("=" * 70)

    top_papers = filter_and_score_papers(all_papers, config, top_n=top_n)

    # 清理内部字段
    for p in top_papers:
        p.pop('s2_matched', None)
        p.pop('s2_title_similarity', None)
        # 保留 abstract，去掉重复的 summary
        p.pop('summary', None)

    # 准备输出
    output = {
        "year_from": year_from,
        "year_to": year_to,
        "keywords_used": config['keywords'],
        "total_found": total_found,
        "total_enriched": total_enriched,
        "top_papers": top_papers,
    }

    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2, default=str)

    logger.info("Results saved to: %s", args.output)
    logger.info("Top %d papers:", len(top_papers))
    for i, p in enumerate(top_papers, 1):
        cit = p.get('citationCount', 0)
        logger.info(
            "  %d. %s... (Score: %s, Citations: %d)",
            i, p.get('title', 'N/A')[:60],
            p['scores']['recommendation'], cit
        )

    print(json.dumps(output, ensure_ascii=False, indent=2, default=str))
    return 0


if __name__ == '__main__':
    sys.exit(main())
