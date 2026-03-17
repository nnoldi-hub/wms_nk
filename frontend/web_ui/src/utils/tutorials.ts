/**
 * tutorials.ts — Definiții complete pentru tutorialele WMS NK
 * Fiecare tutorial ghidează utilizatorul printr-un flux complet de lucru.
 */

export interface TutorialStep {
  id: string;
  title: string;
  content: string;
  /** Rută la care se navighează automat pentru acest pas */
  navigateTo?: string;
  /** Selector CSS pentru elementul evidențiat (opțional) */
  targetSelector?: string;
  /** Text buton acțiune opțional */
  actionLabel?: string;
  actionPath?: string;
  /** Sfat rapid */
  tip?: string;
}

export interface Tutorial {
  id: string;
  title: string;
  description: string;
  /** Emoji sau iconiță reprezentativă */
  emoji: string;
  category: 'setup' | 'operations' | 'scanning' | 'reports' | 'admin';
  estimatedMinutes: number;
  /** Rutele pe care apare ca "recomandat" */
  relevantPaths?: string[];
  steps: TutorialStep[];
}

// ─────────────────────────────────────────────────────────────────────────────
// TUTORIAL 1: Primii pași (Onboarding general)
// ─────────────────────────────────────────────────────────────────────────────
const tutorialPrimiPasi: Tutorial = {
  id: 'primi-pasi',
  title: 'Primii pași în WMS NK',
  description: 'Tour general al sistemului — unde se află fiecare funcționalitate și cum navigați.',
  emoji: '🚀',
  category: 'setup',
  estimatedMinutes: 5,
  relevantPaths: ['/dashboard'],
  steps: [
    {
      id: 'intro',
      title: 'Bine ați venit în WMS NK!',
      content:
        'WMS NK este un sistem complet de management al depozitelor. Acest tutorial vă va prezenta principalele funcționalități în 5 minute. Puteți opri oricând și relua mai târziu.',
      navigateTo: '/dashboard',
      tip: 'Tutorialele sunt disponibile oricând din butonul "?" din bara de sus.',
    },
    {
      id: 'dashboard',
      title: 'Dashboard',
      content:
        'Pagina principală afișează starea depozitului în timp real: numărul de comenzi active, stocul critic, alertele și activitatea recentă. Este punctul de start al fiecărei zile.',
      navigateTo: '/dashboard',
      targetSelector: '[data-tutorial="dashboard-stats"]',
    },
    {
      id: 'meniu-admin',
      title: 'Grupul Admin',
      content:
        'În meniu, grupul "Admin" conține toate setările și configurările: depozit, utilizatori, reguli, import stoc. Doar administratorii și managerii au acces.',
      navigateTo: '/dashboard',
      tip: 'Apăsați pe titlul grupului din meniu pentru a-l extinde sau restrânge.',
    },
    {
      id: 'meniu-operatiuni',
      title: 'Grupul Operațiuni',
      content:
        'Operațiunile zilnice — recepție marfă, NIR, comenzi furnizor, picking, expedieri — se găsesc în grupul "Operațiuni". Operatorii au acces la cele mai multe din aceste secțiuni.',
      navigateTo: '/dashboard',
    },
    {
      id: 'meniu-rapoarte',
      title: 'Rapoarte & Analiză',
      content:
        'Grupul "Rapoarte & Analiză" oferă vizibilitate completă: mișcări de inventar, stoc & loturi, performanță picking, predicții de stoc.',
      navigateTo: '/dashboard',
    },
    {
      id: 'notificari',
      title: 'Notificări în timp real',
      content:
        'Clopoțelul din dreapta sus primește alerte instant prin WebSocket: stoc critic, comenzi noi, erori de sincronizare. Nu trebuie să reîmprospătați pagina.',
      navigateTo: '/dashboard',
      targetSelector: '[data-tutorial="notification-bell"]',
    },
    {
      id: 'final',
      title: 'Gata de lucru!',
      content:
        'Acum cunoașteți structura WMS NK. Continuați cu tutorialele specifice pentru fiecare flux: configurare depozit, recepție marfă, scanare, etc.',
      navigateTo: '/dashboard',
      actionLabel: 'Configurare depozit →',
      actionPath: '/warehouse-config',
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// TUTORIAL 2: Configurare depozit
// ─────────────────────────────────────────────────────────────────────────────
const tutorialConfigurareDepozit: Tutorial = {
  id: 'configurare-depozit',
  title: 'Configurare depozit',
  description: 'Cum se configurează structura fizică a depozitului: zone, rafturi, locații și reguli de alocare.',
  emoji: '🏭',
  category: 'setup',
  estimatedMinutes: 10,
  relevantPaths: ['/warehouse-config', '/wizard-configurare', '/validare-configuratie', '/validator-configurare'],
  steps: [
    {
      id: 'intro',
      title: 'Configurarea depozitului',
      content:
        'Înainte de a primi marfă sau de a procesa comenzi, trebuie să definiți structura depozitului: depozite, etaje, zone și locații individuale. Aceasta se face din secțiunea "Configurare Depozit".',
      navigateTo: '/warehouse-config',
    },
    {
      id: 'wizard',
      title: 'Wizard de configurare',
      content:
        'Cel mai simplu mod de a începe este prin Wizard-ul de configurare. Acesta vă ghidează pas cu pas: alegeți un template, definiți zonele și generați automat locațiile.',
      navigateTo: '/wizard-configurare',
      actionLabel: 'Deschide Wizard →',
      actionPath: '/wizard-configurare',
      tip: 'Template-urile preconfigurate (ex: "Depozit Standard 3 Zone") economisesc mult timp.',
    },
    {
      id: 'template',
      title: 'Alegerea unui template',
      content:
        'Din pagina "Template-uri Depozit" alegeți o structură predefinită care se potrivește depozitului dumneavoastră. Template-urile pot fi personalizate după aplicare.',
      navigateTo: '/template-depozit',
    },
    {
      id: 'zone',
      title: 'Zone și rafturi',
      content:
        'O zonă grupează locații cu caracteristici similare (ex: Zona A pentru produse grele, Zona B pentru produse mici). Fiecare zonă are o strategie de alocare implicită: FIFO, LIFO sau cea mai apropiată locație liberă.',
      navigateTo: '/warehouse-config',
      tip: 'FIFO (First In, First Out) este recomandat pentru produse cu termen de expirare.',
    },
    {
      id: 'locatii',
      title: 'Locații individuale',
      content:
        'Fiecare locație are un cod unic (ex: A-01-03), o capacitate maximă și poate fi restricționată pentru anumite tipuri de produse. Codurile QR ale locațiilor se pot tipări din "QR Coduri Locații".',
      navigateTo: '/warehouse-config',
      targetSelector: '[data-tutorial="locations-tab"]',
    },
    {
      id: 'qr-locatii',
      title: 'Generare coduri QR',
      content:
        'Din pagina "QR Coduri Locații" puteți genera și tipări etichete QR pentru toate locațiile. Acestea se lipesc pe rafturi și sunt scanate de operatori pentru a confirma locația corectă.',
      navigateTo: '/qr-locatii',
      actionLabel: 'Generare QR-uri →',
      actionPath: '/qr-locatii',
    },
    {
      id: 'validare',
      title: 'Validare configurație',
      content:
        'După ce ați configurat depozitul, rulați Validator-ul pentru a verifica că totul este corect: zone definite, locații active, capacități setate, reguli consistente.',
      navigateTo: '/validator-configurare',
      actionLabel: 'Validare configurație →',
      actionPath: '/validator-configurare',
      tip: 'Rezolvați toate erorile CRITICAL înainte de a porni operațiunile.',
    },
    {
      id: 'reguli',
      title: 'Reguli dinamice de alocare',
      content:
        'Regulile dinamice definesc unde se depozitează automat produsele: ex. "Cablurile cu diametru > 10mm merg în Zona B". Se configurează din "Reguli Dinamice" și pot fi testate cu Simulatorul.',
      navigateTo: '/reguli-dinamice',
    },
    {
      id: 'final',
      title: 'Depozitul este configurat!',
      content:
        'Acum puteți importa stocul inițial și puteți începe să recepționați marfă. Pasul următor este importul produselor.',
      navigateTo: '/wizard-configurare',
      actionLabel: 'Import stoc inițial →',
      actionPath: '/import-stoc',
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// TUTORIAL 3: Import stoc inițial
// ─────────────────────────────────────────────────────────────────────────────
const tutorialImportStoc: Tutorial = {
  id: 'import-stoc',
  title: 'Import stoc inițial (CSV)',
  description: 'Cum se importă stocul existent din fișiere CSV sau Excel în sistemul WMS.',
  emoji: '📊',
  category: 'admin',
  estimatedMinutes: 8,
  relevantPaths: ['/import-stoc', '/products'],
  steps: [
    {
      id: 'intro',
      title: 'Import stoc inițial',
      content:
        'Dacă aveți deja marfă în depozit când porniți WMS NK, trebuie să importați stocul existent. Aceasta se face o singură dată la implementare, din pagina "Import Stoc Inițial".',
      navigateTo: '/import-stoc',
    },
    {
      id: 'format-csv',
      title: 'Formatul fișierului CSV',
      content:
        'Fișierul CSV trebuie să conțină coloanele: SKU, Nume Produs, Cantitate, Locație, Lot (opțional). Descărcați template-ul exemplu din pagina de import pentru a vedea formatul exact.',
      navigateTo: '/import-stoc',
      targetSelector: '[data-tutorial="import-upload"]',
      tip: 'Dacă lucrați cu Excel, exportați ca "CSV UTF-8 (delimited by comma)" pentru compatibilitate maximă.',
    },
    {
      id: 'excel-to-csv',
      title: 'Conversie Excel → CSV',
      content:
        'Dacă datele sunt în Excel: deschideți fișierul → Salvare ca → CSV (UTF-8, delimitat prin virgulă). Asigurați-vă că separatorul zecimal este punct (.) nu virgulă (,).',
      navigateTo: '/import-stoc',
      tip: 'Separatorul de câmpuri trebuie să fie virgulă (,) sau punct și virgulă (;) — sistemul îl detectează automat.',
    },
    {
      id: 'upload',
      title: 'Încărcare fișier',
      content:
        'Trageți fișierul CSV în zona de upload sau apăsați "Selectează fișier". Sistemul va previzualiza primele rânduri și va detecta separatorul și encoding-ul automat.',
      navigateTo: '/import-stoc',
      targetSelector: '[data-tutorial="import-upload"]',
    },
    {
      id: 'validare-import',
      title: 'Validare și erori',
      content:
        'Sistemul verifică fiecare rând: SKU-uri inexistente, locații invalide, cantități negative. Erorile sunt afișate pe rânduri și pot fi corectate în fișier înainte de reimport.',
      navigateTo: '/import-stoc',
    },
    {
      id: 'confirmare',
      title: 'Confirmare import',
      content:
        'După validare, apăsați "Importă" pentru a înregistra stocul. Operațiunea este ireversibilă — verificați cu atenție previzualizarea înainte de confirmare.',
      navigateTo: '/import-stoc',
      tip: 'Importul creează automat înregistrări de mișcare de inventar pentru trasabilitate completă.',
    },
    {
      id: 'produse',
      title: 'Gestionare produse',
      content:
        'Produsele importate apar în pagina "Produse". De acolo puteți vedea stocul curent per locație, edita detalii și gestiona loturile.',
      navigateTo: '/products',
      actionLabel: 'Lista produse →',
      actionPath: '/products',
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// TUTORIAL 4: Recepție marfă (flux complet)
// ─────────────────────────────────────────────────────────────────────────────
const tutorialReceptie: Tutorial = {
  id: 'receptie-marfa',
  title: 'Recepție marfă',
  description: 'Fluxul complet de recepție: comandă furnizor → NIR → putaway în depozit.',
  emoji: '📦',
  category: 'operations',
  estimatedMinutes: 12,
  relevantPaths: ['/comenzi-furnizor', '/receptie-nir', '/receptie', '/putaway-tasks'],
  steps: [
    {
      id: 'intro',
      title: 'Fluxul de recepție marfă',
      content:
        'Recepția marfii urmează un flux clar în 4 etape: (1) Comandă Furnizor → (2) Sosire fizică și creare NIR → (3) Recepție produse pe locații → (4) Putaway (depozitare fizică).',
      navigateTo: '/comenzi-furnizor',
    },
    {
      id: 'comanda-furnizor',
      title: '1. Comenzi furnizor',
      content:
        'Înainte de sosirea mărfii, creați o Comandă Furnizor cu produsele și cantitățile așteptate. Acest lucru permite pre-alocarea locațiilor și verificarea ulterioară a cantităților primite.',
      navigateTo: '/comenzi-furnizor',
      actionLabel: 'Comenzi furnizor →',
      actionPath: '/comenzi-furnizor',
      tip: 'Dacă folosiți ERP Pluriva, comenzile de achiziție sunt importate automat.',
    },
    {
      id: 'sosite-marfa',
      title: '2. Sosirea fizică a mărfii',
      content:
        'Când marfa sosește, operatorul merge la "Recepție Marfă" și selectează comanda furnizor corespunzătoare. Dacă nu există comandă, poate face o recepție directă (fără comandă prealabilă).',
      navigateTo: '/receptie',
    },
    {
      id: 'receptie-marfa',
      title: '3. Înregistrare produse primite',
      content:
        'Pentru fiecare produs: selectați SKU-ul, introduceți cantitatea primită, scanați sau introduceți numărul de lot (dacă produsul are lot control), și confirmați locația sugerată de sistem.',
      navigateTo: '/receptie',
      targetSelector: '[data-tutorial="receptie-product"]',
      tip: 'Sistemul sugerează automat o locație bazat pe regulile de alocare definite. Puteți schimba locația dacă este necesar.',
    },
    {
      id: 'nir',
      title: '4. NIR (Nota de Intrare Recepție)',
      content:
        'Din pagina "NIR Recepție" se creează documentul oficial de recepție. NIR-ul înregistrează: furnizor, dată, produse, cantități, prețuri de intrare și gestiunea de destinație.',
      navigateTo: '/receptie-nir',
      actionLabel: 'NIR Recepție →',
      actionPath: '/receptie-nir',
    },
    {
      id: 'putaway',
      title: '5. Putaway (depozitare fizică)',
      content:
        'После recepția în sistem, operatorul primește task-uri de Putaway: ce produs trebuie dus în ce locație. Aceste task-uri apar în "Putaway Tasks" și pot fi confirmate prin scanare QR.',
      navigateTo: '/putaway-tasks',
      actionLabel: 'Putaway Tasks →',
      actionPath: '/putaway-tasks',
      tip: 'Task-urile de putaway pot fi distribuite pe mai mulți operatori simultan.',
    },
    {
      id: 'verificare-stoc',
      title: 'Verificare stoc după recepție',
      content:
        'Stocul actualizat apare imediat în "Rapoarte Stoc & Loturi". Puteți filtra per locație, per lot sau per produs pentru a confirma că totul a fost înregistrat corect.',
      navigateTo: '/rapoarte-stoc',
      actionLabel: 'Rapoarte stoc →',
      actionPath: '/rapoarte-stoc',
    },
    {
      id: 'final',
      title: 'Recepție completă!',
      content:
        'Marfa este acum înregistrată în sistem și depozitată fizic. Stocul este actualizat automat și disponibil pentru comenzile clienților.',
      navigateTo: '/receptie-nir',
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// TUTORIAL 5: Scanare QR
// ─────────────────────────────────────────────────────────────────────────────
const tutorialScanare: Tutorial = {
  id: 'scanare-qr',
  title: 'Scanare QR / cod de bare',
  description: 'Cum se folosește funcția de scanare pentru recepție, putaway, picking și livrare.',
  emoji: '📷',
  category: 'scanning',
  estimatedMinutes: 7,
  relevantPaths: ['/scan'],
  steps: [
    {
      id: 'intro',
      title: 'Funcția de scanare',
      content:
        'Pagina "Scanare" permite citirea codurilor QR și de bare cu camera telefonului sau a unui scanner hardware. Sistemul identifică automat tipul elementului scanat: produs, lot, locație sau comandă.',
      navigateTo: '/scan',
    },
    {
      id: 'mod-scanare',
      title: 'Alegerea modului',
      content:
        'Selectați modul de scanare în funcție de operațiunea curentă:\n• Recepție — pentru înregistrarea mărfii la intrare\n• Putaway — pentru confirmarea depozitării\n• Transformare — pentru procesare produse\n• Livrare — pentru confirmare expediere',
      navigateTo: '/scan',
      targetSelector: '[data-tutorial="scan-mode"]',
      tip: 'Modul se poate schimba oricând între scanări, fără a pierde informațiile deja introduse.',
    },
    {
      id: 'camera',
      title: 'Activare cameră',
      content:
        'Apăsați butonul "Activează Camera" pentru a porni scanarea prin cameră. La prima utilizare, browserul va cere permisiunea de acces la cameră — acceptați cererea.',
      navigateTo: '/scan',
      targetSelector: '[data-tutorial="scan-camera"]',
      tip: 'Pe dispozitive mobile, camera funcționează cel mai bine în modul portrait cu iluminare bună.',
    },
    {
      id: 'cod-manual',
      title: 'Introducere cod manual',
      content:
        'Dacă camera nu funcționează sau codul este deteriorat, puteți introduce codul manual în câmpul de text. Apăsați Enter sau butonul de confirmare după introducere.',
      navigateTo: '/scan',
      targetSelector: '[data-tutorial="scan-input"]',
    },
    {
      id: 'identificare',
      title: 'Identificare automată',
      content:
        'Sistemul identifică automat tipul elementului scanat:\n• LOT-XXXX → lot de produs\n• LOC-XXXX → locație în depozit\n• SKU-XXXX → produs\n• CMD-XXXX → comandă\nRezultatul apare instant sub câmpul de scanare.',
      navigateTo: '/scan',
    },
    {
      id: 'log-scanari',
      title: 'Istoricul scanărilor',
      content:
        'Fiecare scanare este înregistrată automat cu timestamp, codul citit și acțiunea efectuată. Puteți vedea istoricul sesiunii curente în partea de jos a paginii.',
      navigateTo: '/scan',
      targetSelector: '[data-tutorial="scan-log"]',
    },
    {
      id: 'putaway-scan',
      title: 'Flux putaway cu scanare',
      content:
        'Pentru putaway cu scanare: (1) Scanați produsul/lotul, (2) Sistemul afișează locația destinație, (3) Deplasați-vă la locație, (4) Scanați codul QR al locației pentru confirmare.',
      navigateTo: '/scan',
      tip: 'Confirmarea prin scanarea locației elimină erorile de depozitare în locul greșit.',
    },
    {
      id: 'final',
      title: 'Scanare configurată!',
      content:
        'Acum știți cum să folosiți scanarea pentru toate operațiunile. Recomandăm lipirea codurilor QR pe toate locațiile și utilizarea scanerelor dedicate pentru eficiență maximă.',
      navigateTo: '/scan',
      actionLabel: 'Generare QR locații →',
      actionPath: '/qr-locatii',
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// TUTORIAL 6: Comenzi clienți și picking
// ─────────────────────────────────────────────────────────────────────────────
const tutorialComenziPicking: Tutorial = {
  id: 'comenzi-picking',
  title: 'Comenzi clienți & Picking',
  description: 'Fluxul de procesare comenzi: creare/import comandă → job picking → expediere.',
  emoji: '📋',
  category: 'operations',
  estimatedMinutes: 10,
  relevantPaths: ['/orders', '/pick-jobs', '/note-culegere', '/shipments'],
  steps: [
    {
      id: 'intro',
      title: 'Procesarea comenzilor clienților',
      content:
        'O comandă client trece prin 4 etape: (1) Creare/import → (2) Job de picking → (3) Consolidare și ambalare → (4) Expediere. WMS NK gestionează automat alocarea stocului și sugerează traseul optim.',
      navigateTo: '/orders',
    },
    {
      id: 'creare-comanda',
      title: '1. Creare sau import comandă',
      content:
        'Comenzile pot fi:\n• Introduse manual din "Comenzi"\n• Importate din CSV (butonul "Import CSV")\n• Sincronizate automat din ERP Pluriva\nFiecare comandă conține client, produse, cantități și data livrare.',
      navigateTo: '/orders',
      targetSelector: '[data-tutorial="orders-import"]',
      tip: 'Format CSV pentru import: Număr comandă, Client, SKU, Cantitate, Dată livrare.',
    },
    {
      id: 'alocare-stoc',
      title: '2. Alocare automată stoc',
      content:
        'La confirmarea comenzii, sistemul alocă automat stocul din depozit folosind strategia configurată (FIFO/FEFO). Dacă stocul este insuficient, comanda rămâne în așteptare cu un avertisment.',
      navigateTo: '/orders',
      tip: 'FEFO (First Expired, First Out) se recomandă pentru produse cu dată de expirare.',
    },
    {
      id: 'job-picking',
      title: '3. Job de picking',
      content:
        'Din "Pick Jobs" alocați joburi de picking operatorilor. Un job conține o listă de locații de culegere în ordinea optimă a traseului prin depozit, minimizând distanța parcursă.',
      navigateTo: '/pick-jobs',
      actionLabel: 'Pick Jobs →',
      actionPath: '/pick-jobs',
    },
    {
      id: 'note-culegere',
      title: '4. Note de culegere',
      content:
        '"Note de Culegere" sunt documentele pe hârtie sau digitale pe care operatorul le ia la picking. Conțin: locație, cod produs, cantitate de cules și lot (dacă aplicabil).',
      navigateTo: '/note-culegere',
      actionLabel: 'Note culegere →',
      actionPath: '/note-culegere',
    },
    {
      id: 'confirmare-picking',
      title: '5. Confirmare picking',
      content:
        'Operatorul confirmă fiecare linie de picking: merge la locație, ia cantitatea, scanează produsul și locația. La finalizare, stocul scade automat și comanda trece în "Ambalare".',
      navigateTo: '/pick-jobs',
      tip: 'Confirmarea prin scanare elimină erorile de culegere și asigură trasabilitatea completă.',
    },
    {
      id: 'expediere',
      title: '6. Expediere',
      content:
        'Din "Expedieri" gestionați expedierea: selectați transportatorul, introduceți numărul AWB, imprimați documentele de transport și confirmați plecarea. Stocul este debitat definitiv.',
      navigateTo: '/shipments',
      actionLabel: 'Expedieri →',
      actionPath: '/shipments',
    },
    {
      id: 'livrare-sofer',
      title: '7. Confirmare livrare la client',
      content:
        'Din "Livrare Șofer", șoferul confirmă livrarea la client (cu semnătură digitală sau cod de confirmare). Comanda este marcată "Livrată" și informația este trimisă la ERP.',
      navigateTo: '/livrare',
    },
    {
      id: 'final',
      title: 'Flux complet!',
      content:
        'Acum cunoașteți tot fluxul comenzilor clienților. Vedeți rapoartele de picking pentru a monitoriza performanța echipei.',
      navigateTo: '/reports',
      actionLabel: 'Rapoarte picking →',
      actionPath: '/reports',
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// TUTORIAL 7: ERP Integration
// ─────────────────────────────────────────────────────────────────────────────
const tutorialERP: Tutorial = {
  id: 'erp-integration',
  title: 'Integrare ERP Pluriva',
  description: 'Configurarea sincronizării bidirecționale între WMS NK și ERP Pluriva.',
  emoji: '🔗',
  category: 'admin',
  estimatedMinutes: 8,
  relevantPaths: ['/erp-integrare'],
  steps: [
    {
      id: 'intro',
      title: 'Integrarea cu ERP Pluriva',
      content:
        'WMS NK se sincronizează bidirecțional cu ERP Pluriva: primește comenzile de achiziție (PO) din ERP și trimite înapoi NIR-urile de recepție și confirmările de livrare.',
      navigateTo: '/erp-integrare',
    },
    {
      id: 'cheie-api',
      title: '1. Configurare cheie API',
      content:
        'Contactați administratorul ERP Pluriva pentru a obține cheia API. Introduceți-o în variabila de mediu PLURIVA_API_KEY din fișierul .env al serviciului erp-connector. Fără cheie API, sistemul rulează în mod DEMO cu date simulate.',
      navigateTo: '/erp-integrare',
      tip: 'Cheia API este secretă — nu o partajați și nu o includeți în cod sursa.',
    },
    {
      id: 'sync-po',
      title: '2. Sincronizare PO Inbound',
      content:
        'La fiecare 5 minute, sistemul preia automat comenzile de achiziție noi din ERP. Acestea apar în "Comenzi Furnizor" și pot fi procesate ca recepții de marfă.',
      navigateTo: '/erp-integrare',
      targetSelector: '[data-tutorial="erp-stats"]',
    },
    {
      id: 'sync-nir',
      title: '3. Trimitere NIR la ERP',
      content:
        'Când confirmați un NIR în WMS, informația este trimisă automat la ERP Pluriva: cantitățile primite, prețurile de intrare și numărul gestiunii. ERP-ul actualizează stocul contabil.',
      navigateTo: '/erp-integrare',
    },
    {
      id: 'sync-livrari',
      title: '4. Confirmare livrări',
      content:
        'La confirmarea livrării, WMS trimite la ERP: numărul comenzii, data livrare, produsele expediate și AWB-ul. ERP-ul generează factura și actualizează contabilitatea.',
      navigateTo: '/erp-integrare',
    },
    {
      id: 'sync-manual',
      title: '5. Sincronizare manuală',
      content:
        'Dacă este nevoie de sincronizare imediată (nu să așteptați 5 minute), folosiți butoanele de sincronizare manuală: "TOATE", "PO IMPORT", "NIR EXPORT", "LIVRĂRI EXPORT".',
      navigateTo: '/erp-integrare',
      targetSelector: '[data-tutorial="erp-sync-buttons"]',
    },
    {
      id: 'webhooks',
      title: '6. Webhooks ERP',
      content:
        'ERP Pluriva poate trimite notificări instant la WMS prin webhooks (ex: confirmare comandă, anulare). Istoricul webhook-urilor primite se vede în tab-ul "WEBHOOKS".',
      navigateTo: '/erp-integrare',
    },
    {
      id: 'final',
      title: 'ERP configurat!',
      content:
        'Integrarea ERP asigură că WMS și contabilitatea sunt mereu sincronizate, fără introducere manuală dublă a datelor.',
      navigateTo: '/erp-integrare',
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// TUTORIAL 8: Rapoarte și analiză
// ─────────────────────────────────────────────────────────────────────────────
const tutorialRapoarte: Tutorial = {
  id: 'rapoarte',
  title: 'Rapoarte & Analiză',
  description: 'Cum se folosesc rapoartele de stoc, mișcări, performanță și predicții.',
  emoji: '📈',
  category: 'reports',
  estimatedMinutes: 6,
  relevantPaths: ['/rapoarte-stoc', '/rapoarte-miscari', '/rapoarte-performanta', '/rapoarte-predictii', '/reports'],
  steps: [
    {
      id: 'intro',
      title: 'Rapoarte și analiză WMS',
      content:
        'WMS NK oferă 5 tipuri de rapoarte pentru manageri: Stoc & Loturi, Mișcări inventar, Picking, Performanță și Predicții de stoc. Toate sunt actualizate în timp real.',
      navigateTo: '/rapoarte-stoc',
    },
    {
      id: 'stoc-loturi',
      title: 'Stoc & Loturi',
      content:
        'Raportul "Stoc & Loturi" arată stocul curent per produs, per locație și per lot. Puteți filtra după zonă, categorie, sau produse cu stoc critic. Export în CSV sau Excel disponibil.',
      navigateTo: '/rapoarte-stoc',
      actionLabel: 'Stoc & Loturi →',
      actionPath: '/rapoarte-stoc',
    },
    {
      id: 'miscari',
      title: 'Mișcări inventar',
      content:
        '"Mișcări inventar" arată istoricul complet al intrărilor și ieșirilor: ce produs, ce cantitate, din ce locație, de ce operator și când. Esențial pentru audit și trasabilitate.',
      navigateTo: '/rapoarte-miscari',
      actionLabel: 'Mișcări inventar →',
      actionPath: '/rapoarte-miscari',
    },
    {
      id: 'picking',
      title: 'Rapoarte picking',
      content:
        '"Rapoarte Picking" arată eficiența picking-ului: numărul de linii culese per operator, timpii medii, erorile de picking și productivitatea per zi.',
      navigateTo: '/reports',
    },
    {
      id: 'performanta',
      title: 'Performanță depozit',
      content:
        '"Performanță" oferă KPI-uri la nivel de depozit: rata de umplere a locațiilor, timpii de recepție, comenzile procesate per zi, valorile de stoc.',
      navigateTo: '/rapoarte-performanta',
      actionLabel: 'Performanță →',
      actionPath: '/rapoarte-performanta',
    },
    {
      id: 'predictii',
      title: 'Predicții & Forecast',
      content:
        '"Predicții & Forecast" folosește istoricul de mișcări pentru a prognoza stocul viitor și a avertiza despre produsele care vor atinge stocul minim în următoarele zile.',
      navigateTo: '/rapoarte-predictii',
      actionLabel: 'Predicții →',
      actionPath: '/rapoarte-predictii',
      tip: 'Predicțiile sunt mai precise după cel puțin 30 de zile de date istorice.',
    },
    {
      id: 'alerte',
      title: 'Alerte automate de stoc',
      content:
        '"Alerte Live" trimite notificări automate când stocul unui produs scade sub pragul minim configurat. Pragurile se setează per produs din pagina Alerte Live → Praguri.',
      navigateTo: '/alerte-live',
      actionLabel: 'Alerte Live →',
      actionPath: '/alerte-live',
    },
    {
      id: 'final',
      title: 'Rapoartele sunt setate!',
      content:
        'Acum aveți vizibilitate completă asupra depozitului. Configurați alertele de stoc și verificați predicțiile săptămânal pentru a planifica comenzile spre furnizori.',
      navigateTo: '/rapoarte-stoc',
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT: Lista completă de tutoriale
// ─────────────────────────────────────────────────────────────────────────────
export const ALL_TUTORIALS: Tutorial[] = [
  tutorialPrimiPasi,
  tutorialConfigurareDepozit,
  tutorialImportStoc,
  tutorialReceptie,
  tutorialScanare,
  tutorialComenziPicking,
  tutorialERP,
  tutorialRapoarte,
];

export const TUTORIAL_CATEGORIES: Record<Tutorial['category'], { label: string; emoji: string }> = {
  setup:      { label: 'Configurare', emoji: '⚙️' },
  operations: { label: 'Operațiuni',  emoji: '📦' },
  scanning:   { label: 'Scanare',     emoji: '📷' },
  reports:    { label: 'Rapoarte',    emoji: '📊' },
  admin:      { label: 'Admin',       emoji: '🛠️' },
};

/** Returnează tutorialele relevante pentru o rută dată */
export function getTutorialsForPath(path: string): Tutorial[] {
  return ALL_TUTORIALS.filter(
    (t) => t.relevantPaths?.some((p) => path.startsWith(p))
  );
}
