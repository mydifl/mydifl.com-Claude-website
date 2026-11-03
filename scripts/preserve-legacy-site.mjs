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

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

const targetLanguagePages = new Set(['french', 'german', 'japanese', 'spanish', 'italian', 'italian-hindi']);

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
  const displayHeading = route.heading || cleanTitle;
  const image720 = route.image.replace(/-premium\.webp$/i, '-720.webp');
  const image1200 = route.image.replace(/-premium\.webp$/i, '-1200.webp');
  const image2160 = route.image.replace(/-premium\.webp$/i, '-2160.webp');
  const detail = route.seo;
  const examList = detail?.exams || ['International proficiency examinations'];
  const syllabus = detail?.syllabus || [
    'Practical speaking and listening',
    'Structured reading and writing practice',
    'A level plan matched to the learner’s goal',
  ];
  const faq = detail?.faq || [];
  const related = detail?.links || [['Browse all language courses', '/learn-foreign-languages/']];
  return `<main id="langPageContent">
    <div class="premium-page-banner" role="region" aria-label="${escapeHtmlAttribute(cleanTitle)}">
      <img class="premium-page-banner__media" src="${escapeHtmlAttribute(route.image)}" srcset="${escapeHtmlAttribute(image720)} 720w, ${escapeHtmlAttribute(image1200)} 1200w, ${escapeHtmlAttribute(image2160)} 2160w" sizes="100vw" alt="${escapeHtmlAttribute(cleanTitle)}" width="2400" height="800" loading="eager" fetchpriority="high" decoding="async">
      <div class="premium-page-banner__copy">
        <div class="premium-page-banner__eyebrow">Language Course · Jaipur &amp; Online</div>
        <h1 id="primary-h1" class="premium-page-banner__title">${escapeHtmlAttribute(displayHeading)}</h1>
        <div class="premium-page-banner__tags"><span>Speaking</span><span>Reading &amp; Writing</span><span>Exam Preparation</span></div>
      </div>
    </div>
    <section style="background:var(--ink)"><div class="sc">
      <div class="eyebrow">Structured Language Learning</div>
      <h2>${escapeHtml(displayHeading)} <em>Classes in Jaipur &amp; Online</em></h2>
      <p class="lead" style="max-width:800px">${escapeHtml(detail?.intro || route.description)} Course plans are matched to the learner's current level, goals and preferred online, offline or hybrid format.</p>
      <div class="g3" style="margin-top:34px">
        <div class="fcard"><div class="ficon">🗣️</div><div><h3>Practical Communication</h3><p>Speaking and listening are developed alongside vocabulary and grammar from the early stages.</p></div></div>
        <div class="fcard"><div class="ficon">🧠</div><div><h3>ATMA–TTP Approach</h3><p>DIFL’s Absolute Topic Mastery Approach and Thought Translation Process use guided practice to move learners from understanding toward original expression.</p></div></div>
        <div class="fcard"><div class="ficon">🎯</div><div><h3>Goal-Based Planning</h3><p>Prepare for a suitable level or examination after an initial assessment; outcomes depend on each learner’s practice and the official exam body.</p></div></div>
      </div>
      <div class="g2" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:26px;margin-top:44px">
        <div class="course-box" style="margin-top:0"><h3>What You Will Practise</h3><ul style="margin:0;padding-left:19px;color:var(--cream);line-height:1.8">${syllabus.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>
        <div class="course-box" style="margin-top:0"><h3>Certification &amp; Exam Preparation</h3><p style="color:var(--cream);line-height:1.75;margin:0 0 12px">Preparation can be included for an exam that fits your goal:</p><p style="color:var(--gold);line-height:1.8;margin:0"><strong>${examList.map(escapeHtml).join(' · ')}</strong></p><p style="font-size:13px;color:var(--gm);line-height:1.65;margin:15px 0 0">Exam dates, eligibility, registration and results are controlled by the respective official body and should be verified before applying.</p></div>
      </div>
      ${faq.length ? `<section aria-labelledby="course-faq-heading" style="margin-top:48px"><div class="eyebrow">Course FAQs</div><h2 id="course-faq-heading">Questions About ${escapeHtml(displayHeading)}</h2><div style="display:grid;gap:14px;max-width:900px">${faq.map(([question, answer]) => `<article class="fcard" style="display:block"><h3 style="margin-bottom:8px">${escapeHtml(question)}</h3><p style="margin:0">${escapeHtml(answer)}</p></article>`).join('')}</div></section>` : ''}
      <nav aria-label="Related DIFL pages" style="margin-top:34px;display:flex;gap:12px;flex-wrap:wrap">${related.map(([label, href]) => `<a href="${escapeHtmlAttribute(href)}" class="btn-o" style="text-decoration:none">${escapeHtml(label)} →</a>`).join('')}</nav>
      <p style="margin-top:34px"><a class="btn-g" href="/contact/" style="text-decoration:none">Ask About Current Batches →</a></p>
    </div></section>
  </main>`;
}

