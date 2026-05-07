#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { marked } = require("marked");
const puppeteer = require("puppeteer");

// ---- CLI args ----
const args = process.argv.slice(2);
function getArg(name) {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : null;
}
function getFlag(name) {
  const match = args.find((a) => a.startsWith(`${name}=`));
  return match ? match.split("=")[1] : null;
}

const inputFile = args.find((a) => !a.startsWith("-"));
const format = getFlag("--format") || "report";
const theme = getFlag("--theme") || "mgm";
const outputFile =
    getArg("-o") || `output-${format}.pdf`;

if (!inputFile) {
  console.error("Usage: node render.js input.md --format=report|slides --theme=mgm|clay -o output.pdf");
  process.exit(1);
}

// ---- Logo as base64 data URI (avoids Puppeteer file:// sub-resource blocking) ----
function getLogoUri() {
  const svgPath = path.resolve(__dirname, "mgm-logo.svg");
  const pngPath = path.resolve(__dirname, "mgm-logo.png");
  if (fs.existsSync(svgPath)) {
    const data = fs.readFileSync(svgPath).toString("base64");
    return `data:image/svg+xml;base64,${data}`;
  }
  if (fs.existsSync(pngPath)) {
    const data = fs.readFileSync(pngPath).toString("base64");
    return `data:image/png;base64,${data}`;
  }
  return "";
}
const logoUri = getLogoUri();

// ---- Read markdown ----
const md = fs.readFileSync(inputFile, "utf-8");

// ---- Parse front-matter (simple YAML-like) ----
// Supports: title, subtitle, category, author, date, doc_id, version
let meta = {};
let body = md;
if (md.startsWith("---")) {
  const end = md.indexOf("---", 3);
  if (end !== -1) {
    const frontMatter = md.slice(3, end).trim();
    frontMatter.split("\n").forEach((line) => {
      const colon = line.indexOf(":");
      if (colon !== -1) {
        const key = line.slice(0, colon).trim();
        const val = line.slice(colon + 1).trim();
        meta[key] = val;
      }
    });
    body = md.slice(end + 3).trim();
  }
}

const title = meta.title || "Untitled Report";
const subtitle = meta.subtitle || "";
const category = meta.category || "Technical Report";
const author = meta.author || "";
const date = meta.date || new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
const docId = meta.doc_id || "";
const version = meta.version || "1.0";

// ---- Configure marked ----
marked.setOptions({
  gfm: true,
  breaks: false,
});

// Custom renderer to add NASA styling classes
const renderer = new marked.Renderer();

// Add highlight classes to code blocks
renderer.code = function (token) {
  const code = token.text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  return `<pre><code>${code}</code></pre>`;
};

// Blockquotes become callouts
renderer.blockquote = function (token) {
  const body = marked.parser(token.tokens);
  return `<div class="callout">${body}</div>`;
};

marked.use({ renderer });

let htmlContent = marked.parse(body);

// ---- Inline local images as base64 data URIs ----
// Image paths in the markdown are relative to the markdown file's directory,
// but the temp HTML is written elsewhere — so resolve and inline them.
const mdDir = path.dirname(path.resolve(inputFile));
htmlContent = htmlContent.replace(/<img([^>]*?)src="([^"]+)"([^>]*)>/g, (match, pre, src, post) => {
  if (/^(https?:|data:)/i.test(src)) return match;
  const abs = path.resolve(mdDir, src);
  if (!fs.existsSync(abs)) {
    console.warn(`[warn] image not found: ${src} (resolved to ${abs})`);
    return match;
  }
  const ext = path.extname(abs).slice(1).toLowerCase();
  const mime = ext === "svg" ? "image/svg+xml" : ext === "jpg" ? "image/jpeg" : `image/${ext}`;
  const data = fs.readFileSync(abs).toString("base64");
  return `<img${pre}src="data:${mime};base64,${data}"${post}>`;
});

// ---- Split content into sections by H2 ----
function splitByH2(html) {
  // Split on <h2> tags, keeping the tag
  const parts = html.split(/(?=<h2[ >])/);
  return parts.filter((p) => p.trim());
}

const sections = splitByH2(htmlContent);

