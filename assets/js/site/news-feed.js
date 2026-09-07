// Shared by all the news-feed fetchers below: parses JSON, throws on a
// non-OK response, and — unlike a bare fetch() — actually gives up after a
// while instead of hanging forever if a request stalls.
const NEWS_FETCH_TIMEOUT_MS = 8000;
async function fetchJson(url) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), NEWS_FETCH_TIMEOUT_MS);
    try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return await res.json();
    } finally {
        window.clearTimeout(timer);
    }
}

// A lightweight, read-only feed of this project's own GitHub activity —
// shown occasionally in dot's speech bubble alongside its usual random
// one-liners. GitHub's public events API is CORS-open and needs no
// auth/key for public data (verified: Access-Control-Allow-Origin: *),
// so this stays a plain client-side fetch — no backend, matching the
// same constraint that ruled out Deepgram/an LLM chatbot earlier.
// Unauthenticated requests are capped at 60/hour per visitor IP; one
// fetch per page load is nowhere close.
const GITHUB_NEWS_REPO = 'ottobit/portfolio';
let githubNewsItems = [];
async function fetchGithubNews() {
    try {
        // The Events API (used previously) truncates PullRequestEvent's
        // pull_request object down to a handful of fields — no title, no
        // html_url, no merged flag — and often ships PushEvents with an
        // empty commits[] for API-driven pushes (like a merge done through
        // the GitHub API rather than a raw git push). Both meant this feed
        // silently found nothing to show despite the API itself responding
        // fine. The commit history is a much more reliable source: every
        // commit always carries its message and html_url.
        const commits = await fetchJson(`https://api.github.com/repos/${GITHUB_NEWS_REPO}/commits?per_page=20`);
        const items = [];
        const seenText = new Set();
        for (const c of commits) {
            const msg = ((c.commit && c.commit.message) || '').split('\n')[0].trim();
            // Skip merge commits ("Merge pull request #NN from ...") — the
            // feature branch's own commit right after it already carries
            // the real, human-written title.
            if (msg && !/^merge /i.test(msg) && !seenText.has(msg)) {
                seenText.add(msg);
                items.push({ text: msg, url: c.html_url, icon: '📰' });
            }
            if (items.length >= 8) break;
        }
        githubNewsItems = items;
    } catch (err) {
        // Offline, rate-limited, or blocked — dot's normal random lines
        // are a perfectly fine fallback for the visitor either way, but a
        // console warning still helps diagnose a real outage.
        console.warn('[dot] GitHub feed failed:', err);
    }
}

// AI theme: Hugging Face's public trending-models listing. Same
// no-backend constraint as GitHub above — verified CORS-open, no key
// needed for public data.
let aiNewsItems = [];
async function fetchAiNews() {
    try {
        // "trending" is a website-only sort (huggingface.co/models?sort=trending) —
        // the actual REST API rejects it with a 400, since `sort` there must be a
        // real ModelInfo property (downloads, likes, lastModified, ...) paired
        // with `direction=-1` for descending. Sorting by downloads surfaces
        // popular-but-often-old models (the same handful stay on top for
        // years) — lastModified favors what's actually being worked on right
        // now, a better fit for "recent news" than raw popularity.
        const models = await fetchJson('https://huggingface.co/api/models?sort=lastModified&direction=-1&limit=8');
        aiNewsItems = models
            .filter(m => m.id)
            .map(m => ({ text: `updated on Hugging Face: ${m.id}`, url: `https://huggingface.co/${m.id}`, icon: '🤖' }));
    } catch (err) {
        // Same fallback as the GitHub feed — offline/blocked/CORS just
        // means this dot sticks to its usual random one-liners.
        console.warn('[dot] AI feed failed:', err);
    }
}

// World theme: Hacker News' public top-stories feed — real, live world/tech
// news refreshed continuously (previously Wikipedia's "on this day", which
// sounds like news but is the opposite: it always surfaces past-year
// anniversaries for today's date, never anything actually current). No key
// needed, CORS-open, backed by Firebase.
let worldNewsItems = [];
async function fetchWorldNews() {
    try {
        const ids = (await fetchJson('https://hacker-news.firebaseio.com/v0/topstories.json')).slice(0, 8);
        const stories = await Promise.all(ids.map(id =>
            fetchJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).catch(() => null)
        ));
        worldNewsItems = stories
            .filter(s => s && s.title)
            .map(s => ({
                text: s.title,
                // A self-post (Ask/Show HN) has no external url — fall back
                // to its own HN discussion page.
                url: s.url || `https://news.ycombinator.com/item?id=${s.id}`,
                icon: '🌍'
            }));
    } catch (err) {
        console.warn('[dot] world feed failed:', err);
    }
}

