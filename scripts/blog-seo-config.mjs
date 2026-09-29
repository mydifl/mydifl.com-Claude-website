const SITE_ORIGIN = 'https://mydifl.com';
const SEO_TITLE_LIMIT = 65;
const SEO_DESCRIPTION_LIMIT = 160;

const SEO_TITLE_OVERRIDES = Object.freeze({
  'australia-visa-english-tests-2026': 'Australia Visa English Tests 2026: Approved Rules',
  'quebec-pstq-french-2026': 'Québec PSTQ French Requirements 2026',
  jlpt: 'Archived JLPT 2025 Guide: Historical Dates & Centres',
  delf: 'Archived DELF & DALF 2025 Guide: Historical Reference',
  hsk: 'Archived HSK 2025 Guide: Historical India Reference',
  topik: 'Archived TOPIK 2025 Guide: Historical India Reference',
  goethe: 'Archived Goethe Exams 2025 Guide: Historical Reference',
  'japanese-culture': 'Japanese Culture: Customs, Traditions & Context',
  'french-culture': "French Culture: L'Art de Vivre & Social Customs",
  'german-culture': 'German Culture: Customs, Engineering & Christmas Markets',
  'korean-culture': 'Korean Culture: K-Pop, Language & Social Context',
  'japanese-food': 'Japanese Food Culture: Ramen, Sushi, Wagyu & Etiquette',
  'french-food': 'French Food Culture: Cheese, Wine & UNESCO Gastronomy',
  'german-food': 'German Food Culture: Bread, Wurst & Gemütlichkeit',
  'korean-food': 'Korean Food Culture: Kimchi, BBQ & Banchan',
  'dele-guide': 'Archived DELE & SIELE 2025 Guide: Historical Reference',
  'arabic-exam-guide': 'Arabic Proficiency Tests 2025: Hamza & ACTFL Overview',
  'spanish-study-plan': 'Spanish Study Plan: A1 Toward DELE B2',
  'arabic-study-plan': 'Arabic Study Plan: Beginner Toward B2',
  'spanish-culture': 'Spanish Culture: Siesta, Flamenco & Regional Traditions',
  'spanish-food': 'Spanish Food Culture: Tapas, Paella & Rioja',
  'arabic-culture': 'Arabic Culture: Hospitality, Majlis & Regional Context',
  'arabic-food': 'Arabic Food Culture: Kabsa, Mandi & Mezze',
  'japanese-beautiful-words': 'Beautiful Japanese Words: Hindi & English Meanings',
  'spanish-beautiful-words': 'Beautiful Spanish Words: Hindi & English Meanings',
  'japan-travel-business': 'Japan Travel for Indians: Places, Shopping & Etiquette',
  'france-travel-business': 'France Travel for Indians: Places, Shopping & Etiquette',
  'germany-travel-business': 'Germany Travel for Indians: Places, Shopping & Etiquette',
  'korea-travel-business': 'South Korea Travel: Places, Shopping & Business Etiquette',
  'career-japanese-jobs': 'Japanese-Language Jobs in India: Roles & JLPT',
  'career-french-canada': 'French Tests for Canadian Immigration: TEF, TCF & CRS',
  'eps-topik-guide': 'EPS-TOPIK Overview: Test & Official Recruitment Steps',
  'gks-scholarship-guide': 'GKS Scholarship Guide for Indian Students',
  'italy-flussi-visa': 'Italy Decreto Flussi: Official Quota & Visa Process',
  'canada-express-entry-french': 'Canada Express Entry: French-Language Points',
  'german-b2-roadmap': 'German A1–B2 Jaipur 2026: Timeline & Fees Guide',
  'torfl-russian-guide': 'TORFL Guide: Levels, Format & Preparation',
  'ielts-toefl-oet': 'IELTS vs TOEFL vs OET 2026: Which Test Fits?',
  'ausbildung-germany-2026': 'Ausbildung Germany 2026: Stipend, German & Process',
  'highest-paying-languages-india': 'Foreign-Language Careers India 2026: Salary Factors',
  'ttp-method': 'DIFL TTP Method: Structured Thought Translation Practice',
});

