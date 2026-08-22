import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = process.cwd();
const sourcePath = resolve(root, 'content/difl-teaching-method.txt');
const outputPath = resolve(root, 'about-us/difl-teaching-method/index.html');

const escapeHtml = (value) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const slugify = (value) => value
  .normalize('NFKD')
  .toLowerCase()
  .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 72);

const englishHeadings = new Set([
  'Preface',
  'More Than 55 Years of Language-Teaching Excellence',
  'The DIFL Difference',
  'DIFL’s ATMA–TTP Pedagogy',
  'Depth Without Unnecessary Difficulty',
  'Building the Initial Vocabulary Foundation',
  'A Japanese Example: Greetings and Workplace Communication',
  'Memory Is Created Through Extensive Association',
  'Cognitive Benefits of ATMA',
  'Natural Hinglish: Teaching Through the Learner’s Language of Thought',
  'Why Not Pure Hindi or Pure English?',
  'TTP—Thought Translation Process',
  'Level-by-Level Teaching and DIFL’s ATMA–TTP Approach',
  'Passing an Examination and Possessing the Language',
  'Depth Before Speed',
  'From Passive Recognition to Active Command',
  'The DIFL Learning Progression',
  'About Priyanshu Sharma',
  'How to Use This Book',
  'Our Commitment',
]);

const hindiHeadings = new Set([
  'भाषा-शिक्षण में उत्कृष्टता के 55 से अधिक वर्ष',
  'DIFL की विशेषता',
  'DIFL की ATMA–TTP Pedagogy',
  'अनावश्यक कठिनाई के बिना विषय की गहराई',
  'प्रारम्भिक Vocabulary Foundation का निर्माण',
  'Japanese उदाहरण: Greetings और Workplace Communication',
  'विस्तृत संबंधों से स्थायी स्मृति का निर्माण',
  'ATMA के Cognitive Benefits',
  'Natural Hinglish: विद्यार्थी की विचार-भाषा के माध्यम से शिक्षण',
  'केवल शुद्ध Hindi या केवल English क्यों नहीं?',
  'TTP—Thought Translation Process',
  'पारंपरिक Level-by-Level Teaching और DIFL की ATMA–TTP Approach',
  'परीक्षा पास करना और भाषा पर अधिकार प्राप्त करना',
  'Speed से पहले Depth',
  'Passive Recognition से Active Command तक',
  'DIFL Learning Progression',
  'Priyanshu Sharma के बारे में',
  'इस पुस्तक का प्रयोग कैसे करें',
  'हमारा संकल्प',
]);

const editorialVisuals = {
  'DIFL’s ATMA–TTP Pedagogy': '<figure class="editorial-art art-landscape"><img src="/assets/teaching-method/atma-knowledge-garden.jpg" alt="An illustrated knowledge garden growing from an open book, showing how connected topics strengthen memory" width="1254" height="1254" loading="lazy"><figcaption>ATMA transforms a topic into a connected field of vocabulary, situations, senses and practical expression.</figcaption></figure>',
  'DIFL की ATMA–TTP Pedagogy': '<figure class="editorial-art art-landscape"><img src="/assets/teaching-method/atma-knowledge-garden.jpg" alt="एक खुली पुस्तक से विकसित होता illustrated knowledge garden, जो topics और memory के आपसी संबंध को दर्शाता है" width="1254" height="1254" loading="lazy"><figcaption>ATMA किसी topic को vocabulary, situations, senses और practical expression के एक जुड़े हुए क्षेत्र में बदलता है।</figcaption></figure>',
  'TTP—Thought Translation Process': '<figure class="editorial-art art-portrait"><img src="/assets/teaching-method/ttp-thought-transformation.jpg" alt="An artistic visualization of an original thought passing through meaning, vocabulary and grammar to become confident speech" width="1122" height="1402" loading="lazy"><figcaption>Thought becomes meaning; meaning finds structure; structure becomes independent communication.</figcaption></figure>',
};

