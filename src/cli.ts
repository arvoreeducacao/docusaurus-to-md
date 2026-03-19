#!/usr/bin/env node
import { parseArgs } from "node:util";
import { scrape } from "./scraper.js";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    "path-prefix": { type: "string", short: "p", default: "/docs/" },
    output: { type: "string", short: "o", default: "./output" },
    workers: { type: "string", short: "w", default: "8" },
    "no-single-file": { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

if (values.help || !positionals.length) {
  console.log(`
Usage: docusaurus-to-md <url> [options]

Options:
  -p, --path-prefix   URL path prefix to filter (default: /docs/)
  -o, --output        Output directory (default: ./output)
  -w, --workers       Parallel workers (default: 8)
  --no-single-file    Skip generating combined _all.md
  -h, --help          Show help
  
Example:
  docusaurus-to-md https://docs.example.com
  docusaurus-to-md https://docs.example.com -p /docs/api/ -o ./api-docs -w 16
`);
  process.exit(values.help ? 0 : 1);
}

const url = positionals[0];

console.log(`Scraping ${url} (prefix: ${values["path-prefix"]})...`);

const result = await scrape({
  baseUrl: url,
  pathPrefix: values["path-prefix"],
  outputDir: values.output,
  workers: parseInt(values.workers ?? "8", 10),
  singleFile: !values["no-single-file"],
  onProgress: (pageUrl, success, error) => {
    if (success) {
      console.log(`  ✓ ${pageUrl}`);
    } else {
      console.error(`  ✗ ${pageUrl} — ${error}`);
    }
  },
});

console.log(`\nDone: ${result.pages.length} pages, ${result.errors.length} errors`);
console.log(`Output: ${values.output}/`);

if (result.errors.length && !result.pages.length) {
  process.exit(1);
}
