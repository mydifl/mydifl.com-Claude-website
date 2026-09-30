import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { getTransformedRoutes } from '@vercel/routing-utils';
import { extractBlogPosts } from './blog-seo-config.mjs';
import { routeSeoPages } from './route-seo-config.mjs';

const root = process.cwd();
const failures = [];
const staticMarkup = (html) => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
const findMismatchedHeading = (html) => Array.from(html.matchAll(/<h([1-6])\b[^>]*>[\s\S]*?<\/h([1-6])>/gi))
  .find((heading) => heading[1] !== heading[2]);

for (const path of [
  'dist/client/index.html',
  'dist/client/blog.html',
  'dist/client/sitemap.xml',
  'dist/client/robots.txt',
  'dist/client/llms-full.txt',
  '.vercel/output/config.json',
  '.vercel/output/_functions/entry.mjs',
  'dist/client/privacy-policy/index.html',
  'dist/client/assets/google-consent-v1.js',
  'dist/client/assets/privacy-consent-v1.css',
]) {
  if (!existsSync(resolve(root, path))) failures.push(`Missing build artifact: ${path}`);
}

const vercel = readFileSync(resolve(root, 'vercel.json'), 'utf8');
const vercelConfig = JSON.parse(vercel);
const compiledVercelRoutes = getTransformedRoutes(vercelConfig);
if (compiledVercelRoutes.error) failures.push(`Invalid Vercel routing configuration: ${compiledVercelRoutes.error.message}`);
if (vercelConfig.redirects?.some(({ destination = '' }) => destination.includes('?page='))) {
  failures.push('Vercel still redirects clean public URLs to legacy query-string pages.');
}
const hasLegacyRedirect = (source, key, value, destination) => vercelConfig.redirects?.some((redirect) =>
  redirect.source === source && redirect.destination === destination && redirect.permanent === true &&
  redirect.has?.some((condition) => condition.type === 'query' && condition.key === key && condition.value === value)
);
if (!hasLegacyRedirect('/blog.html', 'p', '(?<post>[a-z0-9-]+)', '/blog/:post/')) {
  failures.push('Vercel is missing the article-level legacy blog redirect.');
}
for (const route of [...routeSeoPages, { page: 'blog', path: '/blog/' }]) {
  if (!hasLegacyRedirect('/', 'page', route.page, route.path)) failures.push(`Vercel is missing the legacy ?page=${route.page} redirect.`);
}
const publicHeaderRule = vercelConfig.headers.find(({ source }) => source === '/(.*)');
const publicCsp = publicHeaderRule?.headers.find(({ key }) => key === 'Content-Security-Policy')?.value || '';
if (vercel.includes("'unsafe-eval'")) failures.push('Global CSP still permits unsafe-eval.');
if (/script-src[^;]*\shttps:\s/.test(vercel)) failures.push('Global CSP permits scripts from every HTTPS origin.');
if (!vercel.includes("object-src 'none'")) failures.push("CSP is missing object-src 'none'.");
if (!vercel.includes('X-Permitted-Cross-Domain-Policies')) failures.push('Cross-domain policy header is missing.');
if (!/style-src[^;]*https:\/\/\*\.tawk\.to/.test(publicCsp)) failures.push('Public CSP does not allow Tawk.to widget styles.');
if (!/font-src[^;]*https:\/\/\*\.tawk\.to/.test(publicCsp)) failures.push('Public CSP does not allow Tawk.to widget fonts.');

const sourceBlog = readFileSync(resolve(root, 'blog.html'), 'utf8');
const blogHeadingMismatch = findMismatchedHeading(sourceBlog);
if (blogHeadingMismatch) failures.push(`Blog contains a mismatched H${blogHeadingMismatch[1]}/H${blogHeadingMismatch[2]} heading pair.`);
const blogPosts = extractBlogPosts(sourceBlog);
const postCount = blogPosts.length;
if (postCount !== 50) failures.push(`Expected 50 blog articles, found ${postCount}.`);

