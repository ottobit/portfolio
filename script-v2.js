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

// Fade-in sections on scroll (progressive enhancement: content is visible
// by default in CSS, the fade class is only added here when JS runs)
if ('IntersectionObserver' in window) {
    const observedSections = document.querySelectorAll('.hub-row');
    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');
                sectionObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });

    observedSections.forEach(section => {
        section.classList.add('fade-section');
        sectionObserver.observe(section);
    });
}

// Animated node network in the hero
(() => {
    const canvas = document.getElementById('network-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const heroVisual = canvas.closest('.hero-visual');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isSmallScreen = window.matchMedia('(max-width: 600px)').matches;

    const accentColor = '91, 61, 245';
    const nodeCount = isSmallScreen ? 28 : 60;
    const linkDistance = isSmallScreen ? 110 : 150;
    const nodeSpeed = 0.25;

    let width, height, dpr;
    let nodes = [];
    let mouse = { x: null, y: null };
    let animationId = null;

    function resize() {
        dpr = window.devicePixelRatio || 1;
        width = heroVisual.clientWidth;
        height = heroVisual.clientHeight;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function createNodes() {
        nodes = Array.from({ length: nodeCount }, () => ({
            x: Math.random() * width,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * nodeSpeed,
            vy: (Math.random() - 0.5) * nodeSpeed,
            r: 1.5 + Math.random() * 1.5
        }));
    }

    function step() {
        ctx.clearRect(0, 0, width, height);

        nodes.forEach(node => {
            node.x += node.vx;
            node.y += node.vy;

            if (node.x < 0 || node.x > width) node.vx *= -1;
            if (node.y < 0 || node.y > height) node.vy *= -1;

            if (mouse.x !== null) {
                const dx = node.x - mouse.x;
                const dy = node.y - mouse.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 90) {
                    const force = (90 - dist) / 90;
                    node.x += (dx / dist) * force * 1.2;
                    node.y += (dy / dist) * force * 1.2;
                }
            }
        });

        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const dx = nodes[i].x - nodes[j].x;
                const dy = nodes[i].y - nodes[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < linkDistance) {
                    const opacity = 1 - dist / linkDistance;
                    ctx.strokeStyle = `rgba(${accentColor}, ${opacity * 0.35})`;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(nodes[i].x, nodes[i].y);
                    ctx.lineTo(nodes[j].x, nodes[j].y);
                    ctx.stroke();
                }
            }
        }

        nodes.forEach(node => {
            ctx.fillStyle = `rgba(${accentColor}, 0.55)`;
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
            ctx.fill();
        });

        if (!reduceMotion) {
            animationId = requestAnimationFrame(step);
        }
    }

    heroVisual.addEventListener('mousemove', (e) => {
        const rect = heroVisual.getBoundingClientRect();
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
    });

    heroVisual.addEventListener('mouseleave', () => {
        mouse.x = null;
        mouse.y = null;
    });

    window.addEventListener('resize', () => {
        resize();
        createNodes();
        if (reduceMotion) step();
    });

    resize();
    createNodes();
    step();
})();

