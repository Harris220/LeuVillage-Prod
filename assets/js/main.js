/* ==========================================================================
   Leu Village — interface : navigation, animations, galeries
   JavaScript natif, sans dépendance. Tout le contenu reste lisible sans JS ;
   les animations sont un bonus et respectent « réduire les animations ».
   Les formulaires sont gérés à part (forms.js + request.js + config.js).
   ========================================================================== */
(() => {
  "use strict";

  const root = document.documentElement;
  root.classList.add("js");

  const mqReduce = matchMedia("(prefers-reduced-motion: reduce)");
  const mqFine = matchMedia("(hover: hover) and (pointer: fine)");
  const reduceMotion = () => mqReduce.matches;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const euro = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

  /* ---------- Boucle de défilement unique (rAF) ---------- */
  const scrollSubs = new Set();
  let ticking = false;
  const frame = () => {
    ticking = false;
    const y = window.scrollY;
    scrollSubs.forEach((fn) => fn(y));
  };
  const requestTick = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(frame);
    }
  };
  addEventListener("scroll", requestTick, { passive: true });
  addEventListener("resize", requestTick, { passive: true });

  /* ---------- Ancres internes : défilement natif + focus pour le clavier ---------- */
  function initAnchors() {
    document.addEventListener("click", (e) => {
      const link = e.target.closest('a[href^="#"]');
      if (!link || e.defaultPrevented) return;
      const hash = link.getAttribute("href");
      if (hash === "#") return;
      const target = hash === "#top" ? document.body : document.getElementById(decodeURIComponent(hash.slice(1)));
      if (!target) return;
      e.preventDefault();
      const behavior = reduceMotion() ? "auto" : "smooth";
      if (hash === "#top") {
        scrollTo({ top: 0, behavior });
        return;
      }
      target.scrollIntoView({ behavior, block: "start" });
      if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
      history.replaceState(null, "", hash);
    });
  }

  /* ---------- En-tête : se cache en descendant, revient en remontant ---------- */
  function initHeader() {
    const header = $("[data-header]");
    if (!header) return;
    let lastY = window.scrollY;
    let hidden = false;
    scrollSubs.add((y) => {
      header.classList.toggle("is-scrolled", y > 24);
      const delta = y - lastY;
      if (Math.abs(delta) < 8) return;
      const hide = delta > 0 && y > 220 && !root.classList.contains("menu-open");
      if (hide !== hidden) {
        hidden = hide;
        header.classList.toggle("is-hidden", hidden);
      }
      lastY = y;
    });
    header.addEventListener("focusin", () => {
      hidden = false;
      header.classList.remove("is-hidden");
    });
  }

  /* ---------- Menu mobile ---------- */
  function initMenu() {
    const btn = $(".menu-toggle");
    const menu = $("#mobile-menu");
    if (!btn || !menu) return;
    const label = $(".sr-only", btn);
    const outside = $$("main, .site-footer");
    menu.inert = true;
    const setOpen = (open) => {
      btn.setAttribute("aria-expanded", String(open));
      if (label) label.textContent = open ? "Fermer le menu" : "Ouvrir le menu";
      menu.classList.toggle("is-open", open);
      menu.inert = !open;
      root.classList.toggle("menu-open", open);
      outside.forEach((el) => (el.inert = open));
      document.body.classList.toggle("no-scroll", open);
      if (open) setTimeout(() => $("a", menu)?.focus({ preventScroll: true }), 420);
    };
    btn.addEventListener("click", () => setOpen(btn.getAttribute("aria-expanded") !== "true"));
    menu.addEventListener("click", (e) => {
      if (e.target.closest("a")) setOpen(false);
    });
    addEventListener("keydown", (e) => {
      if (e.key === "Escape" && menu.classList.contains("is-open")) {
        setOpen(false);
        btn.focus();
      }
    });
    matchMedia("(min-width: 1000px)").addEventListener("change", (e) => {
      if (e.matches) setOpen(false);
    });
  }

  /* ---------- Découpage des mots (titres animés) ---------- */
  function splitWords(el) {
    if (el.dataset.splitDone) return;
    el.dataset.splitDone = "1";
    let index = 0;
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const parts = child.textContent.split(/(\s+)/);
          if (parts.length === 1 && !parts[0].trim()) return;
          const frag = document.createDocumentFragment();
          parts.forEach((part) => {
            if (!part) return;
            if (!part.trim()) {
              frag.appendChild(document.createTextNode(part));
              return;
            }
            const outer = document.createElement("span");
            outer.className = "w";
            const inner = document.createElement("span");
            inner.textContent = part;
            inner.style.setProperty("--wi", index++);
            outer.appendChild(inner);
            frag.appendChild(outer);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== "BR") {
          walk(child);
        }
      });
    };
    walk(el);
  }

  /* ---------- Apparitions au défilement ---------- */
  function initReveal() {
    if (reduceMotion() || !("IntersectionObserver" in window)) return;
    $$("[data-stagger]").forEach((group) => {
      Array.from(group.children).forEach((child, i) => {
        if (!child.hasAttribute("data-reveal-img") && !child.hasAttribute("data-reveal")) child.setAttribute("data-reveal", "");
        child.style.setProperty("--i", i);
      });
    });
    $$("[data-split]").forEach(splitWords);

    const els = $$("[data-reveal], [data-reveal-img], [data-split]");
    if (!els.length) return;
    const vh = innerHeight;
    const pending = [];
    els.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < vh * 0.94 && r.bottom > 0) {
        el.classList.add("is-in", "no-anim");
        if (el.hasAttribute("data-reveal-img")) el.classList.add("is-revealed");
      } else {
        pending.push(el);
      }
    });
    root.classList.add("js-reveal");
    requestAnimationFrame(() => requestAnimationFrame(() => $$(".no-anim").forEach((el) => el.classList.remove("no-anim"))));

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          io.unobserve(el);
          el.classList.add("is-in");
          if (el.hasAttribute("data-reveal-img")) {
            const i = parseFloat(getComputedStyle(el).getPropertyValue("--i")) || 0;
            setTimeout(() => el.classList.add("is-revealed"), 1500 + i * 90);
          }
        });
      },
      { rootMargin: "0px 0px -7% 0px", threshold: 0 }
    );
    pending.forEach((el) => io.observe(el));
  }

  /* ---------- Parallaxe douce des images ---------- */
  function initParallax() {
    if (reduceMotion()) return;
    const els = $$("[data-parallax]");
    if (!els.length) return;
    const active = new Set();
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => (e.isIntersecting ? active.add(e.target) : active.delete(e.target))),
      { rootMargin: "15% 0px" }
    );
    els.forEach((el) => io.observe(el));
    scrollSubs.add(() => {
      if (!active.size) return;
      const vh = innerHeight;
      const factor = innerWidth < 700 ? 0.55 : 1;
      const reads = [];
      active.forEach((el) => {
        const box = el.closest(".parallax-wrap") || el.parentElement;
        reads.push([el, box.getBoundingClientRect(), el.offsetHeight - box.offsetHeight]);
      });
      reads.forEach(([el, r, extra]) => {
        const speed = parseFloat(el.dataset.parallax) || 0.1;
        const limit = Math.max(0, extra / 2);
        const y = clamp(-(r.top + r.height / 2 - vh / 2) * speed * factor, -limit, limit);
        el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
      });
    });
    requestTick();
  }

  /* ---------- Hero : diaporama + profondeur au défilement ---------- */
  function initHero() {
    const hero = $("[data-hero]");
    if (!hero) return;
    const media = $(".hero__media", hero);
    const inner = $(".hero__inner", hero);
    let heroH = hero.offsetHeight;
    addEventListener("resize", () => (heroH = hero.offsetHeight), { passive: true });

    if (!reduceMotion() && media && inner) {
      scrollSubs.add((y) => {
        if (y > heroH * 1.1) return;
        const p = clamp(y / heroH, 0, 1);
        media.style.transform = `translate3d(0, ${(y * 0.32).toFixed(1)}px, 0)`;
        inner.style.opacity = String(clamp(1 - p * 1.35, 0, 1));
        inner.style.transform = `translate3d(0, ${(y * -0.1).toFixed(1)}px, 0)`;
      });
    }

    const slides = $$(".hero__slide", hero);
    const bars = $$(".hero__bar", hero);
    const count = $("[data-hero-count]", hero);
    const pauseBtn = $(".hero__pause", hero);
    if (slides.length < 2) return;

    const DURATION = 7000;
    hero.style.setProperty("--slide-dur", `${DURATION}ms`);
    let index = 0;
    let timer = 0;
    let startedAt = 0;
    let remaining = DURATION;
    let paused = reduceMotion();
    let offscreen = false;
    hero.classList.toggle("is-paused", paused);
    pauseBtn?.setAttribute("aria-pressed", String(paused));

    const schedule = (ms) => {
      clearTimeout(timer);
      remaining = ms;
      if (paused || offscreen || document.hidden) return;
      startedAt = performance.now();
      timer = setTimeout(() => show(index + 1), ms);
    };
    const halt = () => {
      if (!timer) return;
      clearTimeout(timer);
      timer = 0;
      remaining = Math.max(400, remaining - (performance.now() - startedAt));
    };
    const show = (n) => {
      slides[index].classList.remove("is-active");
      index = (n + slides.length) % slides.length;
      slides[index].classList.add("is-active");
      bars.forEach((bar, i) => {
        bar.classList.remove("is-active");
        bar.classList.toggle("is-done", i < index);
        bar.setAttribute("aria-current", String(i === index));
      });
      if (bars[index]) {
        void bars[index].offsetWidth;
        bars[index].classList.add("is-active");
      }
      if (count) count.textContent = String(index + 1).padStart(2, "0");
      schedule(DURATION);
    };
    bars.forEach((bar, i) => bar.addEventListener("click", () => show(i)));
    pauseBtn?.addEventListener("click", () => {
      paused = !paused;
      hero.classList.toggle("is-paused", paused);
      pauseBtn.setAttribute("aria-pressed", String(paused));
      pauseBtn.setAttribute("aria-label", paused ? "Lancer le diaporama" : "Mettre le diaporama en pause");
      paused ? halt() : schedule(remaining);
    });
    new IntersectionObserver(([entry]) => {
      offscreen = !entry.isIntersecting;
      hero.classList.toggle("is-offscreen", offscreen);
      offscreen ? halt() : schedule(remaining);
    }).observe(hero);
    document.addEventListener("visibilitychange", () => (document.hidden ? halt() : schedule(remaining)));
    bars[0]?.classList.add("is-active");
    schedule(DURATION);
  }

  /* Images différées (diapositives 2 et suivantes) : chargées après la page */
  function hydrateDeferred() {
    const run = () =>
      $$("[data-defer-srcset], [data-defer-src]").forEach((node) => {
        if (node.dataset.deferSrcset) node.setAttribute("srcset", node.dataset.deferSrcset);
        if (node.dataset.deferSrc) node.setAttribute("src", node.dataset.deferSrc);
        node.removeAttribute("data-defer-srcset");
        node.removeAttribute("data-defer-src");
      });
    if (document.readyState === "complete") setTimeout(run, 300);
    else addEventListener("load", () => setTimeout(run, 300), { once: true });
  }

  /* ---------- Heure locale & statut d'ouverture du coworking (fuseau de La Réunion) ---------- */
  function initClock() {
    const clocks = $$("[data-clock]");
    const statuses = $$("[data-status]");
    if (!clocks.length && !statuses.length) return;
    const tz = "Indian/Reunion";
    let timeFmt;
    let partsFmt;
    try {
      timeFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
      partsFmt = new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    } catch {
      return;
    }
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const update = () => {
      const now = new Date();
      clocks.forEach((c) => {
        c.textContent = timeFmt.format(now);
        c.setAttribute("datetime", now.toISOString());
      });
      const parts = Object.fromEntries(partsFmt.formatToParts(now).map((p) => [p.type, p.value]));
      const day = days.indexOf(parts.weekday);
      const minutes = (parseInt(parts.hour, 10) % 24) * 60 + parseInt(parts.minute, 10);
      const weekday = day >= 0 && day <= 4;
      const open = weekday && minutes >= 420 && minutes < 1080;
      let text = "Ouvert maintenant · jusqu’à 18h";
      if (!open) {
        if (weekday && minutes < 420) text = "Fermé · ouvre à 7h";
        else if (day >= 4) text = "Fermé · réouverture lundi à 7h";
        else text = "Fermé · ouvre demain à 7h";
      }
      statuses.forEach((s) => {
        s.classList.toggle("is-open", open);
        const t = $("[data-status-text]", s);
        if (t) t.textContent = text;
      });
    };
    update();
    setInterval(update, 30000);
  }

  /* ---------- Compteurs (chiffres qui montent à l'apparition) ---------- */
  function initCounters() {
    const els = $$("[data-count]");
    if (!els.length || reduceMotion() || !("IntersectionObserver" in window)) return;
    const run = (el) => {
      const target = parseFloat(el.dataset.count);
      const final = euro.format(target);
      el.textContent = "0"; // la vraie valeur reste affichée tant que l'animation n'a pas commencé
      const t0 = performance.now();
      const dur = 1700;
      const step = (t) => {
        const p = clamp((t - t0) / dur, 0, 1);
        el.textContent = euro.format(Math.round(target * (1 - Math.pow(1 - p, 4))));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      setTimeout(() => (el.textContent = final), dur + 250); // valeur exacte garantie
    };
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          io.unobserve(e.target);
          run(e.target);
        }),
      { threshold: 0.5 }
    );
    els.forEach((el) => {
      if (el.getBoundingClientRect().top > innerHeight) io.observe(el);
    });
  }

  /* ---------- Cartes d'univers : toute la carte ouvre la page (relais du lien du titre) ---------- */
  function initCardLinks() {
    $$(".universe").forEach((card) => {
      const link = $(".universe__link", card);
      if (!link) return;
      card.addEventListener("click", (e) => {
        if (e.defaultPrevented || e.target.closest("a, button")) return;
        if (window.getSelection && String(window.getSelection()).length) return; // sélection de texte
        link.click();
      });
    });
  }

  /* ---------- Cartes d'univers : inclinaison 3D et lueur qui suivent la souris ---------- */
  function initTilt() {
    if (!mqFine.matches || reduceMotion()) return;
    $$("[data-tilt]").forEach((card) => {
      let raf = 0;
      card.addEventListener("pointermove", (e) => {
        if (e.pointerType !== "mouse") return;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          const r = card.getBoundingClientRect();
          const px = clamp((e.clientX - r.left) / r.width, 0, 1);
          const py = clamp((e.clientY - r.top) / r.height, 0, 1);
          card.classList.add("is-tilting");
          card.style.setProperty("--ry", `${((px - 0.5) * 6).toFixed(2)}deg`);
          card.style.setProperty("--rx", `${((0.5 - py) * 5).toFixed(2)}deg`);
          card.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
          card.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
        });
      });
      card.addEventListener("pointerleave", () => {
        cancelAnimationFrame(raf);
        card.classList.remove("is-tilting");
        card.style.setProperty("--rx", "0deg");
        card.style.setProperty("--ry", "0deg");
      });
    });
  }

  /* ---------- Onglets accessibles ---------- */
  function initTabs() {
    $$("[data-tabs]").forEach((wrap) => {
      const list = $('[role="tablist"]', wrap);
      if (!list) return;
      const tabs = $$('[role="tab"]', list);
      const panels = tabs.map((t) => document.getElementById(t.getAttribute("aria-controls")));
      const indicator = $(".tabs__indicator", list);
      const move = (tab, instant) => {
        if (!indicator || !tab) return;
        if (instant) indicator.classList.add("no-anim");
        indicator.style.setProperty("--x", `${tab.offsetLeft}px`);
        indicator.style.setProperty("--w", `${tab.offsetWidth}px`);
        if (instant) requestAnimationFrame(() => requestAnimationFrame(() => indicator.classList.remove("no-anim")));
      };
      const select = (tab, { focus = false, silent = false } = {}) => {
        tabs.forEach((t, i) => {
          const on = t === tab;
          t.setAttribute("aria-selected", String(on));
          t.tabIndex = on ? 0 : -1;
          if (!panels[i]) return;
          panels[i].hidden = !on;
          if (on && !silent) {
            panels[i].classList.remove("is-entering");
            void panels[i].offsetWidth;
            panels[i].classList.add("is-entering");
          }
        });
        move(tab);
        if (focus) tab.focus();
      };
      tabs.forEach((tab, i) => {
        tab.addEventListener("click", () => select(tab));
        tab.addEventListener("keydown", (e) => {
          const map = {
            ArrowRight: tabs[(i + 1) % tabs.length],
            ArrowLeft: tabs[(i - 1 + tabs.length) % tabs.length],
            Home: tabs[0],
            End: tabs[tabs.length - 1],
          };
          if (map[e.key]) {
            e.preventDefault();
            select(map[e.key], { focus: true });
          }
        });
      });
      const current = () => tabs.find((t) => t.getAttribute("aria-selected") === "true") || tabs[0];
      wrap.classList.add("is-ready");
      move(current(), true);
      addEventListener("resize", () => move(current(), true), { passive: true });
      if (document.fonts) document.fonts.ready.then(() => move(current(), true));
      /* Utilisé par forms.js pour ouvrir l'onglet demandé dans l'URL (valeur déjà filtrée) */
      wrap.selectTab = (value) => {
        const tab = tabs.find((t) => t.dataset.value === value);
        if (tab) select(tab, { silent: true });
      };
    });
  }

  /* ---------- Filtres des locations ---------- */
  function initFilters() {
    const bar = $("[data-filters]");
    if (!bar) return;
    const buttons = $$("[data-filter]", bar);
    const items = $$("[data-location]");
    const status = $("[data-filter-status]");
    const relayout = () => {
      let n = 0;
      items.forEach((item) => {
        if (item.classList.contains("is-filtered-out")) return;
        item.classList.toggle("is-alt", n % 2 === 1);
        n++;
      });
      return n;
    };
    buttons.forEach((btn) =>
      btn.addEventListener("click", () => {
        const f = btn.dataset.filter;
        buttons.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
        items.forEach((item) => {
          const show = f === "all" || item.dataset.location === f;
          const wasHidden = item.classList.contains("is-filtered-out");
          item.classList.toggle("is-filtered-out", !show);
          if (show && wasHidden && !reduceMotion()) {
            item.classList.remove("is-filtering-in");
            void item.offsetWidth;
            item.classList.add("is-filtering-in");
          }
        });
        const n = relayout();
        if (status) status.textContent = `${n} hébergement${n > 1 ? "s" : ""} affiché${n > 1 ? "s" : ""}`;
        requestTick();
      })
    );
    relayout();
  }

  /* ---------- Mini-galeries des logements ---------- */
  function initSliders() {
    $$("[data-slider]").forEach((wrap) => {
      const track = $(".listing__track", wrap);
      if (!track) return;
      const slides = $$(".listing__slide", track);
      const dots = $$(".listing__dots span", wrap);
      const prev = $("[data-prev]", wrap);
      const next = $("[data-next]", wrap);
      const zoom = $("[data-zoom]", wrap);
      let index = 0;
      const update = () => {
        index = clamp(Math.round(track.scrollLeft / Math.max(1, track.clientWidth)), 0, slides.length - 1);
        dots.forEach((dot, i) => dot.classList.toggle("is-active", i === index));
        if (prev) prev.disabled = index <= 0;
        if (next) next.disabled = index >= slides.length - 1;
      };
      const go = (n) => track.scrollTo({ left: clamp(n, 0, slides.length - 1) * track.clientWidth, behavior: reduceMotion() ? "auto" : "smooth" });
      prev?.addEventListener("click", () => go(index - 1));
      next?.addEventListener("click", () => go(index + 1));
      zoom?.addEventListener("click", () => slides[index]?.click());
      track.addEventListener("scroll", () => requestAnimationFrame(update), { passive: true });
      track.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          go(index + (e.key === "ArrowRight" ? 1 : -1));
        }
      });
      // Souris : on fait glisser les photos ; un glissement n'ouvre pas la visionneuse (le tactile défile nativement).
      let startX = 0;
      let startLeft = 0;
      let pressed = false;
      let dragged = false;
      track.addEventListener("dragstart", (e) => e.preventDefault());
      track.addEventListener("pointerdown", (e) => {
        if (e.pointerType !== "mouse" || e.button !== 0) return;
        pressed = true;
        dragged = false;
        startX = e.clientX;
        startLeft = track.scrollLeft;
      });
      track.addEventListener("pointermove", (e) => {
        if (!pressed) return;
        const dx = e.clientX - startX;
        if (!dragged && Math.abs(dx) > 6) {
          dragged = true;
          track.classList.add("is-dragging");
          track.setPointerCapture(e.pointerId);
        }
        if (dragged) track.scrollLeft = startLeft - dx;
      });
      const release = () => {
        if (!pressed) return;
        pressed = false;
        if (!dragged) return;
        track.classList.remove("is-dragging");
        const moved = track.scrollLeft - startLeft;
        go(index + (Math.abs(moved) > track.clientWidth * 0.15 ? Math.sign(moved) : 0));
      };
      track.addEventListener("pointerup", release);
      track.addEventListener("pointercancel", release);
      track.addEventListener(
        "click",
        (e) => {
          if (!dragged) return;
          dragged = false;
          e.preventDefault();
          e.stopPropagation();
        },
        true
      );
      update();
    });
  }

  /* ---------- Visionneuse plein écran (clone d'images déjà présentes dans la page) ---------- */
  function initLightbox() {
    const dlg = $("#lightbox");
    if (!dlg || typeof dlg.showModal !== "function") return;
    const figure = $(".lightbox__figure", dlg);
    const countEl = $(".lightbox__count", dlg);
    const titleEl = $(".lightbox__title", dlg);
    const capEl = $(".lightbox__caption", dlg);
    const prevBtn = $(".lightbox__prev", dlg);
    const nextBtn = $(".lightbox__next", dlg);
    let items = [];
    let index = 0;
    let opener = null;
    const render = () => {
      const pic = $("picture", items[index])?.cloneNode(true);
      if (!pic) return;
      pic.querySelectorAll("source, img").forEach((n) => n.setAttribute("sizes", "(min-width: 1200px) 82vw, 100vw"));
      const img = $("img", pic);
      img.draggable = false;
      img.removeAttribute("loading");
      img.className = "";
      img.removeAttribute("style");
      figure.replaceChildren(pic);
      const pad = (n) => String(n).padStart(2, "0");
      countEl.textContent = `${pad(index + 1)} / ${pad(items.length)}`;
      capEl.textContent = img.alt || "";
      prevBtn.hidden = items.length < 2;
      nextBtn.hidden = items.length < 2;
    };
    const go = (n) => {
      index = (n + items.length) % items.length;
      render();
    };
    document.addEventListener("click", (e) => {
      const trigger = e.target.closest("[data-lightbox]");
      if (!trigger) return;
      e.preventDefault();
      const group = trigger.dataset.lightbox;
      items = $$("[data-lightbox]").filter((el) => el.dataset.lightbox === group);
      index = Math.max(0, items.indexOf(trigger));
      opener = trigger;
      titleEl.textContent = trigger.dataset.title || "";
      render();
      dlg.showModal();
      document.body.classList.add("no-scroll");
    });
    prevBtn.addEventListener("click", () => go(index - 1));
    nextBtn.addEventListener("click", () => go(index + 1));
    $$("[data-lightbox-close]", dlg).forEach((b) => b.addEventListener("click", () => dlg.close()));
    dlg.addEventListener("click", (e) => {
      const stageEl = $(".lightbox__stage", dlg);
      if (stageEl.dataset.swiped) {
        delete stageEl.dataset.swiped;
        return;
      }
      if (e.target === dlg || e.target === stageEl) dlg.close();
    });
    dlg.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") go(index + 1);
      if (e.key === "ArrowLeft") go(index - 1);
    });
    dlg.addEventListener("close", () => {
      document.body.classList.remove("no-scroll");
      opener?.focus({ preventScroll: true });
    });
    let sx = 0;
    let sy = 0;
    const stage = $(".lightbox__stage", dlg);
    let swiping = false;
    stage.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      swiping = true;
      sx = e.clientX;
      sy = e.clientY;
      stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener("pointerup", (e) => {
      if (!swiping) return;
      swiping = false;
      const dx = e.clientX - sx;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(e.clientY - sy)) {
        stage.dataset.swiped = "1"; // le clic qui suit le glissement ne ferme pas la visionneuse
        go(index + (dx < 0 ? 1 : -1));
      }
    });
    stage.addEventListener("pointercancel", () => (swiping = false));
  }

  /* ---------- Carte Google chargée seulement à la demande (vie privée + performance) ---------- */
  function initMap() {
    $$("[data-map]").forEach((wrap) => {
      $("[data-map-load]", wrap)?.addEventListener("click", () => {
        let src;
        try {
          src = new URL(wrap.dataset.map);
        } catch {
          return;
        }
        if (src.protocol !== "https:" || !/(^|\.)google\.com$/.test(src.hostname)) return;
        const iframe = document.createElement("iframe");
        iframe.src = src.href;
        iframe.title = "Carte : Leu Village, Pointe des Châteaux, Saint-Leu";
        iframe.referrerPolicy = "strict-origin-when-cross-origin";
        iframe.allowFullscreen = true;
        wrap.appendChild(iframe);
        $(".map__facade", wrap)?.remove();
      });
    });
  }

  /* ---------- Boutons magnétiques & curseur contextuel (souris uniquement) ---------- */
  function initMagnetic() {
    if (!mqFine.matches || reduceMotion()) return;
    $$("[data-magnetic]").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - (r.left + r.width / 2)) * 0.22;
        const y = (e.clientY - (r.top + r.height / 2)) * 0.3;
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      });
      el.addEventListener("pointerleave", () => (el.style.transform = ""));
    });
  }

  function initCursor() {
    if (!mqFine.matches || reduceMotion()) return;
    const zones = $$("[data-cursor]");
    if (!zones.length) return;
    const dot = document.createElement("div");
    dot.className = "cursor";
    dot.setAttribute("aria-hidden", "true");
    document.body.appendChild(dot);
    let x = -200;
    let y = -200;
    let tx = x;
    let ty = y;
    let s = 0.3;
    let ts = 0.3;
    let raf = 0;
    let inside = false;
    const loop = () => {
      x = lerp(x, tx, 0.22);
      y = lerp(y, ty, 0.22);
      s = lerp(s, ts, 0.18);
      dot.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${s.toFixed(3)})`;
      raf = Math.abs(x - tx) + Math.abs(y - ty) + Math.abs(s - ts) > 0.2 ? requestAnimationFrame(loop) : 0;
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(loop);
    };
    addEventListener(
      "pointermove",
      (e) => {
        tx = e.clientX;
        ty = e.clientY;
        if (!inside) {
          x = tx;
          y = ty;
        }
        kick();
      },
      { passive: true }
    );
    zones.forEach((zone) => {
      zone.addEventListener("pointerenter", (e) => {
        if (e.pointerType !== "mouse") return;
        inside = true;
        dot.textContent = zone.dataset.cursor;
        dot.classList.add("is-visible");
        ts = 1;
        kick();
      });
      zone.addEventListener("pointerleave", () => {
        inside = false;
        dot.classList.remove("is-visible");
        ts = 0.3;
        kick();
      });
    });
  }

  /* ---------- Étapes collantes (page coworking) ---------- */
  function initStory() {
    const wrap = $("[data-story]");
    if (!wrap || !("IntersectionObserver" in window)) return;
    const steps = $$(".story-step", wrap);
    const imgs = $$(".sticky-story__img", wrap);
    const setActive = (i) => {
      steps.forEach((s, k) => s.classList.toggle("is-active", k === i));
      imgs.forEach((im, k) => im.classList.toggle("is-active", k === i));
    };
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(steps.indexOf(e.target));
        }),
      { rootMargin: "-45% 0px -45% 0px" }
    );
    steps.forEach((s) => io.observe(s));
    setActive(0);
  }

  /* ---------- Calculateur salle de réunion ---------- */
  function initCalc() {
    $$("[data-calc]").forEach((wrap) => {
      const amount = $("[data-calc-amount]", wrap);
      const rate = $("[data-calc-rate]", wrap);
      const label = $("[data-calc-label]", wrap);
      const cta = $("[data-calc-cta]", wrap);
      const tween = (to) => {
        const from = parseFloat(amount.dataset.value) || to;
        amount.dataset.value = String(to);
        const final = () => {
          if (amount.dataset.value === String(to)) amount.textContent = euro.format(to);
        };
        if (reduceMotion() || from === to || document.hidden) {
          final();
          return;
        }
        const t0 = performance.now();
        const step = (t) => {
          if (amount.dataset.value !== String(to)) return;
          const p = clamp((t - t0) / 600, 0, 1);
          amount.textContent = euro.format(Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))));
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
        setTimeout(final, 750); // filet de sécurité si l'onglet ne rafraîchit pas l'affichage
      };
      const update = () => {
        const input = $("input:checked", wrap);
        if (!input) return;
        const price = Number(input.dataset.price);
        const hours = Number(input.dataset.hours);
        tween(price);
        if (rate) rate.textContent = `soit ${euro.format(price / hours)} € HT de l’heure`;
        if (label) label.textContent = input.dataset.label;
        if (cta && /^(1h|4h|8h)$/.test(input.value)) cta.href = `reserver.html?offre=salle&duree=${input.value}`;
      };
      wrap.addEventListener("change", update);
      update();
    });
  }

  /* ---------- Images : fondu au chargement ---------- */
  function initImages() {
    $$("img.fade-img").forEach((img) => {
      const done = () => img.classList.add("is-loaded");
      if (img.complete && img.naturalWidth) done();
      else {
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
      }
    });
  }

  function initYear() {
    $$("[data-year]").forEach((el) => (el.textContent = String(new Date().getFullYear())));
  }

  /* ---------- Démarrage ---------- */
  [
    initImages,
    initYear,
    initAnchors,
    initHeader,
    initMenu,
    initTabs,
    initReveal,
    initParallax,
    initHero,
    hydrateDeferred,
    initClock,
    initCounters,
    initCardLinks,
    initTilt,
    initFilters,
    initSliders,
    initLightbox,
    initMap,
    initMagnetic,
    initCursor,
    initStory,
    initCalc,
  ].forEach((fn) => {
    try {
      fn();
    } catch (err) {
      console.error(`[Leu Village] ${fn.name}`, err);
    }
  });
  requestTick();
})();