// ---- Shared CSS (from design system) ----
const sharedHead = `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,300;0,400;0,500;0,700;0,900;1,400&family=Roboto+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --carbon-black:    #000000;
      --carbon-90:       #111111;
      --carbon-80:       #1b1b1b;
      --carbon-70:       #2e2e2e;
      --carbon-60:       #1b1b1b;  /* mgm: body text reads as dark/black, not grey */
      --carbon-50:       #2e2e2e;
      --carbon-40:       #919191;
      --carbon-30:       #b9b9bb;
      --carbon-20:       #d1d1d1;
      --carbon-10:       #e6e6e6;
      --carbon-05:       #f6f6f6;
      --spacesuit-white: #ffffff;
      /* mgm brand palette (from mgm-Template-2024.pptx theme) */
      --mgm-teal:        #207475;
      --mgm-teal-dark:   #155153;
      --mgm-blue-teal:   #047FA3;
      --mgm-green:       #5E8013;
      --mgm-olive:       #7E6703;
      --mgm-orange:      #B83403;
      --mgm-red:         #A0012C;
      --mgm-purple:      #6A287D;
      --mgm-blue:        #1D4E86;
      /* aliases — keep legacy var names mapped to mgm primary so prior styles update automatically */
      --nasa-red:        var(--mgm-teal);
      --nasa-red-dark:   var(--mgm-teal-dark);
      --blue-vivid:      var(--mgm-blue);
      --blue-bright:     var(--mgm-blue-teal);
      --blue-mono:       var(--mgm-blue-teal);
      --font-primary:    'Roboto', -apple-system, BlinkMacSystemFont, sans-serif;
      --font-secondary:  'Roboto', var(--font-primary);
      --font-display:    'Roboto', var(--font-primary);
      --font-mono:       'Roboto Mono', 'SF Mono', 'Fira Code', monospace;
    }
    h1, h2, h3, .display-heavy { font-family: var(--font-display); font-weight: 900; }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--font-primary);
      -webkit-font-smoothing: antialiased;
      background: white;
      margin: 0;
      padding: 0;
    }
  </style>`;