function renderArticle(text, headings, prefix) {
  const lines = text
    .replaceAll('\r', '')
    .replace(/[\u2028\u2029]/g, '\n')
    .split('\n')
    .map((line) => line.trim());
  const html = [];
  const toc = [];
  let listOpen = false;
  let tableOpen = false;
  let tableRow = 0;
  let ttpMentions = 0;

  const closeList = () => {
    if (listOpen) html.push('</ul>');
    listOpen = false;
  };
  const closeTable = () => {
    if (tableOpen) html.push('</tbody></table></div>');
    tableOpen = false;
    tableRow = 0;
  };

  for (const line of lines) {
    if (!line) {
      closeList();
      closeTable();
      continue;
    }
    if (line === 'TTP—Thought Translation Process') {
      ttpMentions += 1;
      if (ttpMentions < 3) {
        closeList();
        closeTable();
        html.push(`<p class="term-mark"><span>TTP</span>${escapeHtml(line.slice(3))}</p>`);
        continue;
      }
    }
    if ([
      'Master the topic. Strengthen the memory. Train the thought. Speak the language.',
      'And, as we have always believed at DIFL:',
      'We teach you how to fly. You already have the wings!',
      'Topic पर अधिकार प्राप्त कीजिए। Memory को मजबूत बनाइए। Thought process को प्रशिक्षित कीजिए। भाषा बोलिए।',
      'और जैसा कि DIFL में हमारा सदैव विश्वास रहा है:',
      'हम आपको उड़ना सिखाते हैं—पंख आपके पास पहले से ही हैं!',
    ].includes(line)) continue;
    if (headings.has(line)) {
      closeList();
      closeTable();
      const id = `${prefix}-${slugify(line) || toc.length + 1}`;
      toc.push({ id, label: line });
      html.push(`<h2 id="${id}">${escapeHtml(line)}</h2>`);
      if (editorialVisuals[line]) html.push(editorialVisuals[line]);
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      closeList();
      closeTable();
      html.push(`<h3>${escapeHtml(line)}</h3>`);
      continue;
    }
    if (line.startsWith('* ')) {
      closeTable();
      if (!listOpen) html.push('<ul>');
      listOpen = true;
      html.push(`<li>${escapeHtml(line.slice(2))}</li>`);
      continue;
    }
    if (line.includes('\t')) {
      closeList();
      const cells = line.split('\t').map((cell) => cell.trim()).filter(Boolean);
      if (!tableOpen) {
        html.push('<div class="table-scroll"><table><thead>');
        tableOpen = true;
      }
      if (tableRow === 0) {
        html.push(`<tr>${cells.map((cell) => `<th>${escapeHtml(cell)}</th>`).join('')}</tr></thead><tbody>`);
      } else {
        html.push(`<tr>${cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`);
      }
      tableRow += 1;
      continue;
    }
    closeList();
    closeTable();
    if (line.includes('→')) {
      html.push(`<div class="process">${escapeHtml(line)}</div>`);
    } else if (line === 'Will this help the learner understand or express a real thought?' || line.endsWith('इसका निर्णय कृत्रिम level boundaries से नहीं, बल्कि उसकी communicative relevance अर्थात् संवाद में उसकी वास्तविक उपयोगिता से किया जाता है।')) {
      html.push(`<blockquote>${escapeHtml(line)}</blockquote>`);
    } else {
      html.push(`<p>${escapeHtml(line)}</p>`);
    }
  }
  closeList();
  closeTable();
  return { html: html.join('\n'), toc };
}

const source = await readFile(sourcePath, 'utf8');
const split = source.split(/Hindi version-\s*/i);
if (split.length !== 2) throw new Error('Expected English and Hindi sections in the teaching-method source.');

const english = renderArticle(split[0].trim(), englishHeadings, 'en');
const hindi = renderArticle(split[1].trim(), hindiHeadings, 'hi');
const tocLinks = (items, language) => items.map(({ id, label }) => `<a href="#${id}" data-toc-lang="${language}">${escapeHtml(label)}</a>`).join('\n');

