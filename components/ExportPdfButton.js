'use client';

export default function ExportPdfButton({ companyName = 'ArthaFlow' }) {
  function handleExport() {
    const reportTitle = `${companyName} - Laporan Bulanan - ${new Date().toISOString().slice(0, 10)}`;
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
