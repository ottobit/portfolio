// Progressive enhancement for the homepage hero: make the professional
// value proposition and primary navigation actions immediately visible
// without changing the existing graph, canvas, mascot or warp behavior.
import { getLang } from './theme-lang.js?v=1';

const description = document.querySelector('.hero-text .description');
const ctaButtons = document.querySelector('.hero-text .cta-buttons');

if (description && ctaButtons) {
    const value = document.createElement('p');
    value.className = 'hero-value-proposition';
    value.dataset.it = 'Progetto e guido sistemi software complessi, dalle architetture full-stack ai workflow AI multi-agente, trasformando problemi ambigui in soluzioni solide e manutenibili.';
    value.dataset.en = 'I design and lead complex software systems, from full-stack architectures to multi-agent AI workflows, turning ambiguous problems into robust, maintainable solutions.';
    value.textContent = getLang() === 'it' ? value.dataset.it : value.dataset.en;
    description.prepend(value);

    const existingGithub = ctaButtons.querySelector('a[href="https://github.com/ottobit"]');
    if (existingGithub) {
        existingGithub.dataset.it = 'GitHub';
        existingGithub.dataset.en = 'GitHub';
        existingGithub.textContent = 'GitHub';
    }

    const projects = document.createElement('a');
    projects.href = 'projects/index.html';
    projects.className = 'btn btn-primary';
    projects.dataset.it = 'Progetti';
    projects.dataset.en = 'Projects';
    projects.textContent = getLang() === 'it' ? projects.dataset.it : projects.dataset.en;

    const contact = document.createElement('a');
    contact.href = 'https://www.linkedin.com/in/giuseppequartarone';
    contact.target = '_blank';
    contact.rel = 'noopener';
    contact.className = 'btn btn-primary';
    contact.dataset.it = 'Contatti';
    contact.dataset.en = 'Contact';
    contact.textContent = getLang() === 'it' ? contact.dataset.it : contact.dataset.en;

    ctaButtons.prepend(projects);
    ctaButtons.append(contact);

    document.addEventListener('langchange', event => {
        const lang = event.detail?.lang === 'it' ? 'it' : 'en';
        value.textContent = value.dataset[lang];
        projects.textContent = projects.dataset[lang];
        contact.textContent = contact.dataset[lang];
    });
}
