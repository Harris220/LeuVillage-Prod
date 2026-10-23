/* ==========================================================================
   Leu Village — interactions & animations
   JavaScript natif, sans dépendance (Lenis optionnel pour le défilement doux).
   Tout le contenu reste lisible sans JS ; les animations sont un bonus.
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
  const headerOffset = () => {
    const bar = $(".site-header__bar");
    return bar ? bar.getBoundingClientRect().height + 36 : 100;
  };

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

  /* ---------- Défilement doux (bureau uniquement) ---------- */
  let lenis = null;
  function initLenis() {
    if (reduceMotion() || !mqFine.matches || typeof window.Lenis !== "function") return;
    lenis = new window.Lenis({ lerp: 0.11, smoothWheel: true, wheelMultiplier: 1 });
    const raf = (t) => {
      lenis.raf(t);
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  }

  function initAnchors() {
    document.addEventListener("click", (e) => {
      const link = e.target.closest('a[href^="#"]');
      if (!link || e.defaultPrevented) return;
      const hash = link.getAttribute("href");
      if (hash === "#") return;
      const target = hash === "#top" ? document.body : document.getElementById(hash.slice(1));
      if (!target) return;
      e.preventDefault();
      if (lenis) {
        lenis.scrollTo(hash === "#top" ? 0 : target, { offset: -headerOffset() });
      } else if (hash === "#top") {
        scrollTo({ top: 0, behavior: reduceMotion() ? "auto" : "smooth" });
      } else {
        target.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "start" });
      }
      if (hash !== "#top") {
        if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
        history.replaceState(null, "", hash);
      }
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
      document.body.style.overflow = open ? "hidden" : "";
      if (lenis) open ? lenis.stop() : lenis.start();
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
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          if (child.classList.contains("statement__pill")) {
            child.style.setProperty("--wi", index++);
          } else if (child.tagName !== "BR") {
            walk(child);
          }
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
        if (!child.hasAttribute("data-reveal-img") && !child.hasAttribute("data-reveal")) {
          child.setAttribute("data-reveal", "");
        }
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
    requestAnimationFrame(() =>
      requestAnimationFrame(() => $$(".no-anim").forEach((el) => el.classList.remove("no-anim")))
    );

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

  /* ---------- Manifeste : les mots s'éclairent au fil du défilement ---------- */
  function initScrub() {
    const el = $("[data-scrub]");
    if (!el || reduceMotion()) return;
    splitWords(el);
    const items = $$(".w, .statement__pill", el);
    if (!items.length) return;
    root.classList.add("js-scrub");
    let start = 0;
    let end = 1;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const top = r.top + window.scrollY;
      start = top - innerHeight * 0.82;
      end = top + r.height - innerHeight * 0.38;
    };
    measure();
    addEventListener("resize", measure, { passive: true });
    addEventListener("load", measure, { once: true });
    document.fonts?.ready.then(measure);
    let last = -1;
    scrollSubs.add((y) => {
      const p = clamp((y - start) / (end - start), 0, 1);
      const lit = p * items.length;
      if (Math.abs(lit - last) < 0.02) return;
      last = lit;
      items.forEach((item, i) => {
        item.style.setProperty("--o", (0.14 + clamp(lit - i, 0, 1) * 0.86).toFixed(3));
      });
    });
    requestTick();
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
        const frame = el.closest(".parallax-wrap") || el.parentElement;
        reads.push([el, frame.getBoundingClientRect(), el.offsetHeight - frame.offsetHeight]);
      });
      reads.forEach(([el, r, extra]) => {
        const speed = parseFloat(el.dataset.parallax) || 0.1;
        const distance = r.top + r.height / 2 - vh / 2;
        const limit = Math.max(0, extra / 2);
        const y = clamp(-distance * speed * factor, -limit, limit);
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

  /* Images différées (diapositives 2+) : chargées après la page */
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

  /* ---------- Heure locale & statut d'ouverture (fuseau de La Réunion) ---------- */
  function initClock() {
    const clocks = $$("[data-clock]");
    const statuses = $$("[data-status]");
    if (!clocks.length && !statuses.length) return;
    const tz = "Indian/Reunion";
    let timeFmt;
    let partsFmt;
    try {
      timeFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
      partsFmt = new Intl.DateTimeFormat("en-GB", {
        timeZone: tz,
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      });
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

  /* ---------- Compteurs ---------- */
  function initCounters() {
    const els = $$("[data-count]");
    if (!els.length || reduceMotion() || !("IntersectionObserver" in window)) return;
    const run = (el) => {
      const target = parseFloat(el.dataset.count);
      const t0 = performance.now();
      const dur = 1700;
      const step = (t) => {
        const p = clamp((t - t0) / dur, 0, 1);
        const eased = 1 - Math.pow(1 - p, 4);
        el.textContent = euro.format(Math.round(target * eased));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
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
      if (el.getBoundingClientRect().top > innerHeight) {
        el.textContent = "0";
        io.observe(el);
      }
    });
  }

  /* ---------- Panneaux extensibles ---------- */
  function initPanels() {
    $$("[data-panels]").forEach((wrap) => {
      const panels = $$(".panel", wrap);
      const activate = (panel) => panels.forEach((p) => p.classList.toggle("is-active", p === panel));
      panels.forEach((panel) => {
        panel.addEventListener("pointerenter", (e) => {
          if (e.pointerType === "mouse") activate(panel);
        });
        panel.addEventListener("focusin", () => activate(panel));
      });
    });
  }

  /* ---------- Carrousel horizontal (défilement natif + glisser à la souris) ---------- */
  function initCarousels() {
    $$("[data-carousel]").forEach((wrap) => {
      const track = $(".carousel__track", wrap);
      if (!track) return;
      const prev = $("[data-prev]", wrap);
      const next = $("[data-next]", wrap);
      const bar = $(".carousel__progress span", wrap);
      const step = () => {
        const card = track.firstElementChild;
        const gap = parseFloat(getComputedStyle(track).columnGap) || 16;
        return card ? card.getBoundingClientRect().width + gap : 320;
      };
      const update = () => {
        const max = track.scrollWidth - track.clientWidth;
        const p = max > 0 ? track.scrollLeft / max : 1;
        bar?.style.setProperty("--p", (0.12 + p * 0.88).toFixed(3));
        if (prev) prev.disabled = track.scrollLeft < 4;
        if (next) next.disabled = track.scrollLeft > max - 4;
      };
      const behavior = () => (reduceMotion() ? "auto" : "smooth");
      prev?.addEventListener("click", () => track.scrollBy({ left: -step(), behavior: behavior() }));
      next?.addEventListener("click", () => track.scrollBy({ left: step(), behavior: behavior() }));
      track.addEventListener("scroll", () => requestAnimationFrame(update), { passive: true });
      addEventListener("resize", update, { passive: true });
      update();

      let down = false;
      let startX = 0;
      let startLeft = 0;
      let moved = 0;
      track.addEventListener("pointerdown", (e) => {
        if (e.pointerType !== "mouse" || e.button !== 0) return;
        down = true;
        moved = 0;
        startX = e.clientX;
        startLeft = track.scrollLeft;
      });
      addEventListener("pointermove", (e) => {
        if (!down) return;
        const dx = e.clientX - startX;
        moved = Math.max(moved, Math.abs(dx));
        if (moved > 6) {
          track.classList.add("is-dragging");
          track.scrollLeft = startLeft - dx;
        }
      });
      addEventListener("pointerup", () => {
        if (!down) return;
        down = false;
        if (!track.classList.contains("is-dragging")) return;
        const s = step();
        const target = Math.round(track.scrollLeft / s) * s;
        track.classList.remove("is-dragging");
        track.scrollTo({ left: target, behavior: behavior() });
      });
      track.addEventListener(
        "click",
        (e) => {
          if (moved > 6) {
            e.preventDefault();
            e.stopPropagation();
            moved = 0;
          }
        },
        true
      );
      track.addEventListener("dragstart", (e) => e.preventDefault());
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
        wrap.dispatchEvent(new CustomEvent("tabchange", { detail: { value: tab.dataset.value } }));
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
      document.fonts?.ready.then(() => move(current(), true));
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
          const show = f === "all" || item.dataset.location.split(" ").includes(f);
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
        dots.forEach((d, i) => d.classList.toggle("is-active", i === index));
        if (prev) prev.disabled = index <= 0;
        if (next) next.disabled = index >= slides.length - 1;
      };
      const go = (n) =>
        track.scrollTo({
          left: clamp(n, 0, slides.length - 1) * track.clientWidth,
          behavior: reduceMotion() ? "auto" : "smooth",
        });
      prev?.addEventListener("click", () => go(index - 1));
      next?.addEventListener("click", () => go(index + 1));
      zoom?.addEventListener("click", () => slides[index]?.click());
      track.addEventListener("scroll", () => requestAnimationFrame(update), { passive: true });
      track.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          go(index + 1);
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          go(index - 1);
        }
      });
      update();
    });
  }

  /* ---------- Visionneuse plein écran ---------- */
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
      const source = items[index];
      const pic = $("picture", source)?.cloneNode(true);
      if (!pic) return;
      pic.querySelectorAll("source, img").forEach((n) => n.setAttribute("sizes", "(min-width: 1200px) 82vw, 100vw"));
      const img = $("img", pic);
      img.removeAttribute("loading");
      img.className = "";
      img.removeAttribute("style");
      figure.replaceChildren(pic);
      const pad = (n) => String(n).padStart(2, "0");
      countEl.textContent = `${pad(index + 1)} / ${pad(items.length)}`;
      capEl.textContent = img.alt || "";
      const single = items.length < 2;
      prevBtn.hidden = single;
      nextBtn.hidden = single;
    };
    const go = (n) => {
      index = (n + items.length) % items.length;
      render();
    };
    const open = (trigger) => {
      const group = trigger.dataset.lightbox;
      items = $$(`[data-lightbox="${group}"]`);
      index = Math.max(0, items.indexOf(trigger));
      opener = trigger;
      titleEl.textContent = trigger.dataset.title || "";
      render();
      dlg.showModal();
      lenis?.stop();
    };
    document.addEventListener("click", (e) => {
      const trigger = e.target.closest("[data-lightbox]");
      if (!trigger) return;
      e.preventDefault();
      open(trigger);
    });
    prevBtn.addEventListener("click", () => go(index - 1));
    nextBtn.addEventListener("click", () => go(index + 1));
    $$("[data-lightbox-close]", dlg).forEach((b) => b.addEventListener("click", () => dlg.close()));
    dlg.addEventListener("click", (e) => {
      if (e.target === dlg || e.target.classList.contains("lightbox__stage")) dlg.close();
    });
    dlg.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") go(index + 1);
      if (e.key === "ArrowLeft") go(index - 1);
    });
    dlg.addEventListener("close", () => {
      lenis?.start();
      opener?.focus({ preventScroll: true });
    });
    let sx = 0;
    let sy = 0;
    const stage = $(".lightbox__stage", dlg);
    stage.addEventListener("pointerdown", (e) => {
      sx = e.clientX;
      sy = e.clientY;
    });
    stage.addEventListener("pointerup", (e) => {
      const dx = e.clientX - sx;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - sy)) go(index + (dx < 0 ? 1 : -1));
    });
  }

  /* ---------- Carte chargée au clic (vie privée + performance) ---------- */
  function initMap() {
    $$("[data-map]").forEach((wrap) => {
      $("[data-map-load]", wrap)?.addEventListener("click", () => {
        const iframe = document.createElement("iframe");
        iframe.src = wrap.dataset.map;
        iframe.title = "Carte : Leu Village, Pointe des Châteaux, Saint-Leu";
        iframe.loading = "lazy";
        iframe.referrerPolicy = "no-referrer-when-downgrade";
        iframe.allowFullscreen = true;
        wrap.appendChild(iframe);
        $(".map__facade", wrap)?.remove();
      });
    });
  }

  /* ---------- Boutons magnétiques & curseur contextuel ---------- */
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

  /* ---------- Nombre animé (prix) ---------- */
  function tweenNumber(el, to, { duration = 600, decimals = 0 } = {}) {
    const from = parseFloat(el.dataset.value ?? el.textContent.replace(/[^\d,.-]/g, "").replace(",", ".")) || 0;
    el.dataset.value = String(to);
    const fmt = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    if (reduceMotion() || from === to) {
      el.textContent = fmt.format(to);
      return;
    }
    const t0 = performance.now();
    const step = (t) => {
      const p = clamp((t - t0) / duration, 0, 1);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt.format(from + (to - from) * e);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ---------- Calculateur salle de réunion ---------- */
  function initCalc() {
    $$("[data-calc]").forEach((wrap) => {
      const amount = $("[data-calc-amount]", wrap);
      const rate = $("[data-calc-rate]", wrap);
      const label = $("[data-calc-label]", wrap);
      const cta = $("[data-calc-cta]", wrap);
      const update = () => {
        const input = $("input:checked", wrap);
        if (!input) return;
        const price = parseFloat(input.dataset.price);
        const hours = parseFloat(input.dataset.hours);
        tweenNumber(amount, price);
        if (rate) rate.textContent = `soit ${euro.format(price / hours)} € HT de l’heure`;
        if (label) label.textContent = input.dataset.label;
        if (cta) cta.href = `reserver.html?offre=salle&duree=${input.value}`;
      };
      wrap.addEventListener("change", update);
      update();
    });
  }

  /* ---------- Formulaires (réservation & contact) ---------- */
  const MESSAGES = {
    required: "Ce champ est obligatoire.",
    email: "Indiquez une adresse e-mail valide (ex. nom@domaine.fr).",
    tel: "Indiquez un numéro de téléphone valide (ex. 0692 12 34 56).",
    past: "Choisissez une date à partir d’aujourd’hui.",
    weekend: "Le coworking est ouvert du lundi au vendredi.",
    order: "La date de départ doit être après la date d’arrivée.",
    consent: "Merci d’accepter l’utilisation de vos données pour traiter votre demande.",
    choice: "Sélectionnez une option.",
  };
  const todayISO = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  };
  const parseISO = (v) => {
    const [y, m, d] = v.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const longDate = (v) =>
    v
      ? new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(
          parseISO(v)
        )
      : "—";

  function fieldError(field) {
    const input = $("input, select, textarea", field);
    if (!input) return "";
    if (input.type === "radio") {
      const group = $$(`input[name="${input.name}"]`, field);
      return input.required && !group.some((r) => r.checked) ? MESSAGES.choice : "";
    }
    if (input.type === "checkbox") return input.required && !input.checked ? MESSAGES.consent : "";
    const v = input.value.trim();
    if (input.required && !v) return MESSAGES.required;
    if (!v) return "";
    if (input.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return MESSAGES.email;
    if (input.type === "tel" && !/^\+?[\d\s.()-]{8,20}$/.test(v)) return MESSAGES.tel;
    if (input.type === "date") {
      if (v < todayISO()) return MESSAGES.past;
      if (input.dataset.weekday !== undefined) {
        const day = parseISO(v).getDay();
        if (day === 0 || day === 6) return MESSAGES.weekend;
      }
      if (input.dataset.after) {
        const other = document.getElementById(input.dataset.after);
        if (other?.value && v <= other.value) return MESSAGES.order;
      }
    }
    return "";
  }

  function setFieldState(field, message) {
    const input = $("input, select, textarea", field);
    const err = $(".field__error", field);
    field.classList.toggle("is-invalid", Boolean(message));
    if (err) err.querySelector("span").textContent = message;
    $$("input, select, textarea", field).forEach((el) => {
      if (message) el.setAttribute("aria-invalid", "true");
      else el.removeAttribute("aria-invalid");
    });
    return input;
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

  function showAlert(form, errors) {
    const alert = $(".form-alert", form);
    if (!alert) {
      errors[0]?.input?.focus();
      return;
    }
    const list = $("ul", alert);
    list.replaceChildren(
      ...errors.map(({ field, input, msg }) => {
        const li = document.createElement("li");
        const a = document.createElement("a");
        const name = $(".field__label, label", field)?.textContent.replace(/[*()]|facultatif/gi, "").trim() || "Champ";
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
      field.addEventListener("input", () => {
        if (field.classList.contains("is-invalid")) check();
      });
      field.addEventListener("change", () => {
        if (field.classList.contains("is-invalid")) check();
      });
    });
  }

  async function submitForm(form, payload, onSuccess) {
    const btn = $('[type="submit"]', form);
    btn?.classList.add("is-loading");
    if (btn) btn.disabled = true;
    try {
      if (form.dataset.demo === "true") {
        await new Promise((r) => setTimeout(r, 900));
      } else {
        const res = await fetch(form.action, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      }
      onSuccess();
    } catch (err) {
      const alert = $(".form-alert", form);
      if (alert) {
        $("ul", alert).replaceChildren(
          Object.assign(document.createElement("li"), {
            textContent:
              "L’envoi n’a pas abouti. Réessayez dans un instant ou appelez-nous au +262 693 02 57 57.",
          })
        );
        alert.classList.add("is-visible");
        alert.focus();
      }
    } finally {
      btn?.classList.remove("is-loading");
      if (btn) btn.disabled = false;
    }
  }

  function successCard({ title, text, rows, demo }) {
    const card = document.createElement("div");
    card.className = "success";
    card.setAttribute("tabindex", "-1");
    card.setAttribute("role", "status");
    const rowsHtml = rows
      .filter(([, v]) => v)
      .map(([k, v]) => `<div class="summary__row"><dt>${k}</dt><dd>${v}</dd></div>`)
      .join("");
    card.innerHTML = `
      <span class="success__icon"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg></span>
      <h2 class="h3">${title}</h2>
      <p class="lead">${text}</p>
      ${rowsHtml ? `<dl class="summary__rows success__rows">${rowsHtml}</dl>` : ""}
      ${demo ? '<p class="demo-note">Mode démo : rien n’a été envoyé, le serveur sera branché plus tard.</p>' : ""}
      <a class="link" href="index.html">Retour à l’accueil <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></a>`;
    return card;
  }

  const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  /* Réservation : coworking, salle, séjour */
  function initBooking() {
    const page = $("[data-booking]");
    if (!page) return;
    const params = new URLSearchParams(location.search);
    const tabsWrap = $("[data-tabs]", page);
    const offer = params.get("offre");
    if (offer && tabsWrap?.selectTab) tabsWrap.selectTab(offer);

    $$("form[data-booking-form]", page).forEach((form) => {
      const type = form.dataset.bookingForm;
      const out = (name) => $(`[data-out="${name}"]`, form.closest(".booking"));
      const totalEl = out("total");
      $$('input[type="date"]', form).forEach((d) => (d.min = todayISO()));

      // Préremplissage depuis l'URL
      if (offer === type) {
        const formule = params.get("formule");
        const duree = params.get("duree");
        if (formule) $(`input[name="formule"][value="${formule}"]`, form)?.click();
        if (duree) $(`input[name="duree"][value="${duree}"]`, form)?.click();
      }

      const stepper = $("[data-stepper]", form);
      if (stepper) {
        const input = $("input", stepper);
        const min = parseInt(input.min, 10) || 1;
        const max = parseInt(input.max, 10) || 30;
        $$("button", stepper).forEach((b) =>
          b.addEventListener("click", () => {
            input.value = clamp((parseInt(input.value, 10) || min) + parseInt(b.dataset.step, 10), min, max);
            input.dispatchEvent(new Event("input", { bubbles: true }));
          })
        );
      }

      const compute = () => {
        const data = Object.fromEntries(new FormData(form));
        let total = 0;
        const rows = {};
        if (type === "coworking") {
          const f = $('input[name="formule"]:checked', form);
          const days = clamp(parseInt(data.jours, 10) || 1, 1, 30);
          const daysField = $("[data-days-field]", form);
          if (daysField) daysField.hidden = f?.value !== "flex-jour";
          rows.formule = f?.dataset.label || "—";
          rows.poste = $('input[name="poste"]:checked', form)?.dataset.label || "—";
          rows.debut = data.date_debut ? longDate(data.date_debut) : "À choisir";
          if (f) {
            const price = parseFloat(f.dataset.price);
            total = f.value === "flex-jour" ? price * days : price;
            rows.duree = f.value === "flex-jour" ? `${days} jour${days > 1 ? "s" : ""}` : f.dataset.duration;
          }
          $("[data-pass-hint]", form.closest(".booking"))?.classList.toggle(
            "is-visible",
            f?.value === "flex-jour" && days >= 8
          );
        }
        if (type === "salle") {
          const d = $('input[name="duree"]:checked', form);
          const hours = d ? parseFloat(d.dataset.hours) : 0;
          const startSel = $('select[name="heure_debut"]', form);
          if (startSel && d) {
            const latest = 18 - hours;
            const current = startSel.value;
            const opts = [];
            for (let h = 7; h <= latest; h++) opts.push(`${String(h).padStart(2, "0")}:00`);
            if (startSel.dataset.hours !== String(hours)) {
              startSel.dataset.hours = String(hours);
              startSel.replaceChildren(
                ...opts.map((o) => Object.assign(document.createElement("option"), { value: o, textContent: o.replace(":", "h") }))
              );
              startSel.value = opts.includes(current) ? current : opts[Math.min(2, opts.length - 1)];
            }
          }
          const start = startSel?.value;
          rows.duree = d?.dataset.label || "—";
          rows.date = data.date ? longDate(data.date) : "À choisir";
          if (start && hours) {
            const end = parseInt(start, 10) + hours;
            rows.horaire = `${start.replace(":", "h")} – ${String(end).padStart(2, "0")}h00`;
          }
          rows.participants = data.participants ? `${data.participants} pers.` : "—";
          total = d ? parseFloat(d.dataset.price) : 0;
        }
        if (type === "sejour") {
          const nightly = parseFloat(form.dataset.nightly) || 95;
          const a = data.arrivee;
          const b = data.depart;
          let nights = 0;
          if (a && b && b > a) nights = Math.round((parseISO(b) - parseISO(a)) / 86400000);
          rows.arrivee = a ? longDate(a) : "À choisir";
          rows.depart = b ? longDate(b) : "À choisir";
          rows.nuits = nights ? `${nights} nuit${nights > 1 ? "s" : ""}` : "—";
          rows.voyageurs = data.voyageurs ? `${data.voyageurs} pers.` : "—";
          total = nights * nightly;
          const dep = $('input[name="depart"]', form);
          if (dep && a) {
            const next = parseISO(a);
            next.setDate(next.getDate() + 1);
            next.setMinutes(next.getMinutes() - next.getTimezoneOffset());
            dep.min = next.toISOString().slice(0, 10);
          }
        }
        Object.entries(rows).forEach(([k, v]) => {
          const el = out(k);
          if (el) el.textContent = v;
        });
        if (totalEl) tweenNumber(totalEl, total);
        return { data, total, rows };
      };

      form.addEventListener("input", compute);
      form.addEventListener("change", compute);
      compute();
      wireLiveValidation(form);

      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const errors = validateForm(form);
        if (errors.length) {
          showAlert(form, errors);
          return;
        }
        $(".form-alert", form)?.classList.remove("is-visible");
        const { data, total, rows } = compute();
        const payload = { type, ...data, total_ht: total, envoye_le: new Date().toISOString() };
        submitForm(form, payload, () => {
          const booking = form.closest(".booking");
          const first = escapeHtml(data.prenom || "");
          const labels = {
            formule: "Formule",
            poste: "Poste",
            debut: "Début",
            duree: "Durée",
            date: "Date",
            horaire: "Horaire",
            participants: "Participants",
            arrivee: "Arrivée",
            depart: "Départ",
            nuits: "Durée",
            voyageurs: "Voyageurs",
          };
          const recap = Object.entries(rows).map(([k, v]) => [labels[k] || k, escapeHtml(v)]);
          recap.push([type === "sejour" ? "Estimation" : "Total HT", `${euro.format(total)} €`]);
          const card = successCard({
            title: `Merci${first ? ` ${first}` : ""}, c’est noté !`,
            text: "Votre demande est bien partie. Nous revenons vers vous pour confirmer la disponibilité et finaliser la réservation.",
            rows: recap,
            demo: form.dataset.demo === "true",
          });
          booking.replaceChildren(card);
          card.focus({ preventScroll: true });
          const top = card.getBoundingClientRect().top + scrollY - headerOffset();
          lenis ? lenis.scrollTo(top) : scrollTo({ top, behavior: reduceMotion() ? "auto" : "smooth" });
        });
      });
    });
  }

  /* Formulaire de contact */
  function initContactForm() {
    const form = $("form[data-contact-form]");
    if (!form) return;
    wireLiveValidation(form);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const errors = validateForm(form);
      if (errors.length) {
        showAlert(form, errors);
        return;
      }
      $(".form-alert", form)?.classList.remove("is-visible");
      const data = Object.fromEntries(new FormData(form));
      submitForm(form, { ...data, envoye_le: new Date().toISOString() }, () => {
        const card = successCard({
          title: `Merci${data.prenom ? ` ${escapeHtml(data.prenom)}` : ""} !`,
          text: "Votre message est bien arrivé. Nous vous répondons au plus vite, par e-mail ou par téléphone.",
          rows: [],
          demo: form.dataset.demo === "true",
        });
        form.replaceWith(card);
        card.focus();
      });
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
  const boot = [
    initImages,
    initYear,
    initLenis,
    initAnchors,
    initHeader,
    initMenu,
    initTabs,
    initReveal,
    initScrub,
    initParallax,
    initHero,
    hydrateDeferred,
    initClock,
    initCounters,
    initPanels,
    initCarousels,
    initFilters,
    initSliders,
    initLightbox,
    initMap,
    initMagnetic,
    initCursor,
    initStory,
    initCalc,
    initBooking,
    initContactForm,
  ];
  boot.forEach((fn) => {
    try {
      fn();
    } catch (err) {
      console.error(`[Leu Village] ${fn.name}`, err);
    }
  });
  requestTick();
})();
