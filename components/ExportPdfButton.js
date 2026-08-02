'use client';

export default function ExportPdfButton() {
  function handleExport() {
    document.title = `ArthaFlow-Laporan-${new Date().toISOString().slice(0, 10)}`;
    window.print();
  }

  return (
    <button
      type="button"
      className="export-pdf-btn"
      onClick={handleExport}
    >
      Ekspor PDF
    </button>
  );
}
