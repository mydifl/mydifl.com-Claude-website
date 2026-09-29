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
const vercelConfig = JSON.parse(vercel);
const publicHeaderRule = vercelConfig.headers.find(({ source }) => source === '/(.*)');
const publicCsp = publicHeaderRule?.headers.find(({ key }) => key === 'Content-Security-Policy')?.value || '';
if (vercel.includes("'unsafe-eval'")) failures.push('Global CSP still permits unsafe-eval.');
if (/script-src[^;]*\shttps:\s/.test(vercel)) failures.push('Global CSP permits scripts from every HTTPS origin.');
if (!vercel.includes("object-src 'none'")) failures.push("CSP is missing object-src 'none'.");
if (!vercel.includes('X-Permitted-Cross-Domain-Policies')) failures.push('Cross-domain policy header is missing.');
if (!/style-src[^;]*https:\/\/\*\.tawk\.to/.test(publicCsp)) failures.push('Public CSP does not allow Tawk.to widget styles.');
if (!/font-src[^;]*https:\/\/\*\.tawk\.to/.test(publicCsp)) failures.push('Public CSP does not allow Tawk.to widget fonts.');

const sourceBlog = readFileSync(resolve(root, 'blog.html'), 'utf8');
const postCount = (sourceBlog.match(/\{id:"[^"]+"/g) || []).length;
if (postCount !== 50) failures.push(`Expected 50 blog articles, found ${postCount}.`);

const sourceHome = readFileSync(resolve(root, 'index.html'), 'utf8');
const blankNavigation = sourceHome.match(/<a(?![^>]*\bhref=)[^>]*\bonclick=/gi) || [];
if (blankNavigation.length) failures.push(`Homepage contains ${blankNavigation.length} clickable anchors without fallback href links.`);
if (!sourceHome.includes('class="why-difl-section"')) failures.push('Homepage proof section is missing its light-theme contrast guard.');
if (!sourceHome.includes('class="legacy-banner"')) failures.push('Homepage legacy banner is missing its dark-panel contrast guard.');
if (!sourceHome.includes('cultureBannerHTML(lang)')) failures.push('Language pages are missing their cultural banner renderer.');
for (const language of ['french','japanese','german','spanish','chinese','arabic','korean','italian','russian','english','thai','hindi']) {
  if (!sourceHome.includes(`  ${language}:{greeting:`)) failures.push(`Cultural banner metadata is missing for ${language}.`);
  if (!existsSync(resolve(root, `assets/language-banners/${language}-premium.webp`))) failures.push(`Premium cultural artwork is missing for ${language}.`);
}

const tawkLoader = resolve(root, 'assets/tawk-safe-v4.js');
if (!existsSync(tawkLoader)) failures.push('Missing guarded Tawk.to loader.');
else {
  const tawkSource = readFileSync(tawkLoader, 'utf8');
  if (!tawkSource.includes("launcher.id = 'difl-chat-launcher'")) failures.push('Tawk loader is missing the stable DIFL launcher.');
  if (!tawkSource.includes("'#min-widget,#message-preview,#chat-bubble{display:none!important}'")) failures.push('Tawk loader does not suppress unstable preview frames.');
  if (!tawkSource.includes('function loadTawk()')) failures.push('Tawk loader is not using deliberate lazy loading.');
  if (!tawkSource.includes('function positionTawkFrames()')) failures.push('Tawk loader is missing the left-side panel layout guard.');
  if (!tawkSource.includes('function requestClose()')) failures.push('Tawk loader is missing its independent close control.');
  if (!tawkSource.includes('body.difl-tawk-open #difl-chat-launcher{opacity:1!important')) failures.push('Tawk close control is hidden while the panel is open.');
  if (!tawkSource.includes('Math.min(310') || !tawkSource.includes('Math.min(300')) failures.push('Tawk panel is missing its compact responsive width caps.');
  if (!tawkSource.includes("launcher.setAttribute('aria-expanded'")) failures.push('Tawk launcher is missing its expanded accessibility state.');
  if (tawkSource.includes('wa.me/')) failures.push('Tawk live chat must not redirect visitors to WhatsApp.');
}

const publicTheme = resolve(root, 'assets/coffee-gold-theme-v1.css');
if (!existsSync(publicTheme)) failures.push('Missing versioned public-site coffee-and-gold theme.');
else {
  const themeSource = readFileSync(publicTheme, 'utf8');
  if (!themeSource.includes('#difl-chat-launcher') || !themeSource.includes('.wa-float')) failures.push('Coffee-and-gold theme does not style both support launchers.');
  if (!themeSource.includes('body.difl-tawk-open iframe[title="Chat widget"]')) failures.push('Coffee-and-gold theme is missing the open Tawk panel colour treatment.');
  if (/#0a5c6e|#0e7d96|rgba\(10,\s*92,\s*110/i.test(themeSource)) failures.push('Coffee-and-gold theme still contains a decorative teal colour.');
}
for (const logo of ['assets/difl-logo-mark.png', 'assets/difl-logo-clean.png']) {
  if (!existsSync(resolve(root, logo))) failures.push(`Missing transparent brand asset: ${logo}.`);
}
if (!sourceHome.includes('/assets/difl-logo-mark.png')) failures.push('Homepage header is not using the transparent DIFL mark.');
if (!sourceHome.includes('/assets/difl-logo-clean.png')) failures.push('Homepage footer is not using the complete transparent DIFL logo.');
for (const path of [
  'index.html',
  'blog.html',
  'exam-calendar/index.html',
  'language-for-professionals/index.html',
  'language-quiz/index.html',
  'about-us/difl-teaching-method/index.html',
  '404.html',
  '404-custom.html',
]) {
  const html = readFileSync(resolve(root, path), 'utf8');
  if (!html.includes('/assets/coffee-gold-theme-v1.css')) failures.push(`${path} is missing the versioned coffee-and-gold theme.`);
  if (/\/assets\/light-theme(?:-v[23])?\.css/.test(html)) failures.push(`${path} still references a superseded public theme.`);
}
for (const path of ['index.html', 'blog.html', 'exam-calendar/index.html', 'language-quiz/index.html']) {
  const html = readFileSync(resolve(root, path), 'utf8');
  const bannerIndex = html.indexOf('/assets/premium-page-banners.css');
  const themeIndex = html.indexOf('/assets/coffee-gold-theme-v1.css');
  if (bannerIndex !== -1 && bannerIndex > themeIndex) failures.push(`${path} loads its banner stylesheet after the coffee-and-gold theme.`);
}
for (const path of ['contact-us/index.html', 'whatsapp/index.html']) {
  const html = readFileSync(resolve(root, path), 'utf8');
  if (/#25d366|#1ebe5d|#22c55e|#86efac/i.test(html)) failures.push(`${path} still contains a visible green interface colour.`);
  if (!/#e2bd65|#efcf7a/i.test(html)) failures.push(`${path} is missing the coffee-and-gold standalone treatment.`);
}
for (const path of [
  'index.html',
  'blog.html',
  'exam-calendar/index.html',
  'language-for-professionals/index.html',
  'language-quiz/index.html',
]) {
  const html = readFileSync(resolve(root, path), 'utf8');
  if (!html.includes('/assets/tawk-safe-v4.js?compact=1')) failures.push(`${path} is missing the compact guarded Tawk.to loader.`);
  if (/\/assets\/tawk-safe(?:-v[23])?\.js/.test(html)) failures.push(`${path} still references a superseded Tawk loader.`);
  if (html.includes('embed.tawk.to/6a158407')) failures.push(`${path} still embeds Tawk.to directly.`);
}

const forbiddenPortalDomain = /\b(?:www\.)?mydifl\.(?:in|inf)\b/i;
const portalSourceExtensions = new Set(['.astro', '.css', '.html', '.js', '.json', '.md', '.mjs', '.ts', '.txt', '.xml', '.yaml', '.yml']);
const portalScanIgnoredDirectories = new Set(['.git', '.vercel', 'dist', 'node_modules']);
const scanPortalDomains = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && portalScanIgnoredDirectories.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      scanPortalDomains(path);
      continue;
    }
    if (!portalSourceExtensions.has(extname(entry.name).toLowerCase())) continue;
    if (forbiddenPortalDomain.test(readFileSync(path, 'utf8'))) {
      failures.push(`Superseded Smart Portal domain remains in ${relative(root, path)}.`);
    }
  }
};
scanPortalDomains(root);
for (const path of ['index.html', 'blog.html', 'llms.txt', 'llms-full.txt']) {
  const source = readFileSync(resolve(root, path), 'utf8');
  if (!source.includes('mybhasha.com')) failures.push(`${path} is missing the correct mybhasha.com Smart Portal reference.`);
}
const scanBuiltPortalDomains = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      scanBuiltPortalDomains(path);
      continue;
    }
    if (!portalSourceExtensions.has(extname(entry.name).toLowerCase())) continue;
    if (forbiddenPortalDomain.test(readFileSync(path, 'utf8'))) {
      failures.push(`Superseded Smart Portal domain remains in built artifact ${relative(root, path)}.`);
    }
  }
};
for (const path of ['dist/client', '.vercel/output/static']) {
  const directory = resolve(root, path);
  if (existsSync(directory)) scanBuiltPortalDomains(directory);
}
for (const path of ['dist/client/index.html', 'dist/client/blog.html', 'dist/client/llms.txt', '.vercel/output/static/index.html', '.vercel/output/static/blog.html', '.vercel/output/static/llms.txt']) {
  if (existsSync(resolve(root, path)) && !readFileSync(resolve(root, path), 'utf8').includes('mybhasha.com')) {
    failures.push(`${path} is missing the correct built Smart Portal reference.`);
  }
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
