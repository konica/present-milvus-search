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
const outputFile =
    getArg("-o") || `output-${format}.pdf`;

if (!inputFile) {
  console.error("Usage: node render.js input.md --format=report|slides -o output.pdf");
  process.exit(1);
}

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

const htmlContent = marked.parse(body);

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
  <link href="https://fonts.googleapis.com/css2?family=Public+Sans:ital,wght@0,300;0,400;0,600;0,700;0,800;1,400&family=Inter:wght@400;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --carbon-black:    #000000;
      --carbon-90:       #111111;
      --carbon-80:       #1b1b1b;
      --carbon-70:       #2e2e2e;
      --carbon-60:       #58585b;
      --carbon-50:       #757575;
      --carbon-40:       #919191;
      --carbon-30:       #b9b9bb;
      --carbon-20:       #d1d1d1;
      --carbon-10:       #e6e6e6;
      --carbon-05:       #f6f6f6;
      --spacesuit-white: #ffffff;
      --nasa-red:        #FC3D21;
      --nasa-red-dark:   #E03012;
      --blue-vivid:      #1C67E3;
      --blue-bright:     #2491ff;
      --blue-mono:       #288bff;
      --font-primary:    'Public Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      --font-secondary:  'Inter', var(--font-primary);
      --font-mono:       'DM Mono', 'SF Mono', 'Fira Code', monospace;
    }
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
  const logoPath = path.resolve(__dirname, "mgm-logo.svg");
  const logoUri = `file://${logoPath}`;

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

  const sectionHtml = sections
      .map((s, i) => {
        return `<div class="report-section">
        <div class="page-header">
          <span>${docId ? docId + " — " : ""}${title}</span>
          <img src="${logoUri}" alt="" class="page-header-logo">
        </div>
        <span class="section-number">${String(i + 1).padStart(2, "0")}</span>
        ${s}
      </div>`;
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
      background: var(--carbon-black); color: var(--spacesuit-white);
      display: flex; flex-direction: column; justify-content: space-between;
      padding: 40mm 30mm; page-break-after: always; overflow: hidden;
    }
    .cover-stripe { width: 100%; height: 4px; background: var(--nasa-red); margin-bottom: 24px; }
    .cover-top { display: flex; align-items: center; gap: 16px; }
    .cover-logo { width: 60px; }
    .cover-org { font-size: 11pt; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--carbon-30); }
    .cover-body { flex: 1; display: flex; flex-direction: column; justify-content: center; }
    .cover-category { font-family: var(--font-mono); font-size: 9pt; color: var(--nasa-red); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 12px; }
    .cover-title { font-size: 36pt; font-weight: 800; letter-spacing: -0.02em; line-height: 1.1; margin-bottom: 16px; }
    .cover-subtitle { font-size: 14pt; font-weight: 400; color: var(--carbon-30); max-width: 400px; line-height: 1.5; }
    .cover-footer { display: flex; justify-content: space-between; align-items: flex-end; }
    .cover-meta { font-size: 8.5pt; color: var(--carbon-40); line-height: 1.8; }
    .cover-meta strong { color: var(--carbon-20); font-weight: 600; }

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
    pre { background: var(--carbon-black); color: var(--carbon-20); font-family: var(--font-mono); font-size: 8.5pt; line-height: 1.75; padding: 16px 20px; border-radius: 2px; margin: 16px 0; overflow-x: auto; page-break-inside: avoid; }
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
        <img src="${logoUri}" alt="NASA" class="cover-logo">
        <span class="cover-org">National Aeronautics and Space Administration</span>
      </div>
    </div>
    <div class="cover-body">
      <div class="cover-category">${category}</div>
      <h1 class="cover-title">${title}</h1>
      ${subtitle ? `<p class="cover-subtitle">${subtitle}</p>` : ""}
    </div>
    <div class="cover-footer">
      <div class="cover-meta">
        ${docId ? `<strong>Document ID:</strong> ${docId}<br>` : ""}
        <strong>Classification:</strong> Public Release<br>
        ${author ? `<strong>Prepared by:</strong> ${author}` : ""}
      </div>
      <div class="cover-meta" style="text-align: right;">
        <strong>Date:</strong> ${date}<br>
        <strong>Version:</strong> ${version}
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
  const logoPath = path.resolve(__dirname, "mgm-logo.svg");
  const logoUri = `file://${logoPath}`;

  // First section becomes content for the title slide
  // Remaining sections become individual slides
  const slideFooter = `<div class="slide-footer">
    <img src="${logoUri}" alt="">
    <span>${title} · ${date}</span>
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
          <div class="code-overline">${category}</div>
          <h2>${heading}</h2>
          ${content}
          ${slideFooter}
        </section>`;
        }

        // Always white background
        return `<section class="slide-content">
        <div class="content-header">
          <div class="content-overline">${category}</div>
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
    section::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 3px; background: var(--nasa-red); }

    .slide-footer { position: absolute; bottom: 9mm; left: 14mm; right: 14mm; display: flex; justify-content: space-between; align-items: center; font-family: var(--font-mono); font-size: 6.5pt; color: var(--carbon-40); text-transform: uppercase; letter-spacing: 0.06em; }
    .slide-footer img { height: 14px; opacity: 0.45; }

    /* Title slide — white background */
    .slide-title { background: var(--spacesuit-white); color: var(--carbon-black); justify-content: space-between; }
    .slide-title .title-stripe { width: 100%; height: 4px; background: var(--nasa-red); margin-bottom: 16px; }
    .slide-title .title-top { display: flex; align-items: center; gap: 14px; }
    .slide-title .title-logo { width: 48px; }
    .slide-title .title-org { font-size: 9pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--carbon-50); }
    .slide-title .title-body { margin: auto 0; display: flex; flex-direction: column; justify-content: center; }
    .slide-title .title-category { font-family: var(--font-mono); font-size: 9pt; color: var(--nasa-red); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; }
    .slide-title h1 { font-size: 32pt; font-weight: 800; letter-spacing: -0.02em; line-height: 1.1; margin-bottom: 10px; color: var(--carbon-black); }
    .slide-title .title-subtitle { font-size: 12pt; font-weight: 400; color: var(--carbon-60); max-width: 500px; line-height: 1.5; }
    .slide-title .title-meta { font-size: 8pt; color: var(--carbon-50); }
    .slide-title .title-meta strong { color: var(--carbon-70); }
    .slide-title .slide-footer { color: var(--carbon-40); }

    /* Content slides */
    .slide-content { background: var(--spacesuit-white); }
    .content-header { margin-bottom: 16px; }
    .content-overline { font-family: var(--font-mono); font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.1em; color: var(--nasa-red); margin-bottom: 4px; }
    .slide-content h2 { font-size: 20pt; font-weight: 700; letter-spacing: -0.01em; line-height: 1.2; margin: 0; }
    .content-body { flex: 1; }
    .slide-content p { font-size: 11pt; color: var(--carbon-60); line-height: 1.6; margin-bottom: 10px; }
    .slide-content ul { list-style: none; padding: 0; }
    .slide-content ul li { font-size: 11pt; color: var(--carbon-60); padding: 6px 0 6px 18px; position: relative; border-bottom: 1px solid var(--carbon-05); }
    .slide-content ul li::before { content: ''; position: absolute; left: 0; top: 13px; width: 6px; height: 6px; background: var(--nasa-red); border-radius: 50%; }
    .slide-content ul li strong { color: var(--carbon-black); font-weight: 600; }
    .slide-content ol { padding-left: 20px; }
    .slide-content ol li { font-size: 11pt; color: var(--carbon-60); padding: 4px 0; }
    .slide-content ol li::marker { color: var(--nasa-red); font-weight: 700; }

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
    <div>
      <div class="title-stripe"></div>
      <div class="title-top">
        <img src="${logoUri}" alt="mgm" class="title-logo">
        <span class="title-org">mgm technology partners</span>
      </div>
    </div>
    <div class="title-body">
      <div class="title-category">${category}</div>
      <h1>${title}</h1>
      ${subtitle ? `<p class="title-subtitle">${subtitle}</p>` : ""}
    </div>
    <div class="title-meta">
      ${author ? `<strong>Presented by:</strong> ${author} · ` : ""}<strong>Date:</strong> ${date}
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

// ---- Render PDF ----
async function render() {
  const html = format === "slides" ? buildSlides() : buildReport();

  // Write temp HTML for debugging
  const tmpHtml = path.resolve(__dirname, `.tmp-render-${format}.html`);
  fs.writeFileSync(tmpHtml, html);

  const browser = await puppeteer.launch({ headless: true });
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
  // fs.unlinkSync(tmpHtml);

  console.log(`✓ Rendered ${format} → ${outputFile}`);
}

render().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});