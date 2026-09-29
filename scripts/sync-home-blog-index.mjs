import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildSeoTitle, extractBlogPosts } from './blog-seo-config.mjs';

const project = process.cwd();
const homePath = resolve(project, 'index.html');
const blogPath = resolve(project, 'blog.html');
const startMarker = 'const BLOG_INDEX=';
const nextMarker = 'const LANGS = [';

const [home, blog] = await Promise.all([
  readFile(homePath, 'utf8'),
  readFile(blogPath, 'utf8'),
]);
const start = home.indexOf(startMarker);
const next = home.indexOf(nextMarker, start);
if (start < 0 || next < 0) throw new Error('Could not locate BLOG_INDEX in index.html.');

const listing = extractBlogPosts(blog).map((post) => ({
  id: post.id,
  cat: post.cat,
  lang: post.lang,
  rd: post.rd,
  feat: Boolean(post.feat),
  title: buildSeoTitle(post),
}));
const replacement = `const BLOG_INDEX=${JSON.stringify(listing).replaceAll('<', '\\u003c')};\n`;
const updated = `${home.slice(0, start)}${replacement}${home.slice(next)}`;
if (updated !== home) await writeFile(homePath, updated, 'utf8');

console.log(`Synced ${listing.length} safe blog titles into the home-page index.`);
