// pdf-sobre : contenu.html -> contenu.pdf + un PNG par page (contenu-pages/), avec contrôles bloquants.
// Usage : node render.mjs contenu.html   -> sortie 0 = « OK », 1 = problème(s) listé(s)
// Prérequis dans le dossier de travail : npm i playwright-core @fontsource/figtree @fontsource/cormorant-garamond
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const src = resolve(process.argv[2] ?? 'contenu.html');
const base = src.replace(/\.html?$/i, '');
const { chromium } = createRequire(resolve('package.json'))('playwright-core'); // cherché depuis le dossier de travail, pas depuis le skill
const shots = `${base}-pages`;
mkdirSync(shots, { recursive: true });
const old = readdirSync(shots).filter(f => f.endsWith('.png')); // anciens aperçus : déplacés, jamais supprimés
if (old.length) { mkdirSync(`${shots}/_ancien`, { recursive: true }); old.forEach(f => renameSync(`${shots}/${f}`, `${shots}/_ancien/${f}`)); }

const browser = await chromium.launch({ channel: 'msedge', headless: true }).catch(() => chromium.launch({ headless: true }));
const page = await browser.newPage({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 2 });
const problems = [];
page.on('requestfailed', r => problems.push(`ressource introuvable : ${r.url()}`));
page.on('pageerror', e => problems.push(`erreur JS : ${e.message}`));
await page.goto(pathToFileURL(src).href, { waitUntil: 'load' });
await page.evaluate(() => window.ready);

