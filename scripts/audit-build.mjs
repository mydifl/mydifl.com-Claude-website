import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';

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

const sourceHome = readFileSync(resolve(root, 'index.html'), 'utf8');
const blankNavigation = sourceHome.match(/<a(?![^>]*\bhref=)[^>]*\bonclick=/gi) || [];
if (blankNavigation.length) failures.push(`Homepage contains ${blankNavigation.length} clickable anchors without fallback href links.`);

const tawkLoader = resolve(root, 'assets/tawk-safe.js');
if (!existsSync(tawkLoader)) failures.push('Missing guarded Tawk.to loader.');
else {
  const tawkSource = readFileSync(tawkLoader, 'utf8');
  if (!tawkSource.includes("launcher.id = 'difl-chat-launcher'")) failures.push('Tawk loader is missing the stable DIFL launcher.');
  if (!tawkSource.includes("'#min-widget,#message-preview,#chat-bubble{display:none!important}'")) failures.push('Tawk loader does not suppress unstable preview frames.');
  if (!tawkSource.includes('function loadTawk()')) failures.push('Tawk loader is not using deliberate lazy loading.');
}
for (const path of [
  'index.html',
  'blog.html',
  'exam-calendar/index.html',
  'language-for-professionals/index.html',
  'language-quiz/index.html',
]) {
  const html = readFileSync(resolve(root, path), 'utf8');
  if (!html.includes('/assets/tawk-safe.js')) failures.push(`${path} is missing the guarded Tawk.to loader.`);
  if (html.includes('embed.tawk.to/6a158407')) failures.push(`${path} still embeds Tawk.to directly.`);
}

const builtRoot = resolve(root, 'dist/client');
const builtHtml = [];
const collectHtml = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) collectHtml(path);
    else if (extname(entry.name) === '.html') builtHtml.push(path);
  }
};

if (existsSync(builtRoot)) {
  collectHtml(builtRoot);
  const missingLinks = new Set();
  for (const page of builtHtml) {
    const html = readFileSync(page, 'utf8');
    for (const match of html.matchAll(/(?:href|src)\s*=\s*["']([^"']+)["']/gi)) {
      const raw = match[1].trim();
      if (!raw || raw.startsWith('#') || /^(?:https?:|mailto:|tel:|data:|blob:|javascript:|\/\/)/i.test(raw)) continue;
      const clean = raw.split(/[?#]/)[0];
      if (!clean) continue;
      const target = clean.startsWith('/') ? resolve(builtRoot, `.${clean}`) : resolve(dirname(page), clean);
      if (!existsSync(target) && !existsSync(`${target}.html`) && !existsSync(join(target, 'index.html'))) {
        missingLinks.add(`${relative(builtRoot, page)} -> ${raw}`);
      }
    }
  }
  for (const link of missingLinks) failures.push(`Missing local link or asset: ${link}`);
}

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