const sourceHome = readFileSync(resolve(root, 'index.html'), 'utf8');
const homeHeadingMismatch = findMismatchedHeading(sourceHome);
if (homeHeadingMismatch) failures.push(`Homepage contains a mismatched H${homeHeadingMismatch[1]}/H${homeHeadingMismatch[2]} heading pair.`);
if (!sourceHome.includes('id="canonical-url"')) failures.push('Homepage canonical link is not available for route-aware updates.');
if (!sourceHome.includes('const PAGE_ROUTES = Object.freeze(')) failures.push('Homepage is missing the clean-route map.');
if (sourceHome.includes('aggregateRating')) failures.push('Homepage still publishes an unverifiable aggregate rating.');
if (!sourceHome.includes('"@id":"https://mydifl.com/#organisation"')) failures.push('Homepage is missing static organisation structured data.');
if (sourceHome.includes('const organisationLd=')) failures.push('Organisation structured data still depends on client-side JavaScript.');
if (sourceHome.includes('★★★★★')) failures.push('Homepage still assigns unsupported five-star ratings to testimonial summaries.');
if (/\b(?:patented TTP|35,000\+|most trusted|oldest)\b/i.test(sourceHome)) failures.push('Homepage still contains an unsupported promotional claim.');
if (/(?:25,000\+|25K\+|5000\+|5,000\+)/i.test(sourceHome)) failures.push('Homepage still contains an unsupported learner-volume claim.');
if (/Chairman,\s*CII/i.test(sourceHome)) failures.push('Homepage still presents an unverified current CII leadership title.');
if (!sourceHome.includes('const TESTIMONIALS = [];')) failures.push('Homepage still renders unsourced written testimonial summaries.');
if (/Merit-based concessions|<span>Merit<\/span>/i.test(sourceHome)) failures.push('Homepage scholarship wording is not aligned with need-based fee support.');
if (/\b(?:full language|workable level|full-scale language)\b/i.test(sourceHome)) failures.push('Homepage still presents fixed-duration language outcome promises.');
if (!sourceHome.includes('not guaranteed proficiency or exam-readiness dates')) failures.push('Language-course duration estimates are missing their outcome disclaimer.');
if (!sourceHome.includes('Protect sensitive documents:')) failures.push('Scholarship page is missing its sensitive-document warning.');
if (sourceHome.includes('Free Proficiency Test')) failures.push('Homepage presents the informal quiz as a proficiency test.');
if (sourceHome.includes('id="cAlumni">0')) failures.push('Homepage renders a zero-value alumni counter.');
if (/Morning 5\s*am/i.test(sourceHome)) failures.push('Homepage promises an unverified early-morning professional batch time.');
const blankNavigation = sourceHome.match(/<a(?![^>]*\bhref=)[^>]*\bonclick=/gi) || [];
if (blankNavigation.length) failures.push(`Homepage contains ${blankNavigation.length} clickable anchors without fallback href links.`);
if (!sourceHome.includes('class="why-difl-section"')) failures.push('Homepage proof section is missing its light-theme contrast guard.');
if (!sourceHome.includes('class="legacy-banner"')) failures.push('Homepage legacy banner is missing its dark-panel contrast guard.');
if (!sourceHome.includes('cultureBannerHTML(lang)')) failures.push('Language pages are missing their cultural banner renderer.');
if (sourceHome.includes('/blog.html') || sourceHome.includes('/?page=')) failures.push('Homepage source still links through a legacy HTML or query-string route.');
if (sourceHome.includes("const open=nl.style.display==='flex'")) failures.push('Homepage still contains the conflicting inline-style mobile menu handler.');
if (sourceHome.includes('TICKER_HTML')) failures.push('Homepage references the undefined TICKER_HTML variable.');
if (!sourceHome.includes("navLinks.querySelectorAll('.dd > span')")) failures.push('Homepage mobile navigation is missing accessible dropdown handling.');
if (sourceHome.includes('div,section,article,aside,main{max-width:100vw;overflow-x:hidden}')) failures.push('Homepage still applies nested overflow containers to every mobile section.');
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
  if (!tawkSource.includes('}, 12000);')) failures.push('Tawk loader does not recover promptly from a stalled third-party load.');
  if (!tawkSource.includes("launcher.setAttribute('aria-expanded'")) failures.push('Tawk launcher is missing its expanded accessibility state.');
  if (tawkSource.includes('wa.me/')) failures.push('Tawk live chat must not redirect visitors to WhatsApp.');
}

