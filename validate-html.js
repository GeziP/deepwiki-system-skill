#!/usr/bin/env node
/**
 * validate-html.js — DeepWiki HTML 闭环校验脚本
 *
 * 8 类校验，每类闭环：检查 → 自动修复(可选) → 重新检查 → 报告
 *
 * Usage:
 *   node validate-html.js doc/Scheduler_Architecture_Design.html
 *   node validate-html.js --all              # 校验 doc/ 下所有系统设计 HTML
 *   node validate-html.js --fix file.html    # 自动修复并写回
 *   node validate-html.js --fix --all        # 修复所有
 *   node validate-html.js --strict           # 严格模式（warning 也报错）
 *
 * Exit codes: 0 = all passed, 1 = has errors, 2 = has warnings (strict mode)
 */

const fs = require('fs');
const path = require('path');

const DOC_DIR = path.resolve(__dirname, '..', '..', '..', 'doc');

const args = process.argv.slice(2);
const doFix = args.includes('--fix');
const convertAll = args.includes('--all');
const strict = args.includes('--strict');
const files = args.filter(a => !a.startsWith('--'));

if (!convertAll && files.length === 0) {
  console.log('Usage: node validate-html.js [--fix] [--all] [--strict] [file.html ...]');
  console.log('  --fix      Auto-fix issues and write back');
  console.log('  --all      Validate all HTML in doc/');
  console.log('  --strict   Treat warnings as errors');
  process.exit(0);
}

// ============================================================
// Report collector
// ============================================================
class Report {
  constructor(file) {
    this.file = file;
    this.checks = []; // { category, status: 'pass'|'warn'|'fail'|'fixed', message }
  }
  pass(cat, msg) { this.checks.push({ category: cat, status: 'pass', message: msg }); }
  warn(cat, msg) { this.checks.push({ category: cat, status: 'warn', message: msg }); }
  fail(cat, msg) { this.checks.push({ category: cat, status: 'fail', message: msg }); }
  fixed(cat, msg) { this.checks.push({ category: cat, status: 'fixed', message: msg }); }

