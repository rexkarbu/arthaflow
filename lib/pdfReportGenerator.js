import { jsPDF } from 'jspdf';
import { formatCompactDate, formatFullDate, formatDateTime, formatMonthLabel } from './format.js';
import { formatRupiah } from './currency.js';

/**
 * Normalizes text to ensure safe rendering in standard jsPDF fonts (WinAnsi/Latin-1).
 * Replaces fancy quotes, dashes, or non-Latin glyphs with safe ASCII equivalents.
 */
export function sanitizePdfText(text) {
  if (!text) return '';
  return String(text)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2026]/g, '...')
    .replace(/[\u00A0]/g, ' ')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, ''); // strip unsupported high-plane chars
}

/**
 * Generates a clean, professional, print-ready A4 Portrait PDF financial report.
 */
export function generateMonthlyPdfReport({
  month,
  transactions = [],
  budget = null,
  categoryBudgets = [],
  generatedAt = new Date()
}) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 18;
  const contentWidth = pageWidth - marginX * 2; // 174mm
  const bottomLimit = 275;

  let y = 20;

  // Colors
  const COLOR_PRIMARY = [20, 25, 22]; // #141916 deep graphite
  const COLOR_SECONDARY = [85, 96, 87]; // #556057 muted slate
  const COLOR_MUTED = [135, 145, 137]; // #879189 subtle
  const COLOR_SAGE = [79, 126, 91]; // #4f7e5b sage green
  const COLOR_TERRACOTTA = [158, 71, 65]; // #9e4741 terracotta red
  const COLOR_BORDER = [220, 225, 220]; // #dce1dc light rule
  const COLOR_BG_SUBTLE = [247, 248, 247]; // #f7f8f7 soft surface

  // 1. Calculations
  let incomeTotal = 0;
  let expenseTotal = 0;
  const categorySpendingMap = {};

  for (const t of transactions) {
    if (t.type === 'income') {
      incomeTotal += t.amount;
    } else {
      expenseTotal += t.amount;
      const cat = t.category || 'Lainnya';
      categorySpendingMap[cat] = (categorySpendingMap[cat] || 0) + t.amount;
    }
  }

  const net = incomeTotal - expenseTotal;

  // Category breakdown list
  const categoryBreakdown = Object.entries(categorySpendingMap)
    .map(([cat, amt]) => ({
      category: cat,
      amount: amt,
      percentage: expenseTotal > 0 ? (amt / expenseTotal) * 100 : 0
    }))
    .sort((a, b) => b.amount - a.amount);

  // Category budgets comparison
  const categoryBudgetStatus = categoryBudgets.map(cb => {
    const spent = categorySpendingMap[cb.category] || 0;
    const remaining = cb.limit - spent;
    const isOver = spent > cb.limit;
    return {
      category: cb.category,
      limit: cb.limit,
      spent,
      remaining,
      isOver
    };
  });

  // Helper for page overflow check
  function ensureSpace(requiredHeight) {
    if (y + requiredHeight > bottomLimit) {
      doc.addPage();
      y = 22;
      drawRunningHeader();
    }
  }

  function drawRunningHeader() {
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_MUTED);
    doc.text('ArthaFlow · LAPORAN KEUANGAN', marginX, 12);
    const rightText = sanitizePdfText(formatMonthLabel(month));
    doc.text(rightText, pageWidth - marginX - doc.getTextWidth(rightText), 12);
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.2);
    doc.line(marginX, 14, pageWidth - marginX, 14);
  }

  // ─── DOCUMENT HEADER ───
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text('ArthaFlow', marginX, y);

  // Sage accent dot
  const wordWidth = doc.getTextWidth('ArthaFlow');
  doc.setTextColor(...COLOR_SAGE);
  doc.text('.', marginX + wordWidth, y);

  // Document Title & Month
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLOR_PRIMARY);
  const docTitle = 'LAPORAN KEUANGAN BULANAN';
  doc.text(docTitle, pageWidth - marginX - doc.getTextWidth(docTitle), y - 2);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_SECONDARY);
  const monthFormatted = sanitizePdfText(formatMonthLabel(month));
  doc.text(monthFormatted, pageWidth - marginX - doc.getTextWidth(monthFormatted), y + 3);

  y += 7;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR_MUTED);
  const genStr = `Dibuat: ${sanitizePdfText(formatDateTime(generatedAt))}`;
  doc.text(genStr, marginX, y);

  y += 4;
  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.3);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 8;

  // ─── SECTION 1: RINGKASAN (SUMMARY) ───
  ensureSpace(28);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...COLOR_SECONDARY);
  doc.text('RINGKASAN KEUANGAN', marginX, y);
  y += 4;

  const colWidth = (contentWidth - 6) / 3;

  // Box 1: Pemasukan
  doc.setFillColor(...COLOR_BG_SUBTLE);
  doc.roundedRect(marginX, y, colWidth, 18, 1, 1, 'F');
  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.2);
  doc.roundedRect(marginX, y, colWidth, 18, 1, 1, 'S');

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR_SECONDARY);
  doc.text('Total Pemasukan', marginX + 3.5, y + 5.5);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...COLOR_SAGE);
  doc.text(`+${formatRupiah(incomeTotal)}`, marginX + 3.5, y + 13);

  // Box 2: Pengeluaran
  const col2X = marginX + colWidth + 3;
  doc.setFillColor(...COLOR_BG_SUBTLE);
  doc.roundedRect(col2X, y, colWidth, 18, 1, 1, 'F');
  doc.setDrawColor(...COLOR_BORDER);
  doc.roundedRect(col2X, y, colWidth, 18, 1, 1, 'S');

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR_SECONDARY);
  doc.text('Total Pengeluaran', col2X + 3.5, y + 5.5);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...COLOR_TERRACOTTA);
  doc.text(`-${formatRupiah(expenseTotal)}`, col2X + 3.5, y + 13);

  // Box 3: Net Cash Flow
  const col3X = marginX + (colWidth + 3) * 2;
  doc.setFillColor(...COLOR_BG_SUBTLE);
  doc.roundedRect(col3X, y, colWidth, 18, 1, 1, 'F');
  doc.setDrawColor(...COLOR_BORDER);
  doc.roundedRect(col3X, y, colWidth, 18, 1, 1, 'S');

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR_SECONDARY);
  doc.text('Arus Kas Bersih (Net)', col3X + 3.5, y + 5.5);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(net >= 0 ? COLOR_PRIMARY[0] : COLOR_TERRACOTTA[0], net >= 0 ? COLOR_PRIMARY[1] : COLOR_TERRACOTTA[1], net >= 0 ? COLOR_PRIMARY[2] : COLOR_TERRACOTTA[2]);
  const netPrefix = net > 0 ? '+' : '';
  doc.text(`${netPrefix}${formatRupiah(net)}`, col3X + 3.5, y + 13);

  y += 24;

  // ─── SECTION 2: BUDGET BULANAN (OVERALL BUDGET) ───
  ensureSpace(24);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...COLOR_SECONDARY);
  doc.text('BUDGET BULAN INI', marginX, y);
  y += 4;

  doc.setFillColor(...COLOR_BG_SUBTLE);
  doc.roundedRect(marginX, y, contentWidth, 16, 1, 1, 'F');
  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.2);
  doc.roundedRect(marginX, y, contentWidth, 16, 1, 1, 'S');

  if (budget !== null && budget > 0) {
    const budgetRemaining = budget - expenseTotal;
    const isBudgetOver = expenseTotal > budget;
    const usedPct = Math.round((expenseTotal / budget) * 100);

    const bColW = contentWidth / 3;

    // Col 1: Limit
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR_SECONDARY);
    doc.text('Batas Budget', marginX + 4, y + 5.5);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...COLOR_PRIMARY);
    doc.text(formatRupiah(budget), marginX + 4, y + 12);

    // Col 2: Digunakan
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR_SECONDARY);
    doc.text(`Digunakan (${usedPct}%)`, marginX + bColW + 4, y + 5.5);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...COLOR_PRIMARY);
    doc.text(formatRupiah(expenseTotal), marginX + bColW + 4, y + 12);

    // Col 3: Status
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR_SECONDARY);
    doc.text(isBudgetOver ? 'Kelebihan Budget' : 'Sisa Budget', marginX + bColW * 2 + 4, y + 5.5);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(isBudgetOver ? COLOR_TERRACOTTA[0] : COLOR_SAGE[0], isBudgetOver ? COLOR_TERRACOTTA[1] : COLOR_SAGE[1], isBudgetOver ? COLOR_TERRACOTTA[2] : COLOR_SAGE[2]);
    doc.text(isBudgetOver ? formatRupiah(expenseTotal - budget) : formatRupiah(budgetRemaining), marginX + bColW * 2 + 4, y + 12);
  } else {
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...COLOR_MUTED);
    doc.text('Budget bulan ini belum ditetapkan.', marginX + 4, y + 9.5);
  }

  y += 22;

  // ─── SECTION 3: PENGELUARAN BERDASARKAN KATEGORI ───
  ensureSpace(25);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...COLOR_SECONDARY);
  doc.text('PENGELUARAN BERDASARKAN KATEGORI', marginX, y);
  y += 4;

  if (categoryBreakdown.length === 0) {
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_MUTED);
    doc.text('Belum ada pengeluaran pada periode ini.', marginX, y + 4);
    y += 10;
  } else {
    // Header
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR_MUTED);
    doc.text('Kategori', marginX, y + 3);
    const pStr = 'Porsi (%)';
    doc.text(pStr, marginX + contentWidth - 45 - doc.getTextWidth(pStr), y + 3);
    const jStr = 'Jumlah (Rp)';
    doc.text(jStr, marginX + contentWidth - doc.getTextWidth(jStr), y + 3);
    y += 5;
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.2);
    doc.line(marginX, y, marginX + contentWidth, y);
    y += 4;

    for (const item of categoryBreakdown) {
      ensureSpace(8);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...COLOR_PRIMARY);
      doc.text(sanitizePdfText(item.category), marginX, y + 2.5);

      const pctText = `${Math.round(item.percentage)}%`;
      doc.setTextColor(...COLOR_SECONDARY);
      doc.text(pctText, marginX + contentWidth - 45 - doc.getTextWidth(pctText), y + 2.5);

      const amtText = formatRupiah(item.amount);
      doc.setTextColor(...COLOR_PRIMARY);
      doc.text(amtText, marginX + contentWidth - doc.getTextWidth(amtText), y + 2.5);

      y += 6;
    }
    y += 4;
  }

  // ─── SECTION 4: BUDGET KATEGORI ───
  if (categoryBudgetStatus.length > 0) {
    ensureSpace(25);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...COLOR_SECONDARY);
    doc.text('BUDGET KATEGORI', marginX, y);
    y += 4;

    // Header
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR_MUTED);
    doc.text('Kategori', marginX, y + 3);
    doc.text('Digunakan', marginX + 60, y + 3);
    doc.text('Batas Limit', marginX + 105, y + 3);
    const stStr = 'Sisa / Kelebihan';
    doc.text(stStr, marginX + contentWidth - doc.getTextWidth(stStr), y + 3);
    y += 5;
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.2);
    doc.line(marginX, y, marginX + contentWidth, y);
    y += 4;

    for (const cb of categoryBudgetStatus) {
      ensureSpace(8);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...COLOR_PRIMARY);
      doc.text(sanitizePdfText(cb.category), marginX, y + 2.5);

      doc.setTextColor(...COLOR_SECONDARY);
      doc.text(formatRupiah(cb.spent), marginX + 60, y + 2.5);
      doc.text(formatRupiah(cb.limit), marginX + 105, y + 2.5);

      const remText = cb.isOver ? `Lebih ${formatRupiah(Math.abs(cb.remaining))}` : formatRupiah(cb.remaining);
      doc.setTextColor(cb.isOver ? COLOR_TERRACOTTA[0] : COLOR_SAGE[0], cb.isOver ? COLOR_TERRACOTTA[1] : COLOR_SAGE[1], cb.isOver ? COLOR_TERRACOTTA[2] : COLOR_SAGE[2]);
      doc.text(remText, marginX + contentWidth - doc.getTextWidth(remText), y + 2.5);

      y += 6;
    }
    y += 4;
  }

  // ─── SECTION 5: DAFTAR TRANSAKSI (LEDGER) ───
  ensureSpace(28);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...COLOR_SECONDARY);
  doc.text(`DAFTAR TRANSAKSI (${transactions.length})`, marginX, y);
  y += 4;

  if (transactions.length === 0) {
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_MUTED);
    doc.text('Belum ada transaksi pada periode ini.', marginX, y + 4);
    y += 10;
  } else {
    function drawTableHeader() {
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...COLOR_MUTED);
      doc.text('Tanggal', marginX, y + 3);
      doc.text('Keterangan & Catatan', marginX + 26, y + 3);
      doc.text('Kategori', marginX + 115, y + 3);
      const amtH = 'Jumlah (Rp)';
      doc.text(amtH, marginX + contentWidth - doc.getTextWidth(amtH), y + 3);
      y += 5;
      doc.setDrawColor(...COLOR_BORDER);
      doc.setLineWidth(0.2);
      doc.line(marginX, y, marginX + contentWidth, y);
      y += 4;
    }

    drawTableHeader();

    for (const t of transactions) {
      // Calculate wrapped text for description + notes
      const descText = sanitizePdfText(t.description);
      const notesText = t.notes ? ` (${sanitizePdfText(t.notes)})` : '';
      const fullDesc = descText + notesText;

      const descLines = doc.splitTextToSize(fullDesc, 84); // 84mm width for description column
      const rowHeight = Math.max(6, descLines.length * 4 + 2);

      if (y + rowHeight > bottomLimit) {
        doc.addPage();
        y = 22;
        drawRunningHeader();
        y += 4;
        drawTableHeader();
      }

      // Date
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...COLOR_SECONDARY);
      const dtFormatted = sanitizePdfText(formatCompactDate(t.date));
      doc.text(dtFormatted, marginX, y + 2.5);

      // Description (wrapped)
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...COLOR_PRIMARY);
      doc.text(descLines, marginX + 26, y + 2.5);

      // Category
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...COLOR_SECONDARY);
      doc.text(sanitizePdfText(t.category || 'Lainnya'), marginX + 115, y + 2.5);

      // Amount
      const isIncome = t.type === 'income';
      const sign = isIncome ? '+' : '-';
      const amtStr = `${sign}${formatRupiah(t.amount)}`;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(isIncome ? COLOR_SAGE[0] : COLOR_PRIMARY[0], isIncome ? COLOR_SAGE[1] : COLOR_PRIMARY[1], isIncome ? COLOR_SAGE[2] : COLOR_PRIMARY[2]);
      doc.text(amtStr, marginX + contentWidth - doc.getTextWidth(amtStr), y + 2.5);

      y += rowHeight;
    }
  }

  // ─── RUNNING FOOTERS ON ALL PAGES ───
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.2);
    doc.line(marginX, pageHeight - 14, pageWidth - marginX, pageHeight - 14);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR_MUTED);
    doc.text('ArthaFlow · Laporan Keuangan Bulanan', marginX, pageHeight - 9);

    const pageStr = `Halaman ${i} dari ${totalPages}`;
    doc.text(pageStr, pageWidth - marginX - doc.getTextWidth(pageStr), pageHeight - 9);
  }

  const arrayBuffer = doc.output('arraybuffer');
  return new Uint8Array(arrayBuffer);
}
