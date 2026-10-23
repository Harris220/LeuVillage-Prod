/* ==========================================================================
   Leu Village — configuration publique du site
   Ce fichier est servi tel quel au navigateur : il est lisible par tout le monde.
   N'y placez JAMAIS de secret (clé API, mot de passe, jeton, identifiant privé).
   ========================================================================== */
window.LEU_CONFIG = Object.freeze({
  /* Destinataire des demandes préparées par le formulaire de contact (envoi par e-mail). */
  contact: Object.freeze({
    email: "contact@leuvillage.re",
    phone: "+262 693 02 57 57",
  }),

  /* Point d'intégration du futur backend Go.
     Tant que `baseUrl` est vide, AUCUN appel réseau n'est fait : la réservation
     en ligne reste « bientôt disponible » et le formulaire de contact prépare
     un e-mail (mailto:) que le visiteur envoie depuis sa messagerie.
     Pour brancher l'API plus tard :
       - renseigner `baseUrl` (HTTPS obligatoire, ex. "https://api.exemple.re/")
         et le chemin de chaque point d'entrée dans `endpoints` ;
       - ajouter l'origine de l'API à la directive `connect-src` de la CSP
         (balise <meta http-equiv="Content-Security-Policy"> de chaque page). */
  api: Object.freeze({
    baseUrl: "",
    endpoints: Object.freeze({
      booking: "",
      contact: "",
    }),
    timeoutMs: 10000,
  }),
});
