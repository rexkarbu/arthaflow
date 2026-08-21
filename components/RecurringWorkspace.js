'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Plus, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  ChevronDown, 
  ChevronRight, 
  ArrowLeft,
  Pause,
  Play,
  Archive,
  Edit2,
  AlertTriangle
} from 'lucide-react';
import { formatRupiah } from '@/lib/currency';
import { formatCompactDate } from '@/lib/format';
import RecurringRuleDialog from './RecurringRuleDialog';
import RecordOccurrenceDialog from './RecordOccurrenceDialog';
import ConfirmDialog from './ConfirmDialog';
import { 
  pauseRecurringRule, 
  resumeRecurringRule, 
  archiveRecurringRule, 
  skipRecurringOccurrence 
} from '@/app/actions';
import { toast } from 'sonner';

export default function RecurringWorkspace({
  rules = [],
  occurrences = { pending: [], resolved: [] },
  categories = [],
  accounts = [],
  currentMonth
}) {
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);

  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [recordingOccurrence, setRecordingOccurrence] = useState(null);

  const [confirmDialogState, setConfirmDialogState] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const [showPaused, setShowPaused] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  const monthQuery = currentMonth ? `?month=${currentMonth}` : '';

  // Group rules by status
  const activeRules = rules.filter(r => r.status === 'ACTIVE');
  const pausedRules = rules.filter(r => r.status === 'PAUSED');
  const archivedRules = rules.filter(r => r.status === 'ARCHIVED');

  const pendingOccurrences = occurrences.pending || [];
  const resolvedOccurrences = occurrences.resolved || [];

  const handleOpenCreateRule = () => {
    setEditingRule(null);
    setRuleModalOpen(true);
  };

  const handleOpenEditRule = (rule) => {
    setEditingRule(rule);
    setRuleModalOpen(true);
  };

  const handleOpenRecord = (occ) => {
    setRecordingOccurrence(occ);
    setRecordModalOpen(true);
  };

  const handlePauseRule = (rule) => {
    setConfirmDialogState({
      isOpen: true,
      title: `Jeda Jadwal ${rule.name}`,
      message: `Jeda jadwal rutin "${rule.name}"? Pembuatan jadwal berikutnya akan dihentikan sementara sampai diaktifkan kembali.`,
      onConfirm: async () => {
        try {
          const res = await pauseRecurringRule(rule.id);
          if (res && res.success === false) {
            toast.error(res.error || 'Gagal menjeda jadwal.');
          } else {
            toast.success(`Jadwal "${rule.name}" dijeda.`);
          }
        } catch {
          toast.error('Gagal menjeda jadwal.');
        }
      }
    });
  };

  const handleResumeRule = async (rule) => {
    try {
      const res = await resumeRecurringRule(rule.id);
      if (res && res.success === false) {
        toast.error(res.error || 'Gagal mengaktifkan kembali jadwal.');
      } else {
        toast.success(`Jadwal "${rule.name}" aktif kembali.`);
      }
    } catch {
      toast.error('Gagal mengaktifkan kembali jadwal.');
    }
  };

  const handleArchiveRule = (rule) => {
    setConfirmDialogState({
      isOpen: true,
      title: `Arsipkan Jadwal ${rule.name}`,
      message: `Arsipkan jadwal rutin "${rule.name}"? Jadwal tidak akan membuat transaksi baru lagi, namun riwayat transaksi yang pernah dicatat tetap tersimpan.`,
      onConfirm: async () => {
        try {
          const res = await archiveRecurringRule(rule.id);
          if (res && res.success === false) {
            toast.error(res.error || 'Gagal mengarsipkan jadwal.');
          } else {
            toast.success(`Jadwal "${rule.name}" diarsipkan.`);
          }
        } catch {
          toast.error('Gagal mengarsipkan jadwal.');
        }
      }
    });
  };

  const handleSkipOccurrence = (occ) => {
    setConfirmDialogState({
      isOpen: true,
      title: `Lewati Transaksi Rutin`,
      message: `Lewati "${occ.name}" untuk periode ${formatCompactDate(occ.due_date)}? Tindakan ini tidak mencatat pengeluaran/pemasukan apa pun ke buku kas.`,
      onConfirm: async () => {
        try {
          const res = await skipRecurringOccurrence(occ.id);
          if (res && res.success === false) {
            toast.error(res.error || 'Gagal melewati transaksi rutin.');
          } else {
            toast.success(`Transaksi "${occ.name}" dilewati.`);
          }
        } catch {
          toast.error('Gagal melewati transaksi rutin.');
        }
      }
    });
  };

  const formatSchedule = (rule) => {
    if (rule.frequency === 'monthly') {
      return `Setiap tanggal ${rule.day_of_month || 1}`;
    }
    const days = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
    return `Setiap ${days[rule.day_of_week] || 'hari'}`;
  };

  return (
    <div className="recurring-workspace">
      {/* Top Breadcrumb / Back Link */}
      <div style={{ marginBottom: '0.85rem' }}>
        <Link 
          href={`/transaksi${monthQuery}`} 
          className="btn-extend-history-link"
          style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}
        >
          <ArrowLeft size={14} /> Kembali ke Transaksi
        </Link>
      </div>

      {/* Header Bar */}
      <div className="recurring-header">
        <div>
          <h1 className="recurring-title">Transaksi Rutin</h1>
          <p className="recurring-desc">
            Kelola jadwal pemasukan dan tagihan berulang. Catat transaksi ke buku kas secara manual saat jatuh tempo tiba.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleOpenCreateRule}
        >
          <Plus size={16} /> Tambah Rutin
        </button>
      </div>

      {/* ======================================================== */}
      {/* SECTION 1: PERLU DICATAT (Priority Queue)                 */}
      {/* ======================================================== */}
      <section className="recurring-section" aria-labelledby="due-queue-title">
        <div className="recurring-section-header">
          <h2 id="due-queue-title" className="recurring-section-title">
            Perlu Dicatat
            {pendingOccurrences.length > 0 && (
              <span className="recurring-badge-count">{pendingOccurrences.length}</span>
            )}
          </h2>
        </div>

        {pendingOccurrences.length === 0 ? (
          <div className="recurring-empty-card">
            <CheckCircle2 size={24} className="recurring-empty-icon" />
            <div className="recurring-empty-text">Semua transaksi rutin telah tercatat atau belum ada yang jatuh tempo.</div>
          </div>
        ) : (
          <div className="due-queue-list">
            {pendingOccurrences.map(occ => (
              <div key={occ.id} className={`due-queue-row ${occ.is_overdue ? 'due-queue-row--overdue' : ''}`}>
                <div className="due-row-primary">
                  <div className="due-row-header">
                    <span className="due-row-name">{occ.name}</span>
                    <span className="due-row-type-tag">
                      {occ.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                    </span>
                  </div>
                  <div className="due-row-meta">
                    <span className="due-meta-item">{occ.category}</span>
                    {occ.account_name && (
                      <>
                        <span className="due-meta-dot">·</span>
                        <span className="due-meta-item">{occ.account_name}</span>
                      </>
                    )}
                    <span className="due-meta-dot">·</span>
                    <span className="due-meta-date">
                      {formatCompactDate(occ.due_date)}
                    </span>
                  </div>
                </div>

                <div className="due-row-status-col">
                  {occ.is_overdue ? (
                    <span className="due-status-chip due-status-chip--overdue">
                      <AlertTriangle size={12} /> Terlambat {occ.days_overdue} hari
                    </span>
                  ) : occ.is_due_today ? (
                    <span className="due-status-chip due-status-chip--today">
                      <Clock size={12} /> Hari ini
                    </span>
                  ) : (
                    <span className="due-status-chip">
                      <Calendar size={12} /> Jatuh tempo
                    </span>
                  )}
                </div>

                <div className="due-row-amount-col">
                  <span className="due-row-amount">
                    {formatRupiah(occ.amount)}
                  </span>
                </div>

                <div className="due-row-actions">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleOpenRecord(occ)}
                  >
                    Catat
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleSkipOccurrence(occ)}
                  >
                    Lewati
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ======================================================== */}
      {/* SECTION 2: JADWAL AKTIF (Active Schedules)                */}
      {/* ======================================================== */}
      <section className="recurring-section" aria-labelledby="active-rules-title">
        <div className="recurring-section-header">
          <h2 id="active-rules-title" className="recurring-section-title">
            Jadwal Aktif
            {activeRules.length > 0 && (
              <span className="recurring-badge-count">{activeRules.length}</span>
            )}
          </h2>
        </div>

        {activeRules.length === 0 ? (
          <div className="recurring-empty-card">
            <div className="recurring-empty-text">Belum ada jadwal rutin aktif. Klik &quot;+ Tambah Rutin&quot; untuk membuat jadwal.</div>
          </div>
        ) : (
          <div className="rule-list-card">
            <div className="rule-table-header">
              <div className="rule-col rule-col--name">Nama & Kategori</div>
              <div className="rule-col rule-col--schedule">Jadwal</div>
              <div className="rule-col rule-col--account">Akun</div>
              <div className="rule-col rule-col--next">Berikutnya</div>
              <div className="rule-col rule-col--amount">Jumlah</div>
              <div className="rule-col rule-col--actions">Aksi</div>
            </div>

            {activeRules.map(rule => (
              <div key={rule.id} className="rule-row">
                <div className="rule-col rule-col--name">
                  <div className="rule-name">{rule.name}</div>
                  <div className="rule-cat-meta">{rule.category}</div>
                </div>

                <div className="rule-col rule-col--schedule">
                  <span className="rule-schedule-text">{formatSchedule(rule)}</span>
                </div>

                <div className="rule-col rule-col--account">
                  <span className="rule-account-text">
                    {rule.account_name || <span style={{ color: 'var(--text-muted)' }}>Belum dialokasikan</span>}
                  </span>
                </div>

                <div className="rule-col rule-col--next">
                  <span className="rule-next-text">
                    {rule.next_due_date ? formatCompactDate(rule.next_due_date) : '-'}
                  </span>
                </div>

                <div className="rule-col rule-col--amount">
                  <span className="rule-amount-text">
                    {formatRupiah(rule.amount)}
                  </span>
                </div>

                <div className="rule-col rule-col--actions">
                  <button
                    className="btn-rule-action"
                    onClick={() => handleOpenEditRule(rule)}
                    title="Edit Jadwal"
                    aria-label={`Edit ${rule.name}`}
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    className="btn-rule-action"
                    onClick={() => handlePauseRule(rule)}
                    title="Jeda Jadwal"
                    aria-label={`Jeda ${rule.name}`}
                  >
                    <Pause size={13} />
                  </button>
                  <button
                    className="btn-rule-action btn-rule-action--archive"
                    onClick={() => handleArchiveRule(rule)}
                    title="Arsipkan Jadwal"
                    aria-label={`Arsipkan ${rule.name}`}
                  >
                    <Archive size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ======================================================== */}
      {/* SECTION 3: DIJEDA (Collapsible)                          */}
      {/* ======================================================== */}
      {pausedRules.length > 0 && (
        <section className="recurring-collapsible-section">
          <button
            className="collapsible-toggle-btn"
            onClick={() => setShowPaused(!showPaused)}
            aria-expanded={showPaused}
          >
            {showPaused ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span>Dijeda ({pausedRules.length})</span>
          </button>

          {showPaused && (
            <div className="rule-list-card" style={{ marginTop: '0.65rem' }}>
              {pausedRules.map(rule => (
                <div key={rule.id} className="rule-row rule-row--paused">
                  <div className="rule-col rule-col--name">
                    <div className="rule-name">{rule.name}</div>
                    <div className="rule-cat-meta">{rule.category} · Dijeda</div>
                  </div>

                  <div className="rule-col rule-col--schedule">
                    <span className="rule-schedule-text">{formatSchedule(rule)}</span>
                  </div>

                  <div className="rule-col rule-col--account">
                    <span className="rule-account-text">{rule.account_name || '-'}</span>
                  </div>

                  <div className="rule-col rule-col--next">
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>Dijeda</span>
                  </div>

                  <div className="rule-col rule-col--amount">
                    <span className="rule-amount-text" style={{ color: 'var(--text-secondary)' }}>
                      {formatRupiah(rule.amount)}
                    </span>
                  </div>

                  <div className="rule-col rule-col--actions">
                    <button
                      className="btn-rule-action btn-rule-action--resume"
                      onClick={() => handleResumeRule(rule)}
                      title="Aktifkan Kembali"
                      aria-label={`Aktifkan kembali ${rule.name}`}
                    >
                      <Play size={13} />
                    </button>
                    <button
                      className="btn-rule-action"
                      onClick={() => handleOpenEditRule(rule)}
                      title="Edit Jadwal"
                      aria-label={`Edit ${rule.name}`}
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      className="btn-rule-action btn-rule-action--archive"
                      onClick={() => handleArchiveRule(rule)}
                      title="Arsipkan Jadwal"
                      aria-label={`Arsipkan ${rule.name}`}
                    >
                      <Archive size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ======================================================== */}
      {/* SECTION 4: DIARSIPKAN (Collapsible)                      */}
      {/* ======================================================== */}
      {archivedRules.length > 0 && (
        <section className="recurring-collapsible-section">
          <button
            className="collapsible-toggle-btn"
            onClick={() => setShowArchived(!showArchived)}
            aria-expanded={showArchived}
          >
            {showArchived ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span>Diarsipkan ({archivedRules.length})</span>
          </button>

          {showArchived && (
            <div className="rule-list-card" style={{ marginTop: '0.65rem' }}>
              {archivedRules.map(rule => (
                <div key={rule.id} className="rule-row rule-row--archived">
                  <div className="rule-col rule-col--name">
                    <div className="rule-name" style={{ color: 'var(--text-muted)' }}>{rule.name}</div>
                    <div className="rule-cat-meta">{rule.category} · Diarsipkan</div>
                  </div>

                  <div className="rule-col rule-col--schedule">
                    <span className="rule-schedule-text">{formatSchedule(rule)}</span>
                  </div>

                  <div className="rule-col rule-col--account">
                    <span className="rule-account-text">{rule.account_name || '-'}</span>
                  </div>

                  <div className="rule-col rule-col--next">
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>Nonaktif</span>
                  </div>

                  <div className="rule-col rule-col--amount">
                    <span className="rule-amount-text" style={{ color: 'var(--text-muted)' }}>
                      {formatRupiah(rule.amount)}
                    </span>
                  </div>

                  <div className="rule-col rule-col--actions">
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Arsip</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ======================================================== */}
      {/* SECTION 5: RIWAYAT SELESAI (Collapsible Resolved History) */}
      {/* ======================================================== */}
      {resolvedOccurrences.length > 0 && (
        <section className="recurring-collapsible-section" style={{ marginTop: '1.5rem', marginBottom: '2.5rem' }}>
          <button
            className="collapsible-toggle-btn"
            onClick={() => setShowResolved(!showResolved)}
            aria-expanded={showResolved}
          >
            {showResolved ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span>Riwayat Selesai ({resolvedOccurrences.length})</span>
          </button>

          {showResolved && (
            <div className="rule-list-card" style={{ marginTop: '0.65rem' }}>
              {resolvedOccurrences.map(occ => (
                <div key={occ.id} className="rule-row" style={{ opacity: 0.85 }}>
                  <div className="rule-col rule-col--name">
                    <div className="rule-name">{occ.name}</div>
                    <div className="rule-cat-meta">
                      {occ.category} {occ.account_name ? `· ${occ.account_name}` : ''}
                    </div>
                  </div>

                  <div className="rule-col rule-col--schedule">
                    <span className="rule-schedule-text">{formatCompactDate(occ.due_date)}</span>
                  </div>

                  <div className="rule-col rule-col--account">
                    {occ.status === 'POSTED' ? (
                      <span className="due-status-chip due-status-chip--posted" style={{ display: 'inline-flex' }}>
                        <CheckCircle2 size={11} /> Sudah dicatat
                      </span>
                    ) : (
                      <span className="due-status-chip" style={{ display: 'inline-flex', opacity: 0.7 }}>
                        Dilewati
                      </span>
                    )}
                  </div>

                  <div className="rule-col rule-col--next">
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {occ.resolved_at ? formatCompactDate(occ.resolved_at) : '-'}
                    </span>
                  </div>

                  <div className="rule-col rule-col--amount">
                    <span className="rule-amount-text">
                      {formatRupiah(occ.amount)}
                    </span>
                  </div>

                  <div className="rule-col rule-col--actions">
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Selesai</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Dialogs */}
      <RecurringRuleDialog
        isOpen={ruleModalOpen}
        onClose={() => setRuleModalOpen(false)}
        rule={editingRule}
        categories={categories}
        accounts={accounts}
      />

      <RecordOccurrenceDialog
        isOpen={recordModalOpen}
        onClose={() => setRecordModalOpen(false)}
        occurrence={recordingOccurrence}
        categories={categories}
        accounts={accounts}
      />

      <ConfirmDialog
        isOpen={confirmDialogState.isOpen}
        onClose={() => setConfirmDialogState({ ...confirmDialogState, isOpen: false })}
        onConfirm={confirmDialogState.onConfirm}
        title={confirmDialogState.title}
        message={confirmDialogState.message}
        confirmText="Lanjutkan"
        cancelText="Batal"
      />
    </div>
  );
}