// Weather theme: Open-Meteo's public forecast API — no key, no signup,
// CORS-open. A handful of fixed cities around the world rather than the
// visitor's own location (no geolocation prompt needed for a mascot's
// speech bubble).
const WEATHER_CITIES = [
    { name: 'Rome', it: 'Roma', lat: 41.9028, lon: 12.4964 },
    { name: 'New York', it: 'New York', lat: 40.7128, lon: -74.006 },
    { name: 'Tokyo', it: 'Tokyo', lat: 35.6762, lon: 139.6503 },
    { name: 'London', it: 'Londra', lat: 51.5074, lon: -0.1278 },
    { name: 'Sydney', it: 'Sydney', lat: -33.8688, lon: 151.2093 }
];
let weatherNewsItems = [];
async function fetchWeatherNews() {
    try {
        const lang = (typeof siteState !== 'undefined' && siteState.getLang) ? siteState.getLang() : document.documentElement.lang || 'en';
        const results = await Promise.all(WEATHER_CITIES.map(async city => {
            try {
                const data = await fetchJson(`https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=temperature_2m`);
                const temp = data.current && data.current.temperature_2m;
                if (temp === undefined) return null;
                const cityName = lang === 'it' ? city.it : city.name;
                const text = lang === 'it' ? `${Math.round(temp)}°C a ${cityName} in questo momento` : `${Math.round(temp)}°C in ${cityName} right now`;
                return { text, url: null, icon: '🌤️' };
            } catch (err) {
                console.warn(`[dot] weather feed: ${city.name} failed:`, err);
                return null;
            }
        }));
        weatherNewsItems = results.filter(Boolean);
    } catch (err) {
        console.warn('[dot] weather feed failed:', err);
    }
}

// Space theme: NASA's Astronomy Picture of the Day. Uses NASA's public
// DEMO_KEY — documented, rate-limited but usable without any signup of our
// own (https://api.nasa.gov). Only one item per day, that's fine: the pool
// below handles feeds of any length.
let spaceNewsItems = [];
async function fetchSpaceNews() {
    try {
        // The shared DEMO_KEY is rate-limited (30/hour, 50/day per IP) — a
        // failure here often just means someone on this network already
        // used it up for the day, not that the feed is broken.
        const data = await fetchJson('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY');
        if (!data.title) return;
        spaceNewsItems = [{
            text: `NASA APOD: ${data.title}`,
            url: data.url || 'https://apod.nasa.gov/apod/astropix.html',
            icon: '🔭'
        }];
    } catch (err) {
        console.warn('[dot] space feed failed:', err);
    }
}

// Trending theme: Wikipedia's official pageviews-top API — what the world
// is actually reading right now, not "on this day in history". No key,
// CORS-open. Pageview data has a ~2 day processing lag, so "today" is never
// populated yet — go back 2 days to reliably land on a ready one.
let trendingNewsItems = [];
async function fetchTrendingNews() {
    try {
        const lang = (typeof siteState !== 'undefined' && siteState.getLang) ? siteState.getLang() : document.documentElement.lang || 'en';
        const wikiLang = lang === 'it' ? 'it' : 'en';
        const d = new Date();
        d.setDate(d.getDate() - 2);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const data = await fetchJson(`https://wikimedia.org/api/rest_v1/metrics/pageviews/top/${wikiLang}.wikipedia/all-access/${yyyy}/${mm}/${dd}`);
        const articles = (data.items && data.items[0] && data.items[0].articles) || [];
        trendingNewsItems = articles
            .filter(a => a.article && !/^(Special:|Wikipedia:|Main_Page|Portale:|Speciale:|Pagina_principale)/.test(a.article))
            .slice(0, 8)
            .map(a => ({
                text: `trending on Wikipedia: ${a.article.replace(/_/g, ' ')}`,
                url: `https://${wikiLang}.wikipedia.org/wiki/${a.article}`,
                icon: '📈'
            }));
    } catch (err) {
        console.warn('[dot] trending feed failed:', err);
    }
}

