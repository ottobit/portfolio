// Renders the Studio page from data/studio.json — the only place the
// per-area status lives. Updating an area means editing that JSON file,
// nothing here or in studio/index.html needs to change.

const STATUS_LABELS = {
    non_iniziata: 'Non iniziata',
    in_corso: 'In corso',
    completata: 'Completata',
    in_arrivo: 'In arrivo'
};

// Same shape as assets/js/site/news-feed.js:fetchJson, minus the
// AbortController timeout that one needs for slow external APIs — this
// fetches a static same-origin file, so a hang isn't a realistic failure
// mode and the extra machinery would just be noise.
async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
}

// A "private material" link always carries its own visible warning text —
// never just the lock emoji — so a screen reader, or anyone who can't see
// the emoji, still reads "private, access restricted" rather than hitting
// what looks like a broken link.
function lockLink(href, label) {
    const a = document.createElement('a');
    a.className = 'studio-lock';
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    const icon = document.createElement('span');
    icon.className = 'studio-lock-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '🔒';
    const text = document.createElement('span');
    text.textContent = `${label} — Materiale privato, accesso riservato`;
    a.append(icon, text);
    return a;
}

function statusLabel(area) {
    const base = STATUS_LABELS[area.stato] || area.stato;
    if (area.stato === 'completata' && area.data) {
        return `${base} (${area.data})`;
    }
    return base;
}

function renderProgress(root, aree) {
    const done = aree.filter(a => a.stato === 'completata').length;
    const total = aree.length;
    const pct = total ? Math.round((done / total) * 100) : 0;

    const label = document.createElement('p');
    label.className = 'studio-progress-label';
    label.textContent = `${done} su ${total} aree completate`;

    const bar = document.createElement('div');
    bar.className = 'studio-progress-bar';
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', String(total));
    bar.setAttribute('aria-valuenow', String(done));
    bar.setAttribute('aria-label', 'Aree completate');

    const fill = document.createElement('div');
    fill.className = 'studio-progress-fill';
    fill.style.width = `${pct}%`;
    bar.append(fill);

    root.append(label, bar);
}

function renderArea(area, index) {
    const li = document.createElement('li');
    li.className = 'studio-area';

    const header = document.createElement('div');
    header.className = 'studio-area-header';

    const number = document.createElement('span');
    number.className = 'studio-area-number';
    number.textContent = String(index + 1).padStart(2, '0');

    const name = document.createElement('h3');
    name.className = 'studio-area-name';
    name.textContent = area.nome;

    const status = document.createElement('span');
    status.className = `studio-status is-${area.stato}`;
    status.textContent = statusLabel(area);

    header.append(number, name, status);
    li.append(header);

    const goals = document.createElement('ul');
    goals.className = 'doc-list studio-area-goals';
    for (const goal of area.obiettivi || []) {
        const item = document.createElement('li');
        item.textContent = goal;
        goals.append(item);
    }
    li.append(goals);

    if (area.test || area.lezioni) {
        const links = document.createElement('div');
        links.className = 'studio-area-links';
        if (area.lezioni) links.append(lockLink(area.lezioni, 'Lezioni'));
        if (area.test) links.append(lockLink(area.test, 'Test'));
        li.append(links);
    }

    return li;
}

async function initStudio() {
    const progressRoot = document.getElementById('studio-progress');
    const areasRoot = document.getElementById('studio-areas');
    const mapLink = document.getElementById('studio-map-link');
    if (!progressRoot || !areasRoot) return;

    try {
        const data = await fetchJson('../data/studio.json');
        const aree = data.aree || [];

        progressRoot.replaceChildren();
        renderProgress(progressRoot, aree);

        areasRoot.replaceChildren();
        aree.forEach((area, index) => areasRoot.append(renderArea(area, index)));

        if (mapLink && data.mappa) {
            mapLink.href = data.mappa;
            mapLink.hidden = false;
        }
    } catch (err) {
        console.warn('[studio] failed to load data/studio.json:', err);
        progressRoot.replaceChildren();
        const msg = document.createElement('p');
        msg.className = 'studio-progress-label';
        msg.textContent = 'Impossibile caricare i dati dello studio al momento.';
        progressRoot.append(msg);
    }
}

initStudio();
