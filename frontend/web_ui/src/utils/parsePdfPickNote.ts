/**
 * parsePdfPickNote.ts
 * Extrage datele dintr-o "Notă de culegere" NK Smart Cables (PDF) folosind pdfjs-dist.
 *
 * Format așteptat (din ERP-ul NK):
 *   Nota de culegere CMD_116731 din data 12/03/2026
 *   Partener: CER ELECTRO AVG S.R.L.
 *   Persoana de contact: CROITORU GEO
 *   Tabel cu coloanele:
 *     Denumire articol | Cod gest. | Lungime din care se taie |
 *     Cantitate de | UM | Lot intrare | Cantitate ramasa | Greutate | Lungimi solicitate
 *   Greutate comanda: 331.40
 *   Tip livrare: TRANSPORT NK SMART CABLES
 *   Agent: DOBRESCU DANIEL
 */

import * as pdfjsLib from 'pdfjs-dist';
import type { ImportPayload } from '../services/pickNotes.service';

// Worker URL — importat ca asset Vite cu sufixul ?url
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Setăm worker-ul o singură dată la încărcarea modulului
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// ─── tipos interne ────────────────────────────────────────────────────────────

interface RawItem {
  str: string;
  x: number;
  y: number; // poziție PDF (y creste de jos în sus)
}

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Grupează itemele pe rânduri după coordonata Y (toleranță = threshold unități PDF). */
function clusterByRow(items: RawItem[], threshold = 3.5): RawItem[][] {
  if (!items.length) return [];
  // PDF-urile au Y crescut de jos în sus, sortăm descrescător (top=>first)
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);

  const rows: RawItem[][] = [];
  let curY = sorted[0].y;
  let curRow: RawItem[] = [];

  for (const item of sorted) {
    if (Math.abs(item.y - curY) > threshold) {
      if (curRow.length) rows.push([...curRow].sort((a, b) => a.x - b.x));
      curRow = [item];
      curY = item.y;
    } else {
      curRow.push(item);
    }
  }
  if (curRow.length) rows.push([...curRow].sort((a, b) => a.x - b.x));
  return rows;
}

/** Găsește indexul coloanei cu centrul X cel mai apropiat de xPos. */
function nearestColIdx(xPos: number, colCenters: number[]): number {
  let minDist = Infinity;
  let idx = 0;
  for (let i = 0; i < colCenters.length; i++) {
    const d = Math.abs(xPos - colCenters[i]);
    if (d < minDist) { minDist = d; idx = i; }
  }
  return idx;
}

/** Parsează număr cu virgulă sau punct ca separator zecimal. */
function parseNum(s: string): number {
  return parseFloat(s.replace(',', '.').replace(/\s/g, ''));
}

/**
 * Grupează itemele din headerul PDF în coloane reale.
 * Headerele multi-cuvânt (ex: "Lungime din care se taie") sunt un singur item
 * SAU cuvinte separate cu gap mic. Le reunim după gap față de lățimea estimată.
 */
function mergeHeaderItems(items: RawItem[]): { center: number; label: string }[] {
  if (!items.length) return [];
  const sorted = [...items].sort((a, b) => a.x - b.x);
  const groups: RawItem[][] = [[sorted[0]]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    // Estimăm lățimea cuvântului anterior (~5.5pt/char la font 10pt)
    const prevWidth = prev.str.length * 5.5;
    const gap = curr.x - (prev.x + prevWidth);
    // Gap > 20pt = coloană nouă; gap mai mic = același header multi-cuvânt
    if (gap > 20) {
      groups.push([curr]);
    } else {
      groups[groups.length - 1].push(curr);
    }
  }

  return groups.map(g => ({
    center: g[0].x + (g[g.length - 1].x - g[0].x + g[g.length - 1].str.length * 5.5) / 2,
    label: g.map(it => it.str).join(' ').toLowerCase(),
  }));
}

// ─── export principal ─────────────────────────────────────────────────────────

export interface PdfParseResult {
  note: ImportPayload | null;
  errors: string[];
  warnings: string[];
}

