(() => {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.reveal').forEach((el, i) => {
    el.style.transitionDelay = `${Math.min(i % 4, 3) * 70}ms`;
    observer.observe(el);
  });

  const menuButton = document.querySelector('.menu-button');
  const mobileNav = document.querySelector('#mobile-nav');
  if (menuButton && mobileNav) {
    menuButton.addEventListener('click', () => {
      const open = menuButton.getAttribute('aria-expanded') === 'true';
      menuButton.setAttribute('aria-expanded', String(!open));
      mobileNav.hidden = open;
    });
    mobileNav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => {
      menuButton.setAttribute('aria-expanded', 'false');
      mobileNav.hidden = true;
    }));
  }

  const form = document.querySelector('.waitlist-form');
  if (form) {
    form.addEventListener('submit', () => {
      const button = form.querySelector('button');
      const input = form.querySelector('input');
      if (!input.checkValidity()) {
        input.reportValidity();
        return;
      }
      button.textContent = 'Waitlist endpoint ready to connect ✓';
      button.disabled = true;
    });
  }
})();
