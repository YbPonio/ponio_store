import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wikiDir = path.join(rootDir, 'wiki');
const rawDir = path.join(rootDir, 'raw');

const categories = ['sources', 'entities', 'concepts', 'syntheses'];

function getMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files;
}

function parseFrontmatter(content) {
  if (!content.startsWith('---')) {
    return null;
  }
  const endIndex = content.indexOf('\n---', 3);
  if (endIndex === -1) {
    return null;
  }
  const raw = content.slice(3, endIndex).trim();
  const meta = {};
  for (const line of raw.split('\n')) {
    const splitIndex = line.indexOf(':');
    if (splitIndex > 0) {
      const key = line.slice(0, splitIndex).trim();
      const val = line.slice(splitIndex + 1).trim();
      meta[key] = val.replace(/^["']|["']$/g, '');
    }
  }
  return meta;
}

function extractWikilinks(content) {
  const stripped = content.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '');
  const matches = [];
  const regex = /\[\[([^\]]+)\]\]/g;
  let match;
  while ((match = regex.exec(stripped)) !== null) {
    const rawTarget = match[1].split('|')[0].trim();
    matches.push(rawTarget);
  }
  return matches;
}

function resolveTarget(target, sourceFilePath) {
  const cleanTarget = target.endsWith('.md') ? target : `${target}.md`;
  const inSameDir = path.join(path.dirname(sourceFilePath), cleanTarget);
  if (fs.existsSync(inSameDir)) {
    return inSameDir;
  }
  const inWiki = path.join(wikiDir, cleanTarget);
  if (fs.existsSync(inWiki)) {
    return inWiki;
  }
  for (const cat of categories) {
    const inCat = path.join(wikiDir, cat, cleanTarget);
    if (fs.existsSync(inCat)) {
      return inCat;
    }
    const baseTarget = path.basename(cleanTarget);
    const inCatBase = path.join(wikiDir, cat, baseTarget);
    if (fs.existsSync(inCatBase)) {
      return inCatBase;
    }
  }
  const inRaw = path.join(rawDir, cleanTarget);
  if (fs.existsSync(inRaw)) {
    return inRaw;
  }
  const inRawSources = path.join(rawDir, 'sources', cleanTarget);
  if (fs.existsSync(inRawSources)) {
    return inRawSources;
  }
  return null;
}

