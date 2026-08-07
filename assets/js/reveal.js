/*
 * reveal.js — fades content in as it scrolls into view, and shades the header
 * once the page has scrolled.
 *
 * Two rules this file sticks to:
 *
 * 1. Content must never depend on JavaScript to become visible. The hidden
 *    state lives behind `html.js-reveal`, which is only added here. If this
 *    script fails to load, nothing is hidden and the page reads normally.
 *
 * 2. Motion is optional. If the visitor's system asks for reduced motion, no
 *    elements are hidden and nothing animates. On an emergency-information
 *    site, no one should have to sit through an effect to read a page.
 */

const PREFERS_REDUCED_MOTION =
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Elements to fade in, in the order they appear on the page.
const REVEAL_SELECTOR = [
  '.hero-inner > *',
  '.card',
  '.stat-inner > *',
  '.emergency-inner',
  '.page > h1',
  '.page > .lede',
  '.page > h2',
  '.page > h3',
  '.page > p',
  '.page > .callout',
  '.page > .steps > li',
  '.page > form > .field',
].join(', ');

if (!PREFERS_REDUCED_MOTION) {
  // Set immediately, before first paint, so nothing flashes visible then hides.
  document.documentElement.classList.add('js-reveal');
}

function setupReveal() {
  if (PREFERS_REDUCED_MOTION) return;

  const items = Array.from(document.querySelectorAll(REVEAL_SELECTOR));
  if (!items.length) return;

  // No IntersectionObserver (very old browser): show everything and stop.
  if (!('IntersectionObserver' in window)) {
    document.documentElement.classList.remove('js-reveal');
    return;
  }

  items.forEach((el) => el.classList.add('reveal'));

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        // Stagger siblings slightly so a row of cards arrives in sequence
        // rather than all at once. Capped so nothing waits noticeably long.
        const group = entry.target.parentElement;
        const index = group ? Array.from(group.children).indexOf(entry.target) : 0;
        entry.target.style.transitionDelay = `${Math.min(index, 4) * 80}ms`;

        entry.target.classList.add('reveal-in');
        observer.unobserve(entry.target);
      });
    },
    // Trigger a little before the element reaches the bottom edge, so the
    // animation is already underway by the time it is properly in view.
    { rootMargin: '0px 0px -10% 0px', threshold: 0.1 }
  );

  items.forEach((el) => observer.observe(el));

  // Anything already on screen at load should appear right away.
  requestAnimationFrame(() => {
    items.forEach((el) => {
      if (el.getBoundingClientRect().top < window.innerHeight) {
        el.classList.add('reveal-in');
      }
    });
  });
}

function setupHeaderShadow() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  let ticking = false;
  const update = () => {
    header.classList.toggle('scrolled', window.scrollY > 8);
    ticking = false;
  };

  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    },
    { passive: true }
  );

  update();
}

/*
 * Clicking the logo from an inner page plays one heartbeat before navigating
 * home. Kept short on purpose: this is a wayfinding click on an emergency site,
 * so the delay has to read as a flourish, not as a slow page.
 *
 * Must match the animation duration in styles.css (.brand.beating .brand-logo).
 */
const HEARTBEAT_MS = 700;

function onHomePage() {
  const path = window.location.pathname;
  const file = path.slice(path.lastIndexOf('/') + 1);
  return file === '' || file === 'index.html';
}

function setupBrandHeartbeat() {
  // On the home page the logo goes nowhere, so there is nothing to animate
  // toward. Reduced motion skips the effect and keeps the plain instant link.
  if (PREFERS_REDUCED_MOTION || onHomePage()) return;

  const brand = document.querySelector('.brand');
  if (!brand) return;

  const logo = brand.querySelector('.brand-logo');
  if (!logo) return;

  brand.addEventListener('click', (event) => {
    // Anything that isn't a plain left-click belongs to the browser: open in a
    // new tab, middle-click, right-click. Never delay or swallow those.
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    // Second click while the beat is running: give up and go immediately.
    if (brand.classList.contains('beating')) return;

    event.preventDefault();
    brand.classList.add('beating');

    let navigated = false;
    const go = () => {
      if (navigated) return;
      navigated = true;
      window.location.href = brand.href;
    };

    logo.addEventListener('animationend', go, { once: true });
    // Backstop, in case animationend never fires (background tab, animation
    // disabled by the browser). The visitor still gets home either way.
    setTimeout(go, HEARTBEAT_MS + 150);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupReveal();
  setupHeaderShadow();
  setupBrandHeartbeat();
});
