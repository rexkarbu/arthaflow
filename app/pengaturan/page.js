import { getAuthSession, getCurrentUser, logout } from '@/app/actions';
import LoginForm from '@/components/LoginForm';
import PdfExportControl from '@/components/PdfExportControl';
import { Download, LogOut, FileSpreadsheet } from 'lucide-react';

export const metadata = {
  title: 'Pengaturan — ArthaFlow',
  description: 'Kelola sesi dan salinan data ArthaFlow'
};

export default async function PengaturanPage() {
  const userId = await getAuthSession();
  if (!userId) {
    return <LoginForm />;
  }

  const user = await getCurrentUser();
  const username = user?.username || 'Pengguna';

  return (
    <div className="pengaturan-container">
      {/* Page Header */}
      <header className="page-header" style={{ marginBottom: 'var(--space-6)' }}>
        <h1 className="page-title">Pengaturan</h1>
        <p className="page-subtitle">Kelola sesi dan salinan data ArthaFlow.</p>
      </header>

      <div className="pengaturan-sections">
        {/* Section 1: Akun & Sesi */}
        <section className="pengaturan-section">
          <div className="pengaturan-section-header">
            <h2 className="pengaturan-section-title">Akun & Sesi</h2>
          </div>
          <div className="pengaturan-card">
            <div className="pengaturan-row">
              <div className="pengaturan-row-info">
                <span className="pengaturan-label">Masuk sebagai</span>
                <span className="pengaturan-value">{username}</span>
              </div>
            </div>

            <div className="pengaturan-row">
              <div className="pengaturan-row-info">
                <span className="pengaturan-label">Sesi saat ini</span>
                <span className="pengaturan-desc">Akun ini sedang aktif dan digunakan di browser ini.</span>
              </div>
            </div>

            <div className="pengaturan-row pengaturan-row--action">
              <form action={logout}>
                <button type="submit" className="btn-destructive btn--sm">
                  <LogOut size={13} style={{ marginRight: '6px' }} />
                  Keluar dari ArthaFlow
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* Section 2: Data & Backup */}
        <section className="pengaturan-section">
          <div className="pengaturan-section-header">
            <h2 className="pengaturan-section-title">Data & Backup</h2>
          </div>
          <div className="pengaturan-card">
            <div className="pengaturan-row">
              <div className="pengaturan-row-info">
                <span className="pengaturan-label">Backup lengkap (JSON)</span>
                <span className="pengaturan-desc">
                  Unduh salinan data ArthaFlow milik akun ini (kategori, transaksi, budget, dan goals). Password dan token sesi login tidak disertakan.
                </span>
              </div>
              <div className="pengaturan-row-btn">
                <a
                  href="/api/backup"
                  download
                  className="btn-secondary btn--sm"
                  aria-label="Unduh backup JSON"
                >
                  <Download size={13} style={{ marginRight: '6px' }} />
                  Unduh backup JSON
                </a>
              </div>
            </div>

            <div className="pengaturan-row">
              <div className="pengaturan-row-info">
                <span className="pengaturan-label">Semua transaksi (CSV)</span>
                <span className="pengaturan-desc">
                  Unduh seluruh riwayat transaksi akun ini sebagai file spreadsheet CSV untuk analisis mandiri.
                </span>
              </div>
              <div className="pengaturan-row-btn">
                <a
                  href="/api/export-csv"
                  download
                  className="btn-secondary btn--sm"
                  aria-label="Unduh semua transaksi CSV"
                >
                  <FileSpreadsheet size={13} style={{ marginRight: '6px' }} />
                  Unduh semua transaksi CSV
                </a>
              </div>
            </div>

            <div className="pengaturan-row">
              <div className="pengaturan-row-info">
                <span className="pengaturan-label">Laporan keuangan (PDF)</span>
                <span className="pengaturan-desc">
                  Unduh ringkasan pemasukan, pengeluaran, budget, kategori, dan riwayat transaksi untuk bulan yang dipilih.
                </span>
              </div>
              <div className="pengaturan-row-btn">
                <PdfExportControl />
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Tentang Data */}
        <section className="pengaturan-section">
          <div className="pengaturan-section-header">
            <h2 className="pengaturan-section-title">Tentang Data</h2>
          </div>
          <div className="pengaturan-card pengaturan-card--flat">
            <p className="pengaturan-about-text">
              Format tanggal pada antarmuka ditampilkan menggunakan standar Indonesia (<code>id-ID</code>). Seluruh file backup diekspor dengan struktur JSON berversi dan timestamp ISO 8601 untuk memastikan portabilitas data secara universal.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
