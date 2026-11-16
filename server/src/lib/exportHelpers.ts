/**
 * Export Helpers for PDF and Excel generation.
 * Handles styling, font selection, table layouts, and Uzbek latin characters.
 */
import fs from 'fs';
import ExcelJS from 'exceljs';

// Windows fonts with full Unicode support
const FONT_REGULAR = 'C:/Windows/Fonts/arial.ttf';
const FONT_BOLD = 'C:/Windows/Fonts/arialbd.ttf';

export function setupPdfFonts(doc: PDFKit.PDFDocument) {
  if (fs.existsSync(FONT_REGULAR)) {
    doc.registerFont('CustomRegular', FONT_REGULAR);
    doc.font('CustomRegular');
  }
  if (fs.existsSync(FONT_BOLD)) {
    doc.registerFont('CustomBold', FONT_BOLD);
  }
}

export function getFont(_doc: PDFKit.PDFDocument, isBold = false) {
  if (isBold && fs.existsSync(FONT_BOLD)) return 'CustomBold';
  if (fs.existsSync(FONT_REGULAR)) return 'CustomRegular';
  return isBold ? 'Helvetica-Bold' : 'Helvetica';
}

export const STATUS_LABELS_UZ: Record<string, string> = {
  DRAFT: 'Qoralama',
  SUBMITTED: 'Yuborilgan',
  APPROVED: 'Tasdiqlangan',
  RETURNED: 'Qaytarilgan',
  PRESENT: 'Kelgan',
  ABSENT: 'Kelmagan',
  LATE: 'Kechikkan',
  EXCUSED: 'Sababli',
  PLANNED: 'Rejalashtirilgan',
  ACTIVE: 'Faol',
  COMPLETED: 'Tugallangan',
  CANCELLED: 'Bekor qilingan',
};

export function formatUzStatus(status: string): string {
  return STATUS_LABELS_UZ[status.toUpperCase()] || status;
}

export function drawPdfHeader(
  doc: PDFKit.PDFDocument,
  title: string,
  subtitle?: string,
  metaDetails?: { label: string; value: string }[]
) {
  const pageWidth = doc.page.width;
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  // Header Title bar
  doc
    .rect(margin, 35, contentWidth, 38)
    .fill('#1e293b'); // slate-800

  doc
    .font(getFont(doc, true))
    .fontSize(14)
    .fillColor('#ffffff')
    .text(title.toUpperCase(), margin + 12, 47, { width: contentWidth - 24, align: 'center' });

  let y = 82;

  if (subtitle) {
    doc
      .font(getFont(doc, false))
      .fontSize(10)
      .fillColor('#64748b')
      .text(subtitle, margin, y, { width: contentWidth, align: 'center' });
    y += 18;
  }

  // Meta information box (if provided)
  if (metaDetails && metaDetails.length > 0) {
    const boxHeight = Math.ceil(metaDetails.length / 2) * 16 + 14;
    doc
      .roundedRect(margin, y, contentWidth, boxHeight, 4)
      .fillAndStroke('#f8fafc', '#cbd5e1');

    doc.fillColor('#1e293b');
    let itemIdx = 0;
    for (const item of metaDetails) {
      const col = itemIdx % 2;
      const row = Math.floor(itemIdx / 2);
      const xPos = margin + 12 + col * (contentWidth / 2);
      const yPos = y + 8 + row * 16;

      doc
        .font(getFont(doc, true))
        .fontSize(8.5)
        .fillColor('#475569')
        .text(`${item.label}: `, xPos, yPos, { continued: true })
        .font(getFont(doc, false))
        .fillColor('#0f172a')
        .text(item.value);

      itemIdx++;
    }
    y += boxHeight + 14;
  } else {
    y += 10;
  }

  doc.fillColor('#000000');
  return y;
}

export function drawPdfFooter(doc: PDFKit.PDFDocument) {
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    const bottom = doc.page.height - 30;
    const width = doc.page.width - 80;

    doc
      .strokeColor('#e2e8f0')
      .lineWidth(0.5)
      .moveTo(40, bottom - 6)
      .lineTo(doc.page.width - 40, bottom - 6)
      .stroke();

    doc
      .font(getFont(doc, false))
      .fontSize(8)
      .fillColor('#94a3b8')
      .text(
        `Elektron amaliyot kundaligi tizimi · Chop etilgan sana: ${new Date().toISOString().split('T')[0]}`,
        40,
        bottom,
        { width: width / 2, align: 'left' }
      )
      .text(
        `Sahifa ${i + 1} / ${pages.count}`,
        40 + width / 2,
        bottom,
        { width: width / 2, align: 'right' }
      );
  }
}

export function styleExcelHeader(worksheet: ExcelJS.Worksheet, rowNumber: number) {
  const row = worksheet.getRow(rowNumber);
  row.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' }, // Slate-800
  };
  row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  row.height = 28;
}

export function applyExcelBorders(worksheet: ExcelJS.Worksheet, startRow: number, endRow: number, cols: number) {
  for (let r = startRow; r <= endRow; r++) {
    const row = worksheet.getRow(r);
    for (let c = 1; c <= cols; c++) {
      const cell = row.getCell(c);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      if (r % 2 === 0 && r >= startRow) {
        if (!cell.fill || (cell.fill as any).type !== 'pattern') {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' },
          };
        }
      }
    }
  }
}
