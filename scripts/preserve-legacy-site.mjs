import { cp, mkdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const project = process.cwd();
const targets = [resolve(project, 'dist/client'), resolve(project, '.vercel/output/static')];
const entries = [
  '.well-known', 'about-us', 'assets', 'blog-on-foreign-languages', 'contact', 'contact-us',
  'exam-calendar', 'foreign-language-faqs', 'handwriting-improvement', 'language-for-professionals',
  'language-quiz', 'learn-arabic', 'learn-calligraphy', 'learn-english', 'learn-foreign-languages',
  'learn-french', 'learn-german', 'learn-hindi-language', 'learn-italian-language', 'learn-japanese',
  'learn-korean-language', 'learn-mandarin-chinese', 'learn-russian-language', 'learn-spanish',
  'learn-thai-language', 'study-abroad-programs', 'whatsapp', '404-custom.html', '404.html', 'blog.html',
  'CNAME', 'index.html', 'llms.txt', 'robots.txt', 'sitemap.xml',
];

await Promise.all(targets.map(async (target) => {
  try { await stat(target); } catch { return; }
  await mkdir(target, { recursive: true });
  await Promise.all(entries.map((entry) => cp(resolve(project, entry), resolve(target, entry), { recursive: true, force: true })));
}));

console.log('Preserved the existing mydifl.com pages alongside the secure portal.');
