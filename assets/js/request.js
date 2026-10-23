/* ==========================================================================
   Leu Village — envoi des demandes (couche réseau, séparée de l'interface)

   Aujourd'hui (site statique, aucun backend) :
     le formulaire de contact devient un e-mail pré-rempli (lien mailto:) ;
     la réservation en ligne reste désactivée (« bientôt disponible »).
   Demain (backend Go) :
     si `LEU_CONFIG.api` est renseigné, `postJSON` envoie la demande en JSON
     avec délai d'attente, contrôle du statut HTTP et de la réponse.
     Aucun contrat d'API n'est figé ici : le format est à définir avec le backend,
     qui devra de toute façon revalider toutes les données côté serveur.
   ========================================================================== */
(() => {
  "use strict";

  const config = window.LEU_CONFIG || {};
  const api = config.api || {};
  const MAILTO_MAX = 1900; // marge sous la limite d'URL de certains clients mail

  /* Erreur typée pour que l'interface affiche un message adapté */
  class RequestError extends Error {
    constructor(kind, message, status = 0) {
      super(message);
      this.name = "RequestError";
      this.kind = kind; // "config" | "timeout" | "network" | "http" | "response"
      this.status = status;
    }
  }

  /* URL d'un point d'entrée, ou null si l'API n'est pas configurée (cas actuel) */
  function endpointUrl(name) {
    const base = typeof api.baseUrl === "string" ? api.baseUrl.trim() : "";
    const path = api.endpoints && typeof api.endpoints[name] === "string" ? api.endpoints[name].trim() : "";
    if (!base || !path) return null;
    let url;
    try {
      url = new URL(path, base);
    } catch {
      throw new RequestError("config", "Adresse d’API invalide dans la configuration.");
    }
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
      throw new RequestError("config", "L’API doit être servie en HTTPS.");
    }
    return url.href;
  }

  const apiEnabled = (name) => {
    try {
      return endpointUrl(name) !== null;
    } catch {
      return false;
    }
  };

  /* POST JSON avec délai d'attente ; ne transmet aucun cookie ni identifiant */
  async function postJSON(name, payload) {
    const url = endpointUrl(name);
    if (!url) throw new RequestError("config", "Aucune API configurée.");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Number(api.timeoutMs) || 10000);
    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
        credentials: "omit",
        mode: "cors",
        redirect: "error",
        referrerPolicy: "strict-origin-when-cross-origin",
        signal: controller.signal,
      });
    } catch (err) {
      if (err && err.name === "AbortError") throw new RequestError("timeout", "Le serveur met trop de temps à répondre.");
      throw new RequestError("network", "Connexion impossible au serveur.");
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) throw new RequestError("http", `Le serveur a répondu ${res.status}.`, res.status);
    const type = res.headers.get("Content-Type") || "";
    if (res.status === 204 || !type.includes("application/json")) return null;
    try {
      return await res.json();
    } catch {
      throw new RequestError("response", "Réponse du serveur illisible.", res.status);
    }
  }

  /* Texte découpé en caractères entiers : une moitié d'émoji isolée ferait échouer encodeURIComponent */
  const codePoints = (s) => Array.from(String(s), (c) => (/^[\uD800-\uDFFF]$/.test(c) ? "�" : c));

  /* Lien mailto: sûr : destinataire fixe, sujet et corps encodés (pas d'injection d'en-têtes) */
  function mailtoHref({ subject, body }) {
    const to = (config.contact && config.contact.email) || "contact@leuvillage.re";
    const build = (t) => `mailto:${to}?subject=${encodeURIComponent(codePoints(subject).join(""))}&body=${encodeURIComponent(t)}`;
    const chars = codePoints(body);
    const href = build(chars.join(""));
    if (href.length <= MAILTO_MAX) return { href, truncated: false };
    /* Garde le plus long début du message qui tient dans la limite, suivi d'une mention */
    const suffix = "\n\n[…] Message raccourci : la demande complète peut être copiée depuis le site.";
    let lo = 0;
    let hi = chars.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (build(chars.slice(0, mid).join("") + suffix).length <= MAILTO_MAX) lo = mid;
      else hi = mid - 1;
    }
    return { href: build(chars.slice(0, lo).join("") + suffix), truncated: true };
  }

  window.LeuVillage = Object.assign(window.LeuVillage || {}, {
    request: Object.freeze({ apiEnabled, postJSON, mailtoHref, RequestError }),
  });
})();