// ---- Build report HTML ----
function buildReport() {

  const tocItems = sections
      .map((s, i) => {
        const match = s.match(/<h2[^>]*>(.*?)<\/h2>/);
        const label = match ? match[1] : `Section ${i + 1}`;
        return `<li class="toc-item">
        <span class="toc-number">${String(i + 1).padStart(2, "0")}</span>
        <span class="toc-label">${label}</span>
      </li>`;
      })
      .join("\n");

  const PAGE_BREAK_MARKER = '<div style="page-break-before: always;"></div>';
  const sectionHeader = (i) => `<div class="page-header">
          <span>${docId ? docId + " — " : ""}${title}</span>
          <img src="${logoUri}" alt="" class="page-header-logo">
        </div>`;

  const sectionHtml = sections
      .map((s, i) => {
        const parts = s.split(PAGE_BREAK_MARKER);
        if (parts.length === 1) {
          return `<div class="report-section">
        ${sectionHeader(i)}
        <span class="section-number">${String(i + 1).padStart(2, "0")}</span>
        ${s}
      </div>`;
        }
        return parts.map((part, pi) => `<div class="report-section">
        ${sectionHeader(i)}
        ${pi === 0 ? `<span class="section-number">${String(i + 1).padStart(2, "0")}</span>` : ""}
        ${part}
      </div>`).join("\n");
      })
      .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  ${sharedHead}
  <style>
    @page { size: A4 portrait; margin: 0; }

    body { font-size: 10.5pt; line-height: 1.65; color: var(--carbon-black); }

    /* Cover */
    .cover {
      width: 210mm; height: 297mm;
      background: var(--spacesuit-white); color: var(--carbon-black);
      display: flex; flex-direction: column; justify-content: space-between;
      padding: 40mm 30mm; page-break-after: always; overflow: hidden;
    }
    .cover-stripe { width: 100%; height: 4px; background: var(--nasa-red); margin-bottom: 24px; }
    .cover-top { display: flex; align-items: center; gap: 16px; }
    .cover-logo { width: 60px; }
    .cover-org { font-size: 11pt; font-weight: 600; letter-spacing: 0.06em; color: var(--carbon-60); }
    .cover-body { flex: 1; display: flex; flex-direction: column; justify-content: center; }
    .cover-category { font-family: var(--font-mono); font-size: 9pt; color: var(--nasa-red); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 12px; }
    .cover-title { font-size: 36pt; font-weight: 800; letter-spacing: -0.02em; line-height: 1.1; margin-bottom: 16px; }
    .cover-subtitle { font-size: 14pt; font-weight: 400; color: var(--carbon-60); max-width: 400px; line-height: 1.5; }
    .cover-footer { display: flex; justify-content: space-between; align-items: flex-end; }
    .cover-meta { font-size: 8.5pt; color: var(--carbon-60); line-height: 1.8; }
    .cover-meta strong { color: var(--carbon-80); font-weight: 600; }

    /* TOC */
    .toc { page-break-after: always; padding: 20mm 25mm 25mm 25mm; }
    .toc-header { font-size: 8.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--carbon-40); margin-bottom: 24px; padding-bottom: 8px; border-bottom: 2px solid var(--carbon-10); }
    .toc-list { list-style: none; }
    .toc-item { display: flex; align-items: baseline; padding: 8px 0; border-bottom: 1px solid var(--carbon-05); }
    .toc-number { font-family: var(--font-mono); font-size: 9pt; color: var(--nasa-red); width: 32px; flex-shrink: 0; }
    .toc-label { flex: 1; font-size: 11pt; font-weight: 600; }

    /* Sections */
    .report-section { padding: 20mm 25mm 25mm 25mm; page-break-before: always; }
    .page-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 1px solid var(--carbon-10); margin-bottom: 24px; font-family: var(--font-mono); font-size: 7.5pt; color: var(--carbon-40); text-transform: uppercase; letter-spacing: 0.08em; }
    .page-header-logo { height: 18px; opacity: 0.5; }
    .section-number { font-family: var(--font-mono); font-size: 9pt; color: var(--nasa-red); display: block; margin-bottom: 4px; }

    /* Typography */
    h1 { font-size: 24pt; font-weight: 800; letter-spacing: -0.02em; line-height: 1.15; margin-bottom: 8px; }
    h2 { font-size: 16pt; font-weight: 700; letter-spacing: -0.01em; line-height: 1.25; margin-top: 0; margin-bottom: 10px; color: var(--carbon-black); }
    h3 { font-size: 12pt; font-weight: 700; line-height: 1.35; margin-top: 20px; margin-bottom: 8px; }
    h4 { font-size: 10.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--carbon-60); margin-top: 16px; margin-bottom: 6px; }
    p { margin-bottom: 10px; color: var(--carbon-60); max-width: 75ch; }
    strong { color: var(--carbon-black); font-weight: 600; }
    a { color: var(--blue-vivid); }

    /* Lists */
    ul, ol { margin-bottom: 12px; padding-left: 20px; color: var(--carbon-60); }
    li { margin-bottom: 4px; }
    li::marker { color: var(--nasa-red); }

    /* Callout (from blockquotes) */
    .callout { border-left: 3px solid var(--nasa-red); background: var(--carbon-05); padding: 12px 16px; margin: 16px 0; border-radius: 0 2px 2px 0; }
    .callout p { margin-bottom: 0; font-size: 9.5pt; }

    /* Code */
    code { font-family: var(--font-mono); font-size: 9pt; background: var(--carbon-05); padding: 1px 5px; border-radius: 2px; }
    pre { background: var(--spacesuit-white); color: var(--carbon-80); border: 1px solid var(--carbon-10); font-family: var(--font-mono); font-size: 8.5pt; line-height: 1.75; padding: 16px 20px; border-radius: 2px; margin: 16px 0; overflow-x: auto; page-break-inside: avoid; }
    pre code { background: none; padding: 0; color: inherit; font-size: inherit; }

    /* Table */
    table { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin: 16px 0; page-break-inside: avoid; }
    thead th { text-align: left; font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--carbon-40); padding: 6px 10px; border-bottom: 2px solid var(--carbon-10); }
    tbody td { padding: 8px 10px; border-bottom: 1px solid var(--carbon-05); color: var(--carbon-60); }

    /* HR */
    hr { border: none; border-top: 1px solid var(--carbon-10); margin: 24px 0; }

    /* Images */
    img:not(.cover-logo):not(.page-header-logo) { max-width: 100%; border-radius: 2px; }
  </style>
</head>
<body>

  <div class="cover">
    <div>
      <div class="cover-stripe"></div>
      <div class="cover-top">
        <img src="${logoUri}" alt="mgm" class="cover-logo">
        <span class="cover-org">mgm technology partners</span>
      </div>
    </div>
    <div class="cover-body">
      <div class="cover-category">${category}</div>
      <h1 class="cover-title">${title}</h1>
      ${subtitle ? `<p class="cover-subtitle">${subtitle}</p>` : ""}
    </div>
    <div class="cover-footer">
      <div class="cover-meta">
        ${author ? `<strong>Prepared by:</strong> ${author}` : ""}
      </div>
      <div class="cover-meta" style="text-align: right;">
        <strong>Date:</strong> ${date}
      </div>
    </div>
  </div>

  <div class="toc">
    <div class="toc-header">Table of Contents</div>
    <ul class="toc-list">${tocItems}</ul>
  </div>

  ${sectionHtml}