const publicTheme = resolve(root, 'assets/light-theme-v3.css');
if (!existsSync(publicTheme)) failures.push('Missing versioned public-site light theme.');
else {
  const themeSource = readFileSync(publicTheme, 'utf8');
  if (!themeSource.includes('color-scheme: light')) failures.push('Public theme must use the restored light colour scheme.');
  if (!themeSource.includes('--difl-bg: #f6f2e8')) failures.push('Public theme is missing its original ivory background.');
}
const mobilePolish = resolve(root, 'assets/mobile-polish-v1.css');
if (!existsSync(mobilePolish)) failures.push('Missing versioned public-site mobile polish layer.');
else {
  const mobileSource = readFileSync(mobilePolish, 'utf8');
  if (!mobileSource.includes('.dates-table td::before')) failures.push('Mobile polish is missing labelled exam-table records.');
  if (!mobileSource.includes('.nav-links.mobile-open .dd.open > .ddm')) failures.push('Mobile polish is missing collapsible navigation dropdowns.');
  if (!mobileSource.includes('.culture-banner')) failures.push('Mobile polish is missing language-banner header clearance.');
}
if (!existsSync(resolve(root, 'assets/mobile-table-labels-v1.js'))) failures.push('Missing mobile exam-table label helper.');
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
  if (!html.includes('/assets/light-theme-v3.css')) failures.push(`${path} is missing the versioned light theme.`);
  if (!html.includes('/assets/mobile-polish-v1.css')) failures.push(`${path} is missing the versioned mobile polish layer.`);
  if (html.includes('/assets/coffee-gold-theme-v1.css')) failures.push(`${path} still references the superseded coffee theme.`);
}

