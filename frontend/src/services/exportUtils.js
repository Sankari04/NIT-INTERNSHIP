import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

export function exportToCsv(filename, rows) {
  if (!rows || rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escapeCell = (val) => {
    const str = val === null || val === undefined ? '' : String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csvContent = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escapeCell(r[h])).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
}

export function exportToExcel(filename, rows, sheetName = 'Report') {
  if (!rows || rows.length === 0) return;
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export function exportReportToPdf(title, rows, filename) {
  if (!rows || rows.length === 0) return;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const headers = Object.keys(rows[0]);
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(14);
  doc.text('Demo Snacks Company', 30, 32);
  doc.setFontSize(11);
  doc.text(title, 30, 50);

  let y = 76;
  const colWidth = Math.min(110, (pageWidth - 60) / headers.length);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  headers.forEach((h, i) => {
    doc.text(String(h).slice(0, 16), 30 + i * colWidth, y);
  });
  y += 14;
  doc.line(30, y - 6, pageWidth - 30, y - 6);

  doc.setFont('helvetica', 'normal');
  rows.forEach((row) => {
    if (y > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      y = 40;
    }
    headers.forEach((h, i) => {
      const val = row[h] === null || row[h] === undefined ? '' : String(row[h]);
      doc.text(val.slice(0, 18), 30 + i * colWidth, y);
    });
    y += 15;
  });

  doc.save(`${filename}.pdf`);
}

export function downloadGstInvoicePdf(invoice) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  let y = 45;

  // Company Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.company_name || 'Demo Snacks Company', 40, y);
  y += 18;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.company_address || 'REPLACE_WITH_YOUR_BUSINESS_ADDRESS', 40, y);
  y += 14;
  doc.text(`GSTIN: ${invoice.company_gstin || 'REPLACE_WITH_YOUR_GSTIN'} | State: ${invoice.company_state || 'Tamil Nadu'}`, 40, y);

  // Invoice Title & Meta
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('TAX INVOICE', 430, 45);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Invoice No: ${invoice.invoice_number}`, 400, 63);
  doc.text(`Invoice Date: ${invoice.invoice_date}`, 400, 77);
  doc.text(`Order Ref: ${invoice.order_number}`, 400, 91);
  doc.text(`Status: ${invoice.status}`, 400, 105);

  y += 28;
  doc.line(40, y, 555, y);
  y += 18;

  // Customer Details
  doc.setFont('helvetica', 'bold');
  doc.text('Bill To:', 40, y);
  y += 14;
  doc.setFont('helvetica', 'normal');
  doc.text(`${invoice.customer_name} (${invoice.customer_type})`, 40, y);
  y += 14;
  doc.text(`Address: ${invoice.customer_address || ''}`, 40, y);
  y += 14;
  doc.text(`State: ${invoice.customer_state} | GSTIN: ${invoice.customer_gstin || 'Unregistered'}`, 40, y);

  y += 24;
  doc.line(40, y, 555, y);
  y += 16;

  // Line Items Table Header
  doc.setFont('helvetica', 'bold');
  doc.text('Product', 40, y);
  doc.text('HSN', 195, y);
  doc.text('Qty', 255, y);
  doc.text('Rate', 300, y);
  doc.text('Taxable', 355, y);
  doc.text('GST', 425, y);
  doc.text('Total', 495, y);
  y += 8;
  doc.line(40, y, 555, y);
  y += 16;

  doc.setFont('helvetica', 'normal');
  (invoice.items || []).forEach((item) => {
    const gstAmt = Number(item.cgst_amount || 0) + Number(item.sgst_amount || 0) + Number(item.igst_amount || 0);
    doc.text(String(item.product_name).slice(0, 26), 40, y);
    doc.text(String(item.hsn_code || ''), 195, y);
    doc.text(String(item.quantity), 255, y);
    doc.text(`Rs.${Number(item.unit_price).toFixed(2)}`, 300, y);
    doc.text(`Rs.${Number(item.taxable_amount).toFixed(2)}`, 355, y);
    doc.text(`Rs.${gstAmt.toFixed(2)}`, 425, y);
    doc.text(`Rs.${Number(item.line_total).toFixed(2)}`, 495, y);
    y += 18;
  });

  y += 10;
  doc.line(40, y, 555, y);
  y += 20;

  // Totals
  doc.text(`Taxable Amount: Rs.${Number(invoice.taxable_amount).toFixed(2)}`, 370, y);
  y += 16;
  if (invoice.tax_type === 'CGST_SGST') {
    doc.text(`CGST (2.5%): Rs.${Number(invoice.cgst_amount).toFixed(2)}`, 370, y);
    y += 16;
    doc.text(`SGST (2.5%): Rs.${Number(invoice.sgst_amount).toFixed(2)}`, 370, y);
    y += 16;
  } else {
    doc.text(`IGST (5.0%): Rs.${Number(invoice.igst_amount).toFixed(2)}`, 370, y);
    y += 16;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Grand Total: Rs.${Number(invoice.grand_total).toFixed(2)}`, 370, y);

  if (invoice.status === 'CANCELLED') {
    y += 24;
    doc.setFontSize(10);
    doc.text(`CANCELLED — Credit Note: ${invoice.credit_note_number}`, 40, y);
  }

  y += 40;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    'Note: Generated by academic/prototype Order-to-Audit system with dummy GST details. Not certified for statutory GST filing.',
    40,
    y
  );

  doc.save(`${invoice.invoice_number.replace(/\//g, '-')}.pdf`);
}
