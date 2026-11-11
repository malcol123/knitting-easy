# Knitting Easy

**Knitting Easy** è una web app installabile (PWA) per contare i giri dei lavori a maglia con i ferri, con uno schema che si colora man mano. Funziona su smartphone e computer, anche senza connessione. Non servono account né server: i dati restano sul dispositivo.

Il progetto è fatto solo di file statici (HTML, CSS e JavaScript): non ha dipendenze e non richiede compilazione.

---

## 1. Avviare l'app sul computer (facoltativo)

Serve un piccolo server web locale. Il service worker, che permette l'uso offline, non funziona aprendo `index.html` con un doppio clic.

```bash
cd knitting-easy
python3 -m http.server 8080
```

Poi apri **http://localhost:8080** nel browser.

## 2. Pubblicare l'app su GitHub e installarla sul telefono

Per essere installata sul telefono, l'app deve stare su un indirizzo **https**. GitHub Pages lo offre gratis, per i repository pubblici. Bastano il browser e il computer: non serve installare nulla.

### A. Crea l'account
1. Vai su <https://github.com/signup> e crea un account gratuito. Conferma l'email.
2. Il tuo **nome utente** farà parte dell'indirizzo dell'app: `https://NOMEUTENTE.github.io/knitting-easy/`.

### B. Crea il repository
1. In alto a destra su github.com premi **+** → **New repository**.
2. **Repository name**: `knitting-easy`.
3. Scegli **Public**. Con l'account gratuito GitHub Pages funziona solo con i repository pubblici. Chi ha il link può vedere il codice dell'app, **non** i tuoi progetti, che restano sul telefono.
4. Lascia tutto il resto com'è e premi **Create repository**.

### C. Carica i file
1. Sul computer scompatta `knitting-easy.zip`: ottieni la cartella `knitting-easy`.
2. Nella pagina del repository appena creato premi il link **uploading an existing file**. In alternativa: **Add file** → **Upload files**.
3. Apri la cartella `knitting-easy` e **seleziona tutto il suo contenuto**: `index.html`, `sw.js`, `manifest.webmanifest`, `README.md`, `package.json` e le cartelle `css`, `js`, `icons`, `tests`. Trascinalo nella pagina di GitHub.
   - Trascina il **contenuto**, non la cartella stessa: `index.html` deve trovarsi nella cartella principale del repository.
   - Per trascinare le cartelle usa Chrome, Edge o Firefox. Se il tuo browser non le accetta, carica prima i file sciolti, poi ripeti **Add file → Upload files** per ogni cartella.
4. Attendi che l'elenco dei file sia completo e premi **Commit changes**.
5. Controlla: nella pagina principale del repository devi vedere `index.html` e le cartelle `css`, `icons`, `js`.

### D. Attiva GitHub Pages
1. Nel repository apri **Settings**, la scheda con l'ingranaggio.
2. Nella colonna di sinistra, sezione *Code and automation*, premi **Pages**.
3. In *Build and deployment* → *Source* scegli **Deploy from a branch**.
4. In *Branch* scegli **main** e la cartella **/ (root)**, poi premi **Save**.
5. Attendi 1–3 minuti e ricarica la pagina: in alto compare «Your site is live at `https://NOMEUTENTE.github.io/knitting-easy/`». Lo stato della pubblicazione si vede anche nella scheda **Actions**.
6. Apri l'indirizzo sul computer per verificare che l'app funzioni.

### E. Installa l'app sul telefono
Apri `https://NOMEUTENTE.github.io/knitting-easy/` sul telefono. Puoi inviarti il link via email o messaggio.

- **Android (Chrome)**: menu **⋮** → **Installa app**. Su alcuni telefoni la voce si chiama **Aggiungi a schermata Home** → **Installa**.
- **iPhone/iPad**: apri il link con **Safari** → pulsante **Condividi** (quadrato con freccia) → **Aggiungi alla schermata Home** → **Aggiungi**.

L'icona **Knitting Easy** compare tra le app. Aprila una volta con la connessione attiva: da quel momento funziona anche offline.