const missing = await page.evaluate(() => ['Figtree', 'Cormorant'].filter(f => ![...document.fonts].some(x => x.family.replace(/"/g, '') === f && x.status === 'loaded')));
if (missing.length) problems.push(`polices non chargées : ${missing.join(', ')} (npm i @fontsource/figtree @fontsource/cormorant-garamond puis relancer build.mjs)`);

const pagesMax = Number(await page.evaluate(() => document.body.dataset.pagesMax)) || 0;
const fills = [];
problems.push(...await page.$$eval('.page', pages => pages.flatMap((p, i) => {
  const out = [], n = i + 1, body = p.querySelector('.body'), b = body.getBoundingClientRect(), kids = [...body.children];
  for (const el of kids) {
    const r = el.getBoundingClientRect(), what = el.textContent.trim().replace(/\s+/g, ' ').slice(0, 40);
    if (r.bottom > b.bottom + 1) out.push(`page ${n} : « ${what} » dépasse en bas de ${Math.round(r.bottom - b.bottom)} px`);
    if (r.right > b.right + 1) out.push(`page ${n} : « ${what} » dépasse à droite`);
  }
  const last = kids.filter(k => !k.matches('.notes')).at(-1);
  if (last?.matches('h2,h3')) out.push(`page ${n} : titre seul en bas de page (« ${last.textContent.trim().slice(0, 40)} »)`);
  if (last?.matches('p[data-keep]')) out.push(`page ${n} : phrase d'intro séparée de ce qu'elle annonce`);
  // règle : jamais de page vide ni à moitié vide (une zone Notes compte comme remplie)
  const fill = last ? (last.getBoundingClientRect().bottom - b.top) / b.height : 0;
  const notes = kids.some(k => k.matches('.notes'));
  // notes: non (texte à rendre tel quel) : la dernière page peut rester courte, signalé sans bloquer
  const tel = document.body.dataset.notes === 'non' && n === pages.length;
  if (fill < (notes ? 0.4 : 0.75)) out.push(`${tel ? '#avert ' : ''}page ${n} : remplie à ${Math.round(fill * 100)} % seulement`);
  out.push(`#fill ${n} ${Math.round(fill * 100)}${notes ? ' +notes' : ''}`);
  for (const el of p.querySelectorAll('td, code')) if (el.scrollWidth > el.clientWidth + 1) out.push(`page ${n} : texte coupé à droite dans ${el.tagName}`);
  return out;
})));
for (const m of problems.filter(x => x.startsWith('#fill'))) fills.push(m.slice(6));
const avert = problems.filter(x => x.startsWith('#avert ')).map(x => x.slice(7) + ' (notes: non, accepté)');
const errs = problems.filter(x => !x.startsWith('#fill') && !x.startsWith('#avert '));

// liens : chaque ancre interne vise une section qui existe, le sommaire a tous ses numéros de page
const links = await page.evaluate(() => {
  const a = [...document.querySelectorAll('.page a[href]')];
  return { n: a.length, cassés: a.filter(x => x.getAttribute('href').startsWith('#') && !document.getElementById(x.getAttribute('href').slice(1))).map(x => x.getAttribute('href')),
    sommaire: [...document.querySelectorAll('.toc .pg')].filter(s => !/^\d+$/.test(s.textContent)).length,
    h2: document.querySelectorAll('.page h2').length,
    titres: [...document.querySelectorAll('.page h1, .page h2, .page h3')].map(h => h.textContent.replace(/\s+/g, ' ').trim()),
    info: { Title: document.title, Author: document.querySelector('meta[name=author]')?.content, Subject: document.querySelector('meta[name=description]')?.content, Keywords: document.querySelector('meta[name=keywords]')?.content } };
});
links.cassés.forEach(h => errs.push(`lien interne cassé : ${h} (ancre = titre de section en minuscules, sans accents, mots reliés par des tirets)`));
if (links.sommaire) errs.push(`sommaire : ${links.sommaire} numéro(s) de page manquant(s)`);

const pdf = `${base}.pdf`;
// outline = signets depuis les titres ; tagged = PDF balisé (structure, langue, ordre de lecture) pour les lecteurs d'écran
await page.pdf({ path: pdf, preferCSSPageSize: true, printBackground: true, outline: true, tagged: true });
setInfo(pdf, { ...links.info, Creator: 'pdf-sobre' });
const raw = readFileSync(pdf, 'latin1');
const pdfPages = (raw.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
if (!/\/StructTreeRoot/.test(raw) || !/\/Lang\s*\(/.test(raw)) errs.push('PDF non balisé ou sans langue (accessibilité) : mettre à jour playwright-core');
if (links.h2 && !/\/Outlines/.test(raw)) errs.push('PDF sans signets alors que le document a des sections');
// signets relus dans le PDF lui-même (pas seulement « présents ») : un par titre, même texte (défaut « sansoubli » du 20/11)
const pdfStr = s => s[0] === '(' ? s.slice(1, -1).replace(/\\(.)/g, '$1') : Buffer.from(s.slice(5, -1), 'hex').swap16().toString('utf16le');
const signets = [...raw.matchAll(/\/Title (\((?:\\.|[^\\)])*\)|<FEFF[0-9A-F]*>)\s*\/Dest/g)].map(m => pdfStr(m[1]).replace(/\s+/g, ' ').trim());
const manquants = links.titres.filter(t => !signets.includes(t));
if (links.h2 && manquants.length) errs.push(`signets : ${manquants.length} titre(s) sans signet identique (${manquants.slice(0, 3).map(t => `« ${t} »`).join(', ')})`);
const annots = (raw.match(/\/Subtype\s*\/Link/g) ?? []).length;
if (annots < links.n) errs.push(`${links.n} liens dans la page, ${annots} cliquables dans le PDF`);
await page.emulateMedia({ media: 'print' });
const els = await page.$$('.page');
for (const [k, el] of els.entries()) await el.screenshot({ path: `${shots}/${String(k + 1).padStart(2, '0')}.png` });
await browser.close();
if (pdfPages !== els.length) errs.push(`écart : ${pdfPages} pages PDF pour ${els.length} pages HTML`);
if (pagesMax && els.length > pagesMax) errs.push(`${els.length} pages pour ${pagesMax} demandées : couper le texte le moins utile`);

// la sortie est aussi gardée à côté du PDF : la preuve du contrôle reste dans le dossier livré
const log = [`${pdf} : ${pdfPages} pages · remplissage par page : ${fills.join(' | ')} % · ${annots} lien(s) cliquable(s) · ${signets.length} signet(s) relus · PDF balisé`,
  ...signets.map(s => `  signet : ${s}`), ...avert.map(a => `AVERTISSEMENT : ${a}`), ...errs,
  errs.length ? `ÉCHEC : ${errs.length} problème(s)` : 'OK : aucun débordement, polices chargées, pas de titre seul, aucune page vide ou à moitié vide, signets conformes'];
console.log(log.join('\n'));
writeFileSync(`${base}-rendu.txt`, `${new Date().toISOString()}\n${log.join('\n')}\n`);
process.exit(errs.length ? 1 : 0);

// Métadonnées (Titre, Auteur, Sujet, Mots-clés) : mise à jour incrémentale du PDF (nouvel objet Info + xref ajoutés en fin de fichier,
// le reste n'est pas réécrit). shortcut: suppose la table xref classique de Chromium/Skia ; si elle devient un flux xref, passer à pdf-lib.
function setInfo(file, info) {
  const buf = readFileSync(file), raw = buf.toString('latin1'), t = raw.slice(raw.lastIndexOf('trailer'));
  const prev = raw.match(/startxref\s+(\d+)\s+%%EOF\s*$/)?.[1], size = +t.match(/\/Size (\d+)/)?.[1], root = t.match(/\/Root (\d+ \d+ R)/)?.[1];
  if (!prev || !size || !root || /\/XRef/.test(raw)) return errs.push('métadonnées non écrites : structure du PDF inattendue');
  const id = +(t.match(/\/Info (\d+) 0 R/)?.[1] ?? size);
  const old = raw.match(new RegExp(`(?:^|\\n)${id} 0 obj\\s*<<([\\s\\S]*?)>>\\s*endobj`))?.[1] ?? '';
  const keep = (old.match(/\/(Producer|CreationDate|ModDate) \((?:\\.|[^\\)])*\)/g) ?? []).join('\n');
  const hex = s => '<FEFF' + Buffer.from(s, 'utf16le').swap16().toString('hex').toUpperCase() + '>';
  const dict = Object.entries(info).filter(([, v]) => v).map(([k, v]) => `/${k} ${hex(v)}`).join('\n');
  const obj = `\n${id} 0 obj\n<<${dict}\n${keep}>>\nendobj\n`, off = buf.length + 1, xref = buf.length + Buffer.byteLength(obj, 'latin1');
  const tail = `xref\n0 1\n0000000000 65535 f \n${id} 1\n${String(off).padStart(10, '0')} 00000 n \ntrailer\n<</Size ${Math.max(size, id + 1)}\n/Root ${root}\n/Info ${id} 0 R\n/Prev ${prev}>>\nstartxref\n${xref}\n%%EOF\n`;
  writeFileSync(file, Buffer.concat([buf, Buffer.from(obj + tail, 'latin1')]));
}
