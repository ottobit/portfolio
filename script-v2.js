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
    const observedSections = document.querySelectorAll('.explore');
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

// Interactive node graph for About / Progetti / Social
(() => {
    const graph = document.getElementById('graph');
    if (!graph) return;

    const svg = document.getElementById('graph-lines');
    const hubs = Array.from(graph.querySelectorAll('.hub'));
    const detailPanel = document.getElementById('detail-panel');
    const detailIcon = document.getElementById('detail-icon');
    const detailTitle = document.getElementById('detail-title');
    const detailText = document.getElementById('detail-text');
    const detailClose = document.getElementById('detail-close');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function isDesktop() {
        return window.matchMedia('(min-width: 769px)').matches;
    }

    function nodesFor(hub) {
        return Array.from(graph.querySelectorAll(`.node[data-parent="${hub.dataset.hub}"]`));
    }

    function positionHubs() {
        hubs.forEach(hub => {
            if (isDesktop()) {
                hub.style.left = hub.dataset.x + '%';
                hub.style.top = hub.dataset.y + 'px';
            } else {
                hub.style.left = '';
                hub.style.top = '';
            }
        });
    }

    function clearLines() {
        while (svg.firstChild) svg.removeChild(svg.firstChild);
    }

    function positionNodes(hub, nodes) {
        if (!isDesktop()) {
            nodes.forEach(node => {
                node.style.left = '';
                node.style.top = '';
            });
            return;
        }

        const hx = (parseFloat(hub.dataset.x) / 100) * graph.clientWidth;
        const hy = parseFloat(hub.dataset.y);
        const radius = 165;
        const count = nodes.length;
        const spread = count === 1 ? 0 : Math.min(100, (count - 1) * 35);
        const startAngle = 90 - spread / 2;

        nodes.forEach((node, i) => {
            const angleDeg = count === 1 ? 90 : startAngle + (spread / (count - 1)) * i;
            const angle = (angleDeg * Math.PI) / 180;
            node.style.left = hx + radius * Math.cos(angle) + 'px';
            node.style.top = hy + radius * Math.sin(angle) + 'px';
        });
    }

    function drawLines(hub, nodes) {
        clearLines();
        if (!isDesktop()) return;

        const hx = (parseFloat(hub.dataset.x) / 100) * graph.clientWidth;
        const hy = parseFloat(hub.dataset.y);

        nodes.forEach((node, i) => {
            const nx = parseFloat(node.style.left);
            const ny = parseFloat(node.style.top);
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

    function closeDetail() {
        detailPanel.classList.remove('visible');
        window.setTimeout(() => {
            detailPanel.hidden = true;
        }, reduceMotion ? 0 : 300);
    }

    function openDetail(node) {
        detailIcon.textContent = node.dataset.icon || '';
        detailTitle.textContent = node.dataset.title || '';
        detailText.textContent = node.dataset.detail || '';
        detailPanel.hidden = false;
        requestAnimationFrame(() => detailPanel.classList.add('visible'));
    }

    function openHub(hub) {
        const alreadyOpen = hub.classList.contains('active');

        hubs.forEach(h => {
            if (h === hub) return;
            h.classList.remove('active');
            h.closest('.hub-group').classList.remove('active');
            nodesFor(h).forEach(n => n.classList.remove('visible', 'animate-in'));
        });

        const group = hub.closest('.hub-group');
        const nodes = nodesFor(hub);

        hub.classList.toggle('active', !alreadyOpen);
        group.classList.toggle('active', !alreadyOpen);

        if (alreadyOpen) {
            nodes.forEach(n => n.classList.remove('visible', 'animate-in'));
            clearLines();
            closeDetail();
            return;
        }

        closeDetail();
        positionNodes(hub, nodes);
        nodes.forEach(n => n.classList.add('visible'));

        nodes.forEach((n, i) => {
            window.setTimeout(() => n.classList.add('animate-in'), reduceMotion ? 0 : i * 70);
        });

        drawLines(hub, nodes);
    }

    hubs.forEach(hub => {
        hub.addEventListener('click', () => openHub(hub));
    });

    graph.querySelectorAll('.node:not(.node-link)').forEach(node => {
        node.addEventListener('click', () => openDetail(node));
    });

    detailClose.addEventListener('click', closeDetail);

    window.addEventListener('resize', () => {
        positionHubs();
        const activeHub = hubs.find(h => h.classList.contains('active'));
        if (!activeHub) return;
        const nodes = nodesFor(activeHub);
        positionNodes(activeHub, nodes);
        drawLines(activeHub, nodes);
    });

    positionHubs();

    document.querySelectorAll('.nav-links a[data-hub]').forEach(link => {
        link.addEventListener('click', () => {
            const hub = hubs.find(h => h.dataset.hub === link.dataset.hub);
            if (hub && !hub.classList.contains('active')) {
                openHub(hub);
            }
        });
    });
})();
