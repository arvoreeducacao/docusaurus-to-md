# docusaurus-to-md

Scrape Docusaurus sites and convert all pages to clean Markdown files. Built for generating LLM-ready documentation.

## Quick start

```bash
npx docusaurus-to-md https://docs.example.com
```

## Install

```bash
npm install -g docusaurus-to-md
```

## CLI

```bash
docusaurus-to-md https://docs.example.com
docusaurus-to-md https://docs.example.com -p /docs/api/ -o ./api-docs
docusaurus-to-md https://docs.example.com -w 16
docusaurus-to-md https://docs.example.com --no-single-file
```

## API

```typescript
import { scrape } from "docusaurus-to-md";

const result = await scrape({
  baseUrl: "https://docs.example.com",
  pathPrefix: "/docs/",
  outputDir: "./output",
  workers: 8,
});

console.log(`${result.pages.length} pages scraped`);
```

## How it works

1. Fetches `sitemap.xml` from the Docusaurus site
2. Filters URLs by path prefix
3. Scrapes pages in parallel batches
4. Extracts main content (strips nav, footer, sidebar, TOC)
5. Converts HTML to Markdown via Turndown
6. Saves individual `.md` files + optional combined `_all.md`