export async function parsePdfPickNote(file: File): Promise<PdfParseResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const buffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: buffer });
    const pdf = await loadingTask.promise;

    const allItems: RawItem[] = [];
    let fullText = '';

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();

      for (const rawItem of content.items) {
        // Tipul real are proprietatea 'str'
        const item = rawItem as { str: string; transform: number[] };
        if (!item.str?.trim()) continue;
        const [, , , , x, y] = item.transform;
        allItems.push({ str: item.str.trim(), x, y });
        fullText += ' ' + item.str;
      }
    }

    fullText = fullText.replace(/\s+/g, ' ').trim();

    // ── 1. Extrage metadata ──────────────────────────────────────────────────

    const cmdMatch = fullText.match(/CMD[_\s-](\d+)/i);
    if (!cmdMatch) errors.push('Numărul comenzii (CMD_XXXXXX) nu a putut fi extras.');

    const dateMatch = fullText.match(/din\s+data\s+(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{4})/i);

    // Partener vine după "Partener:" și înainte de "Adresa:" sau "Persoana"
    const partnerMatch = fullText.match(/Partener\s*:\s*(.{1,200}?)(?=\s+Adresa|\s+Persoana|\s{3}|$)/i);
    const contactMatch = fullText.match(/Persoana\s+de\s+contact\s*:\s*(.{1,150}?)(?=\s+Tip|\s+Agent|\s{3}|$)/i);
    const agentMatch = fullText.match(/Agent\s*:\s*(.{1,100}?)(?=\s+Obs|\s+Tip|\s+Greutate|\s{3}|$)/i);
    const livMatch = fullText.match(/Tip\s+livrare\s*:\s*(.{1,200}?)(?=\s+Agent|\s+Obs|\s{3}|$)/i);
    const weightTotalMatch = fullText.match(/Greutate\s+comanda\s*:?\s*([\d.,]+)/i);

    // ── 2. Parsează tabelul ──────────────────────────────────────────────────

    const rows = clusterByRow(allItems);

    // Găsim rândul header (cel care conține "Denumire" sau "Cod gest")
    const headerRowIdx = rows.findIndex(r => {
      const t = r.map(i => i.str).join(' ').toLowerCase();
      return t.includes('denumire') || (t.includes('cod') && t.includes('gest'));
    });

    if (headerRowIdx < 0) {
      errors.push('Tabelul de articole nu a putut fi identificat în PDF.');
      errors.push('Sfat: exportați nota ca CSV/TSV din ERP pentru import mai sigur.');
      return { note: null, errors, warnings };
    }

    // Centrele X ale coloanelor — mergem cuvintele multi-word din header în coloane reale
    const headerRow = rows[headerRowIdx];
    const mergedCols = mergeHeaderItems(headerRow);
    const colCenters = mergedCols.map(c => c.center);
    const colLabels = mergedCols.map(c => c.label);

    // Mapăm coloanele la rol — match de cuvânt întreg (evită 'um' să matchuie 'denumire')
    const findCol = (...keywords: string[]) =>
      colLabels.findIndex(l =>
        keywords.some(k =>
          l === k ||
          l.startsWith(k + ' ') ||
          l.endsWith(' ' + k) ||
          l.includes(' ' + k + ' ')
        )
      );

    const COL = {
      product:   findCol('denumire', 'articol'),
      codGest:   findCol('cod gest', 'cod'),
      lungime:   findCol('lungime'),
      cantitate: findCol('cantitate de', 'cantitat'),
      um:        findCol('u.m.', 'u.m', 'um'),
      lot:       findCol('lot intrare', 'lot'),
      ramasa:    findCol('cantitate ramasa', 'ramasa', 'ramas'),
      greutate:  findCol('greutate'),
      solicitate: findCol('lungimi solicitate', 'solicitate'),
    };

    // Dacă columnele nu sunt identificate bine, avertizăm
    if (COL.product < 0) warnings.push('Coloana "Denumire articol" nu a fost găsită clar.');
    if (COL.cantitate < 0) warnings.push('Coloana "Cantitate" nu a fost găsită clar.');

    // Cuvinte care marchează sfârșitul tabelului
    const TABLE_STOP = ['greutate comanda', 'tip livrare', 'agent:', 'observatii'];

    const lines: ImportPayload['lines'] = [];

    for (let r = headerRowIdx + 1; r < rows.length; r++) {
      const rowItems = rows[r];
      if (!rowItems.length) continue;

      const rowText = rowItems.map(i => i.str).join(' ').toLowerCase();
      if (TABLE_STOP.some(kw => rowText.includes(kw))) break;

      // Mapăm fiecare item la coloana cea mai apropiată
      const cells: string[] = new Array(colCenters.length).fill('');
      for (const item of rowItems) {
        const ci = nearestColIdx(item.x, colCenters);
        cells[ci] = cells[ci] ? cells[ci] + ' ' + item.str : item.str;
      }

      const getCell = (colIdx: number) => (colIdx >= 0 ? (cells[colIdx] || '') : '');

      const productName = getCell(COL.product);
      const codGest = getCell(COL.codGest);

      // Rândul trebuie să aibă cel puțin un identificator de produs
      if (!productName && !codGest) continue;

      const qty = parseNum(getCell(COL.cantitate));
      const lungime = parseNum(getCell(COL.lungime));
      const ramasa = parseNum(getCell(COL.ramasa));
      const weight = parseNum(getCell(COL.greutate));
      // UOM: dacă valoarea detectată nu e o unitate validă (max 10 char, fără cifre), defaultăm Km
      const rawUom = getCell(COL.um);
      const VALID_UNITS = ['km', 'm', 'buc', 'kg', 'ml', 'l', 'set', 'pcs', 'rol', 'bob'];
      const uom = (rawUom && rawUom.length <= 10 && VALID_UNITS.some(u => rawUom.toLowerCase().includes(u)))
        ? rawUom
        : 'Km';

      // Lot-ul poate conține mai multe cuvinte care se distribuie în coloane adiacente
      // Colectăm toate celulele dintre lot și ramasa (exclusiv) și le reunim
      let lot = '';
      if (COL.lot >= 0) {
        const lotEndIdx = COL.ramasa > COL.lot ? COL.ramasa : cells.length;
        lot = cells.slice(COL.lot, lotEndIdx).filter(Boolean).join(' ').trim();
      }

      const solicitate = getCell(COL.solicitate);

      lines.push({
        product_name: productName || codGest,
        stock_code: codGest || undefined,
        length_available: isNaN(lungime) ? undefined : lungime,
        quantity_to_pick: isNaN(qty) ? 0 : qty,
        uom,
        lot_number: lot || undefined,
        quantity_remaining: isNaN(ramasa) ? undefined : ramasa,
        weight: isNaN(weight) ? undefined : weight,
        requested_lengths: solicitate || undefined,
      });
    }

    if (!lines.length) {
      errors.push('Nu s-au putut extrage articole din PDF. PDF-ul poate fi scanat (imagine) sau are un format diferit.');
      return { note: null, errors, warnings };
    }

    // ── 3. Construim nota ────────────────────────────────────────────────────

    // Convertim data din DD/MM/YYYY → YYYY-MM-DD
    let erp_date: string | undefined;
    if (dateMatch) {
      const parts = dateMatch[1].split(/[/\-.]/);
      if (parts.length === 3) {
        const [d, m, y] = parts;
        erp_date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
    }

    const note: ImportPayload = {
      erp_cmd_number: cmdMatch ? `CMD_${cmdMatch[1]}` : `CMD_PDF_${Date.now()}`,
      erp_date,
      partner_name: partnerMatch?.[1]?.trim(),
      contact_person: contactMatch?.[1]?.trim(),
      agent_name: agentMatch?.[1]?.trim(),
      delivery_type: livMatch?.[1]?.trim(),
      total_weight: weightTotalMatch ? parseNum(weightTotalMatch[1]) : undefined,
      lines,
    };

    if (lines.length > 0 && errors.length === 0) {
      // Validare sumă greutate
      const lineWeightSum = lines.reduce((s, l) => s + (l.weight ?? 0), 0);
      if (note.total_weight && Math.abs(lineWeightSum - note.total_weight) > 1) {
        warnings.push(
          `Suma greutăților pe linii (${lineWeightSum.toFixed(2)} kg) diferă de greutatea totală din PDF (${note.total_weight} kg). Verificați extragerea.`,
        );
      }
    }

    return { note, errors, warnings };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Eroare internă la parsarea PDF: ${msg}`);
    return { note: null, errors, warnings };
  }
}