const page = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>DIFL Teaching Method — ATMA–TTP Pedagogy | English & Hindi</title>
  <meta name="description" content="Discover DIFL's ATMA–TTP teaching method: topic mastery, natural Hinglish comprehension, thought translation and practical communication. Read in English or Hindi.">
  <meta name="keywords" content="DIFL teaching method, ATMA TTP pedagogy, language teaching Jaipur, Thought Translation Process, foreign language learning method">
  <link rel="canonical" href="https://mydifl.com/about-us/difl-teaching-method/">
  <meta property="og:title" content="The DIFL Teaching Method — ATMA–TTP Pedagogy">
  <meta property="og:description" content="How DIFL develops understanding, memory, independent thought and practical communication—in English and Hindi.">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://mydifl.com/about-us/difl-teaching-method/">
  <meta property="og:image" content="https://mydifl.com/assets/difl-logo.png">
  <meta name="theme-color" content="#0d0d0d">
  <link rel="icon" href="/assets/difl-logo.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root{--ink:#0d0d0d;--cream:#faf8f3;--paper:#fff;--gold:#c9a84c;--gold-dark:#8c6a1a;--teal:#0a5c6e;--muted:#5e625f;--line:#e8e1d2;--shadow:0 18px 60px rgba(13,13,13,.09)}
    *{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:105px}body{margin:0;background:var(--cream);color:var(--ink);font-family:'DM Sans',sans-serif;line-height:1.75}body::before{content:'';position:fixed;inset:0;pointer-events:none;opacity:.21;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.14'/%3E%3C/svg%3E");z-index:30;mix-blend-mode:multiply}a{color:inherit}.site-nav{position:sticky;top:0;z-index:40;background:rgba(13,13,13,.97);border-bottom:1px solid rgba(201,168,76,.25);backdrop-filter:blur(14px)}.nav-inner{width:min(1180px,calc(100% - 32px));height:78px;margin:auto;display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{display:flex;align-items:center;gap:13px;text-decoration:none;color:#fff}.brand img{width:52px;height:52px;object-fit:contain}.brand strong{display:block;font-family:'Cormorant Garamond',serif;font-size:23px;letter-spacing:1px}.brand span{display:block;color:rgba(255,255,255,.62);font-size:9px;text-transform:uppercase;letter-spacing:1px}.nav-actions{display:flex;align-items:center;gap:18px}.nav-actions>a{color:#f7f1df;text-decoration:none;font-size:13px;font-weight:600}.nav-actions>a:hover{color:var(--gold)}.nav-cta{padding:10px 16px;border:1px solid var(--gold);border-radius:999px}.hero{position:relative;min-height:690px;display:flex;align-items:center;overflow:hidden;background:#0d0d0d;color:#fff}.hero::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,#070707 0%,rgba(7,7,7,.97) 28%,rgba(7,7,7,.4) 57%,rgba(7,7,7,.08) 100%)}.hero-art{position:absolute;inset:0}.hero-art img{width:100%;height:100%;object-fit:cover;object-position:center}.hero-inner{position:relative;z-index:2;width:min(1180px,calc(100% - 36px));margin:auto;padding:90px 0}.eyebrow{color:var(--gold);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:2.5px}.hero h1{max-width:660px;margin:12px 0 20px;font-family:'Cormorant Garamond',serif;font-size:clamp(52px,8vw,94px);line-height:.9;font-weight:600;text-wrap:balance}.hero h1 em{color:var(--gold);font-style:normal}.hero-copy{max-width:600px;color:rgba(255,255,255,.78);font-size:17px}.language-switch{display:inline-flex;gap:5px;margin-top:30px;padding:5px;border:1px solid rgba(255,255,255,.18);border-radius:999px;background:rgba(0,0,0,.45)}.language-switch button{border:0;border-radius:999px;padding:11px 22px;background:transparent;color:#fff;font:600 13px 'DM Sans',sans-serif;cursor:pointer}.language-switch button.active{background:var(--gold);color:#111}.scroll-note{display:inline-flex;align-items:center;gap:8px;margin-left:20px;color:rgba(255,255,255,.5);font-size:11px;text-transform:uppercase;letter-spacing:1px}.scroll-note::before{content:'';width:32px;height:1px;background:var(--gold)}.summary{width:min(1080px,calc(100% - 36px));margin:-35px auto 58px;position:relative;z-index:3;display:grid;grid-template-columns:repeat(4,1fr);background:#fff;border-radius:18px;box-shadow:var(--shadow);overflow:hidden}.summary div{padding:22px;border-right:1px solid var(--line)}.summary div:last-child{border:0}.summary strong{display:block;font-family:'Cormorant Garamond',serif;font-size:26px;color:var(--teal)}.summary span{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--muted)}.method-map{width:min(1080px,calc(100% - 36px));margin:0 auto 70px;position:relative;padding:54px 42px;border-radius:28px;background:linear-gradient(135deg,#16211f,#0b0e0d);color:#fff;overflow:hidden}.method-map::before{content:'ATMA + TTP';position:absolute;right:-10px;top:-55px;font:700 120px 'Cormorant Garamond',serif;color:rgba(201,168,76,.05);white-space:nowrap}.map-heading{position:relative;display:flex;justify-content:space-between;gap:30px;align-items:end;margin-bottom:38px}.map-heading h2{margin:0;font:600 clamp(32px,5vw,52px)/1 'Cormorant Garamond',serif}.map-heading p{max-width:420px;margin:0;color:rgba(255,255,255,.6);font-size:13px}.journey{position:relative;display:grid;grid-template-columns:repeat(5,1fr);gap:14px}.journey::before{content:'';position:absolute;left:8%;right:8%;top:30px;height:1px;background:linear-gradient(90deg,var(--gold),var(--teal),var(--gold));opacity:.6}.journey div{position:relative;padding-top:70px}.journey i{position:absolute;top:5px;left:0;width:52px;height:52px;border-radius:50%;display:grid;place-items:center;background:#142b2d;border:1px solid rgba(201,168,76,.45);font-style:normal;font-size:21px;box-shadow:0 0 0 8px rgba(10,92,110,.18)}.journey strong{display:block;color:var(--gold);font:600 19px 'Cormorant Garamond',serif}.journey span{display:block;margin-top:5px;color:rgba(255,255,255,.58);font-size:11px;line-height:1.5}.layout{width:min(1180px,calc(100% - 36px));margin:0 auto 90px;display:grid;grid-template-columns:265px minmax(0,1fr);gap:46px;align-items:start}.toc{position:sticky;top:104px;max-height:calc(100vh - 125px);overflow:auto;padding:22px;background:#fff;border:1px solid var(--line);border-radius:16px}.toc::before{content:'✦';float:right;color:var(--gold);font-size:22px}.toc strong{display:block;margin-bottom:13px;font-family:'Cormorant Garamond',serif;font-size:21px}.toc a{display:block;padding:7px 0;border-bottom:1px solid #f0ebdf;text-decoration:none;color:#666;font-size:11.5px;line-height:1.45}.toc a:hover{color:var(--teal)}.article{min-width:0;background:#fff;border:1px solid var(--line);border-radius:22px;padding:clamp(26px,5vw,66px);box-shadow:0 8px 40px rgba(13,13,13,.04)}.article[hidden]{display:none}.article h2{margin:68px 0 20px;padding-top:5px;font-family:'Cormorant Garamond',serif;font-size:clamp(30px,4vw,46px);line-height:1.08;color:var(--teal);text-wrap:balance}.article h2:first-child{margin-top:0}.article h2::after{content:'';display:block;width:55px;height:3px;margin-top:13px;background:linear-gradient(90deg,var(--gold),transparent)}.article h3{margin:34px 0 10px;font-family:'Cormorant Garamond',serif;font-size:25px}.article p{margin:0 0 17px;color:#373b38;font-size:15.5px}.article ul{margin:2px 0 24px;padding:0;list-style:none;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px 20px}.article li{position:relative;padding:7px 0 7px 21px;color:#3e423f;font-size:14px;border-bottom:1px solid #f2eee5}.article li::before{content:'◆';position:absolute;left:0;top:9px;color:var(--gold);font-size:9px}.article blockquote{margin:28px 0;padding:25px 28px;border-left:4px solid var(--gold);background:#f8f4e9;font-family:'Cormorant Garamond',serif;font-size:25px;font-weight:600;color:#333}.process{position:relative;margin:28px 0;padding:24px 28px;border-radius:14px;background:linear-gradient(135deg,rgba(10,92,110,.09),rgba(201,168,76,.12));color:#173f47;font-weight:700;text-align:center;line-height:1.8;border:1px dashed rgba(10,92,110,.25)}.process::before,.process::after{content:'✦';position:absolute;color:var(--gold)}.process::before{left:10px;top:7px}.process::after{right:10px;bottom:7px}.editorial-art{position:relative;margin:26px 0 38px}.editorial-art img{display:block;width:100%;height:auto;border-radius:18px;box-shadow:0 20px 50px rgba(13,13,13,.16)}.editorial-art::before{content:'';position:absolute;inset:-11px 14px 15px -11px;border:1px solid rgba(201,168,76,.55);border-radius:20px;z-index:0}.editorial-art img,.editorial-art figcaption{position:relative;z-index:1}.editorial-art figcaption{max-width:85%;margin:-24px auto 0;padding:15px 20px;background:#fff;border-radius:12px;box-shadow:0 10px 30px rgba(13,13,13,.12);color:#5a564b;font:italic 15px 'Cormorant Garamond',serif;text-align:center}.art-landscape img{max-height:720px;object-fit:cover}.art-portrait{width:min(78%,560px);margin-left:auto;margin-right:auto}.table-scroll{overflow-x:auto;margin:25px 0 40px;border:1px solid var(--line);border-radius:14px}.article table{border-collapse:collapse;width:100%;min-width:760px;font-size:12.5px;line-height:1.55}.article th{padding:14px;text-align:left;background:#15201f;color:#fff}.article td{padding:13px 14px;vertical-align:top;border-top:1px solid var(--line);border-right:1px solid var(--line)}.article tr:nth-child(even) td{background:#fbf9f4}.closing{position:relative;margin-top:58px;padding:42px 32px;border-radius:18px;background:#111;color:#fff;text-align:center;overflow:hidden}.closing::before{content:'“';position:absolute;left:20px;top:-30px;font:180px 'Cormorant Garamond',serif;color:rgba(201,168,76,.11)}.closing strong{position:relative;font:600 28px 'Cormorant Garamond',serif;color:var(--gold)}footer{padding:40px 20px;background:#0d0d0d;color:rgba(255,255,255,.65);text-align:center;font-size:12px}footer a{color:var(--gold)}
    @media(max-width:850px){.nav-actions>a:not(.nav-cta){display:none}.hero{min-height:640px}.hero::after{background:linear-gradient(90deg,rgba(7,7,7,.95),rgba(7,7,7,.35))}.hero-art img{object-position:60% center}.summary{grid-template-columns:repeat(2,1fr)}.summary div:nth-child(2){border-right:0}.journey{grid-template-columns:repeat(2,1fr)}.journey::before{display:none}.layout{grid-template-columns:1fr}.toc{position:relative;top:auto;max-height:none}.article ul{grid-template-columns:1fr}}
    @media(max-width:520px){.nav-inner{height:68px}.brand span{display:none}.hero{padding:65px 0 65px}.summary{grid-template-columns:1fr}.summary div{border-right:0;border-bottom:1px solid var(--line)}.article{padding:25px 20px}.language-switch{display:flex}.language-switch button{flex:1}.article p{font-size:14.5px}}
  </style>
  <style>
    .main-nav{position:fixed;top:0;left:0;right:0;z-index:1000;padding:0 5%;display:flex;align-items:center;justify-content:space-between;height:72px;background:rgba(13,13,13,.88);backdrop-filter:blur(20px);border-bottom:1px solid rgba(201,168,76,.15);transition:all .4s ease}.main-nav.scrolled{height:58px;background:rgba(13,13,13,.97);border-bottom-color:rgba(201,168,76,.3)}.nav-logo{display:flex;align-items:center;gap:14px;text-decoration:none;flex-shrink:0}.difl-logo-img{height:48px;width:auto;object-fit:contain;display:block;flex-shrink:0}.nav-wordmark{display:flex;flex-direction:column;justify-content:center;padding-left:8px;line-height:1.15}.nav-wordmark strong{font-family:'Cormorant Garamond',serif;font-size:22px;color:#fff;letter-spacing:2px;line-height:1}.nav-wordmark small{font-size:8px;color:rgba(250,248,243,.6);letter-spacing:1px;text-transform:uppercase;margin-top:3px}.nav-links{display:flex;align-items:center;gap:2px;margin:0;padding:0;list-style:none}.nav-links a,.nav-links>li>span{display:block;padding:8px 14px;border-radius:6px;color:rgba(250,248,243,.75);text-decoration:none;font-size:13px;font-weight:500;letter-spacing:.3px;cursor:pointer;transition:all .25s}.nav-links a:hover,.nav-links>li>span:hover,.nav-links a[aria-current="page"]{color:var(--gold)}.nav-links .dd{position:relative}.nav-links .ddm{position:absolute;top:100%;left:0;min-width:210px;margin:8px 0 0;padding:8px;background:rgba(18,16,12,.97);backdrop-filter:blur(20px);border:1px solid rgba(201,168,76,.2);border-radius:12px;list-style:none;opacity:0;pointer-events:none;transform:translateY(-4px);transition:opacity .2s ease,transform .2s ease}.nav-links .ddm::before{content:'';position:absolute;top:-8px;left:0;right:0;height:8px}.nav-links .dd:hover>.ddm,.nav-links .dd:focus-within>.ddm{opacity:1;pointer-events:auto;transform:translateY(0)}.nav-links .ddm a{padding:10px 14px;border-radius:8px;color:rgba(250,248,243,.8);font-size:12.5px;white-space:nowrap}.nav-links .ddm a:hover{background:rgba(201,168,76,.1);color:var(--gold)}.nav-links .ddm-wide{min-width:520px;display:grid;grid-template-columns:repeat(3,1fr);gap:2px}.nav-links .dd-head{grid-column:1/-1;padding:6px 10px 2px;color:rgba(201,168,76,.6);font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase}.nav-links .nav-cta{padding:9px 20px!important;border:0!important;border-radius:8px!important;background:linear-gradient(135deg,var(--gold),var(--gold-dark))!important;color:var(--ink)!important;font-weight:600!important}.hamburger{display:none;flex-direction:column;gap:5px;padding:7px;border:0;background:transparent;cursor:pointer}.hamburger span{display:block;width:24px;height:2px;background:var(--gold);border-radius:2px;transition:transform .25s ease,opacity .25s ease}.hamburger.active span:nth-child(1){transform:translateY(7px) rotate(45deg)}.hamburger.active span:nth-child(2){opacity:0}.hamburger.active span:nth-child(3){transform:translateY(-7px) rotate(-45deg)}
    .term-mark{display:flex;align-items:center;gap:14px;margin:22px 0 30px!important;padding:16px 20px;border:1px solid rgba(201,168,76,.45);border-radius:13px;background:linear-gradient(115deg,#fffaf0,#f2f8f7);color:#23474b!important;font-family:'Cormorant Garamond',serif;font-size:20px!important;font-weight:600}
    .term-mark span{display:grid;place-items:center;flex:0 0 54px;height:54px;border-radius:50%;background:var(--teal);color:#fff;font:700 15px 'DM Sans',sans-serif;letter-spacing:1px;box-shadow:0 0 0 6px rgba(10,92,110,.1)}
    .table-scroll{overflow-x:hidden}.article table{min-width:0;table-layout:fixed}.article th,.article td{overflow-wrap:anywhere;word-break:normal}.article th:first-child,.article td:first-child{width:22%}.article th:nth-child(2),.article td:nth-child(2){width:36%}.article th:nth-child(3),.article td:nth-child(3){width:42%}
    @media(max-width:850px){.layout{grid-template-columns:minmax(0,1fr)}.layout>*{min-width:0}}
    @media(max-width:900px){.main-nav{height:60px;padding:0 4%}.nav-wordmark{display:none}.nav-links{display:none}.hamburger{display:flex}.nav-links.mobile-open{display:flex;position:fixed;top:60px;left:0;right:0;max-height:calc(100vh - 60px);overflow-y:auto;flex-direction:column;align-items:stretch;gap:0;padding:14px 5% 24px;background:rgba(13,13,13,.99);border-bottom:1px solid rgba(201,168,76,.2)}.nav-links.mobile-open>li{border-bottom:1px solid rgba(255,255,255,.06)}.nav-links.mobile-open>li>a,.nav-links.mobile-open>li>span{padding:12px 8px}.nav-links.mobile-open .ddm{position:static;display:none;min-width:0;margin:0 0 8px;padding:6px;opacity:1;pointer-events:auto;transform:none;background:rgba(255,255,255,.035);box-shadow:none}.nav-links.mobile-open .dd.open>.ddm{display:block}.nav-links.mobile-open .dd.open>.ddm-wide{display:grid;grid-template-columns:1fr}.nav-links.mobile-open .ddm a{white-space:normal}.nav-links.mobile-open .nav-cta{text-align:center;margin:8px 0}}
    @media(max-width:650px){.table-scroll{overflow:visible;border:0;border-radius:0}.article table,.article tbody,.article tr,.article td{display:block;width:100%!important}.article thead{display:none}.article tr{overflow:hidden;margin:0 0 16px;border:1px solid var(--line);border-radius:13px;background:#fff;box-shadow:0 6px 20px rgba(13,13,13,.05)}.article td{position:relative;padding:13px 15px;border:0;border-top:1px solid var(--line);background:#fff!important}.article td:first-child{padding:13px 15px;border:0;background:#15201f!important;color:#fff;font-weight:700}.article td:nth-child(2),.article td:nth-child(3){padding-top:35px}.article td:nth-child(2)::before,.article td:nth-child(3)::before{position:absolute;left:15px;top:10px;color:var(--gold-dark);font-size:9px;font-weight:700;letter-spacing:.8px;text-transform:uppercase}.article[lang="en"] td:nth-child(2)::before{content:'Traditional approach'}.article[lang="en"] td:nth-child(3)::before{content:'DIFL ATMA–TTP approach'}.article[lang="hi"] td:nth-child(2)::before{content:'पारंपरिक Approach'}.article[lang="hi"] td:nth-child(3)::before{content:'DIFL ATMA–TTP Approach'}}
    @media(max-width:520px){.scroll-note{display:none}.term-mark{align-items:flex-start}.method-map{padding:38px 24px}.map-heading{display:block}.map-heading p{margin-top:14px}.journey{grid-template-columns:1fr}.journey div{padding:2px 0 2px 68px;min-height:58px}.journey i{top:2px}.art-portrait{width:100%}}
  </style>
</head>
<body>
  <nav class="main-nav" id="navbar" aria-label="Main navigation">
    <a class="nav-logo" href="/">
      <img src="/assets/difl-logo.png" class="difl-logo-img" alt="DIFL" width="180" height="48">
      <span class="nav-wordmark"><strong>DIFL</strong><small>Dante Institute of Foreign Languages</small></span>
    </a>
    <ul class="nav-links" id="navLinks">
      <li class="dd"><span tabindex="0">Why DIFL? ▾</span>
        <ul class="ddm">
          <li><a href="/about-us/">About DIFL</a></li>
          <li><a href="/about-us/difl-teaching-method/" aria-current="page">DIFL Teaching Method</a></li>
          <li><a href="/about-us/reviews-of-difl/">Testimonials</a></li>
          <li><a href="/about-us/foreign-language-scholarships/">DIFL Scholarships</a></li>
          <li><a href="/foreign-language-faqs/">FAQs</a></li>
        </ul>
      </li>
      <li class="dd"><span tabindex="0">Languages ▾</span>
        <ul class="ddm ddm-wide">
          <li class="dd-head">European</li>
          <li><a href="/learn-french/">🇫🇷 French</a></li><li><a href="/learn-german/">🇩🇪 German</a></li><li><a href="/learn-spanish/">🇪🇸 Spanish</a></li>
          <li><a href="/learn-italian-language/">🇮🇹 Italian</a></li><li><a href="/learn-russian-language/">🇷🇺 Russian</a></li><li><a href="/learn-english/">🇬🇧 English</a></li>
          <li class="dd-head">Asian</li>
          <li><a href="/learn-japanese/">🇯🇵 Japanese</a></li><li><a href="/learn-mandarin-chinese/">🇨🇳 Mandarin</a></li><li><a href="/learn-korean-language/">🇰🇷 Korean</a></li>
          <li><a href="/learn-arabic/">🇦🇪 Arabic</a></li><li><a href="/learn-thai-language/">🇹🇭 Thai</a></li><li><a href="/learn-hindi-language/">🇮🇳 Hindi</a></li>
          <li class="dd-head">Explore</li>
          <li><a href="/learn-foreign-languages/">📚 All Courses</a></li><li><a href="/language-for-professionals/">🏭 For Professionals</a></li><li><a href="/exam-calendar/">📅 Exam Calendar</a></li>
        </ul>
      </li>
      <li class="dd"><span tabindex="0">Programs ▾</span><ul class="ddm"><li><a href="/study-abroad-programs/">All Programs</a></li><li><a href="/study-abroad-programs/">🇩🇪 Ausbildung Germany</a></li><li><a href="/study-abroad-programs/">🇯🇵 MEXT Japan</a></li><li><a href="/study-abroad-programs/">🇫🇷 Campus France</a></li><li><a href="/study-abroad-programs/">🇰🇷 GKS Korea</a></li></ul></li>
      <li class="dd"><span tabindex="0">Handwriting ▾</span><ul class="ddm"><li><a href="/handwriting-improvement/">Handwriting Improvement</a></li><li><a href="/learn-calligraphy/">Learn Calligraphy</a></li></ul></li>
      <li><a href="/blog-on-foreign-languages/">Blog</a></li>
      <li><a href="/contact/" class="nav-cta">Enroll Now</a></li>
    </ul>
    <button class="hamburger" id="hamburger" type="button" aria-label="Open navigation menu" aria-expanded="false"><span></span><span></span><span></span></button>
  </nav>
  <header class="hero">
    <div class="hero-art" aria-hidden="true"><img src="/assets/teaching-method/atma-ttp-hero.jpg" alt="" width="1536" height="1024"></div>
    <div class="hero-inner">
      <div class="eyebrow" data-copy data-en="Why DIFL? · Our teaching philosophy" data-hi="Why DIFL? · हमारी teaching philosophy">Why DIFL? · Our teaching philosophy</div>
      <h1><span data-copy data-en="The DIFL " data-hi="DIFL ">The DIFL </span><em data-copy data-en="Teaching Method" data-hi="Teaching Method">Teaching Method</em></h1>
      <p class="hero-copy" data-copy data-en="More than 55 years of language-teaching experience, shaped into a practical system for building understanding, memory, independent thought and confident communication." data-hi="55 से अधिक वर्षों के language-teaching experience से विकसित एक practical system—जो understanding, memory, independent thought और confident communication का निर्माण करता है।">More than 55 years of language-teaching experience, shaped into a practical system for building understanding, memory, independent thought and confident communication.</p>
      <div class="language-switch" role="group" aria-label="Choose page language">
        <button type="button" data-language="en" class="active" aria-pressed="true">English</button>
        <button type="button" data-language="hi" aria-pressed="false">हिन्दी</button>
      </div>
      <span class="scroll-note" data-copy data-en="Explore the pedagogy" data-hi="Pedagogy को समझिए">Explore the pedagogy</span>
    </div>
  </header>
  <section class="summary" aria-label="DIFL teaching method summary">
    <div><strong>ATMA</strong><span data-copy data-en="Absolute Topic Mastery" data-hi="किसी topic पर पूर्ण practical command">Absolute Topic Mastery</span></div>
    <div><strong>TTP</strong><span data-copy data-en="Thought Translation Process" data-hi="विचार-अनुवाद प्रक्रिया">Thought Translation Process</span></div>
    <div><strong>55+ years</strong><span data-copy data-en="Teaching excellence" data-hi="Teaching excellence">Teaching excellence</span></div>
    <div><strong>25,000+</strong><span data-copy data-en="Learners taught" data-hi="विद्यार्थियों को training">Learners taught</span></div>
  </section>
  <section class="method-map" aria-labelledby="journey-title">
    <div class="map-heading"><h2 id="journey-title" data-copy data-en="From understanding to independent speech" data-hi="Understanding से independent speech तक">From understanding to independent speech</h2><p data-copy data-en="DIFL’s method is a progression: make the idea clear, connect it deeply, retrieve it actively, and use it confidently." data-hi="DIFL की method एक progression है: concept को स्पष्ट समझिए, उसे गहराई से जोड़िए, active memory से recall कीजिए और confidence से प्रयोग कीजिए।">DIFL’s method is a progression: make the idea clear, connect it deeply, retrieve it actively, and use it confidently.</p></div>
    <div class="journey" aria-label="DIFL learning progression">
      <div><i>01</i><strong data-copy data-en="Understand" data-hi="समझिए">Understand</strong><span data-copy data-en="Natural Hinglish removes the barrier between explanation and concept." data-hi="Natural Hinglish explanation और concept के बीच की बाधा हटाती है।">Natural Hinglish removes the barrier between explanation and concept.</span></div>
      <div><i>02</i><strong data-copy data-en="Connect" data-hi="जोड़िए">Connect</strong><span data-copy data-en="One topic grows into a rich network of useful words and situations." data-hi="एक topic useful words और situations के समृद्ध network में विकसित होता है।">One topic grows into a rich network of useful words and situations.</span></div>
      <div><i>03</i><strong data-copy data-en="Recall" data-hi="याद कीजिए">Recall</strong><span data-copy data-en="Varied practice moves knowledge from recognition to active memory." data-hi="अलग-अलग practice knowledge को recognition से active memory तक ले जाती है।">Varied practice moves knowledge from recognition to active memory.</span></div>
      <div><i>04</i><strong data-copy data-en="Construct" data-hi="बनाइए">Construct</strong><span data-copy data-en="Learners build sentences for their own original thoughts." data-hi="विद्यार्थी अपने original thoughts के लिए स्वयं sentences बनाते हैं।">Learners build sentences for their own original thoughts.</span></div>
      <div><i>05</i><strong data-copy data-en="Communicate" data-hi="बोलिए">Communicate</strong><span data-copy data-en="Thought becomes confident, culturally appropriate expression." data-hi="Thought confident और culturally appropriate expression बन जाता है।">Thought becomes confident, culturally appropriate expression.</span></div>
    </div>
  </section>
  <main class="layout">
    <aside class="toc" aria-label="On this page"><strong data-toc-title>On this page</strong><div data-toc="en">${tocLinks(english.toc, 'en')}</div><div data-toc="hi" hidden>${tocLinks(hindi.toc, 'hi')}</div></aside>
    <div>
      <article class="article" data-article="en" lang="en">${english.html}<div class="closing"><strong>Master the topic. Strengthen the memory. Train the thought. Speak the language.</strong><br>We teach you how to fly. You already have the wings!</div></article>
      <article class="article" data-article="hi" lang="hi" hidden>${hindi.html}<div class="closing"><strong>Topic पर अधिकार प्राप्त कीजिए। Memory को मजबूत बनाइए। Thought process को प्रशिक्षित कीजिए। भाषा बोलिए।</strong><br>हम आपको उड़ना सिखाते हैं—पंख आपके पास पहले से ही हैं!</div></article>
    </div>
  </main>
  <footer>© 1970–2026 DIFL — Dante Institute of Foreign Languages, Jaipur · <a href="/contact/">Contact DIFL</a></footer>
  <script>
    const navbar=document.getElementById('navbar');
    const hamburger=document.getElementById('hamburger');
    const navLinks=document.getElementById('navLinks');
    const closeMenu=()=>{navLinks.classList.remove('mobile-open');hamburger.classList.remove('active');hamburger.setAttribute('aria-expanded','false');document.querySelectorAll('.nav-links .dd.open').forEach(item=>item.classList.remove('open'));};
    addEventListener('scroll',()=>navbar.classList.toggle('scrolled',scrollY>60),{passive:true});
    hamburger.addEventListener('click',()=>{const open=navLinks.classList.toggle('mobile-open');hamburger.classList.toggle('active',open);hamburger.setAttribute('aria-expanded',String(open));});
    document.querySelectorAll('.nav-links .dd>span').forEach(trigger=>{
      const toggle=()=>{if(innerWidth<=900){const item=trigger.parentElement;document.querySelectorAll('.nav-links .dd.open').forEach(other=>{if(other!==item)other.classList.remove('open');});item.classList.toggle('open');}};
      trigger.addEventListener('click',toggle);
      trigger.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggle();}});
    });
    navLinks.addEventListener('click',event=>{if(event.target.closest('a'))closeMenu();});
    document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenu();});
    const buttons=[...document.querySelectorAll('[data-language]')];
    const articles=[...document.querySelectorAll('[data-article]')];
    const tocGroups=[...document.querySelectorAll('[data-toc]')];
    const tocTitle=document.querySelector('[data-toc-title]');
    function setLanguage(language, updateUrl=true){
      const selected=language==='hi'?'hi':'en';
      document.documentElement.lang=selected;
      articles.forEach(article=>article.hidden=article.dataset.article!==selected);
      tocGroups.forEach(group=>group.hidden=group.dataset.toc!==selected);
      buttons.forEach(button=>{const active=button.dataset.language===selected;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
      tocTitle.textContent=selected==='hi'?'इस पृष्ठ पर':'On this page';
      document.querySelectorAll('[data-copy]').forEach(element=>{element.textContent=element.dataset[selected]||element.dataset.en;});
      document.title=selected==='hi'?'DIFL Teaching Method — ATMA–TTP Pedagogy | हिन्दी':'DIFL Teaching Method — ATMA–TTP Pedagogy | English & Hindi';
      if(updateUrl){const url=new URL(location.href);selected==='hi'?url.searchParams.set('lang','hi'):url.searchParams.delete('lang');history.replaceState({},'',url);}
      try{localStorage.setItem('difl-method-language',selected)}catch{}
    }
    buttons.forEach(button=>button.addEventListener('click',()=>setLanguage(button.dataset.language)));
    const requested=new URLSearchParams(location.search).get('lang');
    let saved='';try{saved=localStorage.getItem('difl-method-language')||''}catch{}
    setLanguage(requested||saved||'en',false);
  </script>
</body>
</html>`;

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, page);
console.log(`Generated ${outputPath} from the approved bilingual source.`);
