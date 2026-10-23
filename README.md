# Leu Village — site web

Site vitrine statique de Leu Village (Saint-Leu, La Réunion), avec deux activités séparées :

- **Travailler** : coworking (`coworking.html`) et salle de réunion (`salle-de-reunion.html`) ;
- **Séjourner** : chambres du Village et locations Leu Boucan (`meubles.html`).

L'accueil (`index.html`) est un point d'entrée court vers ces deux univers. `reserver.html` accueillera la réservation en ligne du coworking et de la salle (« bientôt disponible ») et renvoie vers leuboucan.re pour les logements, `contact.html` regroupe les coordonnées, `404.html` est servie par GitHub Pages pour toute URL inconnue.

Publication : <https://harris220.github.io/LeuVillage-Prod/>

## Organisation

| Fichier | Rôle |
| --- | --- |
| `assets/css/main.css` | Design system (couleurs crème/corail/ambre, typographie, composants) |
| `assets/js/main.js` | Interface : menu, animations, onglets, filtres, galeries, carte |
| `assets/js/config.js` | Configuration **publique** (aucun secret) : e-mail de contact, futur backend |
| `assets/js/request.js` | Couche réseau séparée de l'interface (lien e-mail du contact aujourd'hui, API Go plus tard) |
| `assets/js/forms.js` | Formulaires : validation, récapitulatif et prix indicatif ; contact par e-mail ; réservation activée quand l'API est configurée |
| `assets/fonts/` | Polices auto-hébergées (Fraunces, Instrument Sans — licence OFL) |
| `images/` | Photos en AVIF + WebP, plusieurs largeurs (`nom-480.avif`, `nom-800.webp`…) |
| `sitemap.xml`, `.nojekyll` | Plan du site (URL absolues) ; désactive Jekyll sur GitHub Pages |

Aucune dépendance JavaScript tierce, aucun script externe, aucun cookie ni stockage navigateur.

## Déploiement (GitHub Pages)

- Le site est publié depuis la racine de ce dépôt (branche `master`).
- Tous les chemins sont **relatifs**, donc compatibles avec le sous-chemin `/LeuVillage-Prod/`.
- Exception : `404.html` utilise des chemins absolus `/LeuVillage-Prod/…`, car GitHub Pages la sert à n'importe quelle profondeur d'URL. **Si le site passe sur un domaine personnalisé**, remplacer `/LeuVillage-Prod/` par `/` dans ce fichier.
- Les balises `canonical`, `og:url`, `og:image`, les données structurées et `sitemap.xml` utilisent l'URL absolue `https://harris220.github.io/LeuVillage-Prod/` : à rechercher-remplacer en cas de changement d'adresse.
- Déclarer `https://harris220.github.io/LeuVillage-Prod/sitemap.xml` dans Google Search Console. (Un `robots.txt` n'est pris en compte qu'à la racine du domaine : inutile sous un sous-chemin.)
- Dans *Settings → Pages*, vérifier que **Enforce HTTPS** est coché.

Test local : servir ce dossier avec n'importe quel serveur statique (par exemple `python -m http.server 8000`), puis ouvrir `http://localhost:8000/`.

## Réservation et formulaires : fonctionnement actuel (sans backend)

Il n'y a **aucun serveur** : le site ne reçoit ni ne stocke aucune donnée.

- **Réservation coworking et salle de réunion** (`reserver.html`) : elle se fera **uniquement sur le site**, avec des comptes clients gérés par le futur backend Go. En attendant, le visiteur peut composer sa réservation (formule, dates, horaire) et voir le prix indicatif, mais le bouton « Réserver en ligne » est **désactivé** et un encadré « Réservation en ligne bientôt disponible » renvoie vers le téléphone et la page Contact. Aucune donnée n'est envoyée, aucun e-mail n'est préparé.
- **Logements (chambres du Village, appartements, bungalows)** : réservation sur <https://www.leuboucan.re/> (moteur de réservation existant). L'onglet « Séjour » de `reserver.html` et les fiches de `meubles.html` y renvoient.
- **Formulaire de contact** (`contact.html`) : après vérification des champs, un panneau propose **Ouvrir ma messagerie** (e-mail pré-rempli `mailto:` vers `contact@leuvillage.re`, envoyé seulement si le visiteur clique sur *Envoyer*) ou **Copier la demande**. Au-delà d'environ 1 900 caractères encodés, le corps de l'e-mail est raccourci (texte complet copiable). Sans JavaScript, le formulaire se rabat sur `action="mailto:"`.

## Intégration future du backend Go (non réalisée)

Rien n'est branché aujourd'hui : `api.baseUrl` est vide dans `assets/js/config.js`, donc aucun appel réseau n'est fait. Pour brancher l'API :

1. Renseigner `api.baseUrl` (HTTPS obligatoire) et les chemins `api.endpoints.booking` / `api.endpoints.contact`. Dès que `booking` est renseigné, `forms.js` active le bouton « Réserver en ligne » et masque l'encadré « bientôt disponible ».
2. Ajouter l'origine de l'API à la directive `connect-src` de la CSP (balise `<meta http-equiv="Content-Security-Policy">` de `reserver.html` et `contact.html`).

