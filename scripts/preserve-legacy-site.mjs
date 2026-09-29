import { cp, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { routeSeoPages } from './route-seo-config.mjs';
import {
  blogIndexPath,
  extractBlogPosts,
  renderBlogIndexPage,
  renderBlogPostPage,
} from './blog-seo-config.mjs';

const project = process.cwd();
const targets = [resolve(project, 'dist/client'), resolve(project, '.vercel/output/static')];
const entries = [
  '.well-known', 'about-us', 'assets', 'blog-on-foreign-languages', 'contact', 'contact-us',
  'exam-calendar', 'foreign-language-faqs', 'handwriting-improvement', 'language-for-professionals',
  'language-quiz', 'learn-arabic', 'learn-calligraphy', 'learn-english', 'learn-foreign-languages',
  'learn-french', 'learn-german', 'learn-hindi-language', 'learn-italian-language', 'learn-japanese',
  'learn-korean-language', 'learn-mandarin-chinese', 'learn-russian-language', 'learn-spanish',
  'learn-thai-language', 'privacy-policy', 'study-abroad-programs', 'whatsapp', '404-custom.html', '404.html', 'blog.html',
  'CNAME', 'index.html', 'llms.txt', 'llms-full.txt', 'robots.txt', 'sitemap.xml',
];

const escapeHtmlAttribute = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('"', '&quot;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const homeRoute = Object.freeze({
  path: '/',
  page: 'home',
  title: 'DIFL Jaipur — Foreign Language Institute Since 1970',
  description: 'Foreign language courses in Jaipur and online since 1970. Learn French, Japanese, German, Spanish, Mandarin, Korean and more with DIFL.',
  image: '/assets/page-banners/about-premium.webp',
});

const topLevelPageIds = Object.freeze([
  'home', 'about', 'all-courses', 'lang', 'programs', 'handwriting', 'calligraphy',
  'testimonials', 'scholarships', 'faq', 'blog', 'professionals', 'contact',
]);

const directPageIds = new Set(topLevelPageIds.filter((id) => id !== 'lang' && id !== 'blog'));
const publicRoutesByPage = new Map([homeRoute, ...routeSeoPages].map((route) => [route.page, route.path]));

function findDivBounds(html, id) {
  const openingPattern = new RegExp(`<div\\b[^>]*\\bid=["']${escapeRegExp(`page-${id}`)}["'][^>]*>`, 'i');
  const opening = openingPattern.exec(html);
  if (!opening) throw new Error(`Could not find #page-${id} in the main page template.`);

  const tagPattern = /<\/?div\b[^>]*>/gi;
  tagPattern.lastIndex = opening.index;
  let depth = 0;
  let tag;
  while ((tag = tagPattern.exec(html))) {
    if (/^<\/div/i.test(tag[0])) depth -= 1;
    else depth += 1;
    if (depth === 0) return { start: opening.index, end: tagPattern.lastIndex };
  }
  throw new Error(`Could not find the closing tag for #page-${id}.`);
}