// Music theme: Apple's public iTunes RSS feed of top songs. No key, no
// signup — the same feeds sites embed client-side (Access-Control-Allow-
// Origin: * on the /json variant).
let musicNewsItems = [];
async function fetchMusicNews() {
    try {
        const data = await fetchJson('https://itunes.apple.com/us/rss/topsongs/limit=8/json');
        const entries = (data.feed && data.feed.entry) || [];
        musicNewsItems = entries
            .filter(e => e['im:name'] && e['im:name'].label)
            .map(e => ({
                text: `top of the charts: ${e['im:artist'].label} — ${e['im:name'].label}`,
                url: (e.id && e.id.label) || null,
                icon: '🎵'
            }));
    } catch (err) {
        console.warn('[dot] music feed failed:', err);
    }
}

// Fashion theme: reddit.com/r/fashion's public top-of-the-day listing.
// Same no-key, CORS-open constraint as the other feeds — reddit's .json
// endpoints serve Access-Control-Allow-Origin: * for public read access.
let fashionNewsItems = [];
async function fetchFashionNews() {
    try {
        const data = await fetchJson('https://www.reddit.com/r/fashion/top.json?limit=8&t=day');
        const posts = (data.data && data.data.children) || [];
        fashionNewsItems = posts
            .filter(p => p.data && p.data.title)
            .map(p => ({ text: p.data.title, url: `https://www.reddit.com${p.data.permalink}`, icon: '👗' }));
    } catch (err) {
        console.warn('[dot] fashion feed failed:', err);
    }
}

// Cinema theme: reddit.com/r/movies' public top-of-the-day listing. Same
// source/shape as the fashion feed above, different subreddit.
let cinemaNewsItems = [];
async function fetchCinemaNews() {
    try {
        const data = await fetchJson('https://www.reddit.com/r/movies/top.json?limit=8&t=day');
        const posts = (data.data && data.data.children) || [];
        cinemaNewsItems = posts
            .filter(p => p.data && p.data.title)
            .map(p => ({ text: p.data.title, url: `https://www.reddit.com${p.data.permalink}`, icon: '🎬' }));
    } catch (err) {
        console.warn('[dot] cinema feed failed:', err);
    }
}

// International politics theme: reddit.com/r/worldnews' public
// top-of-the-day listing. Same no-key, CORS-open source/shape as the
// fashion/cinema feeds above, different subreddit.
let politicsNewsItems = [];
async function fetchPoliticsNews() {
    try {
        const data = await fetchJson('https://www.reddit.com/r/worldnews/top.json?limit=8&t=day');
        const posts = (data.data && data.data.children) || [];
        politicsNewsItems = posts
            .filter(p => p.data && p.data.title)
            .map(p => ({ text: p.data.title, url: `https://www.reddit.com${p.data.permalink}`, icon: '🗳️' }));
    } catch (err) {
        console.warn('[dot] politics feed failed:', err);
    }
}

// Finance theme: reddit.com/r/economics' public top-of-the-day listing.
// Same source/shape again — economics over investing/stocks, since it
// reads as actual financial news rather than trading chatter.
let financeNewsItems = [];
async function fetchFinanceNews() {
    try {
        const data = await fetchJson('https://www.reddit.com/r/economics/top.json?limit=8&t=day');
        const posts = (data.data && data.data.children) || [];
        financeNewsItems = posts
            .filter(p => p.data && p.data.title)
            .map(p => ({ text: p.data.title, url: `https://www.reddit.com${p.data.permalink}`, icon: '💹' }));
    } catch (err) {
        console.warn('[dot] finance feed failed:', err);
    }
}

