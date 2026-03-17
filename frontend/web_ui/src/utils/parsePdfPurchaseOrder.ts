/**
 * parsePdfPurchaseOrder.ts
 * Extrage datele dintr-o "Comandă de achiziție" (export PDF ERP) folosind pdfjs-dist.
 *
 * Formate acceptate:
 *   Comanda de achizitie CA_XXXX din data DD/MM/YYYY
 *   Furnizor: BENEXEL SRL
 *   Persoana contact: ION POPESCU
 *   Termen livrare: 15/04/2026
 *   Tabel cu coloanele:
 *     Denumire articol | Cod / SKU | Cantitate | UM | Pret Lista | Discount% | Pret Unitar | Tip Ambalare
 *   Valoare totala: 12.000,00 RON
 */

import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// ─── tipuri interne ───────────────────────────────────────────────────────────

interface RawItem {
  str: string;
  x: number;
  y: number;
}

export interface ImportLine {
  line_number: number;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit: string;
  list_price: number;
  discount_pct: number;
  unit_price: number;
  line_value: number;
  packaging_type: string;
}

export interface ImportPO {
  order_number: string;
  supplier_name: string;
  order_date: string;
  delivery_date: string;
  currency: string;
  notes: string;
  lines: ImportLine[];
}

export interface PdfPOParseResult {
  po: ImportPO | null;
  errors: string[];
  warnings: string[];
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function clusterByRow(items: RawItem[], threshold = 3.5): RawItem[][] {
  if (!items.length) return [];
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

function nearestColIdx(xPos: number, colCenters: number[]): number {
  let minDist = Infinity;
  let idx = 0;
  for (let i = 0; i < colCenters.length; i++) {
    const d = Math.abs(xPos - colCenters[i]);
    if (d < minDist) { minDist = d; idx = i; }
  }
  return idx;
}

function parseNum(s: string): number {
  // Determină formatul după ultimul separator: punct → zecimal EN, virgulă → zecimal RO
  const cleaned = s.replace(/\s/g, '');
  if (!cleaned || !/\d/.test(cleaned)) return NaN;
  const hasComma = cleaned.includes(',');
  const hasDot   = cleaned.includes('.');
  if (hasComma && hasDot) {
    // Ambele prezente: ultimul separator indică zecimalele
    return cleaned.lastIndexOf('.') > cleaned.lastIndexOf(',')
      ? parseFloat(cleaned.replace(/,/g, ''))            // EN: 14,060.0000 → 14060.0000
      : parseFloat(cleaned.replace(/\./g, '').replace(',', '.')); // RO: 14.060,00 → 14060.00
  }
  // Doar un tip de separator (sau niciunul): tratează ca zecimal
  return parseFloat(cleaned.replace(',', '.'));
}

function mergeHeaderItems(items: RawItem[]): { center: number; label: string }[] {
  if (!items.length) return [];
  const sorted = [...items].sort((a, b) => a.x - b.x);
  const groups: RawItem[][] = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const prevWidth = prev.str.length * 5.5;
    const gap = curr.x - (prev.x + prevWidth);
    if (gap > 20) groups.push([curr]);
    else groups[groups.length - 1].push(curr);
  }
  return groups.map(g => ({
    center: g[0].x + (g[g.length - 1].x - g[0].x + g[g.length - 1].str.length * 5.5) / 2,
    label: g.map(it => it.str).join(' ').toLowerCase(),
  }));
}

function dmyToIso(dmy: string): string {
  const parts = dmy.split(/[/\-.]/);
  if (parts.length !== 3) return dmy;
  const [d, m, y] = parts;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

// ─── export principal ─────────────────────────────────────────────────────────

export async function parsePdfPurchaseOrder(file: File): Promise<PdfPOParseResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

    const allItems: RawItem[] = [];
    let fullText = '';

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      for (const rawItem of content.items) {
        const item = rawItem as { str: string; transform: number[] };
        if (!item.str?.trim()) continue;
        const [, , , , x, y] = item.transform;
        allItems.push({ str: item.str.trim(), x, y });
        fullText += ' ' + item.str;
      }
    }

    fullText = fullText.replace(/\s+/g, ' ').trim();

    // ── 1. Metadata ──────────────────────────────────────────────────────────

    // Număр comandă: CA_100, CA_1234, CB_100, etc.
    const orderMatch = fullText.match(/\b(CA[_\s-]?\d+|CB[_\s-]?\d+)\b/i);
    if (!orderMatch) errors.push('Numărul comenzii (ex: CA_100) nu a putut fi extras.');

    const dateMatch = fullText.match(/din\s+data\s+(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{4})/i)
      ?? fullText.match(/data\s+comenzii\s*:?\s*(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{4})/i)
      ?? fullText.match(/\bdata\s*:?\s*(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{4})/i);