function staticLanguageBody(route) {
  const cleanTitle = route.title.replace(/\s*\|\s*DIFL(?:\s+Jaipur)?$/i, '');
  const image720 = route.image.replace(/-premium\.webp$/i, '-720.webp');
  const image1200 = route.image.replace(/-premium\.webp$/i, '-1200.webp');
  const image2160 = route.image.replace(/-premium\.webp$/i, '-2160.webp');
  return `<main id="langPageContent">
    <div class="premium-page-banner" role="region" aria-label="${escapeHtmlAttribute(cleanTitle)}">
      <img class="premium-page-banner__media" src="${escapeHtmlAttribute(route.image)}" srcset="${escapeHtmlAttribute(image720)} 720w, ${escapeHtmlAttribute(image1200)} 1200w, ${escapeHtmlAttribute(image2160)} 2160w" sizes="100vw" alt="${escapeHtmlAttribute(cleanTitle)}" width="2400" height="800" loading="eager" fetchpriority="high" decoding="async">
      <div class="premium-page-banner__copy">
        <div class="premium-page-banner__eyebrow">Language Course · Jaipur &amp; Online</div>
        <h1 id="primary-h1" class="premium-page-banner__title">${escapeHtmlAttribute(cleanTitle)}</h1>
        <div class="premium-page-banner__tags"><span>Speaking</span><span>Reading &amp; Writing</span><span>Exam Preparation</span></div>
      </div>
    </div>
    <section style="background:var(--ink)"><div class="sc">
      <div class="eyebrow">Structured Language Learning</div>
      <h2>Learn with <em>DIFL Jaipur</em></h2>
      <p class="lead" style="max-width:760px">${escapeHtmlAttribute(route.description)} Course plans are matched to the learner's current level, goals and preferred online, offline or hybrid format.</p>
      <div class="g3" style="margin-top:34px">
        <div class="fcard"><div class="ficon">🗣️</div><div><h3>Practical Communication</h3><p>Build speaking and listening alongside vocabulary and grammar.</p></div></div>
        <div class="fcard"><div class="ficon">📚</div><div><h3>Structured Progress</h3><p>Develop reading and writing through guided lessons and regular practice.</p></div></div>
        <div class="fcard"><div class="ficon">🎯</div><div><h3>Goal-Based Planning</h3><p>Prepare for a suitable level or examination after an initial assessment.</p></div></div>
      </div>
      <p style="margin-top:34px"><a class="btn-g" href="/contact/" style="text-decoration:none">Ask About Current Batches →</a></p>
    </div></section>
  </main>`;
}

function makeRouteSpecific(html, route) {
  const targetId = directPageIds.has(route.page) ? route.page : 'lang';
  const bounds = topLevelPageIds.map((id) => ({ id, ...findDivBounds(html, id) }));
  for (const block of bounds.filter(({ id }) => id !== targetId).sort((a, b) => b.start - a.start)) {
    html = `${html.slice(0, block.start)}${html.slice(block.end)}`;
  }

  html = html.replace(
    new RegExp(`(<div\\b[^>]*\\bid=["']page-${escapeRegExp(targetId)}["'][^>]*\\bclass=["'])([^"']*)(["'])`, 'i'),
    (_, start, classes, end) => `${start}${classes.replace(/\bactive\b/g, '').trim()} active${end}`,
  );

  if (targetId === 'lang') {
    html = html.replace(/<div id="langPageContent"><\/div>/i, staticLanguageBody(route));
  }

  html = html.replace(
    /(<img\b[^>]*class=["']premium-page-banner__media["'][^>]*?)loading=["']lazy["']\s+fetchpriority=["']low["']/i,
    '$1loading="eager" fetchpriority="high"',
  );

  // Generated pages navigate between full canonical documents instead of depending on hidden SPA bodies.
  html = html.replace(/\s+onclick="navigate\('([^']+)'\);return false"/g, '');
  html = html.replace(/onclick="navigate\('([^']+)'\)"/g, (_, page) => {
    const path = publicRoutesByPage.get(page) || '/';
    return `onclick="window.location.href='${path}'"`;
  });

  return html;
}

function replaceRouteStructuredData(html, route) {
  const canonical = new URL(route.path, 'https://mydifl.com').href;
  const image = new URL(route.image, 'https://mydifl.com').href;
  const webPage = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${canonical}#webpage`,
    name: route.title,
    description: route.description,
    url: canonical,
    image,
    inLanguage: 'en-IN',
    dateModified: '2026-09-30',
    isPartOf: { '@id': 'https://mydifl.com/#website' },
    about: { '@id': 'https://mydifl.com/#organisation' },
  };
  const webPageScript = `<script type="application/ld+json">${JSON.stringify(webPage)}</script>`;
  let replaced = false;
  html = html.replace(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, (block) => {
    if (block.includes('"@type":"WebPage"')) {
      replaced = true;
      return webPageScript;
    }
    if (route.page !== 'home' && route.page !== 'all-courses' && block.includes('"@type":"ItemList"')) return '';
    return block;
  });
  if (!replaced) throw new Error('Could not replace the WebPage structured data.');
  return html;
}