const SEO_DESCRIPTION_OVERRIDES = Object.freeze({
  'germany-opportunity-card-language-2026': "Understand the Opportunity Card's eligibility routes, language options, points, proof of funds and why stronger German can help with job searches.",
  'uk-skilled-worker-english-b2-2026': 'Learn when CEFR B2 English, an approved test or a qualifying degree may be required for the UK Skilled Worker route, including transition exceptions.',
  'australia-visa-english-tests-2026': "Review Australia's approved English tests, in-person testing rules and how result dates can affect which visa requirements apply.",
  'study-france-french-level-2026': 'Compare language expectations for French- and English-taught programmes, DAP applications and accepted certificates, then verify with each institution.',
  jlpt: 'Archived 2025 JLPT reference covering N5–N1 and historical India details. Verify every current centre, deadline and fee with official organisers.',
  delf: 'Archived 2025 DELF and DALF reference covering levels and historical India details. Verify current sessions and fees with official centres.',
  hsk: 'Archived 2025 HSK reference covering levels and historical India details. Verify the current format, dates and centres on the official test site.',
  topik: 'Archived 2025 TOPIK reference covering levels and historical India details. Verify every current session with official organisers.',
  goethe: 'Archived 2025 Goethe exam reference covering levels and historical India details. Verify current sessions and fees with Goethe-Institut.',
  'japanese-culture': 'Explore Japanese customs including bowing, tipping, cherry-blossom season, onsen etiquette and everyday social practices useful to language learners.',
  'french-culture': 'Explore French customs and everyday life, from café culture and la bise to working patterns, social etiquette and cultural vocabulary for learners.',
  'german-culture': 'Explore German customs, Sunday quiet rules, engineering culture, Christmas markets and social etiquette relevant to language learners and newcomers.',
  'korean-culture': 'Explore Korean age and hierarchy conventions, jeong, fast-paced work culture, traditional festivals and the context behind modern Korean media.',
  'japanese-food': 'Explore Japanese food culture through ramen, sushi etiquette, Wagyu, bento traditions and practical dining vocabulary for language learners.',
  'french-food': "Explore French meal structure, cheese, wine, bread traditions and food vocabulary, with context on France's UNESCO-recognised gastronomy.",
  'german-food': 'Explore German bread, beer, wurst, Oktoberfest traditions, Gemütlichkeit and practical food vocabulary for travellers and language learners.',
  'korean-food': 'Explore kimchi, fermentation, Korean barbecue etiquette, banchan and practical dining vocabulary for travellers and language learners.',
  'japanese-study-plan': 'An illustrative 18-month Japanese study outline covering kana, kanji and preparation stages from JLPT N5 toward N2, with adaptable practice ideas.',
  'french-study-plan': 'An illustrative 14-month French study outline from pronunciation and A1 foundations toward DELF B2 preparation, with adaptable weekly practice ideas.',
  'german-study-plan': 'An illustrative 14-month German study outline from A1 foundations toward Goethe B2 preparation, with adaptable practice for Germany pathways.',
  'dele-guide': 'Archived 2025 DELE and SIELE reference covering levels and historical India details. Verify current sessions with official organisers.',
  'eps-topik-guide': 'Overview of EPS-TOPIK language preparation and official recruitment steps. Verify current test, cut-off and eligibility rules with EPS authorities.',
  'italy-flussi-visa': "How Italy's quota-based Decreto Flussi process works, why language expectations vary, and which official employment and visa steps to verify.",
  'arabic-exam-guide': 'A guide to Arabic proficiency options including Hamza and ACTFL assessments, with context for Gulf employment and university applications.',
  'spanish-culture': 'Explore Spanish customs including siesta, late dining, flamenco, festivals and everyday etiquette useful to travellers and language learners.',
  'spanish-food': 'Explore Spanish food culture through tapas, paella, Rioja, meal times and shared vocabulary connections relevant to Indian learners.',
  'arabic-culture': 'Explore hospitality, the majlis, coffee traditions, social etiquette and historical context useful to Indian professionals and Arabic learners.',
  'arabic-food': 'Explore Arab food culture through kabsa, mandi, mezze, date traditions, communal dining and vocabulary connections with Indian languages.',
  'arabic-study-plan': 'An illustrative 18-month Arabic study outline covering script, Modern Standard Arabic, Gulf dialect basics and proficiency-test preparation.',
  'torfl-russian-guide': 'A guide to TORFL levels, exam format and preparation, with reminders to verify current organiser and receiving-authority rules.',
  'ielts-toefl-oet': 'Compare IELTS, TOEFL iBT and OET formats, scoring, costs and typical use cases to identify which test may fit your country and profession.',
  'japan-ssw-visa': "Understand Japan's Specified Skilled Worker route: language and skills tests, eligible sectors, application stages, pay protections and contract checks.",
  'ausbildung-germany-2026': "Understand Germany's Ausbildung route: training allowances, German-language expectations, common fields and the application process from India.",
  'highest-paying-languages-india': 'Compare seven foreign-language career paths, factors that influence pay and ways to research current India roles without relying on promised salaries.',
  'ttp-method': "An introduction to DIFL's Thought Translation Process, a mother-tongue bridge designed to support practical language production and classroom practice.",
});

