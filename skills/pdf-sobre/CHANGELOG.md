# Changelog pdf-sobre

## 1.0.0 (2026-11-20)
- Création par le CTO sur décision de l'utilisateur (tri des skills du 20/11) : remplace pdf-luxe.
- Moteur de pagination repris du guide « Claude, ton second cerveau » (validé, relu par un contrôleur indépendant, 18/11), généralisé à tout Markdown.
- Ajout : resserrage automatique (2 crans) quand la dernière page est presque vide, zone Notes en dernier recours, contrôle bloquant du remplissage (75 %, 40 % avec Notes).
- Essai : exemples/exemple.md -> 2 pages, remplies à 97 % et 91 %, OK. Essai long (4 pages) : 93, 95, 98, 77 % + Notes, OK.


## 1.1.0 (2026-11-20, super-skills)
- Repris de pdf-luxe : le nombre de pages demandé se tient (`pages: N` dans l'en-tête, render.mjs bloque au-delà) ; déclencheurs « beau PDF », « premium », « élégant ». Le style ivoire et or et la grille 2 colonnes ne sont pas repris (style abandonné par l'utilisateur).
- Essai : exemple.md -> 2 pages, 97 % et 91 %, OK (inchangé) ; avec `pages: 1` -> ÉCHEC « 2 pages pour 1 demandées » (code 1).

## 1.2.0 (2026-11-20, CTO, demande de l'utilisateur via agent-chef)
Style inchangé ; seulement ce qui sert dans un PDF (rien d'animé).
- Signets depuis les titres et PDF balisé (structure, `/Lang`, titre affiché) : options `outline` et `tagged` de Playwright. En-tête et pied de page répétés en `aria-hidden`.
- Sommaire cliquable facultatif (`sommaire: oui`), numéros de page posés après la mise en pages.
- Ancres de section (`#titre-en-minuscules`) pour les liens internes.
- Métadonnées Titre, Auteur, Sujet (`sujet:` ou le chapeau), Mots-clés (`mots-cles:`), Créateur « pdf-sobre » : écrites par mise à jour incrémentale du PDF, sans nouvelle dépendance. `langue:` pour un document non français.
- Corrigé : les clés d'en-tête avec tiret n'étaient pas lues ; les signets collaient les mots d'un titre sur deux lignes (« sansoubli ») et le numéro de section (« 01Avant ») : `white-space: pre-wrap` sur les titres, numéro de section en ligne.
- render.mjs bloque en plus : lien interne cassé, lien non cliquable dans le PDF, sommaire sans numéro, PDF sans signets ou non balisé.
- Essais (relus avec pypdf, lecteur indépendant) : exemple.md -> 2 pages, 97 % et 91 %, OK, 2 liens (1 externe, 1 interne vers la page 1), métadonnées complètes, 8 signets ; document long avec sommaire -> 6 pages, OK, 9 liens du sommaire vers les bonnes pages (1, 2, 3, 3, 3, 3, 4, 5, 5) ; lien vers une ancre absente -> ÉCHEC (code 1) ; `pages: 1` -> ÉCHEC (code 1). Sommaire sur le document de 2 pages -> 3e page à 37 %, ÉCHEC : le sommaire ne sert qu'à partir de 4 pages.

## 1.3.0 (2026-11-20, corrections après le banc : 5 cas joués, moyenne 7,8)
- build.mjs : titre avec apostrophe droite (« l'assemblée ») ne casse plus la mise en pages (avant : « erreur JS : Unexpected identifier », 0 page HTML ; après : OK) ; `chapeau: non` et `notes: non` pour un texte « tel quel » ; `:---:` centre ; `___` = champ à remplir ; `---signature---` = zone de signature ; dernière ligne « Total » avec filet ; montants et unités insécables ; largeur des colonnes mesurée une fois et gardée sur toutes les pages d'un tableau coupé.
- render.mjs : sortie gardée dans `<nom>-rendu.txt` à côté du PDF (preuve du contrôle) ; signets relus dans le PDF et comparés un à un aux titres (bloquant) ; `notes: non` : dernière page courte = avertissement.
- sobre.css : en-têtes de colonnes jamais coupés au milieu d'un mot, classes .c, .champ, .sign, tr.total.
- SKILL.md : « sans rien ajouter », info absente en `___` ou `<A_REMPLIR>`, règle non vérifiée en INCONNU, contrôle des PNG écrit dans le fichier de rendu.
- Essais : exemple.md inchangé (2 pages, 97 et 91 %, 8 signets conformes) ; compte rendu avec apostrophe, tableau centré, total, signature (1 page, OK) ; tableau de 70 lignes sur 4 pages : colonnes identiques, en-tête répété (page 4 à 21 % refusée à juste titre).
- Non fait : réglage manuel des largeurs de colonnes (la mesure automatique suffit pour les cas du banc).