    const deliveryMatch = fullText.match(/termen\s+(de\s+)?livrare\s*:?\s*(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{4})/i);

    const supplierMatch =
      // "Catre: COMPANY SA" — format NK Smart Cables
      fullText.match(/\bCatre\s*:\s*(.{3,80}?)(?=\s+Adresa\b|\s+Tel\.|\s+Fax\b|$)/i)
      // "Furnizor: COMPANY" fără "Adresa Furnizor" înainte
      ?? fullText.match(/(?<!Adresa\s)Furnizor\s*:\s*(.{1,200}?)(?=\s+Persoana|\s+Adresa|\s+Termen|\s{3}|$)/i)
      ?? fullText.match(/Partener\s*:\s*(.{1,200}?)(?=\s+Persoana|\s+Adresa|\s+Termen|\s{3}|$)/i)
      ?? fullText.match(/(?<!Adresa\s)Furnizor\s*:\s*(.+)/i)
      ?? fullText.match(/Partener\s*:\s*(.+)/i);

    const currencyMatch = fullText.match(/\b(RON|EUR|USD)\b/i);

    const notesMatch = fullText.match(/Observat[i|ș]i\s*:?\s*(.{1,300}?)(?=\s{3}|$)/i);

    // ── 2. Tabel produse ─────────────────────────────────────────────────────

    const rows = clusterByRow(allItems);

    // Header tabel: rândul care conține "Denumire" sau "Cantitate"
    const headerRowIdx = rows.findIndex(r => {
      const t = r.map(i => i.str).join(' ').toLowerCase();
      return (t.includes('denumire') || t.includes('articol'))
        && (t.includes('cantitate') || t.includes('pret') || t.includes('cod'));
    });

    if (headerRowIdx < 0) {
      errors.push('Tabelul de produse nu a putut fi identificat în PDF.');
      errors.push('Sfat: exportați comanda ca CSV/TSV din ERP pentru import mai sigur.');
      return { po: null, errors, warnings };
    }

    // Pozițiile și label-urile coloanelor vin exclusiv din rândul principal de header.
    // NU facem merge cu sub-header-ul (ex: "Crt.", "unitar", "%") — nearestColIdx e imprecis
    // și poate mapa "unitar" la coloana greșită (ex: "Valoare" în loc de "Pret").
    const mergedCols = mergeHeaderItems(rows[headerRowIdx]);
    const colCenters = mergedCols.map(c => c.center);
    const colLabels  = mergedCols.map(c => c.label);

    // Detectăm sub-header-ul DOAR ca să-l sărim (nu îi preluăm textul în colLabels).
    let dataStartIdx = headerRowIdx + 1;
    if (dataStartIdx < rows.length) {
      const subRowText = rows[dataStartIdx].map(i => i.str).join(' ').toLowerCase();
      const isSubHeader = /\b(unitar|ambalare|crt\.?)\b/.test(subRowText)
        && !subRowText.includes('denumire') && !subRowText.includes('cantitate');
      if (isSubHeader) dataStartIdx++;
    }

    const findCol = (...keywords: string[]) =>
      colLabels.findIndex(l =>
        keywords.some(k =>
          l === k || l.startsWith(k + ' ') || l.endsWith(' ' + k) || l.includes(' ' + k + ' ')
        )
      );

    const COL = {
      product:    findCol('denumire', 'articol', 'produs', 'material'),
      sku:        findCol('cod', 'sku', 'cod material', 'cod produs', 'cod gest'),
      quantity:   findCol('cantitate', 'cant', 'qty'),
      unit:       findCol('um', 'u.m.', 'unitate'),
      listPrice:  findCol('pret lista', 'lista', 'pret fara discount'),
      discount:   findCol('discount', 'disc', 'disc %', '%'),
      unitPrice:  findCol('pret unitar', 'unitar', 'pret net'),
      packaging:  findCol('ambalare', 'tip ambalare', 'ambalaj', 'mod ambalare'),
    };

    // Fallback: dacă unitPrice nu a fost găsit (label din row 1 este "pret" simplu),
    // luăm al doilea "pret*" column la STÂNGA coloanei "valoare" (sau orice al doilea pret dacă nu e valoare).
    if (COL.unitPrice < 0) {
      const COL_valoare = colLabels.findIndex(l => l === 'valoare');
      const pretIdxs = colLabels
        .map((l, i) => (l.startsWith('pret') || l === 'pret') ? i : -1)
        .filter(i => i >= 0 && i !== COL.listPrice && (COL_valoare < 0 || i < COL_valoare));
      if (pretIdxs.length > 0) COL.unitPrice = pretIdxs[pretIdxs.length - 1];
    }

    if (COL.product < 0) warnings.push('Coloana "Denumire articol" nu a fost identificată.');
    if (COL.quantity < 0) warnings.push('Coloana "Cantitate" nu a fost identificată.');

