import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const failures = [];

for (const path of [
  'dist/client/index.html',
  'dist/client/blog.html',
  'dist/client/sitemap.xml',
  'dist/client/robots.txt',
  '.vercel/output/config.json',
  '.vercel/output/_functions/entry.mjs',
]) {
  if (!existsSync(resolve(root, path))) failures.push(`Missing build artifact: ${path}`);
}

const vercel = readFileSync(resolve(root, 'vercel.json'), 'utf8');
if (vercel.includes("'unsafe-eval'")) failures.push('Global CSP still permits unsafe-eval.');
if (/script-src[^;]*\shttps:\s/.test(vercel)) failures.push('Global CSP permits scripts from every HTTPS origin.');
if (!vercel.includes("object-src 'none'")) failures.push("CSP is missing object-src 'none'.");
if (!vercel.includes('X-Permitted-Cross-Domain-Policies')) failures.push('Cross-domain policy header is missing.');

const sourceBlog = readFileSync(resolve(root, 'blog.html'), 'utf8');
const postCount = (sourceBlog.match(/\{id:"[^"]+"/g) || []).length;
if (postCount !== 50) failures.push(`Expected 50 blog articles, found ${postCount}.`);

const sitemap = readFileSync(resolve(root, 'sitemap.xml'), 'utf8');
for (const slug of [
  'germany-opportunity-card-language-2026',
  'uk-skilled-worker-english-b2-2026',
  'australia-visa-english-tests-2026',
  'quebec-pstq-french-2026',
  'study-france-french-level-2026',
]) {
  if (!sitemap.includes(`blog.html?p=${slug}`)) failures.push(`Sitemap is missing ${slug}.`);
}

const vercelRoutes = readFileSync(resolve(root, '.vercel/output/config.json'), 'utf8');
for (const route of ['^/admin/?$', '^/api/admin/invite/?$', '^/api/admin/template/?$', '^/api/verify/?$', '^/verify/?$']) {
  if (!vercelRoutes.includes(route)) failures.push(`Vercel output is missing route ${route}.`);
}

if (failures.length) {
  console.error('Build audit failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Build audit passed: required artifacts, hardened CSP and ${postCount} blog articles verified.`);