const consentScriptPath = resolve(root, 'assets/google-consent-v1.js');
if (!existsSync(consentScriptPath)) failures.push('Missing privacy-first Google consent loader.');
else {
  const consentSource = readFileSync(consentScriptPath, 'utf8');
  for (const signal of ['ad_storage', 'analytics_storage', 'ad_user_data', 'ad_personalization']) {
    if (!consentSource.includes(signal)) failures.push(`Consent loader is missing ${signal}.`);
  }
  if (!consentSource.includes("'generate_lead'")) failures.push('Consent loader is missing confirmed lead measurement.');
}
for (const path of [
  'index.html',
  'blog.html',
  'exam-calendar/index.html',
  'language-for-professionals/index.html',
  'language-quiz/index.html',
  'about-us/difl-teaching-method/index.html',
  'privacy-policy/index.html',
]) {
  const html = readFileSync(resolve(root, path), 'utf8');
  if (!html.includes('/assets/google-consent-v1.js')) failures.push(`${path} is missing privacy-first Google measurement consent.`);
  if (/googletagmanager\.com\/gtag\/js/i.test(html)) failures.push(`${path} loads Google measurement before the consent controller.`);
}
const privacyPage = readFileSync(resolve(root, 'privacy-policy/index.html'), 'utf8');
if (!privacyPage.includes('data-difl-consent-open')) failures.push('Privacy page is missing the cookie-settings control.');
if (!privacyPage.includes('30 September 2026')) failures.push('Privacy page is missing its review date.');
if (!privacyPage.includes('id="scholarship-data"')) failures.push('Privacy page is missing scholarship-document handling details.');
for (const path of ['content/difl-teaching-method.txt', 'scripts/generate-teaching-method.mjs', 'language-quiz/index.html', 'llms.txt', 'llms-full.txt']) {
  const source = readFileSync(resolve(root, path), 'utf8');
  if (/(?:25,000\+|25,000 learners|25,000 से अधिक)/i.test(source)) failures.push(`${path} still contains an unsupported learner-volume claim.`);
}
const teachingMethodSource = readFileSync(resolve(root, 'content/difl-teaching-method.txt'), 'utf8');
for (const word of ['शामिल', 'उच्चारण']) {
  if (!teachingMethodSource.includes(word)) failures.push(`Hindi teaching-method source is missing the rendering-check word: ${word}`);
}
const builtVerifyPage = resolve(root, 'dist/client/verify/index.html');
if (existsSync(builtVerifyPage)) {
  const verifyHtml = readFileSync(builtVerifyPage, 'utf8');
  if (!/name="robots" content="noindex, nofollow, noarchive"/.test(verifyHtml)) failures.push('Certificate verification page is indexable.');
  if (!verifyHtml.includes('rel="canonical" href="https://mydifl.com/verify/"')) failures.push('Certificate verification page is missing its token-free canonical URL.');
} else {
  const chunksDirectory = resolve(root, '.vercel/output/_functions/chunks');
  const serverChunks = existsSync(chunksDirectory)
    ? readdirSync(chunksDirectory).filter((name) => name.endsWith('.mjs')).map((name) => readFileSync(join(chunksDirectory, name), 'utf8')).join('\n')
    : '';
  if (!serverChunks.includes('noindex, nofollow, noarchive')) failures.push('Server-rendered certificate verification page is indexable.');
  if (!serverChunks.includes('https://mydifl.com/verify/')) failures.push('Server-rendered certificate verification page is missing its token-free canonical URL.');
}
const professionalsPage = readFileSync(resolve(root, 'language-for-professionals/index.html'), 'utf8');
if (/Googlebot|bingbot|navigator\.userAgent/i.test(professionalsPage)) failures.push('Professionals page still contains crawler-specific rendering.');
if (/DELF A1[–-]C2|Morning 5\s*am/i.test(professionalsPage)) failures.push('Professionals page still contains an inaccurate exam range or unverified batch-time promise.');
for (const path of ['index.html', 'blog.html', 'exam-calendar/index.html', 'language-quiz/index.html']) {
  const html = readFileSync(resolve(root, path), 'utf8');
  const bannerIndex = html.indexOf('/assets/premium-page-banners.css');
  const themeIndex = html.indexOf('/assets/light-theme-v3.css');
  const mobileIndex = html.indexOf('/assets/mobile-polish-v1.css');
  if (bannerIndex !== -1 && bannerIndex > themeIndex) failures.push(`${path} loads its banner stylesheet after the light theme.`);
  if (mobileIndex !== -1 && mobileIndex < themeIndex) failures.push(`${path} loads mobile polish before the light theme.`);
}
const sourceExamCalendar = readFileSync(resolve(root, 'exam-calendar/index.html'), 'utf8');
if (!sourceExamCalendar.includes('/assets/mobile-table-labels-v1.js')) failures.push('Exam calendar is missing its mobile table label helper.');
if (!sourceExamCalendar.includes('not an official live calendar')) failures.push('Exam calendar is missing its official-source accuracy warning.');
for (const staleClaim of [
  'Rajasthan\'s most experienced',
  'India Exam Centers (8 Cities)',
  'June 2026 & December 2026',
  'EPS-TOPIK 2025 Complete Guide for Indian Applicants',
  '5A · 5 · 4 · 3 · 2 · 1',
  'Alternative to JLPT',
  '+91-11-4610-9800',
  '+91-11-2373-5413',
  '+91-11-2687-8761',
]) {
  if (sourceExamCalendar.includes(staleClaim)) failures.push(`Exam calendar still contains stale or unsupported copy: ${staleClaim}`);
}
for (const staleBlogClaim of [
  'headline: post.title',
  'MEXT Erasmus scholarships',
  'German trains target 99.9%',
  'world\'s highest recycling rate',
  'There are no school janitors',
  '25,000+ alumni',
  '25,000+ students',
  'http://www.mosai.org',
  'http://www.abkdosokai.org',
  'http://www.jaltap.org',
]) {
  if (sourceBlog.includes(staleBlogClaim)) failures.push(`Blog still contains stale or unsupported copy: ${staleBlogClaim}`);
}
for (const datedGuideClaim of [
  'JLPT 2025-26 Complete Guide',
  'DELF & DALF 2025-26 Complete Guide',
  'HSK 2025 Complete Guide',
  'TOPIK 2025 Complete Guide',
  'Verified India Centers',
]) {
  if (sourceBlog.includes(datedGuideClaim)) failures.push(`Blog still markets an archived guide as current: ${datedGuideClaim}`);
}
if (!sourceBlog.includes('class="blog-site"')) failures.push('Blog is missing the mobile navigation scope class.');
if (sourceBlog.includes('kwHtml=post.kw?')) failures.push('Blog runtime still manufactures a duplicate keyword-chip block.');
if (sourceBlog.includes('font-awesome/6.5.0/css/all.min.css') && !sourceBlog.includes('LpBERwTkw==')) {
  failures.push('Blog Font Awesome stylesheet has an invalid integrity digest.');
}
const languageQuizPage = readFileSync(resolve(root, 'language-quiz/index.html'), 'utf8');
if (languageQuizPage.includes('Free Proficiency Test')) failures.push('Language quiz presents an informal result as a proficiency test.');
const hiddenPriorityBanners = sourceHome.match(/premium-page-banner__media[^>]*fetchpriority="high"/g) || [];
if (hiddenPriorityBanners.length) failures.push(`Homepage still eagerly prioritises ${hiddenPriorityBanners.length} hidden page banners.`);
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
for (const path of ['dist/client/index.html', 'dist/client/blog.html', 'dist/client/llms.txt', 'dist/client/llms-full.txt', '.vercel/output/static/index.html', '.vercel/output/static/blog.html', '.vercel/output/static/llms.txt', '.vercel/output/static/llms-full.txt']) {
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
      if (raw.includes('${')) continue;
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
if (/[?&](?:page|p)=/i.test(sitemap)) failures.push('Sitemap still contains legacy query-string URLs.');
if (!sitemap.includes('<loc>https://mydifl.com/privacy-policy/</loc>')) failures.push('Sitemap is missing the privacy policy.');
const sitemapUrls = Array.from(sitemap.matchAll(/<loc>([^<]+)<\/loc>/g), (match) => match[1]);
const expectedSitemapCount = 1 + routeSeoPages.length + 4 + 1 + postCount;
if (sitemapUrls.length !== expectedSitemapCount) failures.push(`Expected ${expectedSitemapCount} canonical sitemap URLs, found ${sitemapUrls.length}.`);
if (new Set(sitemapUrls).size !== sitemapUrls.length) failures.push('Sitemap contains duplicate URLs.');
for (const path of ['sitemap.xml', 'robots.txt', 'blog.html', 'llms-full.txt']) {
  const source = readFileSync(resolve(root, path), 'utf8');
  const built = readFileSync(resolve(builtRoot, path), 'utf8');
  if (source !== built) failures.push(`${path} in the production build is stale.`);
}
const builtHome = readFileSync(resolve(builtRoot, 'index.html'), 'utf8');
if (!builtHome.includes('dateModified":"2026-09-30"')) failures.push('Generated homepage structured data is stale.');
if ((staticMarkup(builtHome).match(/<h1\b/gi) || []).length !== 1) failures.push('Generated homepage must contain exactly one H1.');
if (!staticMarkup(builtHome).includes('You Already Have Wings.<br><em>We Teach You How to Fly.</em>')) failures.push('Generated homepage is missing the approved creative H1.');
const searchTitles = new Map();
const rememberSearchTitle = (path, html) => {
  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.replace(/&amp;/g, '&').trim() || '';
  const descriptionTag = html.match(/<meta\b(?=[^>]*\bname=["']description["'])[^>]*>/i)?.[0] || '';
  const description = descriptionTag.match(/\bcontent=(["'])([\s\S]*?)\1/i)?.[2]?.trim() || '';
  if (title.length < 20 || title.length > 65) failures.push(`${path} has a search title outside the 20–65 character QA range (${title.length}).`);
  if (description.length < 70 || description.length > 160) failures.push(`${path} has a meta description outside the 70–160 character QA range (${description.length}).`);
  if (searchTitles.has(title)) failures.push(`${path} duplicates the search title used by ${searchTitles.get(title)}.`);
  else searchTitles.set(title, path);
};
rememberSearchTitle('/', builtHome);
for (const route of routeSeoPages) {
  if (!sitemap.includes(`<loc>https://mydifl.com${route.path}</loc>`)) failures.push(`Sitemap is missing ${route.path}.`);
  const builtRoute = resolve(builtRoot, route.path.replace(/^\/+|\/+$/g, ''), 'index.html');
  if (!existsSync(builtRoute)) {
    failures.push(`Missing generated route page: ${route.path}`);
    continue;
  }
  const html = readFileSync(builtRoute, 'utf8');
  rememberSearchTitle(route.path, html);
  if (!html.includes(`data-initial-page="${route.page}"`)) failures.push(`${route.path} is missing its initial page marker.`);
  const escapedTitle = route.title.replaceAll('&', '&amp;');
  if (!html.includes(`<title>${escapedTitle}</title>`)) failures.push(`${route.path} is missing its unique title.`);
  if (!html.includes(`href="https://mydifl.com${route.path}"`)) failures.push(`${route.path} is missing its canonical URL.`);
  const routeMarkup = staticMarkup(html);
  if ((routeMarkup.match(/<h1\b/gi) || []).length !== 1) failures.push(`${route.path} must contain exactly one static H1.`);
  if (route.heading && !routeMarkup.includes(`>${route.heading}</h1>`)) failures.push(`${route.path} is missing its approved creative language heading.`);
  if ((routeMarkup.match(/id=["']page-[^"']+["']/gi) || []).length !== 1) failures.push(`${route.path} still contains hidden SPA page bodies.`);
  if (!html.includes(`"url":"https://mydifl.com${route.path}"`)) failures.push(`${route.path} has contradictory WebPage structured data.`);
  if (html.includes('/blog.html') || html.includes('/?page=')) failures.push(`${route.path} still links through a legacy route.`);
}
const standaloneCreativeHeadings = new Map([
  ['/language-quiz/', 'Discover What You <em>Already Know</em>'],
  ['/exam-calendar/', 'Every Goal Begins with <em>a Clear Plan</em>'],
]);
for (const path of [
  '/privacy-policy/',
  '/language-quiz/',
  '/about-us/difl-teaching-method/',
  '/exam-calendar/',
]) {
  const htmlPath = resolve(builtRoot, path.replace(/^\/+|\/+$/g, ''), 'index.html');
  if (!existsSync(htmlPath)) {
    failures.push(`Missing standalone page: ${path}`);
    continue;
  }
  const html = readFileSync(htmlPath, 'utf8');
  rememberSearchTitle(path, html);
  if (!html.includes(`href="https://mydifl.com${path}"`)) failures.push(`${path} is missing its canonical URL.`);
  const standaloneMarkup = staticMarkup(html);
  if ((standaloneMarkup.match(/<h1\b/gi) || []).length !== 1) failures.push(`${path} must contain exactly one static H1.`);
  const creativeHeading = standaloneCreativeHeadings.get(path);
  if (creativeHeading && !standaloneMarkup.includes(creativeHeading)) failures.push(`${path} is missing its approved creative H1.`);
}
for (const post of blogPosts) {
  const path = `/blog/${post.id}/`;
  if (!sitemap.includes(`<loc>https://mydifl.com${path}</loc>`)) failures.push(`Sitemap is missing ${path}.`);
  const builtPost = resolve(builtRoot, 'blog', post.id, 'index.html');
  if (!existsSync(builtPost)) {
    failures.push(`Missing generated blog article: ${path}`);
    continue;
  }
  const html = readFileSync(builtPost, 'utf8');
  rememberSearchTitle(path, html);
  if (!html.includes(`data-initial-post="${post.id}"`)) failures.push(`${path} is missing its initial article marker.`);
  if (!html.includes(`href="https://mydifl.com${path}"`)) failures.push(`${path} is missing its canonical URL.`);
  if ((staticMarkup(html).match(/<h1\b/gi) || []).length !== 1) failures.push(`${path} must contain exactly one static H1.`);
  if (!html.includes('"@type":"BlogPosting"')) failures.push(`${path} is missing BlogPosting structured data.`);
  if ((staticMarkup(html).match(/class=["']kw["']/gi) || []).length > 1) failures.push(`${path} contains duplicate visible keyword-chip blocks.`);
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