  print() {
    const cats = {};
    for (const c of this.checks) {
      if (!cats[c.category]) cats[c.category] = [];
      cats[c.category].push(c);
    }
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  ${this.file}`);
    console.log(`${'='.repeat(60)}`);
    for (const [cat, items] of Object.entries(cats)) {
      const passed = items.filter(i => i.status === 'pass').length;
      const warns = items.filter(i => i.status === 'warn').length;
      const fails = items.filter(i => i.status === 'fail').length;
      const fixed = items.filter(i => i.status === 'fixed').length;
      const total = items.length;
      let icon, detail;
      if (fails > 0) {
        icon = '\x1b[31m✗\x1b[0m';
        detail = `${fails} fail${fixed ? `, ${fixed} auto-fixed` : ''}`;
      } else if (warns > 0) {
        icon = '\x1b[33m!\x1b[0m';
        detail = `${warns} warning${fixed ? `, ${fixed} auto-fixed` : ''}`;
      } else if (fixed > 0) {
        icon = '\x1b[36m✓\x1b[0m';
        detail = `${passed + fixed}/${total} (auto-fixed ${fixed})`;
      } else {
        icon = '\x1b[32m✓\x1b[0m';
        detail = `${passed}/${total} valid`;
      }
      console.log(`  [${icon}] ${cat} (${detail})`);
      for (const item of items) {
        if (item.status === 'pass') continue;
        const sym = item.status === 'fail' ? '  ✗' : item.status === 'warn' ? '  !' : '  ~';
        console.log(`      ${sym} ${item.message}`);
      }
    }
    const totalFail = this.checks.filter(c => c.status === 'fail').length;
    const totalWarn = this.checks.filter(c => c.status === 'warn').length;
    console.log('');
    return { fail: totalFail, warn: totalWarn };
  }
}

// ============================================================
// Validation checks
// ============================================================

/**
 * 1. Mermaid 块校验
 */
function checkMermaid(html, report, fix) {
  const cat = 'Mermaid 块';
  const re = /<div class="mermaid">([\s\S]*?)<\/div>/g;
  let m;
  let count = 0;
  let valid = 0;
  let issues = [];
  let fixedHtml = html;

  while ((m = re.exec(html)) !== null) {
    count++;
    const block = m[1];
    const blockIssues = [];

    // Check HTML entities
    if (/&gt;|&lt;|&amp;/.test(block)) {
      blockIssues.push('contains HTML entities (&gt; &lt; &amp;)');
    }
    // Check dotted arrows -.> not -.-> (but allow -.->)
    if (/-\.\>(?!-)/.test(block)) {
      blockIssues.push('dotted arrow should be -.-> not -.>');
    }
    // Check curly braces in non-diamond context
    if (/\["[^"]*\{[^}]*\}[^"]*"\]/.test(block)) {
      blockIssues.push('curly braces {} in node labels conflict with diamond syntax');
    }
    // Check sequence diagram for bare -> (not ->> or -->>) in message text
    if (/sequenceDiagram/.test(block)) {
      const seqLines = block.split('\n').filter(l => {
        const t = l.trim();
        if (/^(graph|flowchart|sequenceDiagram|stateDiagram)/.test(t)) return false;
        // Match -> that is NOT followed by > (i.e., bare -> not ->>)
        return /->(?!>)/.test(t);
      });
      if (seqLines.length > 0) {
        blockIssues.push('sequence diagram message text contains bare -> (should use ->> for arrows)');
      }
    }
    // Check empty blocks
    if (block.trim().length === 0) {
      blockIssues.push('empty mermaid block');
    }

    if (blockIssues.length === 0) {
      valid++;
    } else {
      issues.push({ index: count, problems: blockIssues, original: block });

      if (fix) {
        let fixed = block;
        // Fix HTML entities
        fixed = fixed.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
        // Fix dotted arrows
        fixed = fixed.replace(/-\.\>(?!-)/g, '-.->');
        // Fix curly braces in labels (global)
        fixed = fixed.replace(/\["([^"]*(?:\{[^}]*)+[^"]*)"\]/g, function(_, inner) {
          return '["' + inner.replace(/\{/g, '【').replace(/\}/g, '】') + '"]';
        });
        // Fix sequence diagram: bare -> in message text (not ->> or -->>)
        if (/sequenceDiagram/.test(fixed)) {
          fixed = fixed.replace(/->(?!>)/g, '->>');
        }

        if (fixed !== block) {
          fixedHtml = fixedHtml.replace(block, fixed);
          report.fixed(cat, `Block #${count}: ${blockIssues.join('; ')}`);
        } else {
          report.fail(cat, `Block #${count}: ${blockIssues.join('; ')}`);
        }
      } else {
        report.fail(cat, `Block #${count}: ${blockIssues.join('; ')}`);
      }
    }
  }

  if (count === 0) {
    report.pass(cat, 'No Mermaid blocks found');
  } else if (issues.length === 0) {
    report.pass(cat, `${count}/${count} blocks valid`);
  }

  return fixedHtml;
}

/**
 * 2. 章节标题 ID 校验
 */
function checkHeadingIds(html, report, fix) {
  const cat = '章节标题 ID';
  // Find all h2 and h3 tags
  const h2Re = /<h2([^>]*)>([\s\S]*?)<\/h2>/g;
  const h3Re = /<h3([^>]*)>([\s\S]*?)<\/h3>/g;
  const ids = new Map(); // id -> first occurrence text
  const missing = [];
  const duplicates = [];
  let fixedHtml = html;

  function checkHeading(match, tag, re) {
    const attrs = match[1];
    const text = match[2].replace(/<[^>]+>/g, '').trim();
    const idMatch = attrs.match(/\bid="([^"]+)"/);
    if (!idMatch) {
      missing.push({ tag, text });
    } else {
      const id = idMatch[1];
      if (ids.has(id)) {
        duplicates.push({ id, first: ids.get(id), second: text });
      } else {
        ids.set(id, text);
      }
    }
  }

  let m;
  while ((m = h2Re.exec(html)) !== null) checkHeading(m, 'h2', h2Re);
  while ((m = h3Re.exec(html)) !== null) checkHeading(m, 'h3', h3Re);

  if (missing.length === 0 && duplicates.length === 0) {
    report.pass(cat, `${ids.size} headings with unique IDs`);
  } else {
    if (missing.length > 0) {
      if (fix) {
        for (const item of missing) {
          const genId = 'sec-' + item.text.replace(/[^\w一-鿿]/g, '').toLowerCase().slice(0, 20);
          const tagRe = new RegExp(`(<${item.tag})(>\\s*${item.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`);
          fixedHtml = fixedHtml.replace(tagRe, `$1 id="${genId}"$2`);
          report.fixed(cat, `${item.tag} "${item.text}" — assigned id="${genId}"`);
        }
      } else {
        report.fail(cat, `${missing.length} heading(s) missing id: ${missing.map(m => `${m.tag} "${m.text}"`).join(', ')}`);
      }
    }
    if (duplicates.length > 0) {
      for (const d of duplicates) {
        if (fix) {
          // Rename second occurrence
          const newId = d.id + '-2';
          const secondRe = new RegExp(`(id=")${d.id}(")`, 'g');
          let occurrence = 0;
          fixedHtml = fixedHtml.replace(secondRe, (match) => {
            occurrence++;
            return occurrence > 1 ? `${d.id}-${occurrence}"` : match;
          });
          report.fixed(cat, `Duplicate id="${d.id}" — renamed second occurrence`);
        } else {
          report.warn(cat, `Duplicate id="${d.id}" (${d.first} / ${d.second})`);
        }
      }
    }
  }

  return fixedHtml;
}

