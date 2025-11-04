# Structură meniu (Web Admin)

Aceasta este organizarea meniului din aplicația Admin, conform schiței propuse.

## Sidebar (navigare stânga)

### Admin
- Setări
- Configurare Depozit
- Utilizatori (opțional, dacă nu are meniu separat)

### Operațiuni
- Produse
- Comenzi
- Expedieri

Notă: sub „Comenzi” putem include legături către fluxurile conectate (de ex. „Picking/Pick Jobs”) fără a încărca navigarea principală.

## Dashboard (conținut principal)

Carduri de sinteză în primul rând:
- Total Produse
- Comenzi Active
- Expedieri Azi
- Productivitate

Secțiune dedesubt:
- Activitate Recentă (grafice și date în timp real)

## Mapare (rute recomandate)
- Dashboard: `/dashboard`
- Produse: `/products`
- Comenzi: `/orders`
- Picking (legat de Comenzi): `/pick-jobs`
- Expedieri: `/shipments`
- Setări: `/settings`
- Configurare Depozit: `/warehouse/config`
- Utilizatori: `/users`

## Observații
- Grupele „Admin” și „Operațiuni” sunt extensibile (accordion) pentru a păstra meniul aerisit.
- Vizibilitatea elementelor poate fi filtrată pe rol (admin, operator, manager).
- Dacă „Picking” trebuie să apară în meniul din stânga, plasează-l sub „Operațiuni”, imediat după „Comenzi”.