// Jobs theme: Arbeitnow's public job-board API, filtered client-side to
// postings located in Europe. RemoteOK (tried first) turned out to skew
// heavily American even on "remote worldwide" listings — not useful for
// someone not looking to relocate outside Europe — and has no country
// field of its own to filter by anyway. Arbeitnow's own board is
// Germany-rooted with solid pan-European coverage, so matching against a
// list of European country names (rather than one single country) keeps
// the feed both relevant and non-empty. No key, no signup.
const EUROPE_LOCATION_RE = new RegExp(
    '\\b(' + [
        'europe', 'austria', 'belgium', 'bulgaria', 'croatia', 'cyprus',
        'czech', 'denmark', 'estonia', 'finland', 'france', 'germany',
        'greece', 'hungary', 'iceland', 'ireland', 'italy', 'italia',
        'latvia', 'lithuania', 'luxembourg', 'malta', 'netherlands',
        'norway', 'poland', 'portugal', 'romania', 'slovakia', 'slovenia',
        'spain', 'sweden', 'switzerland', 'united kingdom', 'uk'
    ].join('|') + ')\\b',
    'i'
);
let jobsNewsItems = [];
async function fetchJobsNews() {
    try {
        const data = await fetchJson('https://www.arbeitnow.com/api/job-board-api');
        const jobs = (data && data.data) || [];
        jobsNewsItems = jobs
            .filter(j => j.title && j.company_name && j.url && EUROPE_LOCATION_RE.test(j.location || ''))
            .slice(0, 8)
            .map(j => ({ text: `hiring in Europe: ${j.company_name} — ${j.title}`, url: j.url, icon: '💼' }));
    } catch (err) {
        console.warn('[dot] jobs feed failed:', err);
    }
}

// All feeds pooled together, not split one-per-dot — every dot pulls from
// the same combined pool, so nobody has to wait for "the right one" to see
// a specific source. Round-robin interleaved (not one feed's items
// exhausted before the next's) so consecutive reveals naturally rotate
// between sources.
export function getAllNewsItems() {
    const lists = [githubNewsItems, aiNewsItems, worldNewsItems, weatherNewsItems, spaceNewsItems, trendingNewsItems, musicNewsItems, fashionNewsItems, cinemaNewsItems, politicsNewsItems, financeNewsItems, jobsNewsItems];
    const combined = [];
    const maxLen = lists.reduce((max, l) => Math.max(max, l.length), 0);
    for (let i = 0; i < maxLen; i++) {
        for (const list of lists) {
            if (list[i]) combined.push(list[i]);
        }
    }
    return combined;
}

// Truncated with an ellipsis in the nav (see .nav-news-list CSS), so the
// limit can afford to be breakpoint-aware: more vertical room on desktop
// than in a mobile dropdown. Same 768px line the rest of the site already
// treats as the mobile/desktop split (see .hero's max-width:768px rule).
const NEWS_HISTORY_LIMIT_DESKTOP = 6;
const NEWS_HISTORY_LIMIT_MOBILE = 4;
export function getNewsHistoryLimit() {
    return window.matchMedia('(max-width: 768px)').matches ? NEWS_HISTORY_LIMIT_MOBILE : NEWS_HISTORY_LIMIT_DESKTOP;
}

let notifiedNewsHistory = [];

export function recordNotifiedNews(item) {
    notifiedNewsHistory = [item, ...notifiedNewsHistory.filter(i => i.text !== item.text)].slice(0, NEWS_HISTORY_LIMIT_DESKTOP);
    document.dispatchEvent(new CustomEvent('dotnewshistory', { detail: notifiedNewsHistory }));
}

async function refetchAllNews() {
    await Promise.all([
        fetchGithubNews(),
        fetchAiNews(),
        fetchWorldNews(),
        fetchWeatherNews(),
        fetchSpaceNews(),
        fetchTrendingNews(),
        fetchMusicNews(),
        fetchFashionNews(),
        fetchCinemaNews(),
        fetchPoliticsNews(),
        fetchFinanceNews(),
        fetchJobsNews()
    ]);
}
// The initial population doesn't need to happen at parse time — dot's
// first news reveal is never before ~25s (see scheduleNews below), so a
// short delay here is invisible to a visitor but avoids firing a burst of
// requests to external APIs before the page has even finished settling.
window.setTimeout(refetchAllNews, 6000);
// Floor between click-triggered live refetches — mashing clicks shouldn't
// hammer a handful of rate-limited public APIs at once.
const NEWS_REFETCH_COOLDOWN_MS = 20000;
let lastNewsRefetchAt = 0;

// Where "dot" is born: the dot right after "ottobit." in the big hero
// heading (.name), not the small one in the sticky header logo. Falls back
// to the old hero-center spot if it isn't there for some reason, so a
// missing selector never leaves the mascot un-placeable.