</body>
</html>`;
}

// ---- Build slides HTML ----
function buildSlides() {

  // First section becomes content for the title slide
  // Remaining sections become individual slides
  // Logo is positioned top-right; footer is bottom-right with 8-color bar + "Innovation Implemented." (matches mgm-Template-2024.pptx layout)
  const slideLogo = `<img class="slide-logo" src="${logoUri}" alt="mgm">`;
  const slideFooter = `<div class="slide-footer">
    <div class="footer-colors">
      <span style="background: var(--mgm-blue-teal)"></span>
      <span style="background: var(--mgm-teal)"></span>
      <span style="background: var(--mgm-orange)"></span>
      <span style="background: var(--mgm-red)"></span>
      <span style="background: var(--mgm-olive)"></span>
      <span style="background: var(--mgm-purple)"></span>
      <span style="background: var(--mgm-blue)"></span>
      <span style="background: var(--mgm-green)"></span>
    </div>
    <div class="footer-tagline">Innovation Implemented.</div>
  </div>`;

  // Build individual slides from H2 sections
  // Alternate between light and dark for variety
  const slideHtml = sections
      .map((s, i) => {
        const match = s.match(/<h2[^>]*>(.*?)<\/h2>/);
        const heading = match ? match[1] : "";
        const content = s.replace(/<h2[^>]*>.*?<\/h2>/, "");
        // Check if section has code block — use code slide (white bg)
        if (s.includes("<pre>")) {
          return `<section class="slide-code">
          ${slideLogo}
          <h2>${heading}</h2>
          ${content}
          ${slideFooter}
        </section>`;
        }

        // Always white background
        return `<section class="slide-content">
        ${slideLogo}
        <div class="content-header">
          <h2>${heading}</h2>
        </div>
        <div class="content-body">${content}</div>
        ${slideFooter}
      </section>`;
      })
      .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  ${sharedHead}
  <style>
    @page { size: 254mm 142.9mm; margin: 0; }

    body { font-size: 14pt; line-height: 1.5; color: var(--carbon-black); }

    section {
      width: 254mm; height: 142.9mm; padding: 10mm 14mm 18mm 14mm;
      position: relative; overflow: hidden; page-break-after: always;
      display: flex; flex-direction: column;
    }
    /* Logo: top-right, matches mgm-Template-2024.pptx (~86% left, 4% top) */
    .slide-logo { position: absolute; top: 6mm; right: 14mm; height: 8mm; width: auto; z-index: 10; }

    /* Footer: bottom-right 8-color bar + "Innovation Implemented." tagline (matches mgm-Template-2024.pptx) */
    .slide-footer { position: absolute; bottom: 5mm; right: 14mm; display: flex; flex-direction: column; align-items: flex-end; gap: 3px; z-index: 10; }
    .footer-colors { display: flex; gap: 2px; }
    .footer-colors span { display: block; width: 12px; height: 4px; }
    .footer-tagline { font-family: var(--font-primary); font-size: 7pt; font-weight: 400; color: var(--carbon-70); letter-spacing: 0; }

    /* Title slide — matches mgm-Template-2024.pptx Title Slide layout */
    .slide-title { background: var(--spacesuit-white); color: var(--carbon-black); justify-content: flex-end; padding: 10mm 14mm 18mm 14mm; }
    .slide-title .title-block { width: 100%; max-width: 220mm; }
    .slide-title h1 { font-family: var(--font-display); font-size: 32pt; font-weight: 900; letter-spacing: -0.01em; line-height: 1.1; margin: 0 0 6mm 0; color: var(--carbon-black); }
    .slide-title .title-subtitle-box { padding: 0; font-size: 14pt; font-weight: 500; color: var(--carbon-black); line-height: 1.3; margin-bottom: 5mm; }
    .slide-title .title-meta-box { padding: 0; }
    .slide-title .title-meta-info { font-size: 11pt; color: var(--carbon-black); line-height: 1.5; }

    /* Content slides */
    .slide-content { background: var(--spacesuit-white); }
    .content-header { margin-bottom: 16px; }
    .content-overline { font-family: var(--font-mono); font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.1em; color: var(--nasa-red); margin-bottom: 4px; }
    .slide-content h2 { font-size: 20pt; font-weight: 700; letter-spacing: -0.01em; line-height: 1.2; margin: 0; }
    .content-body { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 8px; }
    .content-body > * { flex: 0 0 auto; }
    .content-body img, .content-body p:has(> img:only-child) { flex: 1 1 0; min-height: 0; }
    .content-body img { max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain; display: block; margin: 0 auto; }
    .content-body p:has(> img:only-child) { margin: 0; text-align: center; display: flex; align-items: center; justify-content: center; }
    .slide-content p { font-size: 11pt; color: var(--carbon-60); line-height: 1.6; margin-bottom: 10px; }
    .slide-content ul { list-style: none; padding: 0; }
    .slide-content ul li { font-size: 11pt; color: var(--carbon-60); padding: 6px 0 6px 18px; position: relative; }
    .slide-content ul li::before { content: ''; position: absolute; left: 0; top: 13px; width: 6px; height: 6px; background: var(--carbon-black); border-radius: 50%; }
    .slide-content ul li strong { color: var(--carbon-black); font-weight: 600; }
    .slide-content ol { padding-left: 20px; }
    .slide-content ol li { font-size: 11pt; color: var(--carbon-60); padding: 4px 0; }
    .slide-content ol li::marker { color: var(--carbon-black); font-weight: 700; }

    /* Code slide — white background */
    .slide-code { background: var(--spacesuit-white); color: var(--carbon-black); }
    .slide-code .code-overline { font-family: var(--font-mono); font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.1em; color: var(--nasa-red); margin-bottom: 4px; }
    .slide-code h2 { font-size: 18pt; font-weight: 700; color: var(--carbon-black); margin-bottom: 16px; }
    .slide-code pre { background: var(--carbon-05); border: 1px solid var(--carbon-10); border-radius: 4px; padding: 16px 20px; margin-top: 8px; font-family: var(--font-mono); font-size: 10pt; line-height: 1.7; color: var(--carbon-70); flex: 1; overflow: hidden; }
    .slide-code pre code { background: none; padding: 0; color: inherit; font-size: inherit; }
    .slide-code .slide-footer { color: var(--carbon-40); }

    /* Callout */
    .callout { border-left: 3px solid var(--nasa-red); background: var(--carbon-05); padding: 10px 14px; margin: 12px 0; border-radius: 0 2px 2px 0; }
    .callout p { margin-bottom: 0; font-size: 10pt; }

    /* Table */
    table { width: 100%; border-collapse: collapse; font-size: 10pt; margin: 10px 0; }
    thead th { text-align: left; font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--carbon-40); padding: 4px 8px; border-bottom: 2px solid var(--carbon-10); }
    tbody td { padding: 6px 8px; border-bottom: 1px solid var(--carbon-05); color: var(--carbon-60); }

    code { font-family: var(--font-mono); font-size: 9pt; background: var(--carbon-05); padding: 1px 4px; border-radius: 2px; }

    /* End slide — white background */
    .slide-end { background: var(--spacesuit-white); color: var(--carbon-black); justify-content: center; align-items: center; text-align: center; }
    .slide-end h2 { font-size: 24pt; font-weight: 800; margin-bottom: 8px; color: var(--carbon-black); }
    .slide-end p { font-size: 12pt; color: var(--carbon-50); }
    .slide-end .slide-footer { color: var(--carbon-40); }
  </style>
</head>
<body>

  <!-- Title slide -->
  <section class="slide-title">
    ${slideLogo}
    <div class="title-block">
      <h1>${title}</h1>
      ${subtitle ? `<div class="title-subtitle-box">${subtitle}</div>` : ""}
      <div class="title-meta-box">
        <div class="title-meta-info">
          ${author ? `${author}<br>` : ""}
          ${date}
        </div>
      </div>
    </div>
    ${slideFooter}
  </section>

  ${slideHtml}

  <!-- End slide -->
  <section class="slide-end">
    <div>
      <img src="${logoUri}" alt="mgm" style="width: 80px; margin-bottom: 20px; opacity: 0.3; filter: invert(1);">
      <h2>End of Briefing</h2>
      <p>Questions and discussion</p>
    </div>
    ${slideFooter}
  </section>

</body>
</html>`;
}

