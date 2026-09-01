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
