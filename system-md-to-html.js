#!/usr/bin/env node
/**
 * system-md-to-html.js — Convert system architecture Markdown docs to single-file HTML.
 *
 * Usage:
 *   node system-md-to-html.js doc/Scheduler_Architecture_Design.md
 *   node system-md-to-html.js --all          # convert all *_Design.md, *_Design_Document.md in doc/
 *   node system-md-to-html.js --index "HDSA" "description"
 *   node system-md-to-html.js --dry-run --all
 *
 * Supports Mermaid code blocks (rendered client-side via mermaid.js CDN),
 * code syntax highlighting (highlight.js CDN), collapsible module panels,
 * and auto-generated TOC sidebar.
 */

const fs = require('fs');
const path = require('path');

const DOC_DIR = path.resolve(__dirname, '..', '..', '..', 'doc');
const TEMPLATE_PATH = path.resolve(__dirname, 'template-system.html');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const convertAll = args.includes('--all');
const shouldGenerateIndex = args.includes('--index');
const files = args.filter(a => !a.startsWith('--'));

if (!convertAll && !shouldGenerateIndex && files.length === 0) {
  console.log('Usage: node system-md-to-html.js [--all] [--index] [--dry-run] [file.md ...]');
  console.log('  --all      Convert all system-level *_Design*.md in doc/');
  console.log('  --index    Generate index.html navigation page');
  console.log('  --dry-run  Preview without writing');
  process.exit(0);
}

// --- System doc patterns ---
const SYSTEM_DOC_PATTERNS = [
  /Architecture_Design\.md$/,
  /Detailed_Design.*\.md$/,
  /Requirements.*\.md$/,
];

function isSystemDoc(filename) {
  return SYSTEM_DOC_PATTERNS.some(p => p.test(filename));
}

function readTemplate() {
  const raw = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
  const styleMatch = raw.match(/<style>([\s\S]*?)<\/style>/);
  const scriptMatches = raw.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
  const lastScript = scriptMatches[scriptMatches.length - 1] || '';
  const jsMatch = lastScript.match(/<script[^>]*>([\s\S]*?)<\/script>/);
  return {
    css: styleMatch ? styleMatch[1] : '',
    js: jsMatch ? jsMatch[1] : ''
  };
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Fix common Mermaid syntax issues in code blocks before embedding into HTML.
 * - Decode HTML entities that would break Mermaid parser
 * - Fix dotted arrows: -.> → -.->  (but not -.-> which is already correct)
 * - Replace curly braces {} in node labels with 【】 to avoid conflict with diamond syntax
 * - Replace -> in sequence diagram message text with . to avoid arrow confusion
 */
function fixMermaidContent(content) {
  // 1. Decode HTML entities
  content = content.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
  // 2. Fix dotted arrows: -.> not followed by - → -.->
  content = content.replace(/-\.\>(?!-)/g, '-.->');
  // 3. Replace {} in quoted node labels (but not diamond nodes which use {"..."})
  content = content.replace(/\["([^"]*\{[^}]*)"\]/g, function(_, inner) {
    return '["' + inner.replace(/\{/g, '【').replace(/\}/g, '】') + '"]';
  });
  return content;
}

function parseMdMeta(lines) {
  const meta = {};
  for (const line of lines) {
    if (/^\|[-\s|]+\|$/.test(line)) continue;
    const m = line.match(/^\|\s*(.+?)\s*\|\s*(.+?)\s*\|$/);
    if (m) {
      const key = m[1].trim();
      const val = m[2].trim();
      if (key === '文档版本') meta.version = val;
      else if (key === '编写日期') meta.writeDate = val;
      else if (key === '更新日期') meta.updateDate = val;
      else if (key === '目标读者') meta.audience = val;
      else if (key === '文档类型') meta.docType = val;
      else if (key === '源码位置') meta.srcPath = val;
      else if (key === '生成方式') meta.generatedBy = val;
      else if (key === '关联产物') meta.artifacts = val;
    }
  }
  return meta;
}