function replaceMeta(html, attribute, key, content) {
  const pattern = new RegExp(
    `<meta\\b(?=[^>]*\\b${attribute}=["']${escapeRegExp(key)}["'])[^>]*>`,
    'i',
  );
  const replacement = `<meta ${attribute}="${escapeHtmlAttribute(key)}" content="${escapeHtmlAttribute(content)}">`;

  if (!pattern.test(html)) {
    throw new Error(`Could not find ${attribute}="${key}" in the main page template.`);
  }

  return html.replace(pattern, replacement);
}

function renderRoutePage(template, route) {
  const canonical = new URL(route.path, 'https://mydifl.com').href;
  const image = new URL(route.image, 'https://mydifl.com').href;
  let html = template;

  html = html.replace(/<html\b([^>]*)>/i, (tag, attributes) => {
    const cleanAttributes = attributes.replace(/\sdata-initial-page=(?:"[^"]*"|'[^']*')/i, '');
    return `<html${cleanAttributes} data-initial-page="${escapeHtmlAttribute(route.page)}">`;
  });
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtmlAttribute(route.title)}</title>`);
  html = replaceMeta(html, 'name', 'description', route.description);
  html = replaceMeta(html, 'property', 'og:title', route.title);
  html = replaceMeta(html, 'property', 'og:description', route.description);
  html = replaceMeta(html, 'property', 'og:url', canonical);
  html = replaceMeta(html, 'property', 'og:image', image);
  html = replaceMeta(html, 'property', 'og:image:alt', `${route.title} — DIFL Jaipur`);
  html = replaceMeta(html, 'name', 'twitter:title', route.title);
  html = replaceMeta(html, 'name', 'twitter:description', route.description);
  html = replaceMeta(html, 'name', 'twitter:image', image);

  const canonicalTag = `<link id="canonical-url" rel="canonical" href="${escapeHtmlAttribute(canonical)}">`;
  const canonicalPattern = /<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/i;
  if (!canonicalPattern.test(html)) {
    throw new Error('Could not find the canonical link in the main page template.');
  }
  html = html.replace(canonicalPattern, canonicalTag);

  html = replaceRouteStructuredData(html, route);
  html = makeRouteSpecific(html, route);

  return html;
}

const mainPageTemplate = await readFile(resolve(project, 'index.html'), 'utf8');
const blogPageTemplate = await readFile(resolve(project, 'blog.html'), 'utf8');
const blogPosts = extractBlogPosts(blogPageTemplate);

await Promise.all(targets.map(async (target) => {
  try { await stat(target); } catch { return; }
  await mkdir(target, { recursive: true });
  await Promise.all(entries.map((entry) => cp(resolve(project, entry), resolve(target, entry), { recursive: true, force: true })));
  await writeFile(resolve(target, 'index.html'), renderRoutePage(mainPageTemplate, homeRoute), 'utf8');

  await Promise.all(routeSeoPages.map(async (route) => {
    const routeDirectory = resolve(target, route.path.replace(/^\/+|\/+$/g, ''));
    await mkdir(routeDirectory, { recursive: true });
    await writeFile(resolve(routeDirectory, 'index.html'), renderRoutePage(mainPageTemplate, route), 'utf8');
  }));

  const blogDirectory = resolve(target, blogIndexPath.replace(/^\/+|\/+$/g, ''));
  await mkdir(blogDirectory, { recursive: true });
  await writeFile(resolve(blogDirectory, 'index.html'), renderBlogIndexPage(blogPageTemplate), 'utf8');

  await Promise.all(blogPosts.map(async (post) => {
    const postDirectory = resolve(blogDirectory, post.id);
    await mkdir(postDirectory, { recursive: true });
    await writeFile(resolve(postDirectory, 'index.html'), renderBlogPostPage(blogPageTemplate, post), 'utf8');
  }));
}));

console.log(`Preserved the existing mydifl.com pages and generated ${routeSeoPages.length} canonical route pages plus ${blogPosts.length} blog article pages alongside the secure portal.`);
