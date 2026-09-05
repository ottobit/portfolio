# Istruzioni per Claude

## Pull request: piano per le cose difficili, push per quelle facili, merge MAI di iniziativa

Regola permanente, esplicitamente ribadita dall'utente — non va mai
dimenticata:

- Per le modifiche difficili/ambigue (scelta di design, architettura,
  qualcosa da chiarire): passa prima da un piano (Plan mode) e fatti
  approvare l'approccio prima di implementare.
- Per le modifiche facili/dirette: implementa, verifica (Playwright quando è
  UI, `node --check` sui file JS coinvolti, nessun errore console), poi
  commit + push sul branch designato senza bisogno di chiedere il permesso
  ogni volta.
- In entrambi i casi, apri (o aggiorna) la PR **in draft**.
- La PR resta in draft. Non marcarla mai pronta per la review, non mergiarla
  mai di tua iniziativa — quella decisione è ESCLUSIVAMENTE dell'utente,
  qualunque sia lo stato della verifica. Aspetta che sia l'utente a dire
  esplicitamente di procedere con merge/ready-for-review.
- Disiscriviti dalla PR solo dopo che è stata mergiata o chiusa (dall'utente).
- **Eccezione esplicita**: quando l'utente usa la frase "commit push PR" (o
  equivalenti tipo "vai con commit e push e PR") oppure la parola d'ordine
  **"Concludi!"**, questo significa ANCHE chiudere/mergiare la PR — non solo
  aprirla in draft. È il segnale che il lavoro è finito: marcarla pronta per
  la review e mergiarla, poi seguire comunque la procedura di conferma del
  deploy qui sotto.
- **Eccezione per i piani**: quando il lavoro è passato da Plan mode e
  l'utente ha approvato il piano (via ExitPlanMode), quell'approvazione vale
  anche come via libera al merge — l'approvazione del piano è già la
  conclusione. Niente bisogno di un "Concludi" separato dopo: implementa,
  verifica, commit + push, apri la PR e mergiala direttamente, poi segui la
  procedura di conferma del deploy qui sotto. Questa eccezione vale solo per
  il lavoro nato da un piano approvato — le modifiche facili dirette restano
  comunque in draft finché l'utente non dice "Concludi"/"commit push PR".

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

## La timeline è chiusa

`evolution.html` racconta i salti creativi del sito, non il suo changelog,
e si ferma al punto in cui ogni progetto ha ottenuto la sua pagina. Da lì
in poi:

- **Le modifiche al sito non aggiungono più ere.** Nessun fix, nessuna
  rifinitura, nessun giro di manutenzione va aggiunto alla timeline: quella
  storia sta già nei commit e nelle PR, che la pagina stessa linka in
  chiusura.
- **Quello che evolve si documenta nella pagina del progetto**
  (`cerebro.html`, `dot-world.html`, `triple-triad.html`), nelle sezioni
  "In breve" / "Come funziona" / "Scelte e vincoli".
- Si torna a toccare la timeline solo se succede un vero salto creativo —
  cioè se cambia la natura di quello che il sito è, non se una cosa viene
  sistemata — e comunque solo su richiesta esplicita dell'utente.
