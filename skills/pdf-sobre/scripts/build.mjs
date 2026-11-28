// pdf-sobre : contenu.md -> contenu.html (A4). La mise en pages se fait dans le navigateur (paginate, plus bas),
// moteur repris du guide validé du 18/11 : titres jamais seuls, listes et tableaux coupés proprement, fin de page vide remplie par une zone Notes.
// Usage : node build.mjs contenu.md   (polices : npm i @fontsource/figtree @fontsource/cormorant-garamond dans le dossier du .md)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const src = resolve(process.argv[2] ?? 'contenu.md');
const dir = dirname(src);
let md = readFileSync(src, 'utf8').replace(/\r/g, '');
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inl = s => esc(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
  .replace(/\*(.+?)\*/g, '<i>$1</i>')
  .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
  .replace(/ ([:;?!»])/g, '&#8239;$1').replace(/« /g, '«&#8239;')
  .replace(/(\d) (?=\d{3}\b)/g, '$1&#8239;').replace(/(\d) (€|%|EUR|HT|TTC|mm|cm|kg|h)\b/g, '$1&#160;$2') // « 18 542,70 € » jamais coupé
  .replace(/_{3,}/g, '<span class="champ"></span>'); // ___ = champ à remplir à la main

// En-tête facultatif : --- surtitre / date / auteur / numeros: non / pages: 2 (maximum, vérifié par render) ---
const meta = {};
if (md.startsWith('---\n')) {
  const end = md.indexOf('\n---\n', 4);
  for (const l of md.slice(4, end).split('\n')) { const m = l.match(/^([\w-]+)\s*:\s*(.*)$/); if (m) meta[m[1]] = m[2].trim(); }
  md = md.slice(end + 5);
}
const lines = md.split('\n');
const out = [], secs = [];
let title = '', lead = '', n = 0, i = 0;
const numbered = meta.numeros !== 'non';
// ancre d'une section : « Le jour J » -> #le-jour-j (liens internes et sommaire)
const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

while (i < lines.length) {
  const l = lines[i];
  if (!l.trim()) { i++; continue; }
  if (l === '---page---') { out.push('<div class="brk"></div>'); i++; continue; }
  if (l === '---signature---') { // devis, accord : zone réservée, jamais coupée ni remplacée par Notes
    out.push('<div class="sign"><div><p>Fait à <span class="champ"></span> le <span class="champ"></span></p><p class="sign-t">Le prestataire</p></div><div><p>Bon pour accord, date et signature</p><p class="sign-t">Le client</p></div></div>');
    i++; continue;
  }
  if (l.startsWith('```')) { // bloc de texte à chasse fixe (schémas, formules), taille ajustée à la ligne la plus longue
    const q = []; i++; while (i < lines.length && !lines[i].startsWith('```')) q.push(lines[i++]); i++;
    const L = Math.max(...q.map(x => x.length), 1), fs = Math.min(8.5, 470 / (L * 0.6)).toFixed(2);
    { const k = out.length - 1; if (k >= 0 && /^<p>/.test(out[k]) && out[k].length < 220) out[k] = out[k].replace(/^<p>/, '<p data-keep="1">'); } // la phrase qui annonce le schéma reste avec lui
    out.push(`<pre class="code" style="font-size:${fs}pt">${esc(q.join('\n'))}</pre>`); continue;
  }
  if (/^# /.test(l)) {
    title = l.slice(2).trim();
    const ld = []; let j = i + 1;
    // chapeau: non = le 1er paragraphe reste un paragraphe normal (texte à rendre tel quel)
    while (meta.chapeau !== 'non' && j < lines.length && !/^(#|---page---)/.test(lines[j])) { if (lines[j].trim()) ld.push(lines[j].trim()); else if (ld.length) break; j++; }
    lead = ld.join(' ');
    out.push(`<header class="doc" data-sec="">${meta.surtitre ? `<p class="kick">${inl(meta.surtitre)}</p>` : ''}<h1>${inl(title)}</h1>${lead ? `<p class="lead">${inl(lead)}</p>` : ''}${meta.date || meta.auteur ? `<p class="meta">${[meta.auteur, meta.date].filter(Boolean).map(inl).join(' · ')}</p>` : ''}</header>`);
    if (meta.sommaire === 'oui') out.push('<nav class="toc" aria-label="Sommaire"></nav>'); // rempli après la boucle
    i = j; continue;
  }
  if (/^## /.test(l)) {
    const t = l.slice(3).trim(), num = numbered ? `<span class="n">${String(++n).padStart(2, '0')}</span> ` : '';
    let id = slug(t) || 's'; while (secs.some(s => s.id === id)) id += '-2';
    secs.push({ id, t, num });
    out.push(`<h2 id="${id}" data-keep="1" data-sec="${esc(t)}">${num}${inl(t)}</h2>`);
    i++; continue;
  }
  if (/^### /.test(l)) { out.push(`<h3 data-keep="1">${inl(l.slice(4))}</h3>`); i++; continue; }
  if (l.startsWith('> ')) {
    const q = []; while (i < lines.length && lines[i].startsWith('>')) q.push(lines[i++].replace(/^> ?/, ''));
    const m = q[0].match(/^\[([^\]]+)\] ?(.*)$/);
    const ps = (m ? [m[2], ...q.slice(1)] : q).filter(Boolean).map(x => `<p>${inl(x)}</p>`).join('');
    out.push(m ? `<aside class="box"><p class="box-t">${inl(m[1])}</p>${ps}</aside>` : `<blockquote>${ps}</blockquote>`);
    continue;
  }
  if (l.startsWith('|')) {
    const rows = []; while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++]);
    const cells = r => r.trim().slice(1, -1).split('|').map(c => c.trim());
    const [h, sep, ...b] = rows;
    const al = cells(sep).map(c => /^:-+:$/.test(c) ? 'c' : /-:$/.test(c) ? 'r' : ''); // :---: centre, ---: droite (chiffres)
    const td = (c, k, tag) => `<${tag}${al[k] ? ` class="${al[k]}"` : ''}>${inl(c)}</${tag}>`;
    const tr = (r, k) => `<tr${k === b.length - 1 && /^(\*\*)?total/i.test(cells(r)[0]) ? ' class="total"' : ''}>${cells(r).map((c, k) => td(c, k, 'td')).join('')}</tr>`; // dernière ligne « Total » : filet au-dessus
    out.push(`<table data-split="tbody"${cells(h).length >= 8 ? ' class="wide"' : ''}><thead><tr>${cells(h).map((c, k) => td(c, k, 'th')).join('')}</tr></thead><tbody>${b.map(tr).join('')}</tbody></table>`);
    continue;
  }
  const li = l.match(/^(- \[ \] |- |(\d+)\. )(.*)$/);
  if (li) {
    const check = li[1] === '- [ ] ', ord = !!li[2], items = [];
    while (i < lines.length) {
      const m = lines[i].match(/^(- \[ \] |- |(\d+)\. )(.*)$/);
      if (m && (m[1] === '- [ ] ') === check && !!m[2] === ord) items.push(inl(m[3]));
      else if (/^ {2,}\S/.test(lines[i]) && items.length) items[items.length - 1] += `<br>${inl(lines[i].trim())}`;
      else break;
      i++;
    }
    const tag = ord ? 'ol' : 'ul';
    out.push(`<${tag}${check ? ' class="check"' : ''}${ord && li[2] !== '1' ? ` start="${li[2]}"` : ''} data-split="self">${items.map(x => `<li>${x}</li>`).join('')}</${tag}>`);
    continue;
  }
  const p = [l]; while (i + 1 < lines.length && lines[i + 1].trim() && !/^(#|>|\||- |\d+\. |---(page|signature)---)/.test(lines[i + 1])) p.push(lines[++i]);
  const txt = p.join(' ');
  { const h = inl(txt), keep = /:\s*$/.test(txt); // paragraphe long : coupable entre deux phrases
    if (h.length > 500) { const sp = h.split(/(?<=[.;!?»)])\s+(?![^<>]*>)/); if (keep && sp.length > 2) sp.push(sp.splice(-2).join(' ')); out.push(`<p data-split="self">${sp.map(x => `<span>${x} </span>`).join('')}</p>`); }
    else out.push(`<p${keep ? ' data-keep="1"' : ''}>${h}</p>`); }
  i++;
}

// Sommaire cliquable : une ligne par section, numéro de page posé par layout() après la mise en pages
const k = out.indexOf('<nav class="toc" aria-label="Sommaire"></nav>');
if (k >= 0) out[k] = `<nav class="toc" aria-label="Sommaire"><p class="toc-t">Sommaire</p><ol>${secs.map(s => `<li><a href="#${s.id}">${s.num}<span class="t">${inl(s.t)}</span><span class="pg" data-for="${s.id}"></span></a></li>`).join('')}</ol></nav>`;

// Polices locales (fontsource) cherchées depuis le dossier du .md ; sinon polices système (render.mjs le signale)
function font(pkg, file) {
  for (let d = dir; ; d = dirname(d)) {
    const f = resolve(d, 'node_modules', '@fontsource', pkg, 'files', file);
    if (existsSync(f)) return pathToFileURL(f).href;
    if (dirname(d) === d) return null;
  }
}
const faces = [['Figtree', 'figtree', 400, 'normal'], ['Figtree', 'figtree', 400, 'italic'], ['Figtree', 'figtree', 600, 'normal'], ['Figtree', 'figtree', 700, 'normal'],
  ['Cormorant', 'cormorant-garamond', 600, 'normal'], ['Cormorant', 'cormorant-garamond', 500, 'italic']]
  .map(([fam, pkg, w, s]) => { const u = font(pkg, `${pkg}-latin-${w}-${s}.woff2`); return u ? `@font-face{font-family:${fam};src:url(${u});font-weight:${w};font-style:${s}}` : ''; }).join('\n');
const css = readFileSync(new URL('../assets/sobre.css', import.meta.url), 'utf8');
const foot = esc(meta.pied ?? title).replace(/'/g, '&#39;').replace(/\\/g, '&#92;'); // inséré dans une chaîne JS entre '...' (bug « l'assemblée »)

const html = `<!DOCTYPE html>
<html lang="${esc(meta.langue ?? 'fr')}"><head><meta charset="utf-8"><title>${esc(title)}</title>
<meta name="author" content="${esc(meta.auteur ?? '')}"><meta name="description" content="${esc(meta.sujet ?? lead)}"><meta name="keywords" content="${esc(meta['mots-cles'] ?? meta.motscles ?? '')}">
<style>${faces}\n${css}</style></head>
<body data-pages-max="${esc(meta.pages ?? '')}" data-notes="${esc(meta.notes ?? 'oui')}">
<div id="flow">
${out.join('\n')}
</div>
<script>
const MM = 96 / 25.4;
function paginate() {
  const flow = document.getElementById('flow'), queue = [...flow.children];
  // largeurs de colonnes mesurées une fois sur le tableau entier : les morceaux coupés gardent les mêmes colonnes
  flow.querySelectorAll('table').forEach(t => { const w = [...t.querySelectorAll('thead th')].map(th => th.getBoundingClientRect().width); t.querySelectorAll('thead th').forEach((th, k) => { th.style.width = w[k] + 'px'; }); t.style.tableLayout = 'fixed'; });
  let body = null, sec = '';
  // nouvelle page ; les titres restés en bas de la précédente la suivent
  const newPage = () => {
    const prev = body, carry = [];
    while (prev?.lastElementChild?.dataset.keep && prev.children.length > 1) { const c = prev.lastElementChild; c.remove(); carry.unshift(c); }
    const p = document.createElement('section');
    p.className = 'page';
    // haut et bas de page répétés : hors de la lecture d'écran (artefacts dans le PDF balisé)
    p.innerHTML = '<header class="head" aria-hidden="true"><span>${foot}</span><span></span></header><div class="body"></div><footer class="foot" aria-hidden="true"><span></span><b></b></footer>';
    flow.before(p); body = p.querySelector('.body');
    carry.forEach(c => { c.classList.remove('cont'); body.append(c); });
  };
  const bottom = () => body.getBoundingClientRect().bottom;
  const over = el => el.getBoundingClientRect().bottom > bottom() + 0.5;
  const room = el => bottom() - el.getBoundingClientRect().bottom;

  // place restante en fin de document ou avant un saut forcé : zone « Notes » lignée, jamais une demi-page vide
  function notes() {
    if (!body || !body.children.length || document.body.dataset.notes === 'non') return;
    const left = bottom() - body.lastElementChild.getBoundingClientRect().bottom;
    if (left < 45 * MM) return;
    const n = document.createElement('div'); n.className = 'notes';
    n.innerHTML = '<p>Notes</p>'; n.style.height = (left - 10 * MM) + 'px'; body.append(n);
  }

  // coupe el (liste, tableau) : la tête reste sur la page, la suite revient dans la file
  function split(el, min) {
    const sel = el.dataset.split, cont = sel === 'self' ? el : el.querySelector(sel);
    const head = el.cloneNode(false); let hc = head;
    if (cont !== el) for (const c of el.children) { if (c === cont) head.append(hc = c.cloneNode(false)); else head.append(c.cloneNode(true)); }
    body.append(head);
    let k = 0;
    while (cont.firstElementChild) {
      const u = cont.firstElementChild; hc.append(u);
      if (over(head)) { cont.prepend(u); break; }
      k++;
    }
    if (cont.children.length === 1 && k >= 2) { cont.prepend(hc.lastElementChild); k--; } // pas une ligne seule en haut de la page suivante
    if (k < min || !cont.firstElementChild) { cont.prepend(...hc.children); head.remove(); return false; }
    if (el.tagName === 'OL') el.start = (head.start || 1) + hc.children.length;
    el.classList.add('cont');
    return true;
  }

  while (queue.length) {
    const el = queue.shift();
    if (el.classList.contains('brk')) { notes(); el.remove(); body = null; continue; }
    if (el.dataset.sec !== undefined) sec = el.dataset.sec;
    if (!body) newPage();
    body.append(el);
    body.parentElement.querySelector('.head span:last-child').textContent ||= sec;
    const fresh = body.children.length === 1;
    if (el.dataset.keep && !fresh && room(el) < 18 * MM) { newPage(); body.append(el); continue; }
    if (!over(el)) continue;
    el.remove();
    if (el.dataset.split && split(el, fresh ? 1 : 2)) { newPage(); queue.unshift(el); continue; }
    if (el.dataset.split && !el.dataset.tried) { el.dataset.tried = '1'; if (!fresh) newPage(); queue.unshift(el); continue; } // retente la coupe en haut de la page suivante
    if (!fresh) newPage();
    body.append(el); // trop grand même seul : signalé par render.mjs
  }
  notes();
  flow.remove();
}
// remplissage réel (hors zone Notes) de la dernière page
function lastFill() {
  const b = [...document.querySelectorAll('.page .body')].at(-1), r = b.getBoundingClientRect();
  const l = [...b.children].filter(k => !k.matches('.notes')).at(-1);
  return l ? (l.getBoundingClientRect().bottom - r.top) / r.height : 0;
}
// dernière page presque vide : on resserre un peu (2 crans) si cela fait gagner la page, sinon mise en pages normale
const SRC = document.getElementById('flow').innerHTML;
function run(level) {
  document.querySelectorAll('.page').forEach(p => p.remove());
  if (!document.getElementById('flow')) { const f = document.createElement('div'); f.id = 'flow'; f.innerHTML = SRC; document.body.prepend(f); }
  document.documentElement.dataset.serre = level;
  paginate();
  return document.querySelectorAll('.page').length;
}
function layout() {
  const n0 = run(0);
  if (n0 > 1 && lastFill() < 0.5 && !(run(1) < n0) && !(run(2) < n0)) run(0);
  const pages = [...document.querySelectorAll('.page')];
  pages.forEach((p, k) => { p.querySelector('.foot b').textContent = (k + 1) + ' / ' + pages.length; });
  document.querySelectorAll('.toc .pg').forEach(s => { const h = document.getElementById(s.dataset.for); s.textContent = h ? pages.indexOf(h.closest('.page')) + 1 : '?'; });
  pages[0].querySelector('.head').remove(); // la 1re page porte le titre du document
}
window.ready = document.fonts.ready.then(layout);
</script>
</body></html>`;
const dst = src.replace(/\.md$/i, '') + '.html';
writeFileSync(dst, html);
console.log(`${dst} : ${out.length} blocs`);
