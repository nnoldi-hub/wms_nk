🟦 1. PRINCIPIUL DE BAZĂ
ERP-ul decide CE se taie, CÂT se taie, DE PE CE tambur.
WMS-ul decide DE UNDE se ia tamburul și UNDE se pune marfa.

Asta este separarea corectă a responsabilităților:

✔ ERP
calculează cantități

decide tamburul sursă

decide cât se taie

decide ce rămâne

decide ce se livrează

face facturarea

face scăderea valorică

✔ WMS
localizează tamburul

generează sarcina pentru operator

urmărește derularea

creează automat restul

mută restul în locația corectă

mută cablul tăiat în zona de livrare

confirmă că totul este pregătit

WMS-ul nu are voie să știe prețuri.  
Doar cantități, locații și mișcări fizice.

🟩 2. CE ÎȚI TREBUIE ÎN WMS CA SĂ FUNCȚIONEZE FLUXUL ERP → WMS
Trebuie să configurezi 4 lucruri:

🟦 2.1. Mod de ambalare (product packaging)
Pentru fiecare produs, definești:

✔ Tipuri de ambalaj posibile:
COLAC_100M

TAMBUR_500M

TAMBUR_900M

TAMBUR_CUSTOM (ex: 467m, 732m etc.)

REST (cantitate rămasă după tăiere)

✔ Reguli:
colac → se vinde doar întreg

tambur → se poate derula

rest → se vinde doar întreg

✔ Fără preț
Doar lungime, greutate, volum.

🟦 2.2. Mod de depozitare (storage rules)
Pentru fiecare ambalaj:

✔ COLAC
pe palet

pe raft

max 50 colaci / palet

✔ TAMBUR MIC (≤ 600m)
pe palet

pe raft

pe derulator

✔ TAMBUR MEDIU (600–1200m)
pe palet

pe raft heavy

✔ TAMBUR MARE (>1200m)
platformă betonată

✔ REST
raft resturi

🟦 2.3. Reguli Putaway (automat)
Când ERP trimite un tambur:

Exemplu: ERP spune
„Taie 120m din tamburul TMB-2026-0045, rămân 347m.”

WMS face:
găsește tamburul în depozit

generează sarcina:

ia tamburul din locația X

du-l la zona de tăiere

după tăiere:

creează automat un nou lot „REST_347m”

pune restul în zona H2-REST

pune cablul tăiat în zona de livrare

Totul fără preț.

🟦 2.4. Reguli Picking (ERP → WMS)
ERP spune:

tamburul sursă

cantitatea

destinația

WMS spune:

locația tamburului

locația restului

locația cablului tăiat

confirmarea finală

🟧 3. CE TREBUIE CONFIGURAT ÎN ADMIN (pas cu pas)
Tu ai deja tot ce trebuie în meniul Admin.
Hai să-ți spun exact ce trebuie setat în fiecare modul.

🟦 3.1. Configurare Depozit
Definești zonele:

H1 – Cabluri mici

H2 – Derulatoare + resturi

H3 – Echipamente + voluminoase

EXT – Platformă betonată

RECV – Recepție

SHIP – Livrare

🟦 3.2. Tipuri Locații
Definești:

RACK_STANDARD

RACK_PALLET

RACK_RESTURI

DERULATOR

FLOOR_HEAVY

TAMBUR_PLATFORMĂ

🟦 3.3. Capacități Locații
Aici setezi:

✔ allowed_packaging:
COLAC

PALET

TAMBUR_MIC

TAMBUR_MEDIU

TAMBUR_MARE

REST

✔ max_weight
✔ max_volume
✔ max_slots
🟦 3.4. Reguli WMS
Aici setezi:

Putaway:
COLAC → RACK_PALLET

TAMBUR_MIC → DERULATOR

TAMBUR_MEDIU → RACK_PALLET

TAMBUR_MARE → PLATFORMĂ

REST → RACK_RESTURI

Picking:
preferă resturi

FIFO

minimize waste

proximitate

🟦 3.5. Reguli Dinamice
Aici setezi:

tambur sub 15% → mută în resturi

palet plin → mută în zona de stocare

tambur mare pe raft → alertă greutate

colaci peste capacitate → alertă

🟦 3.6. Paleți
Aici setezi:

câți colaci intră pe un palet

câți tamburi intră pe un palet

câte sloturi are un palet

🟦 3.7. ERP Pluriva
Aici setezi:

WMS primește:

tambur sursă

cantitate de tăiat

cantitate rămasă

destinație

WMS trimite:

confirmare pregătire

locații

loturi noi (resturi)

🟩 4. CE OBȚII DUPĂ CONFIGURARE
🔥 1. ERP decide ce se taie
🔥 2. WMS decide de unde se ia tamburul
🔥 3. WMS generează sarcina de tăiere
🔥 4. WMS creează automat restul
🔥 5. WMS pune restul în locația corectă
🔥 6. WMS pune cablul tăiat în zona de livrare
🔥 7. ERP facturează
Totul fără preț în WMS.