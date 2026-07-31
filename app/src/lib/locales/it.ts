// Italian translations. Keys are the exact English source strings used in
// `t("…")` calls; any key missing here simply renders in English (safe
// fallback). `{name}` placeholders must be preserved verbatim.
export const it: Record<string, string> = {
  // --- Navigation (navItems / SideNav) ---
  Today: "Oggi",
  Week: "Settimana",
  Add: "Aggiungi",
  Training: "Allenamento",
  More: "Altro",
  "Local-first · offline": "Locale · offline",
  "CREA nutrition data": "Dati nutrizionali CREA",

  // --- Macros (Today) ---
  Protein: "Proteine",
  Carbs: "Carboidrati",
  Fat: "Grassi",
  Fiber: "Fibre",

  // --- Meal slots ---
  Breakfast: "Colazione",
  Lunch: "Pranzo",
  Dinner: "Cena",
  Snacks: "Spuntini",
  Other: "Altro",

  // --- Today ---
  "of {n} kcal": "su {n} kcal",
  "{n} over": "{n} in eccesso",
  "{n} left": "{n} restanti",
  "💧 Water": "💧 Acqua",
  "{n} / {goal} glasses": "{n} / {goal} bicchieri",
  "Set {n} glasses": "Imposta {n} bicchieri",
  "＋ Glass": "＋ Bicchiere",
  "Remove a glass": "Rimuovi un bicchiere",
  Logged: "Registrato",
  "Loading…": "Caricamento…",
  "{n} item": "{n} elemento",
  "{n} items": "{n} elementi",
  empty: "vuoto",
  "Add to {label}": "Aggiungi a {label}",
  "Add {label}…": "Aggiungi {label}…",
  "Edit {name}": "Modifica {name}",
  "Remove {name}": "Rimuovi {name}",
  meal: "pasto",

  // --- Week ---
  Month: "Mese",
  "3 Months": "3 Mesi",
  Custom: "Personalizzato",
  "This week": "Questa settimana",
  "Last week": "Settimana scorsa",
  "Next week": "Prossima settimana",
  "{n} weeks ago": "{n} settimane fa",
  "In {n} weeks": "Tra {n} settimane",
  "{n} days": "{n} giorni",
  "Previous range": "Intervallo precedente",
  "Next range": "Intervallo successivo",
  "Back to this week": "Torna a questa settimana",

  // --- More hub ---
  Body: "Corpo",
  Goals: "Obiettivi",
  Meals: "Pasti",
  "Day planner": "Pianificatore giornaliero",
  History: "Cronologia",
  Settings: "Impostazioni",
  "Weight trend, progress photos & intake": "Andamento del peso, foto dei progressi e apporto",
  "Daily calories, macros & water — and the TDEE calculator":
    "Calorie, macro e acqua giornaliere — e il calcolatore TDEE",
  "Your saved meals to log in one tap": "I tuoi pasti salvati da registrare con un tocco",
  "Coming soon": "In arrivo",
  "Browse past days": "Sfoglia i giorni passati",
  "Sync across devices, water reminders, backup & restore":
    "Sincronizzazione tra dispositivi, promemoria acqua, backup e ripristino",

  // --- Settings ---
  Language: "Lingua",
  "Changes the app's language. Your food names and notes stay as you wrote them.":
    "Cambia la lingua dell'app. I nomi dei tuoi alimenti e le note restano come li hai scritti.",
  "💧 Water reminders": "💧 Promemoria acqua",
  "on ✓": "attivo ✓",
  "This device doesn't support notifications. On iPhone, add Pasto to your Home Screen (Share → Add to Home Screen) and open it from there.":
    "Questo dispositivo non supporta le notifiche. Su iPhone, aggiungi Pasto alla schermata Home (Condividi → Aggiungi a Home) e aprilo da lì.",
  "Sign in above first — reminders need an account so they can be sent across the day.":
    "Accedi prima qui sopra — i promemoria richiedono un account per essere inviati durante la giornata.",
  "Get a gentle nudge a few times a day when you're behind on water. Tap the notification to open the app and log a glass.":
    "Ricevi un promemoria gentile qualche volta al giorno quando sei indietro con l'acqua. Tocca la notifica per aprire l'app e registrare un bicchiere.",
  "Turn off reminders": "Disattiva i promemoria",
  "Turn on reminders": "Attiva i promemoria",
  "🧱 Big 3 reminders": "🧱 Promemoria Big 3",
  "Every 2h from 10:00 to 22:00 until today's Big 3 is logged.":
    "Ogni 2 ore dalle 10:00 alle 22:00 finché i Big 3 di oggi non sono registrati.",
  "🔔 Reminders": "🔔 Promemoria",
  "A nudge a few times a day when you're behind on water.":
    "Qualche promemoria al giorno quando sei indietro con l'acqua.",
  "Couldn't change reminders.": "Impossibile modificare i promemoria.",
  "Sync across devices": "Sincronizza tra dispositivi",
  "Signed in as": "Accesso effettuato come",
  "Your log, meals, custom foods and goals sync automatically to every device where you sign in.":
    "Il tuo diario, i pasti, gli alimenti personalizzati e gli obiettivi si sincronizzano automaticamente su ogni dispositivo dove accedi.",
  "Sign out": "Esci",
  "Sign in on your Mac and your phone with the same account to keep everything in sync. Your current data uploads on first sign-in — nothing is lost.":
    "Accedi sul Mac e sul telefono con lo stesso account per mantenere tutto sincronizzato. I tuoi dati attuali vengono caricati al primo accesso — non si perde nulla.",
  Email: "Email",
  "Password (min 6 characters)": "Password (min 6 caratteri)",
  "Sign in": "Accedi",
  "Create account": "Crea account",
  "Forgot password?": "Password dimenticata?",
  "Enter your email above first, then tap “Forgot password”.":
    "Inserisci prima la tua email qui sopra, poi tocca “Password dimenticata”.",
  "Password-reset link sent to {email}. Check your inbox (and spam).":
    "Link per reimpostare la password inviato a {email}. Controlla la casella di posta (e lo spam).",
  "Wrong email or password.": "Email o password errata.",
  "That email already has an account — use Sign in.":
    "Questa email ha già un account — usa Accedi.",
  "Password must be at least 6 characters.": "La password deve avere almeno 6 caratteri.",
  "That doesn't look like a valid email.": "Questa non sembra un'email valida.",
  "No account found for that email.": "Nessun account trovato per questa email.",
  "Too many attempts — wait a bit and try again.": "Troppi tentativi — aspetta un po' e riprova.",
  "Network error — check your connection.": "Errore di rete — controlla la connessione.",
  "Couldn't complete that. Please try again.": "Impossibile completare l'operazione. Riprova.",
  "Backup & restore": "Backup e ripristino",
  "storage:": "archiviazione:",
  "persistent ✓": "persistente ✓",
  "best-effort": "non garantita",
  "Your data lives only in this browser. Export a backup file to keep it safe or move it to another browser or device.":
    "I tuoi dati esistono solo in questo browser. Esporta un file di backup per tenerli al sicuro o spostarli su un altro browser o dispositivo.",
  "Export backup": "Esporta backup",
  "Restore…": "Ripristina…",
  "Backed up {entries} log entries, {meals} meals, {foods} custom foods.":
    "Salvati {entries} elementi del diario, {meals} pasti, {foods} alimenti personalizzati.",
  "Couldn't read that file — is it a Pasto backup?":
    "Impossibile leggere il file — è un backup di Pasto?",

  // --- Training ---
  Progress: "Progressi",
  Exercises: "Esercizi",
  Strength: "Forza",
  Conditioning: "Condizionamento",
  "Finish a Norwegian 4×4 or McGill Big Three session and it shows up here.":
    "Completa una sessione Norwegian 4×4 o McGill Big Three e comparirà qui.",
  "Workout in progress": "Allenamento in corso",
  "{name} — tap to resume": "{name} — tocca per riprendere",
  "Past blocks": "Blocchi passati",
  "Conditioning & core": "Condizionamento e core",
  "HIIT interval timer": "Timer a intervalli HIIT",
  "Spine-safe core timer": "Timer core sicuro per la schiena",
  "Recent conditioning": "Condizionamento recente",
  "Show less": "Mostra meno",
  "Show all {n}": "Mostra tutti ({n})",
  "Generate a plan": "Genera un piano",
  "Tailored to your goals & schedule — science-based":
    "Su misura per i tuoi obiettivi e i tuoi tempi — basato sulla scienza",
  "Your routines": "Le tue routine",
  "＋ New": "＋ Nuova",
  "No routines yet.": "Ancora nessuna routine.",
  "Create your first split day →": "Crea il tuo primo giorno di allenamento →",
  "Past workouts · tap to edit": "Allenamenti passati · tocca per modificare",
  "🗑 Recently deleted": "🗑 Eliminati di recente",
  partial: "parziale",
  "{n} min": "{n} min",
  "Delete this session?": "Eliminare questa sessione?",
  "Delete {name}": "Elimina {name}",
  "Training block": "Blocco di allenamento",
  "End this training block?": "Terminare questo blocco di allenamento?",
  End: "Termina",
  "Deload · week {n} of {total}": "Scarico · settimana {n} di {total}",
  "Week {n} of {total}": "Settimana {n} di {total}",
  "recover — volume halved, load eased": "recupero — volume dimezzato, carico ridotto",
  "volume ramping toward your peak week": "volume in aumento verso la settimana di picco",
  "Start a training block": "Inizia un blocco di allenamento",
  "Auto-ramp weekly volume, then deload — RP-style":
    "Aumenta il volume settimanale, poi scarico — stile RP",
  Block: "Blocco",
  "{n} weeks": "{n} settimane",
  "ended early": "terminato in anticipo",
  View: "Vedi",
  "Delete block": "Elimina blocco",
  "Delete this block? Your logged workouts are kept — only the plan is removed.":
    "Eliminare questo blocco? I tuoi allenamenti registrati vengono mantenuti — viene rimosso solo il piano.",
  Workout: "Allenamento",
  "{n} sets": "{n} serie",
  Restore: "Ripristina",
  "Permanently delete this workout? This cannot be undone.":
    "Eliminare definitivamente questo allenamento? L'operazione non può essere annullata.",
  "Delete permanently": "Elimina definitivamente",
  "{n} exercise": "{n} esercizio",
  "{n} exercises": "{n} esercizi",
  Start: "Inizia",
  "{n} kg vol": "{n} kg vol",
  "Delete {name} from {date}": "Elimina {name} del {date}",
  workout: "allenamento",
};
