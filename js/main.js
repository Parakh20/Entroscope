// ============================================================
// EntropyBottle — UI interactions
// ============================================================
(function () {
  'use strict';

  // Year in footer
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Nav scroll state
  const nav = document.querySelector('.nav');
  const onScroll = () => {
    if (window.scrollY > 20) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Reveal on scroll
  const revealEls = document.querySelectorAll('.section-head, .feature, .law-card, .science-grid, .eq-strip, .bom, .team-card, .viewer-wrap, .story-step, .side-card, .carousel, .team-tagline, .buy-card');
  revealEls.forEach(el => el.classList.add('reveal'));
  const io = new IntersectionObserver(
    entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );
  revealEls.forEach(el => io.observe(el));

  // ---- Team carousel (continuous marquee) ----
  const track = document.getElementById('car-track');
  if (track) {
    // Duplicate the original slides once so the CSS animation can loop seamlessly.
    // The animation translates by exactly half of the track's width, so the second
    // copy lines up with the first just as the first scrolls off-screen.
    const originals = Array.from(track.children);
    originals.forEach(node => {
      const clone = node.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      track.appendChild(clone);
    });
  }

  // Smooth scroll for nav links (offset for fixed nav)
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (id.length <= 1) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const y = target.getBoundingClientRect().top + window.scrollY - 70;
      window.scrollTo({ top: y, behavior: 'smooth' });
    });
  });
})();