function parseMarkdownSections(content) {
  const lines = content.split('\n');
  const sections = [];
  let currentH2 = null;
  let currentBody = [];
  let metaLines = [];
  let inMeta = false;
  let title = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^# /.test(line) && !title) {
      title = line.replace(/^# /, '').trim();
      continue;
    }

    if (/^## 文档信息/.test(line)) { inMeta = true; continue; }
    if (inMeta) {
      if (/^---/.test(line) || /^## /.test(line)) {
        inMeta = false;
        if (/^## /.test(line)) i--;
      } else {
        metaLines.push(line);
      }
      continue;
    }

    if (/^## 目录/.test(line)) {
      while (i + 1 < lines.length && !(/^## /.test(lines[i + 1]) && !/^## 目录/.test(lines[i + 1]))) {
        i++;
        if (lines[i + 1] && /^---$/.test(lines[i + 1])) { i++; break; }
      }
      continue;
    }

    if (/^---$/.test(line)) continue;

    if (/^## /.test(line)) {
      if (currentH2) {
        sections.push({ heading: currentH2, body: currentBody.join('\n') });
      }
      currentH2 = line.replace(/^## /, '').trim();
      currentBody = [];
      continue;
    }

    currentBody.push(line);
  }
  if (currentH2) {
    sections.push({ heading: currentH2, body: currentBody.join('\n') });
  }

  const meta = parseMdMeta(metaLines);
  return { title, meta, sections };
}

function inlineMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function mdBodyToHtml(body) {
  const lines = body.split('\n');
  const out = [];
  let inCode = false;
  let codeLang = '';
  let codeLines = [];
  let inTable = false;
  let tableRows = [];
  let inList = false;
  let listItems = [];
  let inOl = false;
  let olItems = [];

  function flushList() {
    if (listItems.length) {
      out.push('<ul>');
      listItems.forEach(li => out.push(`  <li>${inlineMarkdown(li)}</li>`));
      out.push('</ul>');
      listItems = [];
      inList = false;
    }
  }

  function flushOl() {
    if (olItems.length) {
      out.push('<ol>');
      olItems.forEach(li => out.push(`  <li>${inlineMarkdown(li)}</li>`));
      out.push('</ol>');
      olItems = [];
      inOl = false;
    }
  }

  function flushTable() {
    if (tableRows.length < 2) { tableRows = []; inTable = false; return; }
    out.push('<div class="table-wrapper"><table>');
    const headers = tableRows[0];
    out.push('<thead><tr>' + headers.map(h => `<th>${inlineMarkdown(h)}</th>`).join('') + '</tr></thead>');
    out.push('<tbody>');
    for (let r = 2; r < tableRows.length; r++) {
      out.push('<tr>' + tableRows[r].map(c => `<td>${inlineMarkdown(c)}</td>`).join('') + '</tr>');
    }
    out.push('</tbody></table></div>');
    tableRows = [];
    inTable = false;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks (including Mermaid)
    if (/^```/.test(line)) {
      if (!inCode) {
        flushList(); flushOl(); flushTable();
        inCode = true;
        codeLang = line.replace(/^```/, '').trim();
        codeLines = [];
      } else {
        const content = codeLines.join('\n');
        if (codeLang === 'mermaid') {
          out.push(`<div class="mermaid-wrap"><div class="mermaid">\n${fixMermaidContent(content)}\n</div></div>`);
        } else {
          const lang = codeLang || '';
          out.push(`<figure class="code-block" data-lang="${lang}"><pre><code>${escapeHtml(content)}</code></pre></figure>`);
        }
        inCode = false;
        codeLang = '';
      }
      continue;
    }

    if (inCode) { codeLines.push(line); continue; }

    // Tables
    if (/^\|/.test(line)) {
      flushList(); flushOl();
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      if (!inTable) inTable = true;
      tableRows.push(cells);
      continue;
    } else if (inTable) {
      flushTable();
    }

    // Unordered lists
    if (/^[-*] /.test(line)) {
      flushOl(); flushTable();
      inList = true;
      listItems.push(line.replace(/^[-*] /, ''));
      continue;
    } else if (inList) {
      flushList();
    }

    // Ordered lists
    if (/^\d+\. /.test(line)) {
      flushList(); flushTable();
      inOl = true;
      olItems.push(line.replace(/^\d+\. /, ''));
      continue;
    } else if (inOl) {
      flushOl();
    }

    // Headings
    if (/^### /.test(line)) {
      flushList(); flushOl(); flushTable();
      const heading = line.replace(/^### /, '').trim();
      out.push(`<h3>${inlineMarkdown(heading)}</h3>`);
      continue;
    }
    if (/^#### /.test(line)) {
      flushList(); flushOl(); flushTable();
      const heading = line.replace(/^#### /, '').trim();
      out.push(`<h4>${inlineMarkdown(heading)}</h4>`);
      continue;
    }

    if (line.trim() === '') { continue; }

    flushList(); flushOl(); flushTable();
    out.push(`<p>${inlineMarkdown(line)}</p>`);
  }

  flushList(); flushOl(); flushTable();
  return out.join('\n');
}

function sectionId(heading) {
  // Try numeric prefix
  const num = heading.match(/^(\d+)\./);
  if (num) {
    const map = {
      '1': 'sec-overview', '2': 'sec-arch', '3': 'sec-diagram',
      '4': 'sec-modules', '5': 'sec-dataflow', '6': 'sec-thread',
      '7': 'sec-config', '8': 'sec-fault', '9': 'sec-perf',
      '10': 'sec-extension',
    };
    if (map[num[1]]) return map[num[1]];
  }
  // Try Chinese part numbers
  const partMatch = heading.match(/第(.+?)部分/);
  if (partMatch) {
    return 'sec-part-' + partMatch[1];
  }
  if (/附录/.test(heading)) return 'sec-appendix';
  return 'sec-' + heading.replace(/[^\w]/g, '').toLowerCase().slice(0, 20);
}

function shouldBeOpen(heading) {
  // Open by default: overview, arch, diagram, modules
  if (/^(1|2|3|4)\./.test(heading)) return true;
  if (/概述|架构|系统架构图|核心模块/.test(heading)) return true;
  // Closed by default: appendix, risks, evidence
  if (/附录|风险|未知|证据/.test(heading)) return false;
  return false;
}

function buildMetaRows(meta) {
  const rows = [];
  if (meta.docType) rows.push(`<dt>文档类型</dt><dd>${meta.docType}</dd>`);
  if (meta.srcPath) rows.push(`<dt>源码位置</dt><dd><code>${meta.srcPath}</code></dd>`);
  if (meta.generatedBy) rows.push(`<dt>生成方式</dt><dd>${meta.generatedBy}</dd>`);
  if (meta.artifacts) rows.push(`<dt>关联产物</dt><dd>${inlineMarkdown(meta.artifacts)}</dd>`);
  if (meta.writeDate) rows.push(`<dt>编写日期</dt><dd>${meta.writeDate}</dd>`);
  if (meta.updateDate) rows.push(`<dt>更新日期</dt><dd>${meta.updateDate}</dd>`);
  return rows.join('\n          ');
}

function buildHtml(parsed, template) {
  const { title, meta, sections } = parsed;

  const sectionsHtml = sections.map(s => {
    const id = sectionId(s.heading);
    const open = shouldBeOpen(s.heading) ? ' open' : '';
    const bodyHtml = mdBodyToHtml(s.body);
    return `
      <details${open} id="${id}">
        <summary><h2>${s.heading}</h2></summary>
        <div class="section-body">
${bodyHtml}
        </div>
      </details>`;
  }).join('\n');

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="generator" content="deepwiki-html system">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css" media="(prefers-color-scheme: light), (prefers-color-scheme: no-preference)">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css" media="(prefers-color-scheme: dark)">
  <style>${template.css}</style>
</head>
<body data-doctype="system-design">

  <nav class="topbar">
    <span class="topbar-brand">HDSA-MACO</span>
    <span class="topbar-sep">/</span>
    <span class="topbar-title">${escapeHtml(title)}</span>
    <div class="topbar-actions">
      <button class="topbar-btn menu-toggle" onclick="toggleSidebar()" title="目录">&#9776;</button>
      <button class="topbar-btn" onclick="toggleTheme()" title="切换主题">&#9680;</button>
      <button class="topbar-btn" onclick="window.print()" title="打印">&#9113;</button>
    </div>
  </nav>

  <div class="layout">
    <aside class="sidebar" id="sidebar">
      <nav><ul class="toc-list" id="toc"></ul></nav>
    </aside>

    <article class="main" id="content">
      <header class="doc-meta">
        <span class="doc-version">${meta.version || 'V1.0'}</span>
        <h1>${escapeHtml(title)}</h1>
        <dl class="meta-grid">
          ${buildMetaRows(meta)}
        </dl>
      </header>

${sectionsHtml}

    </article>
  </div>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.9.0/mermaid.min.js"></script>
  <script>${template.js}</script>
</body>
</html>`;
}

// --- Index Generation ---
const INDEX_TEMPLATE_PATH = path.resolve(__dirname, 'template-index.html');

const DOC_CATEGORIES = {
  'Architecture': { label: '架构设计', desc: '系统整体架构、分层设计、组件关系' },
  'Detailed':     { label: '详细设计', desc: '核心概念、配置指南、API 使用、调试技巧' },
  'Requirements': { label: '需求文档', desc: '功能需求、非功能需求、验收标准' },
};

function categorizeDoc(filename) {
  if (/Architecture/.test(filename)) return 'Architecture';
  if (/Detailed/.test(filename)) return 'Detailed';
  if (/Requirements/.test(filename)) return 'Requirements';
  return 'Architecture';
}

function generateIndex(projectName, projectDesc) {
  if (!fs.existsSync(INDEX_TEMPLATE_PATH)) {
    console.log('  ERROR template-index.html not found');
    process.exit(1);
  }

  const tpl = fs.readFileSync(INDEX_TEMPLATE_PATH, 'utf-8');

  // Scan for existing HTML files
  const htmlFiles = fs.readdirSync(DOC_DIR)
    .filter(f => f.endsWith('.html') && isSystemDoc(f.replace('.html', '.md')))
    .map(f => {
      const name = f.replace('.html', '');
      const cat = categorizeDoc(f);
      return { name, file: f, ...DOC_CATEGORIES[cat] };
    });

  // Build filter buttons
  const groups = [...new Set(htmlFiles.map(f => f.label))];
  const filterButtons = groups
    .map(g => `<button class="filter-btn" data-filter="${g}">${g}</button>`)
    .join('\n    ');

  // Build card groups
  const cardGroups = [];
  for (const [cat, info] of Object.entries(DOC_CATEGORIES)) {
    const items = htmlFiles.filter(f => f.label === info.label);
    if (items.length === 0) continue;

    const cards = items.map(item => `
      <a class="card" href="${item.file}" data-group="${item.label}" data-keywords="${item.name.toLowerCase()}">
        <div class="card-name">${item.name}</div>
        <div class="card-desc">${item.desc}</div>
        <span class="card-tag">${item.label}</span>
      </a>`).join('\n');

    cardGroups.push(`
    <div class="group-label" data-group="${info.label}">${info.label}</div>
    <div class="card-grid" data-group="${info.label}">${cards}
    </div>`);
  }

  let html = tpl
    .replace(/\{\{PROJECT_NAME\}\}/g, projectName)
    .replace(/\{\{PROJECT_DESC\}\}/g, projectDesc)
    .replace('{{FILTER_BUTTONS}}', filterButtons)
    .replace('{{CARD_GROUPS}}', cardGroups.join('\n'));

  if (dryRun) {
    console.log(`  DRY   index.html (${htmlFiles.length} system docs)`);
  } else {
    const outPath = path.join(DOC_DIR, 'index.html');
    fs.writeFileSync(outPath, html, 'utf-8');
    console.log(`  OK    index.html (${htmlFiles.length} system docs)`);
  }
}

// --- Main ---
const template = readTemplate();

if (shouldGenerateIndex) {
  const projectName = files[0] || 'HDSA-MACO';
  const projectDesc = files[1] || '硬件设备调度架构 — 系统设计文档集';
  generateIndex(projectName, projectDesc);
} else {
  let targets = [];
  if (convertAll) {
    targets = fs.readdirSync(DOC_DIR)
      .filter(f => f.endsWith('.md') && isSystemDoc(f))
      .map(f => path.join(DOC_DIR, f));
  } else {
    targets = files.map(f => path.resolve(f));
  }

  let converted = 0;
  let skipped = 0;

  for (const mdPath of targets) {
    if (!fs.existsSync(mdPath)) {
      console.log(`  SKIP  ${mdPath} (not found)`);
      skipped++;
      continue;
    }

    const htmlPath = mdPath.replace(/\.md$/, '.html');
    if (fs.existsSync(htmlPath)) {
      console.log(`  SKIP  ${path.basename(mdPath)} (HTML already exists)`);
      skipped++;
      continue;
    }

    const md = fs.readFileSync(mdPath, 'utf-8');
    const parsed = parseMarkdownSections(md);
    const html = buildHtml(parsed, template);

    if (dryRun) {
      console.log(`  DRY   ${path.basename(mdPath)} -> ${path.basename(htmlPath)} (${parsed.sections.length} sections)`);
    } else {
      fs.writeFileSync(htmlPath, html, 'utf-8');
      console.log(`  OK    ${path.basename(mdPath)} -> ${path.basename(htmlPath)} (${parsed.sections.length} sections)`);
    }
    converted++;
  }

  console.log(`\nDone: ${converted} converted, ${skipped} skipped${dryRun ? ' (dry run)' : ''}`);
}