/**
 * 3. 代码块校验
 */
function checkCodeBlocks(html, report) {
  const cat = '代码块';
  const re = /<figure class="code-block"([^>]*)>([\s\S]*?)<\/figure>/g;
  let m;
  let count = 0;
  let missingLang = 0;
  let unescaped = 0;
  const missingLangLines = [];

  while ((m = re.exec(html)) !== null) {
    count++;
    const attrs = m[1];
    const content = m[2];
    const lineNum = html.substring(0, m.index).split('\n').length;

    // Check data-lang attribute
    if (!/data-lang=/.test(attrs) || /data-lang=""/.test(attrs)) {
      missingLang++;
      missingLangLines.push(lineNum);
    }

    // Check if code content is properly escaped (should not have raw < > in code)
    const codeContent = content.replace(/<[^>]+>/g, ''); // strip tags
    if (/[<>]/.test(codeContent) && !/&lt;|&gt;/.test(content)) {
      unescaped++;
    }
  }

  // Count <pre><code> NOT inside <figure> wrappers
  const withoutFigures = html.replace(/<figure[\s\S]*?<\/figure>/g, '');
  const bareCodeRe = /<pre><code>[\s\S]*?<\/code><\/pre>/g;
  let bareCount = 0;
  while (bareCodeRe.exec(withoutFigures) !== null) bareCount++;

  if (count === 0) {
    report.pass(cat, 'No code blocks found');
  } else {
    if (missingLang === 0) {
      report.pass(cat, `${count} code blocks all have language tags`);
    } else {
      report.warn(cat, `${missingLang}/${count} code blocks missing language tag (lines: ${missingLangLines.join(', ')})`);
    }
    if (unescaped > 0) {
      report.warn(cat, `${unescaped} code block(s) contain unescaped < > characters`);
    }
    if (bareCount > 0) {
      report.warn(cat, `${bareCount} bare <pre><code> outside <figure> wrapper`);
    }
  }
}

/**
 * 4. 表格校验
 */
function checkTables(html, report) {
  const cat = '表格';
  const re = /<div class="table-wrapper"><table>([\s\S]*?)<\/table><\/div>/g;
  let m;
  let count = 0;
  let issues = [];

  while ((m = re.exec(html)) !== null) {
    count++;
    const table = m[1];
    const hasThead = /<thead>/.test(table);
    const hasTbody = /<tbody>/.test(table);
    const tableIssues = [];
    if (!hasThead) tableIssues.push('missing <thead>');
    if (!hasTbody) tableIssues.push('missing <tbody>');
    if (tableIssues.length > 0) {
      issues.push(`Table #${count}: ${tableIssues.join(', ')}`);
    }
  }

  // Also check bare <table> outside wrapper
  const bareTableRe = /(?<!<div class="table-wrapper">)<table>([\s\S]*?)<\/table>(?![\s\S]*?<\/div>)/g;
  let bareCount = 0;
  while ((m = bareTableRe.exec(html)) !== null) {
    // Make sure it's not inside a table-wrapper
    const before = html.substring(Math.max(0, m.index - 100), m.index);
    if (!/table-wrapper/.test(before)) bareCount++;
  }

  if (count === 0) {
    report.pass(cat, 'No tables found');
  } else if (issues.length === 0) {
    report.pass(cat, `${count} tables properly structured`);
  } else {
    for (const issue of issues) {
      report.warn(cat, issue);
    }
  }
  if (bareCount > 0) {
    report.warn(cat, `${bareCount} bare <table> outside .table-wrapper`);
  }
}

