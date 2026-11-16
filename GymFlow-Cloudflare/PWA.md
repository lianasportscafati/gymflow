# GymFlow online installabile

GymFlow resta una web app con account e archivio Cloudflare D1. Non viene generato un APK: su Android aprire il sito in Chrome e scegliere **Installa GymFlow** oppure il menu ⋮ → Installa app / Aggiungi alla schermata Home. Su iPhone usare Condividi → Aggiungi alla schermata Home. Gli aggiornamenti arrivano dal sito.

## Importazione PDF

Il pulsante Importa PDF legge il documento sul dispositivo tramite PDF.js 5.4.624, distribuito dallo stesso sito. Il PDF originale non viene inviato al server. Anteprima di tutte le pagine e revisione dei campi per settimana. Dopo la conferma si inviano solo le prescrizioni della nuova scheda. L'importazione è atomica e usa un identificativo per non duplicare la scheda in caso di retry della stessa richiesta.

Riconoscimento dedicato alle tabelle con intestazioni Gruppo/Esercizio/Serie/Ripetizioni/REC/note/W1… e sezioni ALLENAMENTO A/B/C. I valori sono letti dalle coordinate del documento, non da un modello precompilato. Altri layout possono richiedere correzione o inserimento manuale. Scansioni senza testo: niente OCR. Limiti: 20 MB, 30 pagine, 500 prescrizioni salvabili per importazione.

Per il formato Accumulo: 6 settimane previste, sole W1–W4 compilate; W5–W6 rimangono vuote. I valori base degli accessori valgono solo nelle settimane con almeno una progressione presente. Gli addominali senza giorno/frequenza sono separati in “Da assegnare (senza settimana)” → “Non assegnato”: non sono attribuiti a W1 o ad A/B/C. Prima del salvataggio controllare tutte le sezioni; eventuali righe non riconosciute sono segnalate. La prima verifica automatica del parser usa una ricostruzione a coordinate della struttura del documento, non il file PDF binario originale.

## Carichi e storico

Calcolo dei kg con stringhe decimali e BigInt, senza arrotondamento automatico. Massimale condiviso per nome esercizio normalizzato (maiuscole/spazi). Panca Piana, Squat e Stacco da terra restano separati tra loro ma condividono il proprio massimale tra giorni e schede. Sinonimi diversi vanno uniformati manualmente.

Ogni esercizio mostra il carico da massimale e, separatamente, le serie realmente eseguite. Nessun dato previsto è registrato come eseguito. Aprire “Serie realmente eseguite” e salvare kg, ripetizioni/secondi e nota per ogni serie. Una registrazione per serie di esercizio: aggiornare la serie sostituisce quel valore; non vengono create sessioni multiple nello stesso giorno/settimana.

Lo storico automatico usa la settimana precedente nell'ordine della scheda, stesso nome giornata e stessa chiave esercizio. Non usa altre schede o settimane più lontane se quella precedente è vuota. Non rinominare retroattivamente giorni se si vuole mantenere l'abbinamento automatico. “Storico e backup” mostra anche le registrazioni di schede eliminate o cambiate: i log contengono i nomi e i riferimenti originali e non sono cancellati con le prescrizioni.

## Connessione e dati

La PWA richiede Internet per accedere alle schede e salvare. Non esistono salvataggi in coda offline o sincronizzazione. Il service worker conserva solo una pagina generica senza dati personali per mostrare un messaggio chiaro in assenza di connessione. Non memorizza pagine autenticate, API, allenamenti o PDF. Lo stato online/offline del browser è indicativo: ogni salvataggio attende la risposta del server e segnala gli errori.

“Esporta backup completo” scarica un JSON con schede, settimane, giornate, prescrizioni, massimali e serie eseguite dell'account corrente. È un'esportazione in chiaro; conservarla in un luogo sicuro. Il ripristino tramite interfaccia non è incluso in questa versione web.

## Sviluppo e controlli

`npm ci`, quindi `npm test` e `npm run lint`. `prebuild` e `predev` preparano PDF.js con `npm pack` dal registro ufficiale, versione fissata, senza installare/eseguire script di quel pacchetto; le risorse browser e la licenza sono copiate in `public/pdf-5.4.624`. Per una build riproducibile è necessaria la disponibilità di quel pacchetto nel registro.

La verifica GitHub Actions compila la PWA ed esegue test dei calcoli, parser, importazione transazionale, idempotenza, isolamento utenti, settimane vuote, massimali condivisi e registrazioni. Il workflow Cloudflare esistente pubblica solo su avvio manuale e conserva l'attuale configurazione di accesso. Le tabelle aggiuntive sono create senza cancellare quelle esistenti.
