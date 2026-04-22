(() => {
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // --- console greeting --------------------------------------------------
  const cube = [
    "%c",
    "    ┌───────────────┐    ",
    "   ╱               ╱│   ",
    "  ╱               ╱ │   ",
    " ┌───────────────┐  │   ",
    " │   sean.dev    │  │   ",
    " │               │  ┘   ",
    " │   hi there 👋 │ ╱    ",
    " │               │╱     ",
    " └───────────────┘      ",
    "",
  ].join("\n");
  try { console.log(cube, "color:#5eead4;font-family:monospace;font-size:12px;line-height:1.2"); } catch (_) {}

  // --- frame atlas loader ------------------------------------------------
  const FRAME_COUNT = 121;
  const frames = new Array(FRAME_COUNT);
  let loaded = 0;
  const plFill = document.getElementById("plFill");
  const plPct = document.getElementById("plPct");
  const preloader = document.getElementById("preloader");

  const framesReady = new Promise((resolve) => {
    for (let i = 0; i < FRAME_COUNT; i++) {
      const img = new Image();
      img.decoding = "async";
      img.src = `assets/frames/${String(i + 1).padStart(3, "0")}.webp`;
      img.onload = img.onerror = () => {
        loaded++;
        const pct = Math.round((loaded / FRAME_COUNT) * 100);
        if (plFill) plFill.style.width = pct + "%";
        if (plPct) plPct.textContent = pct;
        if (loaded === FRAME_COUNT) resolve();
      };
      frames[i] = img;
    }
  });

  // --- canvas renderer ---------------------------------------------------
  const canvas = document.getElementById("cubeCanvas");
  const ctx = canvas.getContext("2d");
  let cw = 0, ch = 0, dpr = 1;

  const resizeCanvas = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cw = window.innerWidth;
    ch = window.innerHeight;
    canvas.width  = Math.floor(cw * dpr);
    canvas.height = Math.floor(ch * dpr);
    canvas.style.width  = cw + "px";
    canvas.style.height = ch + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resizeCanvas();
  addEventListener("resize", resizeCanvas);

  let lastFrameDrawn = -1, lastDim = "";
  const drawFrame = (idx) => {
    const i = Math.max(0, Math.min(FRAME_COUNT - 1, Math.round(idx)));
    const dim = cw + "x" + ch;
    if (i === lastFrameDrawn && dim === lastDim) return;
    const img = frames[i];
    if (!img || !img.complete || !img.naturalWidth) return;
    lastFrameDrawn = i;
    lastDim = dim;
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const videoAspect = iw / ih;
    const viewAspect = cw / ch;
    let w, h;
    w = Math.min(cw * 1.1, 1600);
    h = w / videoAspect;
    if (h < ch * 0.55) { h = ch * 0.55; w = h * videoAspect; }
    const x = (cw - w) * 0.5;
    const y = (ch - h) * 0.5;
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, x, y, w, h);
  };

  // --- smooth scroll (Lenis-lite) ---------------------------------------
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const smooth = {
    enabled: !reduceMotion,
    target: window.scrollY,
    current: window.scrollY,
    ease: 0.095,
    wheelMult: 0.9,
    keyStep: () => window.innerHeight * 0.85,
    maxY: () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
  };
  const clampY = (y) => Math.min(smooth.maxY(), Math.max(0, y));

  if (smooth.enabled) {
    addEventListener("wheel", (e) => {
      if (e.ctrlKey) return;
      e.preventDefault();
      smooth.target = clampY(smooth.target + e.deltaY * smooth.wheelMult);
    }, { passive: false });

    addEventListener("keydown", (e) => {
      const tag = (e.target && e.target.tagName) || "";
      if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
      let d = 0;
      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") d = smooth.keyStep();
      else if (e.key === "ArrowUp" || e.key === "PageUp") d = -smooth.keyStep();
      else if (e.key === "Home") { e.preventDefault(); smooth.target = 0; return; }
      else if (e.key === "End")  { e.preventDefault(); smooth.target = smooth.maxY(); return; }
      if (d) { e.preventDefault(); smooth.target = clampY(smooth.target + d); }
    });

    let ty = 0, touching = false;
    addEventListener("touchstart", (e) => { touching = true; ty = e.touches[0].clientY; }, { passive: true });
    addEventListener("touchmove", (e) => {
      if (!touching) return;
      const y = e.touches[0].clientY;
      smooth.target = clampY(smooth.target + (ty - y) * 1.4);
      ty = y;
    }, { passive: true });
    addEventListener("touchend", () => { touching = false; });

    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener("click", (e) => {
        const id = a.getAttribute("href").slice(1);
        const el = id ? document.getElementById(id) : document.body;
        if (!el) return;
        e.preventDefault();
        smooth.target = clampY(el.getBoundingClientRect().top + window.scrollY);
      });
    });
  }

  addEventListener("resize", () => { smooth.target = clampY(smooth.target); });

  // --- main rAF loop (scroll ease + frame scrub + velocity filter) -------
  let velocity = 0, lastScroll = smooth.current;
  const loop = () => {
    if (smooth.enabled) {
      const diff = smooth.target - smooth.current;
      if (Math.abs(diff) < 0.05) smooth.current = smooth.target;
      else smooth.current += diff * smooth.ease;
      if (smooth.current !== window.scrollY) window.scrollTo(0, smooth.current);
    } else {
      smooth.current = window.scrollY;
    }

    velocity = velocity * 0.85 + (smooth.current - lastScroll) * 0.15;
    lastScroll = smooth.current;

    const maxScroll = smooth.maxY() || 1;
    const progress = Math.min(1, Math.max(0, smooth.current / maxScroll));
    // top -> last frame (cube centred big); bottom -> first frame
    drawFrame((1 - progress) * (FRAME_COUNT - 1));

    // filter handled by tintLoop (velocity + section hue)
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  // --- reveal cards ------------------------------------------------------
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add("in");
        io.unobserve(e.target);
      }
    }
  }, { threshold: 0.15, rootMargin: "0px 0px -10% 0px" });
  document.querySelectorAll(".card").forEach((c) => io.observe(c));

  // --- active nav link ---------------------------------------------------
  const navLinks = document.querySelectorAll(".nav nav a[href^='#']");
  const miniLinks = document.querySelectorAll(".mini-nav a[href^='#']");
  const sections = [...document.querySelectorAll("main[id], section[id]")];
  const updateNav = () => {
    const y = smooth.current + window.innerHeight * 0.4;
    let active = sections[0]?.id;
    for (const s of sections) { if (s.offsetTop <= y) active = s.id; }
    const setActive = (a) => {
      const on = a.getAttribute("href") === "#" + active;
      a.style.color = on ? "var(--mint)" : "";
      a.classList.toggle("is-active", on);
      if (on) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    };
    navLinks.forEach(setActive);
    miniLinks.forEach(setActive);
  };
  updateNav();
  setInterval(updateNav, 150);

  // --- magnetic links ----------------------------------------------------
  document.querySelectorAll("[data-magnet]").forEach((el) => {
    let rx = 0, ry = 0, tx = 0, ty = 0, raf = 0, active = false;
    const strength = 0.35;
    const anim = () => {
      rx += (tx - rx) * 0.18;
      ry += (ty - ry) * 0.18;
      el.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      if (active || Math.abs(tx - rx) > 0.1 || Math.abs(ty - ry) > 0.1) raf = requestAnimationFrame(anim);
      else raf = 0;
    };
    el.addEventListener("mousemove", (e) => {
      const r = el.getBoundingClientRect();
      tx = (e.clientX - (r.left + r.width / 2)) * strength;
      ty = (e.clientY - (r.top + r.height / 2)) * strength;
      active = true;
      if (!raf) raf = requestAnimationFrame(anim);
    });
    el.addEventListener("mouseleave", () => {
      tx = 0; ty = 0; active = false;
      if (!raf) raf = requestAnimationFrame(anim);
    });
  });

  // --- custom cursor (dot instant, ring lagged) --------------------------
  const cursor = document.getElementById("cursor");
  if (cursor && matchMedia("(hover: hover)").matches) {
    const dot = cursor.querySelector(".cursor-dot");
    const ring = cursor.querySelector(".cursor-ring");
    let tx = -100, ty = -100, rx = -100, ry = -100;
    addEventListener("mousemove", (e) => {
      tx = e.clientX; ty = e.clientY;
      if (dot) dot.style.transform = `translate3d(${tx}px, ${ty}px, 0) translate(-50%, -50%)`;
    }, { passive: true });
    const step = () => {
      rx += (tx - rx) * 0.22;
      ry += (ty - ry) * 0.22;
      if (ring) ring.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%)`;
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    const hoverables = "a, button, .proj, .chips span, .links a, [data-magnet]";
    document.querySelectorAll(hoverables).forEach((el) => {
      el.addEventListener("mouseenter", () => cursor.classList.add("hover"));
      el.addEventListener("mouseleave", () => cursor.classList.remove("hover"));
    });
  }

  // --- scramble text -----------------------------------------------------
  const SCRAM_CHARS = "!<>-_\\/[]{}—=+*^?#ABCDEF0123456789";
  const rand = (n) => Math.floor(Math.random() * n);
  const scramble = (el) => {
    const text = el.textContent;
    const len = text.length;
    const start = performance.now();
    const duration = 600 + len * 22;
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      let out = "";
      for (let i = 0; i < len; i++) {
        const reveal = t * len;
        if (i < reveal - 2) out += text[i];
        else if (text[i] === " ") out += " ";
        else out += SCRAM_CHARS[rand(SCRAM_CHARS.length)];
      }
      el.textContent = out;
      if (t < 1) requestAnimationFrame(step);
      else el.textContent = text;
    };
    requestAnimationFrame(step);
  };

  const scrambleIO = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        scramble(e.target);
        scrambleIO.unobserve(e.target);
      }
    }
  }, { threshold: 0.5 });
  document.querySelectorAll("[data-scramble]").forEach((el) => scrambleIO.observe(el));

  // --- toast + copy-email ------------------------------------------------
  const toast = document.getElementById("toast");
  let toastTimer = 0;
  const showToast = (msg) => {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
  };
  const burstSparks = (x, y) => {
    const classes = ["", "s-blue", "s-violet"];
    const count = 18;
    for (let i = 0; i < count; i++) {
      const s = document.createElement("div");
      s.className = "spark " + classes[i % classes.length];
      document.body.appendChild(s);
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 60 + Math.random() * 60;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist - 10; // slight upward bias
      const dur = 700 + Math.random() * 400;
      const scale = 0.6 + Math.random() * 0.8;
      s.animate(
        [
          { transform: `translate(${x}px, ${y}px) scale(${scale})`, opacity: 1 },
          { transform: `translate(${x + dx * 0.6}px, ${y + dy * 0.6 + 20}px) scale(${scale * 0.8})`, opacity: 0.9, offset: 0.5 },
          { transform: `translate(${x + dx}px, ${y + dy + 60}px) scale(0)`, opacity: 0 },
        ],
        { duration: dur, easing: "cubic-bezier(.2,.7,.3,1)", fill: "forwards" }
      );
      setTimeout(() => s.remove(), dur);
    }
  };

  document.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      const text = btn.getAttribute("data-copy");
      const r = btn.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = "copied ✓";
        btn.classList.add("copied");
        burstSparks(cx, cy);
        showToast("copied to clipboard");
        setTimeout(() => { btn.textContent = "copy"; btn.classList.remove("copied"); }, 1800);
      } catch (_) {
        showToast("press ⌘C to copy");
      }
    });
  });

  // --- per-section cube tint ---------------------------------------------
  const sectionHue = { hero: 0, about: -6, work: 14, stack: -18, contact: 22 };
  let targetHue = 0, baseHue = 0;
  const hueIO = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        const key = e.target.id || (e.target.classList.contains("hero") ? "hero" : "");
        if (key in sectionHue) targetHue = sectionHue[key];
      }
    }
  }, { threshold: 0.4 });
  document.querySelectorAll("section").forEach((s) => hueIO.observe(s));

  // patch the main loop's filter string with section tint each frame
  const origFilterSetter = (v) => { canvas.style.filter = v; };
  // hook into velocity-filter code: redefine it inline via a wrapper on requestAnimationFrame
  // simpler: fold into the existing loop — we already set filter there; add baseHue here
  setInterval(() => { baseHue += (targetHue - baseHue) * 0.12; }, 16);
  // rewrite loop filter logic: intercept by monkey-patching canvas.style.filter setter? no — just re-assign every frame from a separate rAF
  (function tintLoop() {
    const v = Math.min(30, Math.abs(velocity));
    const hue = baseHue + velocity * 0.4;
    canvas.style.filter = v > 0.5
      ? `saturate(1.05) contrast(1.05) blur(${v * 0.04}px) hue-rotate(${hue}deg)`
      : `saturate(1.05) contrast(1.05) hue-rotate(${baseHue}deg)`;
    requestAnimationFrame(tintLoop);
  })();

  // --- resume link — hide if missing ------------------------------------
  const resumeLink = document.getElementById("resumeLink");
  if (resumeLink) {
    fetch(resumeLink.getAttribute("href"), { method: "HEAD" })
      .then((r) => { if (!r.ok) resumeLink.parentElement.style.display = "none"; })
      .catch(() => { resumeLink.parentElement.style.display = "none"; });
  }

  // --- start: wait for frames, then hide preloader -----------------------
  framesReady.then(() => {
    // draw first frame so canvas isn't blank when preloader fades
    drawFrame(FRAME_COUNT - 1);
    setTimeout(() => preloader && preloader.classList.add("done"), 200);
  });
})();