### F. Pubblicare un aggiornamento
1. Modifica i file e, in `sw.js`, aumenta `VERSION`: per esempio da `v1.1.0` a `v1.1.1`.
2. Su GitHub: **Add file → Upload files**, trascina i file modificati (stessi nomi e stesse cartelle) e premi **Commit changes**. I file con lo stesso nome vengono sostituiti.
3. Dopo un paio di minuti, aprendo l'app compare «È disponibile una nuova versione» → **Aggiorna**. I tuoi progetti non vengono toccati.

### Problemi frequenti
- **Pagina 404**: aspetta qualche minuto. Poi controlla che `index.html` sia nella cartella principale del repository e non dentro una sottocartella `knitting-easy/`.
- **Non compare «Installa app»**: l'indirizzo deve iniziare con `https://`. Ricarica la pagina una volta; su iPhone usa Safari.
- **Mancano i progetti fatti sul computer**: ogni indirizzo e ogni dispositivo ha un archivio separato. Esporta un backup dove si trovano e importalo sul telefono.

## 3. Come si usa

### Progetti
La schermata iniziale mostra i progetti in corso. Per ognuno trovi una piccola anteprima, l'avanzamento, il colore attuale e il pulsante **Riprendi**. Dal menu ⋯ puoi **modificare**, **duplicare**, **archiviare**, **esportare** o **eliminare** un progetto. L'eliminazione chiede sempre conferma. Al primo avvio trovi un progetto di esempio: la sciarpa a righe nere e verdine.

### Contagiri
- **+** (pulsante grande): hai finito un giro.
- **−**: **tienilo premuto** finché l'anello si completa (circa 0,7 secondi). Se lo lasci prima, il conteggio non cambia. Ogni pressione toglie un solo giro, senza ripetizioni automatiche.
- Il **numero grande** indica i giri completati nel blocco del colore attuale. Sotto trovi «Totale colore: 10/30 giri» e «Totale progetto: 40/900 giri».
- Quando completi l'ultimo giro di un blocco, l'app passa da sola al colore successivo e mostra «Cambia colore: ora passa a …». Il numero grande riparte da 0.
- Se togli un giro mentre il nuovo blocco è a 0, l'app torna al blocco precedente: per esempio da 0/30 verdini a 29/30 neri.
- **Annulla ultima modifica** ripristina il valore precedente.
- A fine lavoro compare «Progetto completato» e il conteggio non può superare il totale. Puoi comunque correggerlo con −.
- ☀ in alto mantiene lo **schermo acceso**, dove il browser lo supporta.
- Dal computer: `Spazio`, `+` o `↑` aggiungono un giro; tieni premuto `−` o `↓` per toglierlo; `Ctrl+Z` annulla.

### Schema
L'anteprima in basso mostra la zona attuale e, a destra, l'intero progetto con un marcatore sul punto raggiunto. Toccala per aprire lo **schema completo**, dove puoi:
- scorrere il lavoro e ingrandirlo o ridurlo con i pulsanti, con due dita sul telefono o con `Ctrl` + rotellina sul computer;
- toccare la panoramica a sinistra per saltare a un punto del progetto.

Ogni riga rappresenta un giro e il giro 1 è in basso. I giri fatti hanno il colore pieno, quelli da fare una versione chiara dello stesso colore. Il simbolo **V** indica il dritto, **∩** il rovescio. Il prossimo giro è contornato e indicato con ▶ e con il suo numero. Lo schema è indicativo: non è una simulazione realistica del tessuto.

### Creare un progetto e impostare le sequenze
Nell'editor imposti nome, maglie per ferro, giri totali, lavorazione, colori, sequenza dei blocchi, dati del filato e dei ferri, e note.

Le lavorazioni disponibili sono:
- tutti i giri a dritto;
- tutti i giri a rovescio;
- un giro tutto a dritto e uno tutto a rovescio. Qui si alternano **giri interi**, non le singole maglie; puoi scegliere se il giro 1 è a dritto o a rovescio. L'alternanza segue la posizione nel progetto e non riparte al cambio colore.

La sequenza ha tre parti:
- **Giri iniziali**, facoltativi, lavorati una volta sola.
- **Sequenza da ripetere**, ripetuta fino a raggiungere il totale.
- **Giri finali**, facoltativi.

