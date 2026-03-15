Conceptul de scanare în WMS
🎯 Obiectiv:
Etichetarea și identificarea unică a fiecărui element din depozit (produse, ambalaje, unități compuse) prin coduri QR, pentru a permite:

Scanare rapidă la recepție, transformare, ambalare și livrare

Asociere dinamică între produs și ambalaj (ex: cablu + tambur)

Scădere automată din stoc în funcție de ce se livrează

🧩 Structura logică propusă
1. Entități scanabile
Fiecare dintre următoarele trebuie să aibă un cod QR unic:

Produs brut (ex: cablu X)

Unitate de ambalare (tambur, colac, palet)

Unitate compusă (cablul X pe tambur Y → entitate nouă)

2. Relații între entități
Un produs poate fi legat de mai multe ambalaje în timp (ex: cablu X → tambur Y → colac Z)

Ambalajele pot fi reutilizabile sau consumabile

La scanare, sistemul trebuie să știe dacă:

Se livrează doar produsul (și ambalajul rămâne)

Se livrează produsul + ambalajul (ambalajul se scade din stoc)

3. Etape de scanare
Etapă	Ce se scanează	Ce se întâmplă în sistem
Recepție	Cod QR produs + cod QR ambalaj	Se creează relația produs-ambalaj în stoc
Transformare	Cod QR produs + cod QR ambalaj nou	Se modifică ambalajul, se păstrează trasabilitate
Livrare	Cod QR unitate compusă	Se scade produsul și ambalajul (dacă e livrat)
🛠️ Implementare în interfață
🔍 Pagina „Scanare”
Moduri de scanare: Recepție / Transformare / Livrare

Câmpuri:

Cod QR scanat

Tip entitate detectată (produs / ambalaj / compus)

Acțiune sugerată (asociere, transformare, scădere)

Log activitate: Istoric scanări + modificări stoc

📦 Exemplu de flux:
Scanare tambur Y → sistemul îl identifică

Scanare cablu X → sistemul propune asociere cu tambur Y

La livrare, scanare unitate compusă → sistemul scade cablu X + tambur Y

🧪 Recomandări tehnice
Folosește un generator de coduri QR care encodează ID-ul unic + tipul entității

Stochează relațiile într-un tabel unitati_compuse cu:

id_produs

id_ambalaj

cantitate

status (activ / livrat / transformat)

La scanare, folosește un parser care identifică tipul entității și propune acțiunea

Import produse si initializare depozit

Modul „Setare Inițială Depozit” – propunere de funcționalitate
🎯 Scop:
Permite încărcarea rapidă a produselor, ambalajelor și relațiilor dintre ele, cu generare automată de coduri QR, fără scanare fizică.

🧩 Structură modulară
1. Import în masă
Format acceptat: Excel / CSV

Coloane utile:

Nume produs

Cod intern / SKU

Cantitate

Tip ambalaj (tambur, colac, palet)

Asocieri (ex: cablu X pe tambur Y)

Status ambalaj (reutilizabil / consumabil)

2. Generare automată coduri QR
La import, sistemul generează:

Cod QR pentru fiecare produs

Cod QR pentru fiecare ambalaj

Cod QR pentru fiecare unitate compusă (produs + ambalaj)

Codurile pot fi exportate ca PDF pentru print sau afișate în interfață

3. Interfață de configurare
Pagina „Setare Inițială” cu:

Formular manual + opțiune de import

Preview coduri QR generate

Confirmare + salvare în stoc

Imprimare cosuri qr pt a pune pe produse 

🛠️ Avantaje față de scanare manuală
Metodă	Avantaje principale
Setare inițială	Rapid, scalabil, ideal pentru început
Scanare manuală	Flexibilă, ideală pentru operațiuni zilnice
Poți folosi ambele metode în paralel: setarea inițială pentru populare, scanarea pentru recepții, transformări și livrări.

🧪 Recomandări tehnice
Creează un endpoint POST /import-produse care procesează fișierul și generează codurile QR

Salvează codurile QR ca imagini în baza de date sau le encodezi direct în interfață

Folosește o librărie precum qrcode (JS) sau qrcode-generator pentru generare rapidă

🏗️ 1. Receptie
Creare produs compus: Cablul electric este asociat cu tamburul pe care vine. Se creează o entitate „Cablu pe Tambur” cu:

Cod cablu

Tip tambur (dimensiune, material)

Lungime cablu (km)

Furnizor

Lot / batch

Unitate de măsură primară: km (pentru stoc)

Unitate de vânzare: metru (pentru tăieri și comenzi)

🧮 2. Prelucrare și gestiune stoc
Centralizare stoc pe SKU: Sistemul adună lungimile aceluiasi tip de cablu de la mai mulți furnizori.

Tambur ca container: Fiecare tambur are un ID unic și este tratat ca un container fizic cu:

Lungime disponibilă

Istoric tăieri

Status (plin, parțial, gol)

Operațiuni de tăiere:

Se selectează tamburul cu lungime suficientă

Se taie x metri → se generează o „ieșire” din tambur

Tamburul se actualizează cu lungimea rămasă

Se poate genera un nou tambur cu restul, sau se marchează tamburul ca „parțial”

🛒 3. Vânzare
Comanda clientului: exprimată în metri

Sistemul propune tamburul optim: cel cu lungimea minimă care acoperă cererea

Actualizare stoc:

Se scade lungimea tăiată din tambur

Se actualizează stocul total pe SKU

Se înregistrează tamburul returnat (dacă rămâne cablu pe el)

🧩 Structura de date recomandată
Categorie	Coloane necesare
Cablu	Cod, Tip, Secțiune, Material, Tensiune
Tambur	ID, Dimensiune, Material, Status
Cablu pe Tambur	Cod cablu, ID tambur, Lungime, Furnizor
Furnizor	Nume, Cod fiscal, Loturi livrate
Stoc	SKU, Total km, Tamburi active
Tăiere	ID tambur, Lungime tăiată, Data, Operator
Vânzare	Client, Lungime cerută, Tambur folosit
🧠 Funcționalități utile de implementat
🔍 Filtrare după categorie și furnizor

📦 Vizualizare tamburi și lungimi disponibile

✂️ Simulare tăiere și sugestie tambur

📊 Rapoarte: stoc pe SKU, tamburi parțiali, tăieri efectuate

🔄 Istoric tambur: ce lungimi au fost tăiate și când