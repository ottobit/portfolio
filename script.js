// Flip card functionality for desktop and mobile
const flipCards = document.querySelectorAll('.flip-card');
let touchStartX = 0;
let touchEndX = 0;

// Desktop: hover to flip
flipCards.forEach(card => {
    card.addEventListener('mouseenter', () => {
        card.classList.add('flipped');
    });
    
    card.addEventListener('mouseleave', () => {
        card.classList.remove('flipped');
    });

    // Mobile: swipe to flip
    card.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, false);

    card.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe(card);
    }, false);
});

function handleSwipe(card) {
    const swipeThreshold = 30;
    const diff = touchStartX - touchEndX;

    if (Math.abs(diff) > swipeThreshold) {
        card.classList.toggle('flipped');
    }
}

// Smooth scroll for navigation
const navLinks = document.querySelectorAll('.nav-links a');

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (href.startsWith('#')) {
            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                target.scrollIntoView({ behavior: 'smooth' });
            }
        }
    });
});

// Update active nav link on scroll
window.addEventListener('scroll', () => {
    const sections = document.querySelectorAll('section');
    const scrollPosition = window.scrollY + 100;

    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionBottom = sectionTop + section.offsetHeight;
        const sectionId = section.getAttribute('id');
        const navLink = document.querySelector(`.nav-links a[href="#${sectionId}"]`);

        if (scrollPosition >= sectionTop && scrollPosition < sectionBottom) {
            navLinks.forEach(link => link.classList.remove('active'));
            if (navLink) {
                navLink.classList.add('active');
            }
        }
    });
});