Per ogni blocco scegli colore, numero di giri e lavorazione. L'opzione *Come il progetto* eredita la lavorazione generale. Due blocchi consecutivi dello stesso colore contano come un unico blocco colore.

L'**anteprima del risultato** mostra la composizione esatta, per esempio «1 ripetizione completa da 60 giri + 1 ripetizione parziale di 40 giri = 100 giri». Se un blocco resta parziale, l'avviso lo dice chiaramente e propone totali che chiudono con una ripetizione completa. Se la sequenza non basta a coprire il totale, il salvataggio è bloccato finché non correggi.

Esempi:
- **Sciarpa normale**: modello *Tinta unita*, 50 maglie, 900 giri, *Tutti i giri a dritto*.
- **Sciarpa sottile**: modello *A righe*, 30 maglie, 900 giri, alternato con il primo giro a dritto, 30 giri neri e 30 verdini da ripetere.

### Modificare un progetto già iniziato
I giri completati vengono conservati. Se il nuovo totale è inferiore ai giri già fatti, l'app chiede conferma prima di ridurre l'avanzamento. Anche **Azzera avanzamento** chiede conferma.

### Note e promemoria
Dal menu ⋯ del contagiri apri **Note e promemoria**. Lì scrivi appunti liberi, salvati in automatico, e aggiungi promemoria legati a un giro, per esempio «Al giro 60 cambia ferri». Il promemoria compare quando quel giro sta per iniziare, con un'anticipazione qualche giro prima.

### Impostazioni
Tema chiaro, scuro o automatico; vibrazione, dove supportata (non su iPhone); schermo sempre acceso; pulsante + a destra o a sinistra; backup.

## 4. Salvataggio e backup

- **Ogni tocco viene salvato subito** nella memoria del browser (`localStorage`). Chiudendo e riaprendo l'app ritrovi tutti i progetti e il punto esatto.
- **I dati restano solo su questo dispositivo e in questo browser.** Non vengono inviati a nessun server. Se cancelli i dati del sito o del browser, disinstalli l'app o cambi telefono, i progetti non ti seguono.
- Il **backup** è un file `.json` con tutti i progetti e il loro avanzamento. Serve per **trasferire** i dati su un altro dispositivo o per **recuperarli**. Si esporta da *Impostazioni → Esporta backup*; sul telefono puoi anche condividerlo, per esempio via email o su Drive.
- Per l'importazione, da *Impostazioni → Importa backup*, puoi scegliere:
  - **Aggiungi ai miei progetti**: non cancella nulla. Se trova un progetto identico lo salta; se trova una versione diversa dello stesso progetto la aggiunge come copia «(importato)».
  - **Sostituisci tutto**: sostituisce i progetti del dispositivo con quelli del backup, dopo una conferma.
- Se non esporti un backup da più di 30 giorni, la schermata iniziale te lo ricorda.

## 5. Struttura del codice

```
index.html              guscio dell'app
manifest.webmanifest    dati per l'installazione (nome, icone, colori)
sw.js                   service worker: cache dei file per l'uso offline
css/styles.css          stile (tema chiaro e scuro)
js/model.js             logica pura: piano dei giri, stato del contagiri, alternanza,
                        sequenze, backup (nessun accesso al DOM)
js/store.js             salvataggio locale
js/schema.js            disegno dello schema su canvas (panoramica, zona attuale, vista con zoom)
js/ui.js                icone, finestre di dialogo, avvisi, vibrazione, schermo acceso
js/app.js               schermate e navigazione
icons/                  icone dell'app
tests/model.test.mjs    test della logica
```

Tutto l'avanzamento deriva da un solo numero per progetto, i **giri completati in totale**. Blocco attuale, numero grande, totali, istruzione del prossimo giro e schema si calcolano da quel numero e dal piano dei giri. Per questo restano sempre coerenti, anche dopo correzioni, annullamenti e modifiche della struttura.

### Test
```bash
node tests/model.test.mjs     # 17 test sulla logica (Node.js 18+)
```

### Pubblicare un aggiornamento
Dopo aver modificato i file, aumenta `VERSION` in `sw.js`, per esempio `v1.0.1`. Alla successiva apertura l'app mostra «È disponibile una nuova versione» con il pulsante **Aggiorna**. I dati salvati non vengono toccati.
