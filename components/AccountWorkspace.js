'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, ArrowLeftRight, Edit2, Archive, RotateCcw, Trash2, ArrowRight, Info, ChevronDown, ChevronUp, X } from 'lucide-react';
import { toast } from 'sonner';
import { formatRupiah } from '@/lib/currency';
import { formatCompactDate } from '@/lib/format';
import { archiveAccount, unarchiveAccount, deleteAccountTransfer } from '@/app/actions';
import AccountDialog from './AccountDialog';
import TransferDialog from './TransferDialog';
import ConfirmDialog from './ConfirmDialog';
import ExpenseForm from './ExpenseForm';
import ExtendHistoryDialog from './ExtendHistoryDialog';

export default function AccountWorkspace({
  accounts = [],
  archivedAccounts = [],
  transfers = [],
  unassignedCount = 0,
  currentMonth = null,
  expenseCategories = [],
  incomeCategories = []
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [extendHistoryAccount, setExtendHistoryAccount] = useState(null);
  const [archivingAccount, setArchivingAccount] = useState(null);
  const [isArchiving, setIsArchiving] = useState(false);

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferDefaultFromId, setTransferDefaultFromId] = useState(null);

  const [incomeTargetAccount, setIncomeTargetAccount] = useState(null);

  const [showArchived, setShowArchived] = useState(false);
  const [deletingTransfer, setDeletingTransfer] = useState(null);
  const [isDeletingTransfer, setIsDeletingTransfer] = useState(false);

  const monthQuery = currentMonth ? `?month=${currentMonth}` : '';
  const totalFunds = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);

  // Handle Archive Confirmation
  async function handleConfirmArchive() {
    if (!archivingAccount || isArchiving) return;
    setIsArchiving(true);
    try {
      const res = await archiveAccount(archivingAccount.id);
      if (res && res.success === false) {
        toast.error(res.error || 'Gagal mengarsipkan akun.');
        return;
      }
      toast.success(`Akun "${archivingAccount.name}" berhasil diarsipkan.`);
      setArchivingAccount(null);
    } catch (err) {
      toast.error(err?.message || 'Gagal mengarsipkan akun.');
    } finally {
      setIsArchiving(false);
    }
  }

  // Handle Unarchive
  async function handleUnarchive(acc) {
    try {
      const res = await unarchiveAccount(acc.id);
      if (res && res.success === false) {
        toast.error(res.error || 'Gagal mengaktifkan akun.');
        return;
      }
      toast.success(`Akun "${acc.name}" aktif kembali.`);
    } catch (err) {
      toast.error(err?.message || 'Gagal mengaktifkan akun.');
    }
  }

  // Handle Delete Transfer
  async function handleConfirmDeleteTransfer() {
    if (!deletingTransfer || isDeletingTransfer) return;
    setIsDeletingTransfer(true);
    try {
      const res = await deleteAccountTransfer(deletingTransfer.id);
      if (res && res.success === false) {
        toast.error(res.error || 'Gagal menghapus transfer.');
        return;
      }
      toast.success('Catatan transfer berhasil dihapus.');
      setDeletingTransfer(null);
    } catch (err) {
      toast.error(err?.message || 'Gagal menghapus transfer.');
    } finally {
      setIsDeletingTransfer(false);
    }
  }

  return (
    <div className="accounts-workspace">
      {/* 1. Header */}
      <div className="accounts-page-header">
        <div>
          <h1 className="accounts-page-title">Akun & Dompet</h1>
          <p className="accounts-page-subtitle">
            Lacak lokasi fisik uang kamu — rekening bank, e-wallet, atau uang tunai.
          </p>
        </div>
        <div className="accounts-header-actions">
          <button
            type="button"
            className="btn-cancel btn-action--account"
            onClick={() => setShowTransferModal(true)}
            disabled={accounts.length < 2}
            title={accounts.length < 2 ? 'Perlu minimal 2 akun aktif untuk transfer' : 'Transfer Antar Akun'}
          >
            <ArrowLeftRight size={13} style={{ marginRight: '5px' }} />
            Transfer Antar Akun
          </button>
          <button
            type="button"
            className="btn-submit btn-action--account"
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={13} style={{ marginRight: '5px' }} />
            Tambah Akun
          </button>
        </div>
      </div>

      {/* 2. Total Liquid Assets Banner */}
      <div className="total-funds-card">
        <div className="total-funds-label">TOTAL SALDO SELURUH AKUN</div>
        <div className="total-funds-value">
          {formatRupiah(totalFunds)}
        </div>
      </div>

      {/* 3. Unassigned Transactions Notice (if any) */}
      {unassignedCount > 0 && (
        <div className="unassigned-notice">
          <div className="unassigned-notice-icon">
            <Info size={15} />
          </div>
          <div className="unassigned-notice-content">
            <span className="unassigned-notice-title">
              {unassignedCount} transaksi belum dialokasikan ke akun.
            </span>
            <span className="unassigned-notice-desc">
              Transaksi lama tetap valid dalam perhitungan bulanan, tetapi kelayakan alokasi akun bergantung pada tanggal mulai pelacakan.
            </span>
          </div>
          <Link
            href={`/transaksi${monthQuery}`}
            className="unassigned-notice-link"
            aria-label="Tinjau transaksi yang belum dialokasikan"
          >
            <span>Tinjau transaksi</span>
            <ArrowRight size={12} style={{ marginLeft: '4px' }} />
          </Link>
        </div>
      )}

      {/* 4. Active Accounts List */}
      <div className="accounts-list-section">
        <div className="section-title">DAFTAR AKUN</div>

        {accounts.length === 0 ? (
          <div className="accounts-empty-state">
            <span className="accounts-empty-title">Belum ada akun terdaftar.</span>
            <p className="accounts-empty-desc">
              Tambahkan akun seperti Bank, E-wallet, atau Tunai untuk mulai melacak tempat uang kamu disimpan.
            </p>
            <button
              type="button"
              className="btn-submit btn-submit--sm"
              onClick={() => setShowAddModal(true)}
              style={{ marginTop: '0.75rem' }}
            >
              <Plus size={13} style={{ marginRight: '4px' }} />
              Tambah akun pertama
            </button>
          </div>
        ) : (
          <div className="accounts-table">
            {accounts.map(acc => {
              const sharePct = (totalFunds > 0 && acc.balance >= 0)
                ? Math.round((acc.balance / totalFunds) * 100)
                : null;

              return (
                <div key={acc.id} className="account-row">
                  <div className="account-row-primary">
                    <div className="account-row-title-group">
                      <span className="account-row-name">{acc.name}</span>
                      <span className="account-row-type">{acc.type_label || acc.type}</span>
                    </div>
                    <div className="account-row-meta">
                      <span>Mulai: {formatCompactDate(acc.opening_date)}</span>
                      {acc.opening_balance > 0 && (
                        <>
                          <span className="meta-dot">&middot;</span>
                          <span>Saldo awal: {formatRupiah(acc.opening_balance)}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="account-row-balance-col">
                    <div className={`account-row-balance ${acc.balance < 0 ? 'account-row-balance--negative' : ''}`}>
                      {formatRupiah(acc.balance)}
                    </div>
                    <div className="account-row-share">
                      {sharePct !== null ? `${sharePct}% dari total` : '—'}
                    </div>
                  </div>

                  <div className="account-row-actions">
                    <button
                      type="button"
                      className="btn-row-action btn-row-action--income"
                      title={`Catat pemasukan ke ${acc.name}`}
                      aria-label={`Catat pemasukan ke ${acc.name}`}
                      onClick={() => setIncomeTargetAccount(acc)}
                    >
                      <Plus size={13} />
                      <span className="btn-row-action-text">Catat pemasukan</span>
                    </button>
                    {accounts.length >= 2 && (
                      <button
                        type="button"
                        className="btn-row-action"
                        title={`Transfer dari ${acc.name}`}
                        aria-label={`Transfer dari ${acc.name}`}
                        onClick={() => {
                          setTransferDefaultFromId(acc.id);
                          setShowTransferModal(true);
                        }}
                      >
                        <ArrowLeftRight size={13} />
                        <span className="btn-row-action-text">Transfer</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-row-action"
                      title={`Edit ${acc.name}`}
                      aria-label={`Edit ${acc.name}`}
                      onClick={() => setEditingAccount(acc)}
                    >
                      <Edit2 size={13} />
                      <span className="btn-row-action-text">Edit</span>
                    </button>
                    <button
                      type="button"
                      className="btn-row-action btn-row-action--archive"
                      title={`Arsipkan ${acc.name}`}
                      aria-label={`Arsipkan ${acc.name}`}
                      onClick={() => setArchivingAccount(acc)}
                    >
                      <Archive size={13} />
                      <span className="btn-row-action-text">Arsipkan</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Archived Accounts Section (Collapsible) */}
      {archivedAccounts.length > 0 && (
        <div className="archived-accounts-section">
          <button
            type="button"
            className="archived-toggle-btn"
            onClick={() => setShowArchived(prev => !prev)}
            aria-expanded={showArchived}
          >
            <span>
              {showArchived ? 'Sembunyikan' : 'Tampilkan'} akun diarsipkan ({archivedAccounts.length})
            </span>
            {showArchived ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {showArchived && (
            <div className="archived-accounts-list">
              {archivedAccounts.map(acc => (
                <div key={acc.id} className="account-row account-row--archived">
                  <div className="account-row-primary">
                    <div className="account-row-title-group">
                      <span className="account-row-name">{acc.name}</span>
                      <span className="account-row-type">{acc.type_label || acc.type} · Diarsipkan</span>
                    </div>
                  </div>
                  <div className="account-row-balance-col">
                    <div className="account-row-balance">
                      {formatRupiah(acc.balance)}
                    </div>
                  </div>
                  <div className="account-row-actions">
                    <button
                      type="button"
                      className="btn-row-action"
                      onClick={() => handleUnarchive(acc)}
                      title={`Aktifkan kembali ${acc.name}`}
                      aria-label={`Aktifkan kembali ${acc.name}`}
                    >
                      <RotateCcw size={13} />
                      <span className="btn-row-action-text">Aktifkan</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 6. Transfer Activity Ledger */}
      <div className="transfers-activity-section">
        <div className="section-title">AKTIVITAS TRANSFER</div>

        {transfers.length === 0 ? (
          <div className="transfers-empty-state">
            <span>Belum ada perpindahan dana antar akun pada periode ini.</span>
          </div>
        ) : (
          <div className="transfers-table">
            {transfers.map(tx => (
              <div key={tx.id} className="transfer-row">
                <div className="transfer-row-info">
                  <div className="transfer-row-flow">
                    <span className="transfer-acc-name">{tx.from_account_name}</span>
                    <ArrowRight size={12} className="transfer-arrow" />
                    <span className="transfer-acc-name">{tx.to_account_name}</span>
                  </div>
                  <div className="transfer-row-meta">
                    <span>{formatCompactDate(tx.transfer_date)}</span>
                    {tx.note && (
                      <>
                        <span className="meta-dot">&middot;</span>
                        <span className="transfer-note">{tx.note}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="transfer-row-amount">
                  {formatRupiah(tx.amount)}
                </div>

                <div className="transfer-row-actions">
                  <button
                    type="button"
                    className="btn-action btn-action--danger"
                    title="Hapus transfer"
                    aria-label="Hapus transfer"
                    onClick={() => setDeletingTransfer(tx)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Account Modal */}
      <AccountDialog
        isOpen={showAddModal || !!editingAccount}
        account={editingAccount}
        onClose={() => {
          setShowAddModal(false);
          setEditingAccount(null);
        }}
        onOpenExtendHistory={(acc) => {
          setEditingAccount(null);
          setExtendHistoryAccount(acc);
        }}
      />

      {/* Extend History Dialog */}
      <ExtendHistoryDialog
        isOpen={!!extendHistoryAccount}
        account={extendHistoryAccount}
        onClose={() => setExtendHistoryAccount(null)}
      />

      {/* Transfer Modal */}
      <TransferDialog
        isOpen={showTransferModal}
        accounts={accounts}
        defaultFromId={transferDefaultFromId}
        onClose={() => {
          setShowTransferModal(false);
          setTransferDefaultFromId(null);
        }}
      />

      {/* Confirm Archive Modal */}
      <ConfirmDialog
        isOpen={!!archivingAccount}
        title={`Arsipkan akun "${archivingAccount?.name}"?`}
        description={
          archivingAccount?.balance !== 0
            ? `Akun ini memiliki saldo ${formatRupiah(archivingAccount?.balance || 0)}. Kosongkan saldo akun terlebih dahulu sebelum mengarsipkan.`
            : `Akun yang diarsipkan akan disembunyikan dari pemilihan transaksi baru dan transfer. Riwayat transaksi lama tetap tersimpan. Tindakan ini dapat dibatalkan sewaktu-waktu.`
        }
        confirmLabel="Arsipkan Akun"
        cancelLabel="Batal"
        isDestructive={false}
        isPending={isArchiving}
        onConfirm={handleConfirmArchive}
        onCancel={() => setArchivingAccount(null)}
      />

      {/* Confirm Delete Transfer Modal */}
      <ConfirmDialog
        isOpen={!!deletingTransfer}
        title="Hapus catatan transfer?"
        description={`Transfer sebesar ${formatRupiah(deletingTransfer?.amount || 0)} dari ${deletingTransfer?.from_account_name} ke ${deletingTransfer?.to_account_name} akan dihapus. Saldo kedua akun akan dikembalikan ke posisi sebelum transfer.`}
        confirmLabel="Hapus Transfer"
        cancelLabel="Batal"
        isDestructive={true}
        isPending={isDeletingTransfer}
        onConfirm={handleConfirmDeleteTransfer}
        onCancel={() => setDeletingTransfer(null)}
      />

      {/* Catat Pemasukan Shortcut Modal */}
      {incomeTargetAccount && (
        <div
          className="dialog-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIncomeTargetAccount(null);
          }}
          aria-hidden="true"
        >
          <div
            className="dialog-content"
            role="dialog"
            aria-modal="true"
            aria-label={`Catat Pemasukan — ${incomeTargetAccount.name}`}
          >
            <button
              className="dialog-close"
              onClick={() => setIncomeTargetAccount(null)}
              aria-label="Tutup"
            >
              <X size={18} />
            </button>
            <div className="dialog-title">Catat Pemasukan</div>
            <ExpenseForm
              key={`income-${incomeTargetAccount.id}`}
              initialType="income"
              initialAccountId={incomeTargetAccount.id}
              expenseCategories={expenseCategories}
              incomeCategories={incomeCategories}
              accounts={accounts}
              onSuccess={() => setIncomeTargetAccount(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