/**
 * 5. 内联 Markdown 校验
 */
function checkInlineMarkdown(html, report) {
  const cat = '内联 Markdown';
  // Check for unresolved markdown patterns in section-body (not inside code/pre)
  const bodyRe = /<div class="section-body">([\s\S]*?)<\/div>/g;
  let m;
  let rawLinks = 0;
  let rawBold = 0;
  let rawInlineCode = 0;

  while ((m = bodyRe.exec(html)) !== null) {
    const body = m[1];
    // Strip code blocks and inline code from consideration
    const stripped = body
      .replace(/<pre><code>[\s\S]*?<\/code><\/pre>/g, '')
      .replace(/<code>[\s\S]*?<\/code>/g, '');

    // Check for raw markdown links [text](url) that weren't converted
    const rawLinkMatches = stripped.match(/\[[^\]]+\]\([^)]+\)/g);
    if (rawLinkMatches) rawLinks += rawLinkMatches.length;

    // Check for raw bold **text** that weren't converted (inside text nodes, not attrs)
    const rawBoldMatches = stripped.match(/\*\*[^*]+\*\*/g);
    if (rawBoldMatches) rawBold += rawBoldMatches.length;
  }

  if (rawLinks === 0 && rawBold === 0) {
    report.pass(cat, 'Inline markdown properly converted');
  } else {
    if (rawLinks > 0) report.warn(cat, `${rawLinks} raw markdown link(s) [text](url) not converted`);
    if (rawBold > 0) report.warn(cat, `${rawBold} raw **bold** pattern(s) not converted`);
  }
}

/**
 * 6. 可折叠章节校验
 */
function checkCollapsibleSections(html, report) {
  const cat = '可折叠章节';
  const detailsRe = /<details([^>]*)>([\s\S]*?)<\/details>/g;
  let m;
  let count = 0;
  let orphaned = 0;
  let missingSummary = 0;
  let openCount = 0;

  while ((m = detailsRe.exec(html)) !== null) {
    count++;
    const attrs = m[1];
    const body = m[2];
    if (/ open/.test(attrs)) openCount++;
    if (!/<summary>/.test(body)) missingSummary++;
  }

  // Check for </details> without matching <details>
  // Strip <style>/<script> blocks to avoid counting CSS comments containing "<details"
  const htmlOnly = html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '');
  const openDetails = (htmlOnly.match(/<details/g) || []).length;
  const closeDetails = (htmlOnly.match(/<\/details>/g) || []).length;
  if (openDetails !== closeDetails) {
    orphaned = Math.abs(openDetails - closeDetails);
  }

  if (count === 0) {
    report.pass(cat, 'No collapsible sections found');
  } else {
    if (missingSummary > 0) {
      report.warn(cat, `${missingSummary} <details> missing <summary>`);
    } else {
      report.pass(cat, `${count} sections (${openCount} open, ${count - openCount} collapsed)`);
    }
    if (orphaned > 0) {
      report.fail(cat, `Mismatched <details>/<details>: ${openDetails} open vs ${closeDetails} close`);
    }
  }
}

/**
 * 7. TOC 完整性校验
 */
function checkTOC(html, report, fix) {
  const cat = 'TOC 完整性';
  let fixedHtml = html;

  // Use a non-greedy regex that doesn't cross </ul> boundaries
  const tocMatch = html.match(/<ul class="toc-list"[^>]*>((?:[^<]|<(?!\/ul>))*?)<\/ul>/);
  if (!tocMatch) {
    const hasSidebar = /class="sidebar"/.test(html) || /id="toc"/.test(html) || /toc-list/.test(html);
    if (!hasSidebar) {
      report.warn(cat, 'No TOC element found (HTML may use non-standard template)');
    } else {
      report.fail(cat, 'TOC element (.toc-list) not found but sidebar exists');
    }
    return fixedHtml;
  }

  const tocContent = tocMatch[1].trim();
  if (tocContent.length === 0 || !/<li/.test(tocContent)) {
    report.fail(cat, 'TOC is empty (no <li> entries) — converter should generate static TOC');
  } else {
    // TOC has content — verify links point to existing IDs
    const tocLinks = tocContent.match(/href="#([^"]+)"/g) || [];
    const ids = new Set();
    const idRe = /\bid="([^"]+)"/g;
    let idm;
    while ((idm = idRe.exec(html)) !== null) ids.add(idm[1]);

    let broken = 0;
    for (const link of tocLinks) {
      const targetId = link.match(/href="#([^"]+)"/)[1];
      if (!ids.has(targetId)) broken++;
    }

    if (broken === 0) {
      report.pass(cat, `TOC has ${tocLinks.length} entries, all links valid`);
    } else {
      report.warn(cat, `TOC has ${broken} broken link(s) pointing to non-existent IDs`);
    }
  }

  return fixedHtml;
}

