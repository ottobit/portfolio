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
