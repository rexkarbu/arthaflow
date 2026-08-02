'use client';

import { useEffect, useState } from 'react';

const COMPANY_KEY = 'arthaflow-company-name';

export default function ExportPdfButton() {
  const [companyName, setCompanyName] = useState('ArthaFlow');

  useEffect(() => {
    const storedName = window.localStorage.getItem(COMPANY_KEY);
    if (storedName) {
      setCompanyName(storedName);
    }
  }, []);

  function handleExport() {
    const input = window.prompt('Masukkan nama perusahaan / instansi untuk laporan PDF:', companyName);
    const nextName = (input || '').trim() || companyName;

    window.localStorage.setItem(COMPANY_KEY, nextName);
    setCompanyName(nextName);

    const printCompany = document.querySelector('.print-company-name');
    const reportTitle = `${nextName} - Laporan Bulanan - ${new Date().toISOString().slice(0, 10)}`;

    if (printCompany) {
      printCompany.textContent = nextName;
    }

    document.title = reportTitle;
    window.print();
  }

  return (
    <button
      type="button"
      className="export-pdf-btn"
      onClick={handleExport}
      title={`Cetak / Simpan PDF - ${companyName}`}
    >
      Cetak / Simpan PDF
    </button>
  );
}
