# Adamante Photo Studio per macOS

Utility SwiftUI per preparare le immagini e il prompt di una chat ChatGPT usando **l'abbonamento personale dell'utente**, non le API OpenAI.

## Flusso
1. Avvia l'app sul Mac e configura **una volta** quattro reference (tre quarti, frontale, indossato, packaging).
2. Seleziona una foto prodotto, indica categoria e dettagli importanti.
3. Premi **Prepara su ChatGPT**.
4. L'app genera una cartella in `Documenti/Adamante Photo Studio/Lavorazioni` con la foto originale, le quattro reference (tutte PNG) e un prompt testuale.
5. Copia il prompt negli appunti, evidenzia le cinque immagini in Finder e apre ChatGPT.
6. Con il permesso Accessibilità e l'automazione attivata, **prova** a creare una nuova chat, incollare separatamente le cinque immagini negli appunti e **solo dopo** il prompt.
7. **Prima di premere Invio, verifica che nella chat siano visibili cinque anteprime allegate** (originale + 4 reference). La procedura non può verificarlo automaticamente; se mancano, trascina le cinque immagini da Finder nella chat, poi incolla il prompt con ⌘V e invia.

L'app **non** invia messaggi automaticamente, non legge la cronologia, non richiede credenziali e non usa API a pagamento. L'incolla automatico delle immagini è sperimentale e **non garantisce** che ChatGPT le riconosca come allegati. Il tentativo può smettere di funzionare quando ChatGPT cambia interfaccia o scorciatoie.

## Installazione per i colleghi
- GitHub Actions: workflow `Build Mac App`; scarica l'artifact `Adamante-Photo-Studio-macOS` e decomprimilo.
- Sposta **Adamante Photo Studio.app** nella cartella Applicazioni.
- Poiché l'app è firmata ad hoc e **non notarizzata**, macOS può bloccarla. Se ti fidi della provenienza del file, gestisci il blocco da **Impostazioni di Sistema > Privacy e sicurezza > Apri comunque**.
- Scarica e accedi a ChatGPT per macOS. In assenza dell'app il pulsante apre `https://chatgpt.com`.
- Per tentare il preinserimento del prompt, concedi all'app **Accessibilità** nelle impostazioni macOS. La funzione è opzionale.
- Carica una sola volta le quattro reference in ogni Mac, perché vengono salvate in locale.

## Compilare manualmente
Serve un Mac con Xcode command line tools / Swift SDK e macOS 14+.

```bash
bash macos/build-app.sh
```

Trovi il pacchetto in `macos/dist/Adamante Photo Studio.app`.

## Limitazioni
- Non esiste un'interfaccia ufficiale di ChatGPT per allegare automaticamente immagini da applicazioni esterne a una nuova chat. La nuova versione TENTA cinque incolla immagine via clipboard, ma non può accertarne il successo.
- Non possiamo garantire che la generazione di quattro foto sia eseguita in un solo turno; il prompt specifica di proseguire in più turni se necessario.
- Il numero e la fedeltà dei dettagli di pietre e montature vanno controllati dopo ogni generazione.
- L'app non estrae le immagini generate né le salva in automatico: i risultati vanno scaricati dalla chat.
- Se è necessaria l'automazione integrale, bisogna utilizzare un'API a consumo separata da ChatGPT Plus/Pro.

## Sicurezza
Nessuna chiave API, account, password o riferimento viene inviato a server dell'app. Le immagini rimangono sul Mac fino a quando l'utente decide di inviarle a ChatGPT.
