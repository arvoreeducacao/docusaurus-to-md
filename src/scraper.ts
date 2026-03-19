import * as cheerio from "cheerio";
import TurndownService from "turndown";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parseStringPromise } from "./xml.js";

export interface ScrapedPage {
  url: string;
  markdown: string;
  filepath: string;
}

export interface ScrapeResult {
  pages: ScrapedPage[];
  errors: Array<{ url: string; error: string }>;
}

export interface ScrapeOptions {
  baseUrl: string;
  pathPrefix?: string;
  outputDir?: string;
  workers?: number;
  singleFile?: boolean;
  onProgress?: (url: string, success: boolean, error?: string) => void;
}

const NOISE_SELECTORS = [
  "nav",
  "footer",
  "header",
  "script",
  "style",
  ".theme-doc-breadcrumbs",
  ".pagination-nav",
  ".theme-doc-toc-mobile",
  ".theme-doc-toc-desktop",
  ".theme-doc-sidebar-container",
  ".theme-doc-footer",
  "button.clean-btn",
  "aside",
  'a[title^="Direct link"]',
  "a.hash-link",
];

const CONTENT_SELECTORS = ["article", ".theme-doc-markdown", "main"];

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

turndown.remove("img");

function htmlToMarkdown(html: string): string {
  const $ = cheerio.load(html);

  for (const selector of NOISE_SELECTORS) {
    $(selector).remove();
  }

  let contentHtml: string | null = null;
  for (const selector of CONTENT_SELECTORS) {
    const el = $(selector).first();
    if (el.length) {
      contentHtml = el.html();
      break;
    }
  }

  if (!contentHtml) {
    contentHtml = $("body").first().html();
  }

  if (!contentHtml) return "";

  let md = turndown.turndown(contentHtml);
  md = md.replace(/\[​\]\([^)]*\)/g, "");
  md = md.replace(/\n{3,}/g, "\n\n");
  return md.trim();
}

async function fetchSitemapUrls(baseUrl: string): Promise<string[]> {
  const sitemapUrl = `${baseUrl.replace(/\/$/, "")}/sitemap.xml`;
  const response = await fetch(sitemapUrl);
  if (!response.ok) throw new Error(`Failed to fetch sitemap: ${response.status}`);
  const xml = await response.text();
  return parseStringPromise(xml);
}

function filterUrls(urls: string[], pathPrefix: string): string[] {
  return urls.filter((u) => u.includes(pathPrefix));
}

function urlToFilepath(url: string, pathPrefix: string, outputDir: string): string {
  const parsed = new URL(url);
  let path = parsed.pathname.replace(/^\/|\/$/g, "");
  const prefix = pathPrefix.replace(/^\/|\/$/g, "");
  if (prefix) {
    path = path.replace(new RegExp(`^${prefix}/?`), "");
  }
  if (!path) path = "index";
  return join(outputDir, `${path}.md`);
}

async function scrapePage(url: string): Promise<{ url: string; markdown?: string; error?: string }> {
  try {
    const response = await fetch(url);
    if (!response.ok) return { url, error: `HTTP ${response.status}` };
    const html = await response.text();
    const markdown = htmlToMarkdown(html);
    if (!markdown) return { url, error: "no content found" };
    return { url, markdown };
  } catch (e) {
    return { url, error: e instanceof Error ? e.message : String(e) };
  }
}

async function processInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

export async function scrape(options: ScrapeOptions): Promise<ScrapeResult> {
  const {
    baseUrl,
    pathPrefix = "/docs/",
    outputDir = "./output",
    workers = 8,
    singleFile = true,
    onProgress,
  } = options;

  const allUrls = await fetchSitemapUrls(baseUrl);
  const urls = filterUrls(allUrls, pathPrefix);

  if (!urls.length) {
    return { pages: [], errors: [{ url: "sitemap", error: `no URLs matching '${pathPrefix}'` }] };
  }

  await mkdir(outputDir, { recursive: true });

  const pages: ScrapedPage[] = [];
  const errors: Array<{ url: string; error: string }> = [];

  const results = await processInBatches(urls, workers, async (url) => {
    const result = await scrapePage(url);

    if (result.error || !result.markdown) {
      const err = result.error ?? "unknown error";
      errors.push({ url, error: err });
      onProgress?.(url, false, err);
      return null;
    }

    const filepath = urlToFilepath(url, pathPrefix, outputDir);
    await mkdir(dirname(filepath), { recursive: true });
    await writeFile(filepath, result.markdown, "utf-8");

    const page: ScrapedPage = { url, markdown: result.markdown, filepath };
    pages.push(page);
    onProgress?.(url, true);
    return page;
  });

  if (singleFile && pages.length) {
    const sorted = [...pages].sort((a, b) => a.filepath.localeCompare(b.filepath));
    const combined = sorted
      .map((p) => `<!-- source: ${p.url} -->\n\n${p.markdown}`)
      .join("\n\n---\n\n");
    await writeFile(join(outputDir, "_all.md"), combined, "utf-8");
  }

  return { pages, errors };
}
