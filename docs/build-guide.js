(function () {
  'use strict';

  const navLinks = document.querySelectorAll('.nav a[href^="#"]');

  if (navLinks.length && location.hash) {
    const id = location.hash.slice(1);
    navLinks.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + id));
  } else if (navLinks.length) {
    navLinks[0].classList.add('active');
  }
  const sections = document.querySelectorAll('main section[id]');

  function setActive(id) {
    navLinks.forEach((a) => {
      a.classList.toggle('active', a.getAttribute('href') === '#' + id);
    });
  }

  navLinks.forEach((a) => {
    a.addEventListener('click', () => {
      const id = a.getAttribute('href').slice(1);
      setActive(id);
    });
  });

  if (sections.length && 'IntersectionObserver' in window) {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting && en.intersectionRatio >= 0.25) {
            setActive(en.target.id);
          }
        });
      },
      { rootMargin: '-20% 0px -55% 0px', threshold: [0, 0.25, 0.5] }
    );
    sections.forEach((s) => obs.observe(s));
  }

  document.querySelectorAll('.cmd').forEach((block) => {
    const pre = block.querySelector('pre');
    if (!pre) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cmd-copy';
    btn.textContent = 'Copier';
    btn.addEventListener('click', async () => {
      const text = pre.textContent.trim();
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = 'Copié';
        btn.classList.add('copied');
        showToast('Copié dans le presse-papiers');
        setTimeout(() => {
          btn.textContent = 'Copier';
          btn.classList.remove('copied');
        }, 2000);
      } catch {
        showToast('Copie impossible', false);
      }
    });
    block.appendChild(btn);
  });

  function showToast(msg, ok = true) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.color = ok ? 'var(--success)' : '#fb7185';
    el.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => el.classList.remove('show'), 2200);
  }
})();
