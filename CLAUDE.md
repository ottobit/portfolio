# Istruzioni per Claude

## Pull request: fai tutto tu, fino alla fine

Quando lavori su una modifica in questo repo, non fermarti alla PR aperta in
draft. Il flusso completo, senza bisogno che venga richiesto ogni volta:

1. Implementa la modifica, verificala (Playwright quando è UI, `node --check`
   sui file JS coinvolti, nessun errore console).
2. Commit + push sul branch designato.
3. Apri la PR (in draft va bene come primo passo).
4. Se la modifica è verificata e non richiede una decisione dell'utente
   (scelta di design ambigua, cosa da chiarire, rischio concreto), segna la
   PR come pronta per la review e mergiala tu stesso — non aspettare che
   l'utente lo chieda esplicitamente ogni volta.
5. Disiscriviti dalla PR una volta mergiata.

In sintesi: apri, verifica, pronta per review, merge — è un flusso unico che
porti a termine tu, non tre richieste separate da parte dell'utente.

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
