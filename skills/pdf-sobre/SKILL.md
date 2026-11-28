---
name: pdf-sobre
description: Crée un PDF A4 sobre, classique et précis (fiche, guide, compte rendu, devis expliqué, dossier, mode d'emploi) à partir d'un texte en Markdown, avec une mise en pages automatique qui ne laisse jamais de page vide ou à moitié vide, ni de titre seul en bas de page, avec signets, liens cliquables, sommaire cliquable au besoin, métadonnées et PDF balisé pour l'accessibilité. À utiliser dès qu'on demande un PDF, une fiche à imprimer, un document propre, « fais-moi un PDF », « mets ça en page », « un guide en PDF », « un beau PDF », « PDF premium ou élégant », « 2 pages maximum », même si le mot « sobre » n'est pas dit. Alternative sobre à pdf-luxe.
---

# PDF sobre

Le style : sobre, classique, ergonomique, esthétique, simple et précis. Papier blanc, encre presque noire, un seul accent bleu encre, titres en Cormorant Garamond, texte en Figtree. Pas de violet, pas de dégradé, pas d'ombre, pas d'emoji. Le document doit se lire vite et s'imprimer proprement.

Fichiers du skill :
- `scripts/build.mjs` : Markdown -> HTML A4, avec le moteur de pagination (repris du guide validé le 18/11).
- `scripts/render.mjs` : HTML -> PDF + un PNG par page, avec contrôles bloquants.
- `assets/sobre.css` : la charte. Une charte client (couleurs, polices) se met en tête du `:root`, rien d'autre ne change.
- `exemples/exemple.md` et `exemples/exemple.pdf` : un document de 2 pages qui montre tout le format.

## 1. Le contenu d'abord
- Écris tout le texte avant la mise en pages. Coupe ce qui ne sert pas au lecteur. N'invente jamais un contenu pour remplir une page.
- Nombre de pages demandé (« 2 pages max ») : le mettre dans `pages:` et le tenir ; mieux vaut couper une phrase que déborder.
- « Sans rien ajouter », « tel quel » : recopier le texte, aucun détail, calcul ni date ajouté ; `chapeau: non` et `notes: non`.
- Une info absente (date du devis, nom, montant) : `___` ou `<A_REMPLIR>`, jamais déduite en silence ; une règle ou un chiffre non lu sur une source ouverte : INCONNU ou « à vérifier », jamais écrit comme sûr.
- Phrases courtes, un titre de section qui dit ce qu'on y trouve, un chiffre étiqueté s'il compte (VÉRIFIÉ avec source datée, ESTIMÉ, HYPOTHÈSE, INCONNU).

## 2. Le format Markdown accepté
```
---                       (en-tête facultatif)
surtitre: Fiche pratique
auteur: <nom>
date: Novembre 2026
pied: <texte du haut de page, sinon le titre>
numeros: non              (sections non numérotées ; par défaut 01, 02...)
pages: 2                  (nombre de pages maximum demandé : render bloque au-delà)
sommaire: oui             (sommaire cliquable avec numéros de page ; utile à partir de 4 pages)
mots-cles: devis, site    (métadonnées du PDF ; auteur et titre viennent de auteur: et du # titre)
sujet: <une phrase>       (métadonnée Sujet ; par défaut le chapeau)
langue: en                (langue du document pour les lecteurs d'écran ; fr par défaut)
chapeau: non              (le 1er paragraphe reste un paragraphe normal : texte à rendre tel quel)
notes: non                (jamais de zone Notes ; la dernière page peut rester courte, signalée sans bloquer)
---
# Titre du document
Chapeau : un paragraphe qui dit à quoi sert le document.

## Section          -> numérotée 01, 02...
### Sous-titre
Paragraphe avec **gras**, *italique*, `code`, [lien](https://...).
- puce / 1. numéro / - [ ] case à cocher
| Colonne | Chiffre |
|---|:---:|---:|    (:---: centre, ---: aligne à droite pour les chiffres)
| **Total** | | 1 250,00 € |   (dernière ligne qui commence par Total : filet et gras)
Nom : ___           (trois _ ou plus = champ à remplir à la main)
---signature---     (zone « Fait à ... le ... » + « Bon pour accord » : devis, accord, jamais coupée)
> [À retenir] Encadré avec libellé (Attention, Exemple, À retenir...)
> Citation sans libellé
---page---          (saut de page forcé, rare)
```
Une phrase qui finit par « : » reste toujours collée à ce qu'elle annonce.
Lien vers une section du document : `[voir les contrôles](#les-controles-dans-l-ordre)`, l'ancre est le titre `##` en minuscules, sans accents, mots reliés par des tirets. Un document à imprimer écrit aussi l'adresse lisible dans le texte : sur papier, un lien ne se clique pas.
Bloc de texte à chasse fixe (schéma, formule) : entouré de trois accents graves ; la taille s'ajuste à la ligne la plus longue et la phrase qui l'annonce reste avec lui.
Paragraphe de plus de 500 caractères : coupé automatiquement entre deux phrases (jamais au milieu d'une phrase) si une page le demande.
Tableau de 8 colonnes ou plus : police réduite (corps 7,4 pt, en-têtes 5,6 pt), césure dans les cellules, largeur minimale de 13 mm sur les colonnes étroites.
Texte à rendre identique : ne pas écrire `sommaire: oui` ; un sommaire ajoute des lignes et peut décaler la mise en pages.

## Ce que le PDF contient sans rien régler
Un PDF ne s'anime pas ; ce qui le rend agréable à l'écran, c'est la navigation. Chaque PDF sort avec :
- des signets (panneau latéral du lecteur) tirés des titres `#`, `##`, `###` ;
- des liens cliquables, externes et internes, et le sommaire cliquable si `sommaire: oui` ;
- les métadonnées Titre, Auteur, Sujet, Mots-clés (visibles dans les propriétés du fichier et par les moteurs de recherche) ;
- un PDF balisé : structure des titres, listes et tableaux, langue, titre affiché dans la barre du lecteur, en-têtes et pieds de page ignorés par les lecteurs d'écran.

## 3. Produire le PDF
Dans un dossier de travail (jamais dans le dossier du skill) :
1. Une seule fois : `npm i playwright-core @fontsource/figtree @fontsource/cormorant-garamond` (playwright-core 1.42 ou plus, pour les signets et le balisage). Le rendu passe par Edge s'il existe, sinon Chromium (`npx playwright install chromium`).
2. `node <skill>/scripts/build.mjs contenu.md` -> `contenu.html`.
3. `node <skill>/scripts/render.mjs contenu.html` -> `contenu.pdf` + `contenu-pages/01.png...`. Il affiche le remplissage de chaque page, relit les signets dans le PDF et finit par `OK` (code 0) ou `ÉCHEC` (code 1, problèmes listés). La même sortie est gardée dans `contenu-rendu.txt`, à côté du PDF : c'est la preuve du contrôle, elle part avec le livrable.

Ce que fait la mise en pages, sans rien à régler :
- un titre ou une phrase d'annonce n'est jamais le dernier élément d'une page ;
- les montants ne se coupent jamais (« 18 542,70 € ») ; les colonnes d'un tableau gardent la même largeur d'une page à l'autre ; les en-têtes de colonnes ne se coupent pas au milieu d'un mot ;
- listes et tableaux se coupent proprement (au moins 2 lignes en bas de page, jamais une ligne seule en haut de la suivante, en-tête de tableau répété) ;
- si la dernière page est remplie à moins de 50 %, le texte est resserré d'un ou deux crans, seulement si cela supprime cette page ;
- s'il reste quand même plus de 45 mm vides en fin de document (ou avant un `---page---`), une zone « Notes » lignée les occupe.

## 4. Contrôle (obligatoire avant de livrer)
- `render.mjs` doit finir par `OK`. Il bloque : débordement, titre seul en bas de page, phrase d'annonce séparée, page remplie à moins de 75 % (40 % si elle a une zone Notes), police non chargée, écart entre pages PDF et HTML, plus de pages que `pages:`, lien interne vers une section qui n'existe pas, lien non cliquable dans le PDF, sommaire sans numéro de page, PDF sans signets ou non balisé, titre sans signet au texte identique.
- En cas d'`ÉCHEC` sur le remplissage : raccourcir ou compléter le texte utile de la section concernée, ou déplacer un tableau ; jamais de remplissage artificiel. Relancer build puis render.
- Regarder chaque PNG en entier : alignements, coupures, équilibre, en-tête de tableau répété, aucune ligne seule en haut de page. Écrire en une ligne par page ce qui a été vu à la fin de `contenu-rendu.txt`. Livrer seulement quand tout est propre, avec le nombre de pages.

## Interdits
- Violet, dégradés, ombres, emojis, polices fantaisie.
- Contenu inventé pour remplir l'espace.
- Images de personnes réelles ou logos de marques sans accord.
- Livrer sans avoir lu `OK` et regardé chaque page.