// ---- Clay shared CSS vars ----
const clayHead = `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --canvas:        #fffaf0;
      --surface-soft:  #faf5e8;
      --surface-card:  #f5f0e0;
      --ink:           #0a0a0a;
      --body-strong:   #1a1a1a;
      --body:          #3a3a3a;
      --muted:         #6a6a6a;
      --muted-soft:    #9a9a9a;
      --hairline:      #e5e5e5;
      --hairline-soft: #f0f0f0;
      --on-dark:       #ffffff;
      --pink:          #ff4d8b;
      --teal:          #1a3a3a;
      --ochre:         #e8b94a;
      --font:          'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: var(--font); -webkit-font-smoothing: antialiased; background: var(--canvas); margin: 0; padding: 0; }
  </style>`;

// ---- Build slides HTML (Clay theme) ----
function buildSlidesClay() {

  const slideFooter = `<div class="slide-footer">
    <img src="${logoUri}" alt="">
    <span>${title} · ${date}</span>
  </div>`;

  const slideHtml = sections.map((s) => {
    const match = s.match(/<h2[^>]*>(.*?)<\/h2>/);
    const heading = match ? match[1] : "";
    const content = s.replace(/<h2[^>]*>.*?<\/h2>/, "");

    if (s.includes("<pre>")) {
      return `<section class="slide-code">
        <div class="content-overline">${category}</div>
        <h2>${heading}</h2>
        ${content}
        ${slideFooter}
      </section>`;
    }

    return `<section class="slide-content">
      <div class="content-overline">${category}</div>
      <h2>${heading}</h2>
      <div class="content-body">${content}</div>
      ${slideFooter}
    </section>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  ${clayHead}
  <style>
    @page { size: 254mm 142.9mm; margin: 0; }
    body { font-size: 11pt; line-height: 1.55; color: var(--ink); }

    section {
      width: 254mm; height: 142.9mm;
      position: relative; overflow: hidden; page-break-after: always;
      display: flex; flex-direction: column; background: var(--canvas);
    }
    section::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 3px; background: var(--pink); }

    .slide-footer { position: absolute; bottom: 9mm; left: 14mm; right: 14mm; display: flex; justify-content: space-between; align-items: center; font-size: 7pt; font-weight: 600; color: var(--muted-soft); text-transform: uppercase; letter-spacing: 1.2px; }
    .slide-footer img { height: 14px; opacity: 0.3; }

    /* Title slide */
    .slide-title { flex-direction: row; padding: 0; }
    .slide-title .title-bar { width: 6mm; background: var(--pink); flex-shrink: 0; }
    .slide-title .title-inner { flex: 1; padding: 10mm 14mm 18mm 12mm; display: flex; flex-direction: column; justify-content: space-between; }
    .slide-title .title-logo-row { display: flex; align-items: center; gap: 10px; }
    .slide-title .title-logo { height: 20px; }
    .slide-title .title-org { font-size: 8pt; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: var(--muted); }
    .slide-title .title-overline { font-size: 8pt; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: var(--pink); margin-bottom: 6px; }
    .slide-title h1 { font-size: 28pt; font-weight: 500; letter-spacing: -0.8px; line-height: 1.08; color: var(--ink); margin-bottom: 8px; }
    .slide-title .title-subtitle { font-size: 11pt; font-weight: 400; color: var(--muted); line-height: 1.45; }
    .slide-title .title-meta { font-size: 8pt; color: var(--muted); }
    .slide-title .title-meta strong { color: var(--body-strong); font-weight: 600; }

    /* Content slides */
    .slide-content { padding: 10mm 14mm 18mm 14mm; }
    .content-overline { font-size: 7pt; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: var(--pink); margin-bottom: 4px; }
    .slide-content h2 { font-size: 18pt; font-weight: 500; letter-spacing: -0.4px; line-height: 1.2; color: var(--ink); margin-bottom: 6mm; padding-bottom: 4px; border-bottom: 2px solid var(--hairline); }
    .content-body { flex: 1; }
    .slide-content p { font-size: 10.5pt; color: var(--body); line-height: 1.6; margin-bottom: 8px; }
    .slide-content ul { list-style: none; padding: 0; }
    .slide-content ul li { font-size: 10.5pt; color: var(--body); padding: 5px 0 5px 18px; position: relative; border-bottom: 1px solid var(--hairline-soft); line-height: 1.45; }
    .slide-content ul li:last-child { border-bottom: none; }
    .slide-content ul li::before { content: ''; position: absolute; left: 0; top: 12px; width: 7px; height: 7px; background: var(--pink); border-radius: 50%; }
    .slide-content ul li strong { color: var(--ink); font-weight: 600; }
    .slide-content ol { padding-left: 20px; }
    .slide-content ol li { font-size: 10.5pt; color: var(--body); padding: 4px 0; line-height: 1.45; }
    .slide-content ol li::marker { color: var(--pink); font-weight: 700; }
    .slide-content ol li strong { color: var(--ink); font-weight: 600; }

    /* Code slide */
    .slide-code { padding: 10mm 14mm 18mm 14mm; }
    .slide-code .content-overline { font-size: 7pt; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: var(--pink); margin-bottom: 4px; }
    .slide-code h2 { font-size: 16pt; font-weight: 500; letter-spacing: -0.3px; color: var(--ink); margin-bottom: 5mm; }
    .slide-code pre { background: var(--surface-card); border: 1px solid var(--hairline); border-radius: 12px; padding: 12px 16px; font-family: 'SF Mono', 'Fira Code', monospace; font-size: 9pt; line-height: 1.75; color: var(--body); flex: 1; overflow: hidden; }
    .slide-code pre code { background: none; padding: 0; color: inherit; font-size: inherit; }

    /* Callout */
    .callout { border-left: 3px solid var(--pink); background: var(--surface-soft); padding: 8px 12px; border-radius: 0 12px 12px 0; margin: 8px 0; }
    .callout p { font-size: 9.5pt; margin-bottom: 0; color: var(--body); }

    /* Table */
    table { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin: 6px 0; }
    thead th { text-align: left; font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; color: var(--muted); padding: 5px 8px; border-bottom: 2px solid var(--hairline); }
    tbody td { padding: 6px 8px; border-bottom: 1px solid var(--hairline-soft); color: var(--body); }

    code { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 8.5pt; background: var(--surface-card); padding: 1px 5px; border-radius: 6px; }

    .content-body { display: flex; flex-direction: column; }
    .content-body img { flex: 1; max-height: 90mm; width: 100%; object-fit: contain; border-radius: 8px; display: block; }

    /* End slide */
    .slide-end { justify-content: center; align-items: center; text-align: center; }
    .slide-end h2 { font-size: 22pt; font-weight: 500; letter-spacing: -0.5px; color: var(--ink); margin-bottom: 8px; }
    .slide-end p { font-size: 11pt; color: var(--muted); }
  </style>
</head>
<body>

  <section class="slide-title">
    <div class="title-bar"></div>
    <div class="title-inner">
      <div class="title-logo-row">
        <img src="${logoUri}" alt="mgm" class="title-logo">
        <span class="title-org">mgm technology partners</span>
      </div>
      <div>
        <div class="title-overline">${category}</div>
        <h1>${title}</h1>
        ${subtitle ? `<p class="title-subtitle">${subtitle}</p>` : ""}
      </div>
      <div class="title-meta">
        ${author ? `<strong>Presented by:</strong> ${author} &nbsp;·&nbsp; ` : ""}<strong>Date:</strong> ${date}
      </div>
    </div>
    ${slideFooter}
  </section>

  ${slideHtml}

  <section class="slide-end">
    <div>
      <img src="${logoUri}" alt="mgm" style="height: 28px; margin-bottom: 16px; opacity: 0.2;">
      <h2>Thank you</h2>
      <p>Questions and discussion</p>
    </div>
    ${slideFooter}
  </section>

</body>
</html>`;
}

// ---- Build report HTML (Clay theme) ----
function buildReportClay() {

  const tocItems = sections.map((s, i) => {
    const match = s.match(/<h2[^>]*>(.*?)<\/h2>/);
    const label = match ? match[1] : `Section ${i + 1}`;
    return `<li class="toc-item">
      <span class="toc-number">${String(i + 1).padStart(2, "0")}</span>
      <span class="toc-label">${label}</span>
    </li>`;
  }).join("\n");

  const sectionHtml = sections.map((s, i) => {
    return `<div class="report-section">
      <div class="page-header">
        <span>${docId ? docId + " — " : ""}${title}</span>
        <img src="${logoUri}" alt="" class="page-header-logo">
      </div>
      <span class="section-number">${String(i + 1).padStart(2, "0")}</span>
      ${s}
    </div>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  ${clayHead}
  <style>
    @page { size: A4 portrait; margin: 0; }
    body { font-size: 10.5pt; line-height: 1.65; color: var(--body); background: var(--canvas); }

    /* Cover — cream with left pink bar */
    .cover { width: 210mm; height: 297mm; display: flex; flex-direction: row; page-break-after: always; overflow: hidden; }
    .cover-bar { width: 6mm; background: var(--pink); flex-shrink: 0; }
    .cover-inner { flex: 1; display: flex; flex-direction: column; justify-content: space-between; padding: 40mm 30mm; }
    .cover-top { display: flex; align-items: center; gap: 12px; margin-bottom: 48px; }
    .cover-logo { height: 26px; }
    .cover-org { font-size: 9pt; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: var(--muted); }
    .cover-body { flex: 1; display: flex; flex-direction: column; justify-content: center; }
    .cover-category { font-size: 8pt; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: var(--pink); margin-bottom: 12px; }
    .cover-title { font-size: 36pt; font-weight: 500; letter-spacing: -1px; line-height: 1.08; color: var(--ink); margin-bottom: 16px; }
    .cover-subtitle { font-size: 13pt; font-weight: 400; color: var(--muted); max-width: 400px; line-height: 1.5; }
    .cover-footer { display: flex; justify-content: space-between; align-items: flex-end; padding-top: 32px; border-top: 2px solid var(--hairline); }
    .cover-meta { font-size: 8.5pt; color: var(--muted); line-height: 1.8; }
    .cover-meta strong { color: var(--body-strong); font-weight: 600; }

    /* TOC */
    .toc { page-break-after: always; padding: 20mm 25mm 25mm 25mm; }
    .toc-header { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: var(--muted); margin-bottom: 24px; padding-bottom: 8px; border-bottom: 2px solid var(--hairline); }
    .toc-list { list-style: none; }
    .toc-item { display: flex; align-items: baseline; padding: 8px 0; border-bottom: 1px solid var(--hairline-soft); }
    .toc-number { font-size: 9pt; font-weight: 600; color: var(--pink); width: 32px; flex-shrink: 0; }
    .toc-label { flex: 1; font-size: 11pt; font-weight: 500; color: var(--ink); }

    /* Sections */
    .report-section { padding: 20mm 25mm 25mm 25mm; page-break-before: always; }
    .page-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 1px solid var(--hairline); margin-bottom: 24px; font-size: 7.5pt; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: var(--muted-soft); }
    .page-header-logo { height: 16px; opacity: 0.25; }
    .section-number { font-size: 9pt; font-weight: 600; color: var(--pink); display: block; margin-bottom: 4px; }

    /* Typography */
    h1 { font-size: 24pt; font-weight: 500; letter-spacing: -0.6px; line-height: 1.15; margin-bottom: 8px; color: var(--ink); }
    h2 { font-size: 16pt; font-weight: 500; letter-spacing: -0.3px; line-height: 1.25; margin-top: 0; margin-bottom: 10px; color: var(--ink); }
    h3 { font-size: 12pt; font-weight: 600; line-height: 1.35; margin-top: 20px; margin-bottom: 8px; color: var(--body-strong); }
    h4 { font-size: 10.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--muted); margin-top: 16px; margin-bottom: 6px; }
    p { margin-bottom: 10px; color: var(--body); max-width: 75ch; }
    strong { color: var(--body-strong); font-weight: 600; }
    a { color: var(--pink); }

    ul, ol { margin-bottom: 12px; padding-left: 20px; color: var(--body); }
    li { margin-bottom: 4px; }
    li::marker { color: var(--pink); }

    .callout { border-left: 3px solid var(--pink); background: var(--surface-soft); padding: 12px 16px; margin: 16px 0; border-radius: 0 12px 12px 0; }
    .callout p { margin-bottom: 0; font-size: 9.5pt; }

    code { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 9pt; background: var(--surface-card); padding: 1px 5px; border-radius: 6px; }
    pre { background: var(--surface-card); border: 1px solid var(--hairline); color: var(--body); font-family: 'SF Mono', 'Fira Code', monospace; font-size: 8.5pt; line-height: 1.75; padding: 16px 20px; border-radius: 12px; margin: 16px 0; page-break-inside: avoid; }
    pre code { background: none; padding: 0; color: inherit; font-size: inherit; }

    table { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin: 16px 0; page-break-inside: avoid; }
    thead th { text-align: left; font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--muted); padding: 6px 10px; border-bottom: 2px solid var(--hairline); }
    tbody td { padding: 8px 10px; border-bottom: 1px solid var(--hairline-soft); color: var(--body); }

    hr { border: none; border-top: 1px solid var(--hairline); margin: 24px 0; }
    img:not(.cover-logo):not(.page-header-logo) { max-width: 100%; border-radius: 12px; }
  </style>
</head>
<body>

  <div class="cover">
    <div class="cover-bar"></div>
    <div class="cover-inner">
      <div class="cover-top">
        <img src="${logoUri}" alt="mgm" class="cover-logo">
        <span class="cover-org">mgm technology partners</span>
      </div>
      <div class="cover-body">
        <div class="cover-category">${category}</div>
        <h1 class="cover-title">${title}</h1>
        ${subtitle ? `<p class="cover-subtitle">${subtitle}</p>` : ""}
      </div>
      <div class="cover-footer">
        <div class="cover-meta">
          ${docId ? `<strong>Document ID:</strong> ${docId}<br>` : ""}
          ${author ? `<strong>Prepared by:</strong> ${author}` : ""}
        </div>
        <div class="cover-meta" style="text-align: right;">
          <strong>Date:</strong> ${date}<br>
          <strong>Version:</strong> ${version}
        </div>
      </div>
    </div>
  </div>

  <div class="toc">
    <div class="toc-header">Table of Contents</div>
    <ul class="toc-list">${tocItems}</ul>
  </div>

  ${sectionHtml}

</body>
</html>`;
}

// ---- Render PDF ----
async function render() {
  let html;
  if (format === "slides") {
    html = theme === "clay" ? buildSlidesClay() : buildSlides();
  } else {
    html = theme === "clay" ? buildReportClay() : buildReport();
  }

  // Write temp HTML for debugging
  const tmpHtml = path.resolve(__dirname, `.tmp-render-${format}.html`);
  fs.writeFileSync(tmpHtml, html);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--allow-file-access-from-files", "--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  await page.goto(`file://${tmpHtml}`, { waitUntil: "networkidle0" });

  const pdfOptions = {
    path: outputFile,
    printBackground: true,
    preferCSSPageSize: true,
  };

  if (format === "slides") {
    pdfOptions.width = "254mm";
    pdfOptions.height = "142.9mm";
    pdfOptions.landscape = true;
  } else {
    pdfOptions.format = "A4";
  }

  await page.pdf(pdfOptions);
  await browser.close();

  // Clean up temp file
  fs.unlinkSync(tmpHtml);

  console.log(`✓ Rendered ${format} → ${outputFile}`);
}

render().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});