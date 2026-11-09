// Divide landing page. No dependencies, nothing global.
// The HTML ships every final state; this script only rewinds and replays
// motion for people who haven't asked for reduced motion.
(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const motionAllowed = () => !reduceMotion.matches;

  const money = (cents) =>
    (cents / 100).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ---------- Hero: Siri prints an expense onto the receipt ----------

  function heroReceipt() {
    const wrap = document.querySelector(".receipt-wrap");
    const siriLine = wrap && wrap.querySelector(".siri-line");
    if (!siriLine || !motionAllowed()) return;

    const totalCell = wrap.querySelector(".total td");
    const amount = wrap.querySelector(".amount");
    const rows = [...wrap.querySelectorAll("tr[data-cents]")];

    const tally = (list) => {
      let total = 0;
      let owed = 0; // what Drea owes Kyle
      for (const row of list) {
        const cents = Number(row.dataset.cents);
        const half = Math.floor(cents / 2);
        total += cents;
        owed += row.dataset.payer === "kyle" ? half : -half;
      }
      return { total, owed };
    };
    const before = tally(rows.filter((row) => row !== siriLine));
    const after = tally(rows);

    const setAmount = (cents) => {
      const [whole, frac] = money(cents).split(".");
      amount.innerHTML = `$${whole}<span class="cents">.${frac}</span>`;
    };

    wrap.classList.add("is-rewound");
    totalCell.textContent = money(before.total);
    setAmount(before.owed);

    const countUp = (from, to, ms, draw) => {
      const start = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - start) / ms);
        const eased = 1 - Math.pow(1 - t, 3);
        draw(Math.round(from + (to - from) * eased));
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    // The receipt feeds out first (CSS, 1.75 s), then Siri asks, then it prints.
    setTimeout(() => {
      wrap.classList.remove("is-rewound");
      setTimeout(() => {
        siriLine.classList.add("is-printing");
        countUp(before.total, after.total, 600, (c) => { totalCell.textContent = money(c); });
        countUp(before.owed, after.owed, 600, setAmount);
      }, 900);
    }, 1900);
  }

  // ---------- Clips play only while on screen ----------

  function clips() {
    // The Duo stage runs its own videos (see duo()).
    const videos = [...document.querySelectorAll("video.clip")].filter((video) => !video.closest(".duo-stage"));
    if (!videos.length || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const video = entry.target;
        if (entry.isIntersecting && motionAllowed()) {
          video.preload = "auto";
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      }
    }, { threshold: 0.4 });
    videos.forEach((video) => observer.observe(video));
    reduceMotion.addEventListener?.("change", () => {
      if (!motionAllowed()) videos.forEach((video) => video.pause());
    });
    return observer;
  }

  // ---------- Header beta button appears after the hero's ----------

  function stickyButton() {
    const headerButton = document.querySelector(".header-cta");
    const heroButton = document.querySelector("#hero .beta-link");
    if (!headerButton || !heroButton || !("IntersectionObserver" in window)) return;
    new IntersectionObserver(([entry]) => {
      // Only once the hero's button has scrolled up out of view.
      headerButton.hidden = entry.isIntersecting || entry.boundingClientRect.top > 0;
    }).observe(heroButton);
  }

  // ---------- iPhone Duo poses ----------

  function duo() {
    const stage = document.querySelector(".duo-stage");
    const buttons = [...document.querySelectorAll(".pose-button")];
    if (!stage || !buttons.length) return;
    const order = ["closed", "open", "half"];
    let timer = null;
    let onScreen = false;

    const show = (pose) => {
      stage.dataset.pose = pose;
      for (const button of buttons) {
        button.setAttribute("aria-pressed", String(button.dataset.pose === pose));
      }
      for (const video of stage.querySelectorAll("video")) {
        const active = video.closest(".duo-screen").classList.contains(`duo-screen-${pose}`);
        if (active && onScreen && motionAllowed()) {
          video.preload = "auto";
          video.currentTime = 0;
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      }
    };
    const stop = () => { clearInterval(timer); timer = null; };
    const start = () => {
      if (timer || !motionAllowed()) return;
      timer = setInterval(() => {
        const next = order[(order.indexOf(stage.dataset.pose) + 1) % order.length];
        show(next);
      }, 4000);
    };

    let touched = false;
    for (const button of buttons) {
      button.addEventListener("click", () => {
        touched = true;
        stop();
        show(button.dataset.pose);
      });
    }

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([entry]) => {
        onScreen = entry.isIntersecting;
        if (onScreen && !touched) {
          show(stage.dataset.pose);
          start();
        } else if (!onScreen) {
          stop();
          stage.querySelectorAll("video").forEach((video) => video.pause());
        }
      }, { threshold: 0.4 }).observe(stage);
    }
  }

  const init = () => {
    heroReceipt();
    clips();
    stickyButton();
    duo();
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
