'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Plus } from 'lucide-react';
import { formatRupiah } from '@/lib/currency';
import AccountDialog from './AccountDialog';

export default function AccountOverview({
  accounts = [],
  currentMonth = null
}) {
  const [showAddModal, setShowAddModal] = useState(false);

  const monthQuery = currentMonth ? `?month=${currentMonth}` : '';
  const totalFunds = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
  const displayAccounts = accounts.slice(0, 3);
  const extraCount = Math.max(0, accounts.length - 3);

  return (
    <section className="account-overview-section" aria-labelledby="overview-accounts-heading">
      <div className="account-overview-header">
        <div>
          <h2 id="overview-accounts-heading" className="section-title">
            Akun
          </h2>
        </div>
        {accounts.length > 0 && (
          <Link
            href={`/akun${monthQuery}`}
            className="account-overview-link"
            aria-label="Buka workspace kelola akun"
          >
            <span>Kelola akun</span>
            <ArrowRight size={12} style={{ marginLeft: '3px' }} />
          </Link>
        )}
      </div>

      {accounts.length === 0 ? (
        <div className="account-overview-empty">
          <div className="account-overview-empty-text">
            <span className="account-overview-empty-title">Belum ada akun.</span>
            <p className="account-overview-empty-desc">
              Tambahkan tempat uang disimpan untuk mulai melacak saldo aktual.
            </p>
          </div>
          <button
            type="button"
            className="btn-secondary btn-secondary--sm"
            onClick={() => setShowAddModal(true)}
            aria-label="Tambah akun baru"
          >
            <Plus size={13} style={{ marginRight: '4px' }} />
            Tambah akun
          </button>
        </div>
      ) : (
        <div className="account-overview-surface">
          {/* Total Dana Hero */}
          <div className="account-overview-total-row">
            <span className="account-overview-total-label">Total Dana</span>
            <span className="account-overview-total-val">
              {formatRupiah(totalFunds)}
            </span>
          </div>

          {/* Top 3 Account Rows */}
          <div className="account-overview-list">
            {displayAccounts.map(a => (
              <div key={a.id} className="account-overview-item">
                <div className="account-overview-item-info">
                  <span className="account-overview-item-name">{a.name}</span>
                  <span className="account-overview-item-type">{a.type_label || a.type}</span>
                </div>
                <div className={`account-overview-item-balance ${a.balance < 0 ? 'account-overview-item-balance--negative' : ''}`}>
                  {formatRupiah(a.balance)}
                </div>
              </div>
            ))}
          </div>

          {extraCount > 0 && (
            <div className="account-overview-extra">
              <Link href={`/akun${monthQuery}`} className="account-overview-extra-link">
                +{extraCount} akun lainnya
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Add Account Modal */}
      <AccountDialog
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
      />
    </section>
  );
}