// Hub/sub-node graph: dots overlaid on the hero canvas (desktop) and a
// compact accordion fallback (mobile), sharing one detail panel below the hero.
(() => {
    const detailPanel = document.getElementById('detail-panel');
    if (!detailPanel) return;

    const detailIcon = document.getElementById('detail-icon');
    const detailTitle = document.getElementById('detail-title');
    const detailText = document.getElementById('detail-text');
    const detailClose = document.getElementById('detail-close');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function isDesktop() {
        return window.matchMedia('(min-width: 769px)').matches;
    }

    function closeDetail() {
        detailPanel.classList.remove('visible');
        window.setTimeout(() => {
            detailPanel.hidden = true;
        }, reduceMotion ? 0 : 300);
    }

    function openDetail(el) {
        detailIcon.textContent = el.dataset.icon || '';
        detailTitle.textContent = el.dataset.title || '';
        detailText.textContent = el.dataset.detail || '';
        detailPanel.hidden = false;
        requestAnimationFrame(() => detailPanel.classList.add('visible'));
    }

    if (detailClose) detailClose.addEventListener('click', closeDetail);

    // --- Desktop: dots overlaid directly on the hero canvas ---
    const heroVisual = document.querySelector('.hero-visual');
    const overlay = document.getElementById('hub-overlay');
    const svg = document.getElementById('graph-lines');
    const hubDots = overlay ? Array.from(overlay.querySelectorAll('.hub-dot')) : [];
    let desktopOpenKey = null;

    function positionHubDots() {
        hubDots.forEach(hub => {
            hub.style.left = hub.dataset.x + '%';
            hub.style.top = hub.dataset.y + '%';
        });
    }

    function subDotsFor(key) {
        return overlay ? Array.from(overlay.querySelectorAll(`.sub-dot[data-parent="${key}"]`)) : [];
    }

    function clearLines() {
        if (svg) while (svg.firstChild) svg.removeChild(svg.firstChild);
    }

    function positionSubDots(hub, subs) {
        const hx = (parseFloat(hub.dataset.x) / 100) * heroVisual.clientWidth;
        const hy = (parseFloat(hub.dataset.y) / 100) * heroVisual.clientHeight;
        const radius = 130;
        const count = subs.length;
        const spread = count === 1 ? 0 : Math.min(130, (count - 1) * 55);
        const startAngle = 90 - spread / 2;

        subs.forEach((sub, i) => {
            const angleDeg = count === 1 ? 90 : startAngle + (spread / (count - 1)) * i;
            const angle = (angleDeg * Math.PI) / 180;
            const offsetX = radius * Math.cos(angle);
            sub.style.left = hx + offsetX + 'px';
            sub.style.top = hy + radius * Math.sin(angle) + 'px';
            sub.classList.toggle('label-left', offsetX < -10);
        });

        return { hx, hy };
    }

    function drawLines(hx, hy, subs) {
        clearLines();
        if (!svg) return;

        subs.forEach((sub, i) => {
            const nx = parseFloat(sub.style.left);
            const ny = parseFloat(sub.style.top);
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', hx);
            line.setAttribute('y1', hy);
            line.setAttribute('x2', hx);
            line.setAttribute('y2', hy);
            svg.appendChild(line);

            if (reduceMotion) {
                line.setAttribute('x2', nx);
                line.setAttribute('y2', ny);
                return;
            }

            requestAnimationFrame(() => {
                line.style.transition = `x2 0.4s ease ${i * 0.06}s, y2 0.4s ease ${i * 0.06}s`;
                line.setAttribute('x2', nx);
                line.setAttribute('y2', ny);
            });
        });
    }

    function closeDesktopHub(hub) {
        hub.classList.remove('active');
        subDotsFor(hub.dataset.hub).forEach(s => s.classList.remove('visible', 'animate-in'));
        clearLines();
    }

    function openDesktopHub(key) {
        const hub = hubDots.find(h => h.dataset.hub === key);
        if (!hub) return;
        const alreadyOpen = hub.classList.contains('active');

        hubDots.forEach(h => {
            if (h !== hub) closeDesktopHub(h);
        });

        if (alreadyOpen) {
            closeDesktopHub(hub);
            closeDetail();
            desktopOpenKey = null;
            return;
        }

        hub.classList.add('active');
        desktopOpenKey = key;
        closeDetail();

        const subs = subDotsFor(key);
        const { hx, hy } = positionSubDots(hub, subs);
        subs.forEach(s => s.classList.add('visible'));
        subs.forEach((s, i) => {
            window.setTimeout(() => s.classList.add('animate-in'), reduceMotion ? 0 : i * 70);
        });
        drawLines(hx, hy, subs);
    }

    positionHubDots();

    hubDots.forEach(hub => {
        hub.addEventListener('click', () => openDesktopHub(hub.dataset.hub));
    });

    if (overlay) {
        overlay.querySelectorAll('.sub-dot:not(.sub-link)').forEach(sub => {
            sub.addEventListener('click', () => openDetail(sub));
        });
    }

    window.addEventListener('resize', () => {
        if (!desktopOpenKey) return;
        const hub = hubDots.find(h => h.dataset.hub === desktopOpenKey);
        const subs = subDotsFor(desktopOpenKey);
        const { hx, hy } = positionSubDots(hub, subs);
        drawLines(hx, hy, subs);
    });

    // --- Mobile: compact accordion, same content, no positioning math ---
    const hubRow = document.getElementById('hub-row');
    const rowGroups = hubRow ? Array.from(hubRow.querySelectorAll('.hub-row-group')) : [];

    function openMobileHub(key) {
        const group = rowGroups.find(g => g.querySelector('.hub-row-btn').dataset.hub === key);
        if (!group) return;
        const btn = group.querySelector('.hub-row-btn');
        const alreadyOpen = btn.classList.contains('active');

        rowGroups.forEach(g => {
            if (g === group) return;
            g.classList.remove('active');
            g.querySelector('.hub-row-btn').classList.remove('active');
        });

        group.classList.toggle('active', !alreadyOpen);
        btn.classList.toggle('active', !alreadyOpen);
        closeDetail();
    }

    rowGroups.forEach(group => {
        const btn = group.querySelector('.hub-row-btn');
        btn.addEventListener('click', () => openMobileHub(btn.dataset.hub));

        group.querySelectorAll('.hub-row-node').forEach(node => {
            if (node.tagName !== 'A') {
                node.addEventListener('click', () => openDetail(node));
            }
        });
    });

    // --- Nav links + hero CTA: open the right hub regardless of breakpoint ---
    function openHubByKey(key) {
        if (isDesktop()) {
            openDesktopHub(key);
        } else {
            openMobileHub(key);
        }
    }

    document.querySelectorAll('.nav-links a[data-hub], .cta-buttons a[data-hub]').forEach(el => {
        el.addEventListener('click', () => openHubByKey(el.dataset.hub));
    });
})();