export const blogIndexPath = '/blog/';
export const blogShareImage = '/assets/page-banners/blog-premium.webp';

const escapeHtmlAttribute = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('"', '&quot;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function replaceMeta(html, attribute, key, content) {
  const pattern = new RegExp(
    `<meta\\b(?=[^>]*\\b${attribute}=["']${escapeRegExp(key)}["'])[^>]*>`,
    'i',
  );
  const replacement = `<meta ${attribute}="${escapeHtmlAttribute(key)}" content="${escapeHtmlAttribute(content)}">`;

  if (!pattern.test(html)) {
    throw new Error(`Could not find ${attribute}="${key}" in the blog template.`);
  }

  return html.replace(pattern, replacement);
}

function replaceCanonical(html, canonical) {
  const pattern = /<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/i;
  if (!pattern.test(html)) throw new Error('Could not find the blog canonical link.');
  return html.replace(pattern, `<link rel="canonical" href="${escapeHtmlAttribute(canonical)}">`);
}

function clipAtWordBoundary(value, limit) {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= limit) return normalized;

  const candidate = normalized.slice(0, limit);
  const boundary = candidate.lastIndexOf(' ');
  if (boundary < 1) throw new Error(`Could not shorten SEO text to ${limit} characters without splitting a word.`);

  return `${candidate.slice(0, boundary).replace(/[\s,;:–—-]+$/u, '')}…`;
}

export function buildSeoTitle(post) {
  return clipAtWordBoundary(SEO_TITLE_OVERRIDES[post.id] || post.title, SEO_TITLE_LIMIT);
}

function cleanDescription(value) {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= SEO_DESCRIPTION_LIMIT) return normalized;

  const candidate = normalized.slice(0, SEO_DESCRIPTION_LIMIT + 1);
  const sentenceEnds = [candidate.lastIndexOf('. '), candidate.lastIndexOf('? '), candidate.lastIndexOf('! ')];
  const sentenceEnd = Math.max(...sentenceEnds);
  if (sentenceEnd >= 90) return candidate.slice(0, sentenceEnd + 1);

  return clipAtWordBoundary(normalized, SEO_DESCRIPTION_LIMIT);
}

function buildSeoDescription(post) {
  return cleanDescription(SEO_DESCRIPTION_OVERRIDES[post.id] || post.desc);
}

/**
 * The posts are deliberately kept in blog.html so the existing site can remain
 * a single, dependency-free page. The build reads that local array and emits
 * one crawlable HTML document per article. No remote code is executed.
 */
export function extractBlogPosts(template) {
  const startMarker = 'const POSTS=[';
  const endMarker = '];// end POSTS';
  const start = template.indexOf(startMarker);
  const end = template.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error('Could not locate the POSTS array in blog.html.');

  const arraySource = template.slice(start + 'const POSTS='.length, end + 1);
  // CTA is the only interpolation used inside the local post body templates.
  const posts = Function('CTA', `"use strict"; return (${arraySource});`)('');
  if (!Array.isArray(posts) || posts.length === 0) throw new Error('No blog posts were found.');
  return posts;
}

function replacePostsDataset(html, posts) {
  const startMarker = 'const POSTS=[';
  const endMarker = '];// end POSTS';
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error('Could not slim the POSTS array in the generated article.');
  const compactPosts = JSON.stringify(posts).replaceAll('<', '\\u003c');
  return `${html.slice(0, start)}const POSTS=${compactPosts};// end POSTS${html.slice(end + endMarker.length)}`;
}

function keepOnlyCurrentPost(html, post) {
  return replacePostsDataset(html, [post]);
}