function runStats() {
  console.log('LLM Wiki Statistics');
  console.log('===================');
  
  const rawSources = getMarkdownFiles(path.join(rawDir, 'sources'));
  console.log(`Raw Sources:    ${rawSources.length}`);

  let totalWikiPages = 0;
  for (const cat of categories) {
    const catFiles = getMarkdownFiles(path.join(wikiDir, cat));
    totalWikiPages += catFiles.length;
    console.log(`Wiki ${cat.padEnd(10)}: ${catFiles.length}`);
  }

  const allWikiFiles = getMarkdownFiles(wikiDir);
  let totalLinks = 0;
  for (const file of allWikiFiles) {
    const text = fs.readFileSync(file, 'utf8');
    totalLinks += extractWikilinks(text).length;
  }

  const logFile = path.join(wikiDir, 'log.md');
  let logEntries = 0;
  if (fs.existsSync(logFile)) {
    const logContent = fs.readFileSync(logFile, 'utf8');
    const logMatches = logContent.match(/^##\s+\[\d{4}-\d{2}-\d{2}\]/gm);
    logEntries = logMatches ? logMatches.length : 0;
  }

  console.log('-------------------');
  console.log(`Total Wiki Pages: ${totalWikiPages}`);
  console.log(`Total Wiki Links: ${totalLinks}`);
  console.log(`Log Entries:      ${logEntries}`);
}

function runLint() {
  console.log('LLM Wiki Lint & Integrity Check');
  console.log('===============================');
  
  let errors = 0;
  let warnings = 0;

  const indexFile = path.join(wikiDir, 'index.md');
  if (!fs.existsSync(indexFile)) {
    console.log('[ERROR] Master index file missing: wiki/index.md');
    errors++;
  }

  const logFile = path.join(wikiDir, 'log.md');
  if (!fs.existsSync(logFile)) {
    console.log('[ERROR] Master log file missing: wiki/log.md');
    errors++;
  }

  const indexContent = fs.existsSync(indexFile) ? fs.readFileSync(indexFile, 'utf8') : '';
  const allWikiFiles = getMarkdownFiles(wikiDir);
  const inboundCount = new Map();

  for (const file of allWikiFiles) {
    inboundCount.set(file, 0);
  }

  for (const file of allWikiFiles) {
    const relPath = path.relative(rootDir, file);
    const content = fs.readFileSync(file, 'utf8');
    const isSpecial = file === indexFile || file === logFile;

    if (!isSpecial) {
      const frontmatter = parseFrontmatter(content);
      if (!frontmatter) {
        console.log(`[WARN] Missing or invalid frontmatter: ${relPath}`);
        warnings++;
      }
      const baseName = path.basename(file, '.md');
      if (!indexContent.includes(baseName)) {
        console.log(`[WARN] Page not referenced in index.md: ${relPath}`);
        warnings++;
      }
    }

    const links = extractWikilinks(content);
    for (const target of links) {
      const resolved = resolveTarget(target, file);
      if (!resolved) {
        console.log(`[ERROR] Dead wikilink in ${relPath}: [[${target}]]`);
        errors++;
      } else if (inboundCount.has(resolved)) {
        inboundCount.set(resolved, inboundCount.get(resolved) + 1);
      }
    }
  }

  for (const [file, count] of inboundCount.entries()) {
    if (file !== indexFile && file !== logFile && count === 0) {
      const relPath = path.relative(rootDir, file);
      console.log(`[WARN] Orphan page with 0 inbound links: ${relPath}`);
      warnings++;
    }
  }

  console.log('-------------------------------');
  console.log(`Lint finished: ${errors} errors, ${warnings} warnings.`);
  if (errors > 0) {
    process.exit(1);
  }
}

function runSearch(query) {
  if (!query) {
    console.log('Usage: node scripts/wiki.mjs search <query>');
    process.exit(1);
  }

  const q = query.toLowerCase();
  console.log(`Searching for: "${query}"`);
  console.log('==========================');

  const files = getMarkdownFiles(wikiDir);
  let totalMatches = 0;

  for (const file of files) {
    const relPath = path.relative(rootDir, file);
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    const matchingLines = [];

    lines.forEach((line, index) => {
      if (line.toLowerCase().includes(q)) {
        matchingLines.push({ num: index + 1, text: line.trim() });
      }
    });

    if (matchingLines.length > 0) {
      console.log(`\n${relPath} (${matchingLines.length} match${matchingLines.length > 1 ? 'es' : ''}):`);
      for (const m of matchingLines.slice(0, 5)) {
        console.log(`  Line ${m.num}: ${m.text}`);
      }
      if (matchingLines.length > 5) {
        console.log(`  ... and ${matchingLines.length - 5} more`);
      }
      totalMatches += matchingLines.length;
    }
  }

  console.log('\n--------------------------');
  console.log(`Total occurrences found: ${totalMatches}`);
}

function runList(filterCategory) {
  console.log('LLM Wiki Pages');
  console.log('==============');

  const selectedCategories = filterCategory ? [filterCategory] : categories;

  for (const cat of selectedCategories) {
    const dir = path.join(wikiDir, cat);
    const files = getMarkdownFiles(dir);
    console.log(`\n[${cat.toUpperCase()}] (${files.length})`);
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const meta = parseFrontmatter(content);
      const title = meta && meta.title ? meta.title : path.basename(file, '.md');
      const relPath = path.relative(rootDir, file);
      console.log(`- ${title} (${relPath})`);
    }
  }
}

const command = process.argv[2] || 'stats';
const arg = process.argv[3];

switch (command) {
  case 'stats':
    runStats();
    break;
  case 'lint':
    runLint();
    break;
  case 'search':
    runSearch(arg);
    break;
  case 'list':
    runList(arg);
    break;
  default:
    console.log('Commands: stats | lint | search <query> | list [category]');
    break;
}
