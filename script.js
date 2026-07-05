// ██╗    ██╗██╗   ██╗██╗
// ██║    ██║██║   ██║██║
// ██║ █╗ ██║██║   ██║██║
// ██║███╗██║██║   ██║╚═╝
// ╚███╔███╔╝╚██████╔╝██╗
//  ╚══╝╚══╝  ╚═════╝ ╚═╝
//
//   NGAPAIN WOI BACA SC GW😹

document.addEventListener('DOMContentLoaded', () => {

  /* ============ 1. LOADING ANIMATION ============ */
  const loader = document.getElementById('loader');
  window.addEventListener('load', () => {
    setTimeout(() => loader.classList.add('hidden'), 1200);
  });
  // Fallback kalau event load sudah lewat / lambat
  setTimeout(() => loader.classList.add('hidden'), 3000);


  /* ============ 2. NAVBAR MOBILE MENU ============ */
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');

  hamburger.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    hamburger.classList.toggle('open', isOpen);
    hamburger.setAttribute('aria-expanded', isOpen);
  });

  // Tutup menu saat link diklik
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      hamburger.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
    });
  });


  /* ============ 3. SMOOTH SCROLL ============ */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
      const targetId = anchor.getAttribute('href');
      if (targetId.length <= 1) return;
      const target = document.querySelector(targetId);
      if (!target) return;
      e.preventDefault();
      const navH = document.getElementById('navbar').offsetHeight;
      const top = target.getBoundingClientRect().top + window.pageYOffset - navH - 8;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });


  /* ============ 4. ACTIVE NAVBAR ON SCROLL ============ */
  const sections = document.querySelectorAll('section[id]');
  const navButtons = document.querySelectorAll('[data-nav]');

  function updateActiveNav() {
    const navH = document.getElementById('navbar').offsetHeight;
    let currentId = 'home';
    sections.forEach(sec => {
      const top = sec.getBoundingClientRect().top;
      if (top - navH - 100 <= 0) currentId = sec.id;
    });
    navButtons.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('href') === '#' + currentId);
    });
  }
  window.addEventListener('scroll', updateActiveNav, { passive: true });
  updateActiveNav();


  /* ============ 5. SCROLL REVEAL ANIMATION ============ */
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));


  /* ============ 6. ANIMATED COUNTER ============ */
  function animateCounter(el) {
    const target = parseInt(el.dataset.counter, 10);
    const suffix = el.dataset.suffix || '';
    const duration = 1400;
    const start = performance.now();

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      el.textContent = Math.round(eased * target) + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  const counterObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        counterObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('[data-counter]').forEach(el => counterObserver.observe(el));


  /* ============ 7. ANIMATED PROGRESS BARS ============ */
  const barObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const fill = entry.target;
        setTimeout(() => {
          fill.style.width = fill.dataset.progress + '%';
        }, 150);
        barObserver.unobserve(fill);
      }
    });
  }, { threshold: 0.4 });

  document.querySelectorAll('.bar-fill').forEach(el => barObserver.observe(el));


  /* ============ 8. GALLERY MODAL ============ */
  const modal = document.getElementById('galleryModal');
  const modalImg = document.getElementById('modalImg');
  const modalCaption = document.getElementById('modalCaption');
  const modalPrev = document.getElementById('modalPrev');
  const modalNext = document.getElementById('modalNext');

  const galleryCards = Array.from(document.querySelectorAll('.gallery-card'));
  const galleryData = galleryCards.map(card => ({
    src: card.querySelector('img').src,
    title: card.dataset.title || card.querySelector('img').alt
  }));

  let currentIndex = 0;

  function openModal(index) {
    currentIndex = index;
    updateModal();
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function updateModal() {
    const item = galleryData[currentIndex];
    modalImg.src = item.src;
    modalImg.alt = item.title;
    modalCaption.textContent = item.title;
  }

  function showNext(dir) {
    currentIndex = (currentIndex + dir + galleryData.length) % galleryData.length;
    updateModal();
  }

  galleryCards.forEach((card, i) => {
    card.addEventListener('click', () => openModal(i));
  });

  modalPrev.addEventListener('click', () => showNext(-1));
  modalNext.addEventListener('click', () => showNext(1));

  modal.querySelectorAll('[data-close-modal]').forEach(el => {
    el.addEventListener('click', closeModal);
  });

  document.addEventListener('keydown', e => {
    if (!modal.classList.contains('open')) return;
    if (e.key === 'Escape') closeModal();
    if (e.key === 'ArrowLeft') showNext(-1);
    if (e.key === 'ArrowRight') showNext(1);
  });


  /* ============ 9. BACK TO TOP ============ */
  const backTop = document.getElementById('backTop');
  const backTopFooter = document.getElementById('backTopFooter');

  window.addEventListener('scroll', () => {
    backTop.classList.toggle('show', window.scrollY > 500);
  }, { passive: true });

  function scrollTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  backTop.addEventListener('click', scrollTop);
  backTopFooter.addEventListener('click', scrollTop);


  /* ============ 10. FLOATING SHAPES (PARALLAX) ============ */
  const doodles = document.querySelectorAll('.doodle');
  let ticking = false;

  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      doodles.forEach((d, i) => {
        const speed = 0.04 + (i % 3) * 0.03;
        d.style.marginTop = (y * speed * (i % 2 === 0 ? 1 : -1)) + 'px';
      });
      ticking = false;
    });
  }, { passive: true });


  /* ============ 11. CONTACT FORM ============ */
  const contactForm = document.getElementById('contactForm');
  contactForm.addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const message = document.getElementById('message').value.trim();

    if (!name || !email || !message) return;

    // Kirim via WhatsApp
    const text = encodeURIComponent(
      `Halo Fajar!\n\nNama: ${name}\nEmail: ${email}\n\nPesan:\n${message}`
    );
    window.open(`https://wa.me/6285708557587?text=${text}`, '_blank');

    // Feedback button
    const btn = contactForm.querySelector('button[type="submit"]');
    const original = btn.innerHTML;
    btn.innerHTML = '<svg class="icon"><use href="#i-check"/></svg> Pesan Terkirim!';
    btn.style.background = 'var(--green)';
    btn.style.color = 'var(--ink)';
    contactForm.reset();
    setTimeout(() => {
      btn.innerHTML = original;
      btn.style.background = '';
      btn.style.color = '';
    }, 3000);
  });

});
