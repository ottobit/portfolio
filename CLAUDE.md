# Istruzioni per Claude

## Pull request: piano per le cose difficili, push per quelle facili, merge solo sul lavoro strutturato

Regola permanente, esplicitamente ribadita dall'utente — non va mai
dimenticata:

- Per le modifiche difficili/ambigue (scelta di design, architettura,
  qualcosa da chiarire): passa prima da un piano (Plan mode) e fatti
  approvare l'approccio prima di implementare.
- Per le modifiche facili/dirette: implementa, verifica (Playwright quando è
  UI, `node --check` sui file JS coinvolti, nessun errore console), poi
  commit + push su un branch nuovo (vedi sotto "Un branch nuovo per ogni
  sviluppo") senza bisogno di chiedere il permesso ogni volta.
- In entrambi i casi, apri (o aggiorna) la PR **in draft**.
- **Se concludere di tua iniziativa dipende dalla portata del lavoro.**
  Regola aggiunta dall'utente dopo che una PR piccola era stata mergiata
  senza il suo via libera:
  - **Lavoro minimo** — un fix, un ritocco a un'animazione o al copy, un
    bump di versione, una modifica che tocca uno o due file: **non
    concludere**. Commit, push, PR in draft, e ti fermi lì. La chiusura la
    decide l'utente.
  - **Lavoro tanto e strutturato** — una pagina nuova, un modulo nuovo, una
    feature che attraversa più file, un lavoro nato da un piano approvato:
    concludi tu. Marca la PR pronta per la review, mergiala, poi segui la
    procedura di conferma del deploy qui sotto.
  - **Nel dubbio, draft.** Il merge è l'unica azione da cui non si torna
    indietro: se non sai da che parte cade il lavoro, trattalo come minimo
    e aspetta.
- Non esiste nessun "auto concludi" valido per tutta la sessione: ogni PR si
  giudica sulla propria portata con il criterio qui sopra. Un via libera
  dato una volta non si trascina alla PR successiva.
- **Le PR aperte vanno concluse in ordine crescente di numero.** Se ci sono
  più PR aperte contemporaneamente, quando arriva un "Concludi" (o
  l'equivalente via libera di un piano approvato) e non è chiaro a quale
  PR si riferisce, si conclude prima quella con il numero più basso (la più
  vecchia) prima di passare alle successive — non saltarla solo perché la
  conversazione in corso riguarda un'altra PR più recente. Se l'utente
  nomina esplicitamente una PR diversa, quella indicazione vince comunque
  su questo ordine.
- Disiscriviti dalla PR solo dopo che è stata mergiata o chiusa.
- **Eccezione esplicita**: quando l'utente usa la frase "commit push PR" (o
  equivalenti tipo "vai con commit e push e PR") oppure la parola d'ordine
  **"Concludi!"**, questo significa ANCHE chiudere/mergiare la PR — non solo
  aprirla in draft. È il segnale che il lavoro è finito: marcarla pronta per
  la review e mergiarla, poi seguire comunque la procedura di conferma del
  deploy qui sotto. Vale anche sul lavoro minimo: la parola dell'utente
  batte sempre il criterio della portata.
- **Eccezione per i piani**: quando il lavoro è passato da Plan mode e
  l'utente ha approvato il piano (via ExitPlanMode), quell'approvazione vale
  anche come via libera al merge — l'approvazione del piano è già la
  conclusione. Niente bisogno di un "Concludi" separato dopo: implementa,
  verifica, commit + push, apri la PR e mergiala direttamente, poi segui la
  procedura di conferma del deploy qui sotto — è il caso "tanto e
  strutturato" nella sua forma più chiara. Le modifiche minime dirette
  restano comunque in draft finché l'utente non dice "Concludi"/"commit
  push PR".

## Dopo il merge: conferma il deploy, non solo il merge

Il merge della PR NON significa che il sito live sia già aggiornato — GitHub
Pages ha un suo workflow separato ("pages build and deployment") che parte
dopo il merge, e l'iscrizione agli eventi della PR non notifica il suo
completamento automaticamente. Dopo ogni merge:

1. Recupera l'ultima run del workflow "pages build and deployment" per lo
   SHA del merge commit (`actions_list` con `list_workflow_runs`, poi
   `actions_get` su quella run se serve controllarne lo stato).
2. Se è ancora `in_progress`/`queued`, ricontrolla finché non risulta
   `completed`/`success` — la pipeline è storicamente rapida (~40-60s), non
   serve un'attesa lunga.
3. Solo a quel punto conferma all'utente che la modifica è live in
   produzione — non basta dire "PR mergiata".

Se il deploy fallisce o resta bloccato, dillo esplicitamente invece di
assumere che sia andato a buon fine.

**Ferma sempre il polling una volta ottenuta la risposta.** Che sia un
`curl` in loop lanciato in background per aspettare il deploy o qualunque
altro processo avviato solo per controllare uno stato: appena arriva
`completed`/`success` (o comunque l'esito), il processo va terminato subito
— non lasciarlo girare in background "tanto poi finisce da solo". Prima di
chiudere il giro di lavoro, controlla anche che non sia rimasto altro
polling/server locale attivo da fermare (`ps aux` se in dubbio).

## Prima di ogni merge: aggiornati da main

Possono esserci altre sessioni/lavori in corso in parallelo sullo stesso
repo. Prima di mergiare qualunque PR (sia nel flusso "Concludi" sia
nell'eccezione dei piani approvati):

1. `git fetch origin main` e confronta con il branch di lavoro
   (`git diff HEAD origin/main --stat`) per vedere se `main` si è mosso da
   quando il branch è partito.
2. Se sì, prova comunque prima il merge della PR — se GitHub non segnala
   conflitti, va bene così (i due lavori non si toccano).
3. Se GitHub rifiuta il merge per conflitti reali (non il falso positivo da
   squash-merge già noto — quello si riconosce da un `git diff HEAD~1
   origin/main --stat` vuoto), fai `git merge origin/main` sul branch di
   lavoro, risolvi i conflitti mantenendo l'intento di entrambi i lati
   quando possibile, riverifica (stessa verifica già fatta per la PR:
   Playwright/`node --check`/console pulita) sull'albero unito, poi push e
   merge.
4. Se `git merge` viene bloccato dal classificatore dei permessi, spiega
   perché serve e chiedi conferma prima di riprovare — non è un'azione
   distruttiva (crea un commit di merge, non riscrive storia), ma resta
   un'azione che tocca git e va confermata come le altre.

## Un branch nuovo per ogni sviluppo

Regola aggiunta dall'utente dopo aver notato che riusare sempre lo stesso
branch per PR successive è scomodo da seguire e causava il falso positivo
di merge conflict descritto sopra (una storia pre-squash che diverge
sempre di più da quella squashata su `main`, PR dopo PR).

Da ora, per ogni nuovo sviluppo (non per ogni singolo commit — un piano
approvato o un giro di feedback che genera più commit correlati resta
sullo stesso branch finché non è mergiato):

1. Parti sempre da `main` aggiornato:
   `git fetch origin main && git checkout -B claude/<slug-breve> origin/main`
   — `<slug-breve>` descrive il lavoro (es. `claude/embergale-boss-tosto`,
   `claude/sword-color-fix`), non serve seguire lo schema del vecchio
   branch designato.
2. Lavora, apri la PR da quel branch (draft o pronta secondo il criterio
   di portata già in vigore).
3. **Dopo che la PR è mergiata, cancella il branch di default**
   (`delete_branch` sulla PR, o `git push origin --delete claude/<slug>`)
   — il contenuto resta comunque su `main` grazie allo squash-merge, quindi
   non si perde nulla. Fai eccezione solo se c'è una ragione specifica per
   tenerlo (l'utente lo chiede, o la PR resta chiusa senza merge e potrebbe
   servire riprenderla) — in quel caso lascialo e basta, senza chiedere
   conferma ogni volta.

Un branch nato così è già pulito: nessuna storia vecchia da cui ripartire,
quindi il falso positivo di merge conflict da squash-merge (sezione sopra)
dovrebbe restare raro — capita solo se `main` si muove *durante* il
lavoro su quel branch, non più per accumulo tra una PR e la successiva.

## Se il check "syntax" non parte su un push

Il trigger `pull_request`/`push` di `check-js.yml` a volte non si attiva
su un push (causa non chiarita, capitato più volte in questa sessione).
Dato che `syntax` è un required status check su `main`, non aspettare a
scoprirlo dopo minuti di polling: appena fatto un push sul branch di
lavoro, lancia subito anche `actions_run_trigger` (`method:
run_workflow`, `workflow_id: check-js.yml`, `ref: <branch>`) —
`workflow_dispatch` è configurato apposta come rete di sicurezza. Se la
run `pull_request` risulta già partita da sola, quella manuale è
ridondante ma innocua (nessun conflitto, nessun costo per repo pubblici).

## La timeline è chiusa

`projects/evolution/index.html` racconta i salti creativi del sito, non il
suo changelog, e si ferma al punto in cui ogni progetto ha ottenuto la sua
pagina. Da lì in poi:

- **Le modifiche al sito non aggiungono più ere.** Nessun fix, nessuna
  rifinitura, nessun giro di manutenzione va aggiunto alla timeline: quella
  storia sta già nei commit e nelle PR, che la pagina stessa linka in
  chiusura.
- **Quello che evolve si documenta nella pagina del progetto**
  (`projects/cerebro/`, `projects/dot-world/`, `projects/triple-triad/`),
  nelle sezioni "In breve" / "Come funziona" / "Scelte e vincoli".
- Si torna a toccare la timeline solo se succede un vero salto creativo —
  cioè se cambia la natura di quello che il sito è, non se una cosa viene
  sistemata — e comunque solo su richiesta esplicita dell'utente.

## Checklist SEO per una nuova pagina progetto

L'obiettivo dichiarato dall'utente è comparire su Google per il proprio
nome e per la portata dei progetti documentati. Ogni volta che si
aggiunge una nuova pagina in `projects/<nome>/index.html`, copiare la
struttura `<head>` di una pagina esistente (es. `projects/cerebro/`) e
verificare che porti con sé, aggiornati per il nuovo progetto:

- `<title>` nel formato `ottobit — <Nome progetto>`.
- `<meta name="description">` + gli equivalenti `og:description` e
  `twitter:description` — stesso testo, una frase che descriva cosa fa
  il progetto, non solo il nome.
- `og:url` **e** `<link rel="canonical">` con lo stesso URL assoluto
  della pagina (`https://ottobit.github.io/portfolio/projects/<nome>/`).
- Il blocco JSON-LD (`<script type="application/ld+json">`) — `@type`
  `"SoftwareSourceCode"` per un progetto software, `"CreativeWork"` per
  una pagina più narrativa/documentale (come `evolution/`); sempre con
  `author` che referenzia la Persona (`Giuseppe Quartarone` / `ottobit`,
  stesso pattern delle pagine esistenti).
- Una nuova voce in `sitemap.xml`, con `<lastmod>` alla data reale della
  modifica (non lasciarla mai indietro rispetto all'ultima modifica vera
  della pagina).

Bump delle versioni di cache-busting (`styles.css?v=`, `site.js?v=`)
quando si toccano file condivisi, come da convenzione già in uso nel
resto del sito.