function replaceBlogListingWithShell(html) {
  const opening = /<div\b[^>]*\bid=["']pg-list["'][^>]*>/i.exec(html);
  if (!opening) throw new Error('Could not locate #pg-list in the generated article.');
  const tags = /<\/?div\b[^>]*>/gi;
  tags.lastIndex = opening.index;
  let depth = 0;
  let tag;
  while ((tag = tags.exec(html))) {
    if (/^<\/div/i.test(tag[0])) depth -= 1;
    else depth += 1;
    if (depth === 0) {
      const shell = '<div id="pg-list" class="pg" aria-hidden="true"><div id="catBar"></div><div id="featRow"></div><div id="postGrid"></div></div>';
      return `${html.slice(0, opening.index)}${shell}${html.slice(tags.lastIndex)}`;
    }
  }
  throw new Error('Could not close #pg-list in the generated article.');
}

export function renderBlogIndexPage(template) {
  const canonical = new URL(blogIndexPath, SITE_ORIGIN).href;
  const image = new URL(blogShareImage, SITE_ORIGIN).href;
  let html = template;
  html = html.replace(/<html\b([^>]*)>/i, (tag, attributes) => {
    const clean = attributes.replace(/\sdata-initial-post=(?:"[^"]*"|'[^']*')/i, '');
    return `<html${clean}>`;
  });
  html = replaceCanonical(html, canonical);
  html = replaceMeta(html, 'property', 'og:url', canonical);
  html = replaceMeta(html, 'property', 'og:image', image);
  html = replaceMeta(html, 'name', 'twitter:image', image);
  const listingPosts = extractBlogPosts(template).map(({ body, faq, ...post }) => post);
  html = replacePostsDataset(html, listingPosts);
  return html;
}

export function renderBlogPostPage(template, post) {
  const path = `/blog/${encodeURIComponent(post.id)}/`;
  const canonical = new URL(path, SITE_ORIGIN).href;
  const image = new URL(blogShareImage, SITE_ORIGIN).href;
  const title = buildSeoTitle(post);
  const description = buildSeoDescription(post);
  let html = template;

  html = html.replace(/<html\b([^>]*)>/i, (tag, attributes) => {
    const clean = attributes.replace(/\sdata-initial-post=(?:"[^"]*"|'[^']*')/i, '');
    return `<html${clean} data-initial-post="${escapeHtmlAttribute(post.id)}">`;
  });
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtmlAttribute(title)}</title>`);
  html = replaceCanonical(html, canonical);
  html = replaceMeta(html, 'name', 'description', description);
  html = replaceMeta(html, 'property', 'og:title', title);
  html = replaceMeta(html, 'property', 'og:description', description);
  html = replaceMeta(html, 'property', 'og:type', 'article');
  html = replaceMeta(html, 'property', 'og:url', canonical);
  html = replaceMeta(html, 'property', 'og:image', image);
  html = replaceMeta(html, 'property', 'og:image:alt', `${post.title} — DIFL Blog`);
  html = replaceMeta(html, 'name', 'twitter:title', title);
  html = replaceMeta(html, 'name', 'twitter:description', description);
  html = replaceMeta(html, 'name', 'twitter:image', image);

  const faqHtml = post.faq?.length
    ? `<div class="ab"><h2>Frequently Asked Questions</h2>${post.faq.map((item) => `<h3>${item.q}</h3><p>${item.a}</p>`).join('')}</div>`
    : '';
  const legacy2025Content = /\b2025\b/.test(post.title || '') || /📅(?:\s+Updated)?(?:\s+(?:May|July))?\s+2025/.test(post.body || '');
  const archiveNotice = legacy2025Content
    ? `<aside class="archive-notice" role="note"><strong>Archive/current-information notice:</strong> This guide is labelled 2025 or 2025–26. Dates, fees, exam centres, scholarship terms, immigration rules and other time-sensitive details may have changed. Before applying or paying, confirm the current position with the official authority linked in the article or on that authority's official website.</aside>`
    : '';
  // The visible article body already contains human-edited topic labels where
  // useful. Do not manufacture a second keyword-chip block ahead of the title:
  // duplicate keyword lists look spammy and weaken the reading experience.
  const staticArticle = `${archiveNotice}${post.body || ''}${faqHtml}`;
  html = html.replace('<div id="pg-list" class="pg on">', '<div id="pg-list" class="pg">');
  html = html.replace('<div id="pg-art" class="pg">', '<div id="pg-art" class="pg on">');
  html = html.replace('<div class="ap" id="artBody"></div>', `<div class="ap" id="artBody">${staticArticle}</div>`);

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description,
    ...(legacy2025Content ? {} : { dateModified: '2026-09-30' }),
    inLanguage: 'en-IN',
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    image,
    author: {
      '@type': 'Organization',
      name: 'DIFL — Dante Institute of Foreign Languages',
      url: SITE_ORIGIN,
    },
    publisher: {
      '@type': 'Organization',
      name: 'DIFL — Dante Institute of Foreign Languages',
      url: SITE_ORIGIN,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_ORIGIN}/assets/difl-logo-clean.png`,
      },
    },
  };
  const schema = `<script type="application/ld+json" id="post-ld">${JSON.stringify(structuredData).replaceAll('<', '\\u003c')}</script>`;
  html = html.replace('</head>', `${schema}\n</head>`);
  html = html.replaceAll('onclick="showList()"', 'onclick="window.location.href=\'/blog/\'"');
  html = keepOnlyCurrentPost(html, post);
  html = replaceBlogListingWithShell(html);
  return html;
}
