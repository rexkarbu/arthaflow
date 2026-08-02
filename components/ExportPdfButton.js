'use client';

import { useEffect, useState } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const COMPANY_KEY = 'arthaflow-company-name';
const LOGO_KEY = 'arthaflow-company-logo';
const APPROVER_KEY = 'arthaflow-report-approver';
const NOTES_KEY = 'arthaflow-report-notes';

const DEFAULT_LOGO = '/arthaflow-brand.svg';

export default function ExportPdfButton() {
  const [companyName, setCompanyName] = useState('ArthaFlow');

  useEffect(() => {
    const storedName = window.localStorage.getItem(COMPANY_KEY);
    const storedLogo = window.localStorage.getItem(LOGO_KEY);
    const storedApprover = window.localStorage.getItem(APPROVER_KEY);
    const storedNotes = window.localStorage.getItem(NOTES_KEY);

    if (storedName) {
      setCompanyName(storedName);
    }

    if (storedLogo) {
      const logoNode = document.querySelector('.print-brand-logo-image');
      if (logoNode) {
        logoNode.src = storedLogo;
      }
    }

    if (storedApprover) {
      const approverNode = document.querySelector('.print-approved-by-value');
      if (approverNode) {
        approverNode.textContent = storedApprover;
      }
    }

    if (storedNotes) {
      const notesNode = document.querySelector('.print-notes-value');
      if (notesNode) {
        notesNode.textContent = storedNotes;
      }
    }
  }, []);

  function updatePrintMetadata(nextName, approver, notes, logoUrl) {
    const printCompany = document.querySelector('.print-company-name');
    const printApprover = document.querySelector('.print-approved-by-value');
    const printNotes = document.querySelector('.print-notes-value');
    const printLogo = document.querySelector('.print-brand-logo-image');

    if (printCompany) {
      printCompany.textContent = nextName;
    }

    if (printApprover) {
      printApprover.textContent = approver;
    }

    if (printNotes) {
      printNotes.textContent = notes;
    }

    if (printLogo) {
      printLogo.src = logoUrl || DEFAULT_LOGO;
    }

    document.title = `${nextName} - Laporan Bulanan - ${new Date().toISOString().slice(0, 10)}`;
  }

  async function saveDirectPdf(nextName, approver, notes, logoUrl) {
    window.localStorage.setItem(COMPANY_KEY, nextName);
    window.localStorage.setItem(APPROVER_KEY, approver);
    window.localStorage.setItem(NOTES_KEY, notes);

    if (logoUrl) {
      window.localStorage.setItem(LOGO_KEY, logoUrl);
    }

    setCompanyName(nextName);
    updatePrintMetadata(nextName, approver, notes, logoUrl || DEFAULT_LOGO);

    const exportRoot = document.querySelector('.print-report-export-root');
    if (!exportRoot) {
      return;
    }

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const pageCanvasHeight = Math.floor(pdfHeight * (2.2));

    const canvas = await html2canvas(exportRoot, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      windowWidth: exportRoot.scrollWidth,
      windowHeight: exportRoot.scrollHeight,
    });

    const totalHeight = canvas.height;
    const pixelsPerMm = canvas.width / pdfWidth;
    const pageCropHeight = Math.max(1, Math.floor(pdfHeight * pixelsPerMm));
    let currentY = 0;
    let pageIndex = 0;

    while (currentY < totalHeight) {
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = Math.min(pageCropHeight, totalHeight - currentY);
      const ctx = pageCanvas.getContext('2d');

      ctx.drawImage(
        canvas,
        0,
        currentY,
        canvas.width,
        pageCanvas.height,
        0,
        0,
        canvas.width,
        pageCanvas.height,
      );

      const imageData = pageCanvas.toDataURL('image/png');

      if (pageIndex > 0) {
        pdf.addPage();
      }

      pdf.addImage(imageData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      currentY += pageCropHeight;
      pageIndex += 1;
    }

    pdf.save(`${nextName.replace(/\s+/g, '-').toLowerCase()}-laporan-bulanan-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  function handleExport() {
    const defaultApprover = window.localStorage.getItem(APPROVER_KEY) || 'Manajer Keuangan';
    const defaultNotes = window.localStorage.getItem(NOTES_KEY) || 'Laporan disiapkan untuk keperluan audit internal dan arsip akuntansi.';
    const storedName = window.localStorage.getItem(COMPANY_KEY) || companyName;

    const input = window.prompt('Masukkan nama perusahaan / instansi untuk laporan PDF:', storedName);
    const nextName = (input || '').trim() || storedName;

    const approverInput = window.prompt('Masukkan nama yang menyetujui laporan:', defaultApprover);
    const approver = (approverInput || '').trim() || defaultApprover;

    const notesInput = window.prompt('Masukkan catatan pada footer laporan:', defaultNotes);
    const notes = (notesInput || '').trim() || defaultNotes;

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) {
        await saveDirectPdf(nextName, approver, notes, window.localStorage.getItem(LOGO_KEY) || DEFAULT_LOGO);
        return;
      }

      const reader = new FileReader();
      reader.onload = async () => {
        const logoDataUrl = typeof reader.result === 'string' ? reader.result : DEFAULT_LOGO;
        await saveDirectPdf(nextName, approver, notes, logoDataUrl);
      };
      reader.readAsDataURL(file);
    });

    document.body.appendChild(fileInput);
    fileInput.click();
    fileInput.remove();
  }

  return (
    <button
      type="button"
      className="export-pdf-btn"
      onClick={handleExport}
      title={`Simpan PDF - ${companyName}`}
    >
      Simpan PDF
    </button>
  );
}