/**
 * 8. HTML 骨架校验
 */
function checkHtmlSkeleton(html, report) {
  const cat = 'HTML 骨架';
  const checks = [
    { test: /<meta charset="utf-8"/i, name: 'charset=utf-8' },
    { test: /<meta name="viewport"/i, name: 'viewport meta' },
    { test: /<html[^>]*lang="/i, name: 'lang attribute on <html>' },
    { test: /<title>[^<]+<\/title>/i, name: '<title> tag' },
    { test: /<!doctype html>/i, name: '<!doctype html>' },
    { test: /<meta name="generator"/i, name: 'generator meta' },
  ];

  let passed = 0;
  let missing = [];
  for (const c of checks) {
    if (c.test.test(html)) {
      passed++;
    } else {
      missing.push(c.name);
    }
  }

  if (missing.length === 0) {
    report.pass(cat, `All ${checks.length} skeleton elements present`);
  } else {
    report.warn(cat, `Missing: ${missing.join(', ')}`);
  }
}

// ============================================================
// Main
// ============================================================

function validateFile(filePath, fix) {
  let html = fs.readFileSync(filePath, 'utf-8');
  const report = new Report(path.basename(filePath));
  const originalHtml = html;

  // Run all 8 checks
  html = checkMermaid(html, report, fix);
  html = checkHeadingIds(html, report, fix);
  checkCodeBlocks(html, report);
  checkTables(html, report);
  checkInlineMarkdown(html, report);
  checkCollapsibleSections(html, report);
  html = checkTOC(html, report, fix);
  checkHtmlSkeleton(html, report);

  const result = report.print();

  // Write back if fix mode and content changed
  if (fix && html !== originalHtml) {
    fs.writeFileSync(filePath, html, 'utf-8');
    console.log(`  \x1b[36m[written]\x1b[0m ${filePath}`);
  }

  return result;
}

// Collect targets
let targets = [];
if (convertAll) {
  // System-level docs in doc/ root
  const systemDocs = fs.readdirSync(DOC_DIR)
    .filter(f => f.endsWith('.html') && /Architecture|Design/.test(f) && !f.includes('index'))
    .map(f => path.join(DOC_DIR, f));
  // Also check tech-docs/ for module-level docs
  const techDocsDir = path.join(DOC_DIR, 'tech-docs');
  let moduleDocs = [];
  if (fs.existsSync(techDocsDir)) {
    moduleDocs = fs.readdirSync(techDocsDir)
      .filter(f => f.endsWith('_Design.html'))
      .map(f => path.join(techDocsDir, f));
  }
  targets = [...systemDocs, ...moduleDocs];
} else {
  targets = files.map(f => path.resolve(f));
}

let totalFail = 0;
let totalWarn = 0;

for (const filePath of targets) {
  if (!fs.existsSync(filePath)) {
    console.log(`  SKIP  ${filePath} (not found)`);
    continue;
  }
  const result = validateFile(filePath, doFix);
  totalFail += result.fail;
  totalWarn += result.warn;
}

console.log(`\n${'='.repeat(60)}`);
if (totalFail === 0 && totalWarn === 0) {
  console.log(`  \x1b[32mALL PASSED\x1b[0m — ${targets.length} file(s) validated`);
} else {
  const parts = [];
  if (totalFail > 0) parts.push(`\x1b[31m${totalFail} error(s)\x1b[0m`);
  if (totalWarn > 0) parts.push(`\x1b[33m${totalWarn} warning(s)\x1b[0m`);
  console.log(`  ${parts.join(', ')} across ${targets.length} file(s)`);
}

if (totalFail > 0) process.exit(1);
if (strict && totalWarn > 0) process.exit(2);
process.exit(0);
