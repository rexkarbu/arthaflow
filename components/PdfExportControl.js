'use client';

import { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function PdfExportControl() {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [isGenerating, setIsGenerating] = useState(false);

  async function handleDownload() {
    if (isGenerating) return;
    if (!selectedMonth || !/^\d{4}-(0[1-9]|1[0-2])$/.test(selectedMonth)) {
      toast.error('Pilih bulan yang valid.');
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch(`/api/report-pdf?month=${selectedMonth}`);
      if (!res.ok) {
        const errorText = await res.text();
        toast.error(errorText || 'Laporan belum berhasil dibuat. Coba lagi.');
        return;
      }

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/pdf')) {
        toast.error('Laporan belum berhasil dibuat. Coba lagi.');
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `arthaflow-laporan-${selectedMonth}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF download error:', err);
      toast.error('Laporan belum berhasil dibuat. Coba lagi.');
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="pdf-export-controls">
      <input
        type="month"
        value={selectedMonth}
        onChange={(e) => setSelectedMonth(e.target.value)}
        className="cat-select pdf-month-input"
        aria-label="Pilih bulan laporan PDF"
        disabled={isGenerating}
      />
      <button
        type="button"
        onClick={handleDownload}
        className="btn-secondary btn--sm"
        disabled={isGenerating}
        aria-label="Unduh laporan PDF"
      >
        {isGenerating ? (
          <>
            <Loader2 size={13} className="animate-spin" style={{ marginRight: '6px' }} />
            Membuat laporan...
          </>
        ) : (
          <>
            <FileText size={13} style={{ marginRight: '6px' }} />
            Unduh laporan PDF
          </>
        )}
      </button>
    </div>
  );
}