`request.js` envoie alors un `POST` JSON avec délai d'attente (`timeoutMs`), redirections refusées, contrôle du statut HTTP et du type de réponse ; en cas d'échec, le visiteur voit un message d'erreur et le téléphone. Il envoie aujourd'hui les requêtes **sans cookies** (`credentials: "omit"`) : à adapter quand les comptes clients existeront (voir ci-dessous).

Besoins envisagés, **à définir avec le backend** (aucun contrat figé) :

- **comptes clients** : inscription, connexion, déconnexion, mot de passe oublié, « mes réservations » ;
- **réservation** coworking et salle : `type` (`coworking`, `salle`) et les champs du formulaire (`formule`, `poste`, `jours`, `date_debut`, `duree`, `date`, `heure_debut`, `participants`, `prenom`, `nom`, `email`, `telephone`, `societe`, `message`, `consentement`, `total_indicatif`), puis disponibilités en temps réel (postes, salle) ;
- **contact** : `sujet`, coordonnées et message.

À prévoir côté serveur :

- **revalider toutes les données** (longueurs : prénom/nom 80, e-mail 254, téléphone 30, société 120, message 1 000 caractères ; formats ; dates futures ; jours ouvrés ; valeurs autorisées) et **recalculer les prix** : le total envoyé par le navigateur n'est qu'indicatif ;
- **authentification** : mots de passe hachés (Argon2id ou bcrypt), session en cookie `HttpOnly`, `Secure`, `SameSite=Lax` ou `Strict`, protection CSRF, limitation des tentatives de connexion, jetons de réinitialisation à usage unique et courte durée ; ne jamais stocker de jeton d'accès dans `localStorage` ;
- **autorisations** : un client ne voit et ne modifie que ses propres réservations (contrôle côté serveur à chaque requête) ;
- **même site** recommandé : servir le site et l'API sous le même domaine (par ex. `leuvillage.re` et `api.leuvillage.re`), car les cookies d'un autre domaine que `github.io` sont bloqués par de plus en plus de navigateurs ; il faudra alors `credentials: "include"` dans `request.js` et, côté API, `Access-Control-Allow-Credentials: true` avec une origine explicite ;
- HTTPS uniquement ; CORS limité à l'origine du site — **CORS n'est pas une authentification** et ne remplace pas les contrôles côté serveur ;
- limitation de débit et protection anti-spam (champ piège, CAPTCHA respectueux de la vie privée) ;
- secrets (SMTP, clés, paiement éventuel) **uniquement côté serveur**, jamais dans ce dépôt ;
- RGPD : finalité, durée de conservation, information des personnes, suppression du compte.

## Sécurité

- **CSP** en `<meta>` sur chaque page (GitHub Pages ne permet pas d'en-têtes HTTP personnalisés) : scripts, styles, polices et images uniquement depuis le site ; cadres limités à Google Maps (chargé seulement au clic) ; `object-src 'none'` ; `form-action 'self' mailto:`. Aucun script ni style inline.
- Une CSP en `<meta>` ne gère pas `frame-ancestors` (protection contre l'affichage du site dans un cadre) ni les rapports de violation.
- `Referrer-Policy` via `<meta name="referrer" content="strict-origin-when-cross-origin">` ; liens externes en `target="_blank" rel="noopener noreferrer"`.
- Paramètres d'URL de `reserver.html` filtrés par liste blanche ; aucun `innerHTML` alimenté par des données du visiteur ; formulaires de réservation sans `action` (aucun envoi possible tant que l'API n'est pas branchée).

En-têtes recommandés si un proxy ou CDN (Cloudflare, par exemple) est placé devant un domaine personnalisé — ils ne peuvent pas être définis par un fichier HTML :

```
Content-Security-Policy: (reprendre celle des pages) ; frame-ancestors 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
X-Frame-Options: DENY
Cross-Origin-Opener-Policy: same-origin
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

(Sur `*.github.io`, GitHub envoie déjà `Strict-Transport-Security`.) En cas de domaine personnalisé : vérifier le domaine dans les paramètres GitHub Pages du compte (contre la prise de contrôle de domaine), activer DNSSEC et un enregistrement CAA chez le registrar si possible.

## Contenus à valider

- **Photos du coworking et de la salle** : images d'illustration (générées, mention affichée sur le site) à remplacer par de vraies photos. Garder les mêmes noms de fichiers et largeurs (480, 800, 1024 px) en AVIF et WebP.
- **Adresse** : le site affiche « Pointe des Châteaux, 97436 Saint-Leu » (livret Leu Village) ; leuboucan.re indique « 5 Avenue des Artisans, 97416 ST LEU ».
- **Tarifs Leu Boucan** : prix « à partir de » relevés sur leuboucan.re, à tenir à jour.
- **Horaires** : l'indication « Ouvert maintenant » est calculée à partir de 7h–18h du lundi au vendredi (heure de La Réunion) et ne tient pas compte des jours fériés ni des fermetures.
- **Chambres du Village** : leur réservation renvoie vers l'accueil de leuboucan.re ; vérifier qu'elles y sont bien proposées.
