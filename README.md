# Adamante Photo Studio

## Soluzione consigliata: app macOS con ChatGPT personale

È disponibile una prima app per Mac nel percorso [macos/](macos/README.md). L'app prepara la fotografia originale, le quattro reference Adamante e un prompt coordinato; apre ChatGPT del collaboratore e copia/inserisce il prompt, quando i permessi lo consentono.

**Nessun costo API:** ogni collega invia il messaggio nel proprio ChatGPT Plus/Pro. **L'inserimento automatico degli allegati non è supportato ufficialmente:** le cinque immagini vanno trascinate dalla cartella preparata nella nuova chat. L'app non invia messaggi senza l'intervento dell'utente.

**Download:** nella sezione [Actions — Build Mac App](../../actions/workflows/build-macos.yml) seleziona l'ultima esecuzione riuscita e scarica l'artifact `Adamante-Photo-Studio-macOS`. Per installazione e limiti, leggi [macos/README.md](macos/README.md).

---

## Prototipo web con API OpenAI (separato dalla soluzione macOS)

Il codice Next.js sotto `app/` è il precedente prototipo web che genera immagini tramite API OpenAI **a consumo**. Non utilizza gli abbonamenti ChatGPT Plus/Pro ed è mantenuto nella repository come alternativa tecnica; non pubblicarlo senza configurazione del server.

---

# ADAMANTE · Photo Studio

Studio fotografico AI dedicato al catalogo e-commerce Adamante.

## Cosa fa
- Carica una fotografia di un gioiello e specifica categoria, nome e dettagli vincolanti.
- Utilizza quattro fotografie di riferimento, una per ciascuno scatto: prodotto a tre quarti, vista frontale, indossato e scrigno bordeaux.
- Genera quattro immagini **separate**, quadrate 1024×1024 su sfondo bianco tramite OpenAI Images Edits API.
- Rigenera un solo scatto, scarica PNG singoli oppure un ZIP completo.
- Conserva reference e sessioni nello **storage IndexedDB del browser**. La prima volta carica nell'app le quattro reference condivise in chat. Le reference non vengono incluse nel repository.
- Protegge le chiamate API con password, cookie firmato e segreti lato server.

## Requisiti
Node.js 20.9+ e account OpenAI API con credito. L'abbonamento ChatGPT non comprende il consumo API.

## Installazione
1. Installa le dipendenze: `npm install`
2. Copia `.env.example` in `.env.local`
3. Imposta `OPENAI_API_KEY`, `STUDIO_PASSWORD` e `SESSION_SECRET` (stringa casuale lunga almeno 32 caratteri).
4. Avvia: `npm run dev`
5. Apri `http://localhost:3000` e inserisci la password.
6. Vai su **Reference** e carica le 4 fotografie nelle rispettive schede.
7. Torna in **Studio**, carica un gioiello e avvia la generazione.

## Pubblicazione su Vercel
Importa il repository e imposta le tre variabili d'ambiente sotto **Settings → Environment Variables**. Evita assolutamente di pubblicare la chiave OpenAI nel client o nel repository. La funzione di generazione richiede esecuzioni potenzialmente lunghe: assicurati che la durata massima sia supportata dal tuo piano Vercel.

## Note importanti
- Le immagini e lo storico rimangono nel browser utilizzato; non sono sincronizzati tra dispositivi. Per sincronizzarli serve un backend storage (es. Supabase).
- OpenAI riceve foto prodotto e reference solo per effettuare la generazione.
- Non è garantita la precisione assoluta dei dettagli, in particolare conteggio gemme, incastonature, incisioni e proporzioni. **Verifica le immagini prima di pubblicarle**.
- I quattro scatti sono richieste distinte: il consumo API aumenta per ogni immagine generata o rigenerata.
- Le immagini potrebbero non apparire perfettamente identiche ai riferimenti: lo stile è guidato dalle reference e dalle regole fotografiche, non rigidamente deterministico.
- Usa immagini di cui possiedi i diritti.

## Tecnologia
Next.js App Router + React + TypeScript + CSS, OpenAI Images Edit API, IndexedDB e JSZip.