function staticHindiItalianBody(route) {
  const image720 = route.image.replace(/-premium\.webp$/i, '-720.webp');
  const image1200 = route.image.replace(/-premium\.webp$/i, '-1200.webp');
  const image2160 = route.image.replace(/-premium\.webp$/i, '-2160.webp');
  const detail = route.seo;
  return `<main id="langPageContent" lang="hi">
    <div class="premium-page-banner" role="region" aria-label="${escapeHtmlAttribute(route.heading)}">
      <img class="premium-page-banner__media" src="${escapeHtmlAttribute(route.image)}" srcset="${escapeHtmlAttribute(image720)} 720w, ${escapeHtmlAttribute(image1200)} 1200w, ${escapeHtmlAttribute(image2160)} 2160w" sizes="100vw" alt="DIFL इटैलियन भाषा कोर्स" width="2400" height="800" loading="eager" fetchpriority="high" decoding="async">
      <div class="premium-page-banner__copy">
        <div class="premium-page-banner__eyebrow">इटैलियन भाषा · जयपुर और ऑनलाइन</div>
        <h1 id="primary-h1" class="premium-page-banner__title">${escapeHtml(route.heading)}</h1>
        <div class="premium-page-banner__tags"><span>बोलना</span><span>पढ़ना और लिखना</span><span>परीक्षा तैयारी</span></div>
      </div>
    </div>
    <section style="background:var(--ink)"><div class="sc">
      <div class="eyebrow">DIFL · 55 वर्षों की भाषा-शिक्षण परंपरा</div>
      <h2>इटैलियन <em>सीखना शुरू करें</em></h2>
      <p class="lead" style="max-width:820px">${escapeHtml(detail.intro)} ऑनलाइन, ऑफलाइन और हाइब्रिड विकल्प वर्तमान बैच उपलब्धता के अनुसार बताए जाते हैं।</p>
      <div class="g3" style="margin-top:34px">
        <div class="fcard"><div class="ficon">🗣️</div><div><h3>हिंदी में सरल समझ</h3><p>पहले से अंग्रेज़ी जानना आवश्यक नहीं है। विषयों को हिंदी में आसान तरीके से समझाया जाता है।</p></div></div>
        <div class="fcard"><div class="ficon">🧠</div><div><h3>ATMA–TTP तरीका</h3><p>Absolute Topic Mastery Approach और Thought Translation Process समझ से अपने वाक्य बनाने तक मार्गदर्शन देते हैं।</p></div></div>
        <div class="fcard"><div class="ficon">🎯</div><div><h3>लक्ष्य के अनुसार योजना</h3><p>आपके स्तर और उद्देश्य के अनुसार पाठ्यक्रम तथा परीक्षा-तैयारी का सुझाव।</p></div></div>
      </div>
      <section aria-labelledby="hindi-first-method" style="margin-top:48px;max-width:980px">
        <div class="eyebrow">DIFL की शिक्षण शैली</div>
        <h2 id="hindi-first-method">हिंदी से समझें, <em>इटैलियन में सोचें</em></h2>
        <p class="lead" style="max-width:900px">कई भाषा-पाठ्यक्रम समझाने के लिए अंग्रेज़ी को आधार बनाते हैं। हिंदी में सोचने वाले विद्यार्थी के लिए यह एक अतिरिक्त अनुवाद-चरण बना सकता है और शुरुआती इटैलियन कठिन लगने लगती है। DIFL में अवधारणाएँ हिंदी के माध्यम से स्पष्ट की जाती हैं, ताकि विद्यार्थी सीधे इटैलियन के अर्थ और प्रयोग पर ध्यान दे सके।</p>
        <div class="g2" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;margin-top:24px">
          <article class="fcard" style="display:block"><h3>समझ का परिचित आधार</h3><p style="margin:0">इटैलियन में संज्ञा का लिंग, क्रिया-रूप और काल जैसे विषय आते हैं। हिंदी में इन विचारों को समझाकर, फिर इटैलियन उदाहरणों और बोलने की प्रैक्टिस से जोड़ा जाता है। यह किसी भाषा को दूसरी भाषा का समान रूप नहीं बताता, बल्कि सीखने के लिए एक परिचित आधार देता है।</p></article>
          <article class="fcard" style="display:block"><h3>अंग्रेज़ी की शर्त नहीं</h3><p style="margin:0">कम अंग्रेज़ी ज्ञान या सीमित औपचारिक शैक्षिक पृष्ठभूमि वाले विद्यार्थी भी अपने वर्तमान स्तर से शुरू कर सकते हैं। DIFL का ATMA–TTP (Absolute Topic Mastery Approach और Thought Translation Process) तरीका चरणबद्ध समझ, अभ्यास और अपने वाक्य बनाने पर केंद्रित है।</p></article>
        </div>
        <p style="font-size:13px;color:var(--gm);line-height:1.65;margin:18px 0 0">सीखने की गति, स्तर और परिणाम हर विद्यार्थी की उपस्थिति, अभ्यास और लक्ष्य पर निर्भर करते हैं।</p>
      </section>
      <section aria-labelledby="difl-hindi-team" style="margin-top:52px">
        <div class="eyebrow">DIFL परिवार</div>
        <h2 id="difl-hindi-team">55 वर्षों की परंपरा के <em>पीछे हमारी टीम</em></h2>
        <p class="lead" style="max-width:820px">DIFL में सीखना केवल एक कोर्स नहीं है। यह एक ऐसी संस्थागत परंपरा का हिस्सा है जिसमें भाषा को सरल, व्यवस्थित और आत्मविश्वास के साथ सिखाने पर ध्यान दिया जाता है।</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(172px,1fr));gap:18px;margin-top:28px">
          <figure class="fcard" style="display:block;margin:0;padding:12px;overflow:hidden">
            <img src="/assets/team-late-dr-v-k-sharma.jpg" alt="DIFL के संस्थापक, स्वर्गीय डॉ. वी. के. शर्मा" loading="lazy" decoding="async" width="600" height="600" style="display:block;width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px">
            <figcaption style="padding:14px 4px 3px"><strong style="display:block;color:var(--cream);font-size:17px">स्वर्गीय डॉ. वी. के. शर्मा</strong><span style="display:block;color:var(--gold);font-size:12px;letter-spacing:.08em;text-transform:uppercase;margin-top:4px">DIFL के संस्थापक</span></figcaption>
          </figure>
          <figure class="fcard" style="display:block;margin:0;padding:12px;overflow:hidden">
            <img src="/assets/team-mrs-kamlesh-sharma.jpg" alt="श्रीमती कमलेश शर्मा" loading="lazy" decoding="async" width="600" height="600" style="display:block;width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px">
            <figcaption style="padding:14px 4px 3px"><strong style="display:block;color:var(--cream);font-size:17px">श्रीमती कमलेश शर्मा</strong><span style="display:block;color:var(--gold);font-size:12px;letter-spacing:.08em;text-transform:uppercase;margin-top:4px">DIFL परिवार</span></figcaption>
          </figure>
          <figure class="fcard" style="display:block;margin:0;padding:12px;overflow:hidden">
            <img src="/assets/team-priyanshu-sharma.jpg" alt="DIFL निदेशक, प्रियांशु शर्मा" loading="lazy" decoding="async" width="600" height="600" style="display:block;width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px">
            <figcaption style="padding:14px 4px 3px"><strong style="display:block;color:var(--cream);font-size:17px">प्रियांशु शर्मा</strong><span style="display:block;color:var(--gold);font-size:12px;letter-spacing:.08em;text-transform:uppercase;margin-top:4px">निदेशक, DIFL</span></figcaption>
          </figure>
          <figure class="fcard" style="display:block;margin:0;padding:12px;overflow:hidden">
            <img src="/assets/team-roopshikha-sharma.jpg" alt="रूपशिखा शर्मा" loading="lazy" decoding="async" width="600" height="600" style="display:block;width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px">
            <figcaption style="padding:14px 4px 3px"><strong style="display:block;color:var(--cream);font-size:17px">रूपशिखा शर्मा</strong><span style="display:block;color:var(--gold);font-size:12px;letter-spacing:.08em;text-transform:uppercase;margin-top:4px">DIFL शिक्षण टीम</span></figcaption>
          </figure>
        </div>
      </section>
      <div class="g2" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:26px;margin-top:44px">
        <div class="course-box" style="margin-top:0"><h3>कोर्स में क्या सीखेंगे</h3><ul style="margin:0;padding-left:19px;color:var(--cream);line-height:1.9">${detail.syllabus.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>
        <div class="course-box" style="margin-top:0"><h3>परीक्षा तैयारी</h3><p style="color:var(--cream);line-height:1.75;margin:0">लक्ष्य के अनुसार ${detail.exams.map(escapeHtml).join(', ')} की तैयारी शामिल की जा सकती है। परीक्षा की तारीख, पंजीकरण, पात्रता और परिणाम संबंधित आधिकारिक संस्था तय करती है।</p></div>
      </div>
      <section aria-labelledby="italian-hindi-faq" style="margin-top:48px"><div class="eyebrow">सामान्य प्रश्न</div><h2 id="italian-hindi-faq">इटैलियन कोर्स के बारे में</h2><div style="display:grid;gap:14px;max-width:900px">${detail.faq.map(([question, answer]) => `<article class="fcard" style="display:block"><h3 style="margin-bottom:8px">${escapeHtml(question)}</h3><p style="margin:0">${escapeHtml(answer)}</p></article>`).join('')}</div></section>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:34px"><a class="btn-g" href="/contact/" style="text-decoration:none">कोर्स के लिए संपर्क करें →</a><a class="btn-o" href="tel:+919929515151" style="text-decoration:none">📞 9929-51 51 51</a></div>
      <p style="font-size:13px;color:var(--gm);line-height:1.65;margin-top:20px">DIFL भाषा सीखने और परीक्षा-तैयारी में सहायता करता है। नौकरी, वीज़ा, प्रवेश या परीक्षा परिणाम की कोई गारंटी नहीं दी जाती।</p>
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
    html = html.replace(/<div id="langPageContent"><\/div>/i, route.page === 'italian-hindi' ? staticHindiItalianBody(route) : staticLanguageBody(route));
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
    inLanguage: route.language === 'hi' ? 'hi-IN' : 'en-IN',
    dateModified: targetLanguagePages.has(route.page) ? '2026-11-02' : '2026-09-30',
    isPartOf: { '@id': 'https://mydifl.com/#website' },
    about: { '@id': 'https://mydifl.com/#organisation' },
  };
  const courseSchema = targetLanguagePages.has(route.page) && route.seo ? {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: route.title.replace(/\s*\|\s*DIFL$/, ''),
    description: route.description,
    url: canonical,
    inLanguage: route.language === 'hi' ? 'hi-IN' : 'en-IN',
    availableLanguage: route.courseLanguage || route.heading?.replace(/^.*Learn\s+/, '') || route.page,
    courseMode: ['online', 'offline', 'hybrid'],
    provider: { '@id': 'https://mydifl.com/#organisation' },
  } : null;
  const faqSchema = targetLanguagePages.has(route.page) && route.seo?.faq ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: route.seo.faq.map(([name, text]) => ({
      '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text },
    })),
  } : null;
  const webPageScript = `<script type="application/ld+json">${JSON.stringify(webPage)}</script>${courseSchema ? `<script type="application/ld+json">${JSON.stringify(courseSchema)}</script>` : ''}${faqSchema ? `<script type="application/ld+json">${JSON.stringify(faqSchema)}</script>` : ''}`;
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
    const cleanAttributes = attributes
      .replace(/\sdata-initial-page=(?:"[^"]*"|'[^']*')/i, '')
      .replace(/\slang=(?:"[^"]*"|'[^']*')/i, '');
    const staticRoute = route.staticOnly ? ' data-static-route="true"' : '';
    return `<html${cleanAttributes} lang="${escapeHtmlAttribute(route.language || 'en')}" data-initial-page="${escapeHtmlAttribute(route.page)}"${staticRoute}>`;
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
