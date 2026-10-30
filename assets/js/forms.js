/* ==========================================================================
   Leu Village — formulaires (réservation & contact)
   Validation côté navigateur (confort uniquement : le futur backend devra
   tout revalider) et récapitulatif en temps réel.
   - Réservation (coworking, salle) : uniquement sur le site, via l'API Go une
     fois configurée ; d'ici là l'envoi est désactivé (« bientôt disponible »).
   - Contact : sans backend, le message s'ouvre dans la messagerie du visiteur
     (mailto:) ; rien n'est envoyé ni enregistré par le site lui-même.
   Dépend de : config.js, request.js (chargés avant ce fichier).
   ========================================================================== */
(() => {
  "use strict";

  const LV = window.LeuVillage || {};
  const request = LV.request;
  if (!request) return;

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const euro = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
  const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const phone = (window.LEU_CONFIG && window.LEU_CONFIG.contact && window.LEU_CONFIG.contact.phone) || "+262 693 02 57 57";

  /* Valeurs acceptées depuis l'URL (liste blanche : rien d'autre n'est lu) */
  const ALLOWED = {
    offre: ["coworking", "salle", "sejour"],
    formule: ["flex-jour", "flex-mois", "fixe", "pass"],
    duree: ["1h", "4h", "8h"],
  };
  const param = (params, name) => {
    const v = params.get(name);
    return ALLOWED[name].includes(v) ? v : null;
  };

  const MESSAGES = {
    required: "Ce champ est obligatoire.",
    email: "Indiquez une adresse e-mail valide (ex. nom@domaine.fr).",
    tel: "Indiquez un numéro de téléphone valide (ex. 0692 12 34 56).",
    past: "Choisissez une date à partir d’aujourd’hui.",
    weekend: "Le coworking est ouvert du lundi au vendredi.",
    order: "La date de départ doit être après la date d’arrivée.",
    consent: "Merci d’accepter l’utilisation de vos informations pour traiter votre demande.",
    choice: "Sélectionnez une option.",
    long: "Ce texte est trop long.",
  };

  /* ---------- Dates ---------- */
  const todayISO = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 10);
  };
  const isISODate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v);
  const parseISO = (v) => {
    const [y, m, day] = v.split("-").map(Number);
    return new Date(y, m - 1, day);
  };
  const longDate = (v) =>
    v && isISODate(v)
      ? new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(parseISO(v))
      : "";

  /* ---------- Validation ---------- */
  function fieldError(field) {
    const input = $("input, select, textarea", field);
    if (!input) return "";
    if (input.type === "radio") {
      const group = $$(`input[type="radio"]`, field).filter((r) => r.name === input.name);
      return input.required && !group.some((r) => r.checked) ? MESSAGES.choice : "";
    }
    if (input.type === "checkbox") return input.required && !input.checked ? MESSAGES.consent : "";
    const v = input.value.trim();
    if (input.required && !v) return MESSAGES.required;
    if (!v) return "";
    if (input.maxLength > 0 && v.length > input.maxLength) return MESSAGES.long;
    if (input.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return MESSAGES.email;
    if (input.type === "tel" && !/^\+?[\d\s.()-]{8,20}$/.test(v)) return MESSAGES.tel;
    if (input.type === "date") {
      if (!isISODate(v)) return MESSAGES.required;
      if (v < todayISO()) return MESSAGES.past;
      if (input.hasAttribute("data-weekday")) {
        const day = parseISO(v).getDay();
        if (day === 0 || day === 6) return MESSAGES.weekend;
      }
      if (input.dataset.after) {
        const other = document.getElementById(input.dataset.after);
        if (other && other.value && v <= other.value) return MESSAGES.order;
      }
    }
    return "";
  }

  function setFieldState(field, message) {
    const err = $(".field__error span", field);
    field.classList.toggle("is-invalid", Boolean(message));
    if (err) err.textContent = message;
    $$("input, select, textarea", field).forEach((el) => {
      if (message) el.setAttribute("aria-invalid", "true");
      else el.removeAttribute("aria-invalid");
    });
    return $("input, select, textarea", field);
  }

  function validateForm(form) {
    const errors = [];
    $$("[data-field]", form).forEach((field) => {
      if (field.closest("[hidden]")) return;
      const msg = fieldError(field);
      const input = setFieldState(field, msg);
      if (msg) errors.push({ field, input, msg });
    });
    return errors;
  }

  function showAlert(form, items) {
    const alert = $(".form-alert", form);
    if (!alert) return;
    const list = $("ul", alert);
    list.replaceChildren(
      ...items.map(({ field, input, msg, text }) => {
        const li = document.createElement("li");
        if (text) {
          li.textContent = text;
          return li;
        }
        const a = document.createElement("a");
        const label = $("label, .field__label", field);
        const name = field.dataset.errorLabel || (label ? label.textContent.replace(/[*]|\(facultatif\)/gi, "").trim() : "Champ");
        a.href = `#${input.id}`;
        a.textContent = `${name} : ${msg}`;
        a.addEventListener("click", (e) => {
          e.preventDefault();
          input.focus();
        });
        li.appendChild(a);
        return li;
      })
    );
    alert.classList.add("is-visible");
    alert.focus();
  }

  function wireLiveValidation(form) {
    $$("[data-field]", form).forEach((field) => {
      const check = () => setFieldState(field, fieldError(field));
      field.addEventListener("focusout", (e) => {
        if (field.contains(e.relatedTarget)) return;
        const input = $("input, select, textarea", field);
        if (input && (input.value || field.classList.contains("is-invalid"))) check();
      });
      ["input", "change"].forEach((type) =>
        field.addEventListener(type, () => {
          if (field.classList.contains("is-invalid")) check();
        })
      );
    });
  }

  /* ---------- Nombre animé (total) ---------- */
  function tweenNumber(el, to) {
    const from = parseFloat(el.dataset.value) || 0;
    const token = String(Date.now() + Math.random());
    el.dataset.value = String(to);
    el.dataset.tween = token;
    const final = () => {
      if (el.dataset.tween === token) el.textContent = euro.format(to);
    };
    if (reduceMotion() || from === to || document.hidden) {
      final();
      return;
    }
    const t0 = performance.now();
    const step = (t) => {
      if (el.dataset.tween !== token) return;
      const p = clamp((t - t0) / 500, 0, 1);
      el.textContent = euro.format(Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    setTimeout(final, 650); // filet de sécurité si l'onglet ne rafraîchit pas l'affichage
  }

  /* ---------- Texte de la demande ---------- */
  const val = (data, key) => (typeof data[key] === "string" ? data[key].trim() : "");

  function contactBlock(data) {
    return [
      `${val(data, "prenom")} ${val(data, "nom")}`.trim(),
      val(data, "email"),
      val(data, "telephone"),
      val(data, "societe"),
    ].filter(Boolean);
  }

  function buildRequestText({ intro, rows, data }) {
    const lines = ["Bonjour,", "", intro, ""];
    rows.forEach(([label, value]) => lines.push(`- ${label} : ${value}`));
    lines.push("", "Mes coordonnées :");
    contactBlock(data).forEach((l) => lines.push(`- ${l}`));
    const message = val(data, "message");
    if (message) lines.push("", "Message :", message);
    lines.push("", "Demande préparée depuis le site Leu Village.");
    return lines.join("\n");
  }

  /* ---------- Panneau « demande prête » (gabarit HTML + textContent uniquement) ---------- */
  function showPanel(form, { title, text, rows, mail, sent }) {
    const tpl = document.getElementById("tpl-request");
    if (!tpl) return;
    const panel = tpl.content.firstElementChild.cloneNode(true);
    $(".request-panel__title", panel).textContent = title;
    $(".request-panel__text", panel).textContent = text;
    const dl = $(".request-panel__rows", panel);
    rows.forEach(([label, value]) => {
      const row = document.createElement("div");
      row.className = "summary__row";
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      dd.textContent = value;
      row.append(dt, dd);
      dl.appendChild(row);
    });
    const status = $(".request-panel__status", panel);
    const mailLink = $("[data-request-mail]", panel);
    const copyBtn = $("[data-request-copy]", panel);
    const pre = $(".request-text", panel);
    if (sent) {
      $(".request-panel__actions", panel).remove();
      $(".more", panel).remove();
    } else {
      mailLink.href = mail.href;
      pre.textContent = mail.body;
      if (mail.truncated) status.textContent = "Votre message étant long, l’e-mail est raccourci : utilisez « Copier la demande » pour le coller en entier.";
      copyBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(mail.body);
          status.textContent = "Demande copiée : collez-la dans un e-mail à contact@leuvillage.re.";
        } catch {
          $(".more", panel).open = true;
          status.textContent = "Copie automatique impossible : sélectionnez le texte ci-dessous pour le copier.";
        }
      });
    }
    $("[data-request-edit]", panel).addEventListener("click", () => {
      panel.remove();
      form.hidden = false;
      const first = $("input:not([type=hidden]), select, textarea", form);
      if (first) first.focus();
    });
    form.hidden = true;
    form.after(panel);
    panel.focus({ preventScroll: true });
    panel.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "start" });
  }

  /* Envoi : API Go si configurée. Sans API, seul le formulaire de contact prépare un e-mail ;
     la réservation, elle, se fera uniquement sur le site (aucun envoi par e-mail). */
  async function deliver(form, kind, { subject, intro, rows, data, payload }) {
    const first = val(data, "prenom");
    if (!request.apiEnabled(kind)) {
      if (kind !== "contact") return;
      const body = buildRequestText({ intro, rows, data });
      showPanel(form, {
        title: `${first ? `${first}, votre` : "Votre"} demande est prête`,
        text: "Cliquez sur « Ouvrir ma messagerie » : un e-mail pré-rempli à destination de Leu Village s’ouvre. Il ne part qu’une fois que vous cliquez sur Envoyer dans votre messagerie.",
        rows,
        mail: { ...request.mailtoHref({ subject, body }), body },
      });
      return;
    }
    const btn = $('[type="submit"]', form);
    btn.classList.add("is-loading");
    btn.disabled = true;
    try {
      await request.postJSON(kind, payload);
      showPanel(form, {
        title: `Merci${first ? ` ${first}` : ""}, votre demande est envoyée`,
        text: "Nous revenons vers vous pour confirmer la disponibilité.",
        rows,
        sent: true,
      });
    } catch (err) {
      const reason = err && err.kind === "timeout" ? "Le serveur met trop de temps à répondre." : "L’envoi n’a pas abouti.";
      showAlert(form, [{ text: `${reason} Réessayez dans un instant, ou appelez-nous au ${phone}.` }]);
    } finally {
      btn.classList.remove("is-loading");
      btn.disabled = false;
    }
  }

  /* ---------- Réservation : coworking et salle de réunion ---------- */
  function initBooking() {
    const page = $("[data-booking]");
    if (!page) return;
    const params = new URLSearchParams(location.search);
    const offer = param(params, "offre");
    const tabsWrap = $("[data-tabs]", page);
    if (offer && tabsWrap && typeof tabsWrap.selectTab === "function") tabsWrap.selectTab(offer);

    $$("form[data-booking-form]", page).forEach((form) => {
      const type = form.dataset.bookingForm;
      const booking = form.closest(".booking");
      const out = (name) => booking.querySelector(`[data-out="${name}"]`);
      $$('input[type="date"]', form).forEach((input) => (input.min = todayISO()));

      if (offer === type) {
        const radio = (name, value) => $$(`input[type="radio"]`, form).find((r) => r.name === name && r.value === value);
        const formule = param(params, "formule");
        const duree = param(params, "duree");
        if (formule) radio("formule", formule)?.click();
        if (duree) radio("duree", duree)?.click();
      }

      const stepper = $("[data-stepper]", form);
      if (stepper) {
        const input = $("input", stepper);
        const min = parseInt(input.min, 10) || 1;
        const max = parseInt(input.max, 10) || 30;
        $$("button", stepper).forEach((b) =>
          b.addEventListener("click", () => {
            input.value = String(clamp((parseInt(input.value, 10) || min) + parseInt(b.dataset.step, 10), min, max));
            input.dispatchEvent(new Event("input", { bubbles: true }));
          })
        );
      }

      /* Calcule le récapitulatif ; renvoie les lignes lisibles et le total indicatif */
      const compute = () => {
        const data = Object.fromEntries(new FormData(form));
        let total = 0;
        const rows = [];
        if (type === "coworking") {
          const f = $('input[name="formule"]:checked', form);
          const days = clamp(parseInt(data.jours, 10) || 1, 1, 30);
          const daysField = $("[data-days-field]", form);
          if (daysField) daysField.hidden = !f || f.value !== "flex-jour";
          if (f) total = f.value === "flex-jour" ? Number(f.dataset.price) * days : Number(f.dataset.price);
          rows.push(["Formule", f ? f.dataset.label : "—"]);
          rows.push(["Poste", $('input[name="poste"]:checked', form)?.dataset.label || "—"]);
          rows.push(["Début", longDate(data.date_debut) || "À choisir"]);
          rows.push(["Durée", f ? (f.value === "flex-jour" ? `${days} jour${days > 1 ? "s" : ""}` : f.dataset.duration) : "—"]);
          booking.querySelector("[data-pass-hint]")?.classList.toggle("is-visible", Boolean(f && f.value === "flex-jour" && days >= 8));
        }
        if (type === "salle") {
          const dur = $('input[name="duree"]:checked', form);
          const hours = dur ? Number(dur.dataset.hours) : 0;
          const startSel = $('select[name="heure_debut"]', form);
          if (startSel && dur && startSel.dataset.hours !== String(hours)) {
            const current = startSel.value;
            const options = [];
            for (let h = 7; h <= 18 - hours; h++) options.push(`${String(h).padStart(2, "0")}:00`);
            startSel.dataset.hours = String(hours);
            startSel.replaceChildren(
              ...options.map((o) => {
                const opt = document.createElement("option");
                opt.value = o;
                opt.textContent = o.replace(":", "h");
                return opt;
              })
            );
            startSel.value = options.includes(current) ? current : options[Math.min(2, options.length - 1)];
          }
          const start = startSel ? startSel.value : "";
          if (dur) total = Number(dur.dataset.price);
          rows.push(["Durée", dur ? dur.dataset.label : "—"]);
          rows.push(["Date", longDate(data.date) || "À choisir"]);
          rows.push(["Horaire", start && hours ? `${start.replace(":", "h")} – ${String(parseInt(start, 10) + hours).padStart(2, "0")}h00` : "—"]);
          rows.push(["Participants", data.participants ? `${data.participants} pers.` : "—"]);
        }
        const keys = Array.from(booking.querySelectorAll(".summary [data-out]"))
          .map((el) => el.dataset.out)
          .filter((k) => k !== "total");
        rows.forEach(([, value], i) => {
          const el = keys[i] ? out(keys[i]) : null;
          if (el) el.textContent = value;
        });
        const totalEl = out("total");
        if (totalEl) tweenNumber(totalEl, total);
        return { data, total, rows };
      };

      form.addEventListener("input", compute);
      form.addEventListener("change", compute);
      compute();
      wireLiveValidation(form);

      /* Réservation en ligne : active seulement quand l'API Go est configurée (config.js) */
      const online = request.apiEnabled("booking");
      const submitBtn = $("[data-booking-submit]", form);
      const soon = $("[data-soon]", form);
      if (online) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.setAttribute("aria-label", "Réserver en ligne");
        }
        if (soon) soon.hidden = true;
      }

      form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (!online) return;
        const errors = validateForm(form);
        if (errors.length) {
          showAlert(form, errors);
          return;
        }
        $(".form-alert", form)?.classList.remove("is-visible");
        const { data, total, rows } = compute();
        deliver(form, "booking", {
          rows: [...rows, ["Total indicatif HT", `${euro.format(total)} €`]],
          data,
          payload: { type, ...data, total_indicatif: total },
        });
      });
    });
  }

  /* ---------- Contact ---------- */
  /* Lignes en plus dans la demande : chaque champ marqué data-row="Libellé" ajoute « Libellé : valeur » ;
     pour une liste, la valeur est le texte du choix ; pour un groupe de cases, la liste des cases cochées. */
  function extraRows(form) {
    return $$("[data-row]", form)
      .map((el) => {
        let value;
        if (el.matches("fieldset")) value = $$("input:checked", el).map((c) => c.value).join(", ");
        else if (el.matches("select")) value = el.value ? el.options[el.selectedIndex].text : "";
        else if (el.type === "date") value = longDate(el.value);
        else value = el.value.trim();
        return [el.dataset.row, value];
      })
      .filter(([, value]) => value);
  }

  function initContact() {
    const form = $("form[data-contact-form]");
    if (!form) return;
    wireLiveValidation(form);
    // ?formule=… (boutons des formules de la page Événements) : présélectionne le choix s'il existe
    const params = new URLSearchParams(location.search);
    $$("select[data-from-url]", form).forEach((sel) => {
      const wanted = params.get(sel.dataset.fromUrl);
      if (wanted && $$("option", sel).some((o) => o.value === wanted)) sel.value = wanted;
    });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const errors = validateForm(form);
      if (errors.length) {
        showAlert(form, errors);
        return;
      }
      $(".form-alert", form)?.classList.remove("is-visible");
      const data = Object.fromEntries(new FormData(form));
      const subjectSel = $('select[name="sujet"]', form);
      const topic = subjectSel ? subjectSel.options[subjectSel.selectedIndex].text : "Demande";
      // data-subject et data-topic-label : formulaire de la page Événements
      deliver(form, "contact", {
        subject: `${form.dataset.subject || "Contact site"} · ${topic}`,
        intro: `Ma demande concerne : ${topic.toLowerCase()}.`,
        rows: [[form.dataset.topicLabel || "Sujet", topic], ...extraRows(form)],
        data,
        payload: { ...data },
      });
    });
  }

  [initBooking, initContact].forEach((fn) => {
    try {
      fn();
    } catch (err) {
      console.error(`[Leu Village] ${fn.name}`, err);
    }
  });
})();