    const TABLE_STOP = ['valoare totala', 'total comanda', 'termen livrare', 'observatii', 'semnat', 'emis de'];

    const lines: ImportLine[] = [];
    for (let r = dataStartIdx; r < rows.length; r++) {
      const rowItems = rows[r];
      if (!rowItems.length) continue;

      const rowText = rowItems.map(i => i.str).join(' ').toLowerCase();
      if (TABLE_STOP.some(kw => rowText.includes(kw))) break;

      const cells: string[] = new Array(colCenters.length).fill('');
      for (const item of rowItems) {
        const ci = nearestColIdx(item.x, colCenters);
        cells[ci] = cells[ci] ? cells[ci] + ' ' + item.str : item.str;
      }

      const getCell = (ci: number) => (ci >= 0 ? (cells[ci] ?? '') : '');

      const productName = getCell(COL.product);
      const sku = getCell(COL.sku);
      if (!productName && !sku) continue;

      // Sari rândurile care sunt sub-headere ale tabelului (ex: "Crt.", "Nr.", "Nr. Crt.", "Total")
      const nameLower = productName.toLowerCase().trim();
      const SKIP_NAMES = ['crt.', 'crt', 'nr.', 'nr. crt.', 'nr crt', 'total', 'subtotal', '#', 'nr'];
      if (SKIP_NAMES.includes(nameLower)) continue;
      // Sari și rândurile cu doar cifre sau foarte scurte fără conținut util
      if (/^\d+$/.test(nameLower) && !sku) continue;

      const qty = parseNum(getCell(COL.quantity));
      const lp = parseNum(getCell(COL.listPrice));
      const disc = parseNum(getCell(COL.discount));
      const rawUp = parseNum(getCell(COL.unitPrice));
      const up = isNaN(rawUp) ? (isNaN(lp) ? 0 : lp * (1 - (isNaN(disc) ? 0 : disc) / 100)) : rawUp;
      const lineVal = isNaN(qty) ? 0 : Math.round(qty * up * 100) / 100;

      const rawUnit = getCell(COL.unit);
      const VALID_UNITS = ['km', 'm', 'buc', 'kg', 'ml', 'l', 'set', 'pcs', 'rol', 'bob', 'rola', 'tambur'];
      const unit = (rawUnit && rawUnit.length <= 15 && VALID_UNITS.some(u => rawUnit.toLowerCase().includes(u)))
        ? rawUnit : 'Km';

      lines.push({
        line_number: lines.length + 1,
        product_name: productName || sku,
        product_sku: sku || '',
        quantity: isNaN(qty) ? 0 : qty,
        unit,
        list_price: isNaN(lp) ? 0 : lp,
        discount_pct: isNaN(disc) ? 0 : disc,
        unit_price: up,
        line_value: lineVal,
        packaging_type: getCell(COL.packaging),
      });
    }

    if (!lines.length) {
      errors.push('Nu s-au putut extrage produse din PDF. PDF-ul poate fi scanat (imagine) sau are un format diferit.');
      return { po: null, errors, warnings };
    }

    // Validare sum valori
    const totalMatch = fullText.match(/Valoare\s+total[aă]\s*:?\s*([\d.,]+)/i)
      ?? fullText.match(/Total\s+comand[aă]\s*:?\s*([\d.,]+)/i);
    if (totalMatch) {
      const pdfTotal = parseNum(totalMatch[1]);
      const calcTotal = lines.reduce((s, l) => s + l.line_value, 0);
      if (!isNaN(pdfTotal) && Math.abs(calcTotal - pdfTotal) > 1) {
        warnings.push(
          `Suma liniilor (${calcTotal.toFixed(2)}) diferă de totalul din PDF (${pdfTotal.toFixed(2)}). Verificați prețurile.`,
        );
      }
    }

    // ── 3. Construire obiect ImportPO ────────────────────────────────────────

    const rawOrderNum = orderMatch?.[1].replace(/\s/, '_').toUpperCase() ?? `CA_PDF_${Date.now()}`;

    const po: ImportPO = {
      order_number: rawOrderNum,
      supplier_name: supplierMatch?.[1]?.trim() ?? '',
      order_date: dateMatch ? dmyToIso(dateMatch[1]) : new Date().toISOString().slice(0, 10),
      delivery_date: deliveryMatch ? dmyToIso(deliveryMatch[2]) : '',
      currency: currencyMatch?.[1]?.toUpperCase() ?? 'RON',
      notes: notesMatch?.[1]?.trim() ?? '',
      lines,
    };

    return { po, errors, warnings };
  } catch (e: unknown) {
    errors.push(`Eroare neașteptată la parsarea PDF-ului: ${(e as Error).message}`);
    return { po: null, errors, warnings };
  }
}
