export default function Loading() {
  return (
    <div className="wrap" style={{ pointerEvents: 'none' }}>
      {/* Header Skeleton */}
      <header className="site-header">
        <div className="site-header-left">
          <div className="skeleton" style={{ width: '100px', height: '20px' }}></div>
          <div className="desktop-nav" style={{ gap: '1.25rem' }}>
            <div className="skeleton" style={{ width: '60px', height: '14px' }}></div>
            <div className="skeleton" style={{ width: '60px', height: '14px' }}></div>
            <div className="skeleton" style={{ width: '50px', height: '14px' }}></div>
            <div className="skeleton" style={{ width: '50px', height: '14px' }}></div>
          </div>
        </div>
        <div className="site-header-right">
          <div className="skeleton" style={{ width: '130px', height: '28px', borderRadius: '6px' }}></div>
          <div className="skeleton" style={{ width: '28px', height: '28px', borderRadius: '6px' }}></div>
          <div className="skeleton" style={{ width: '28px', height: '28px', borderRadius: '6px' }}></div>
        </div>
      </header>

      {/* Financial Overview Skeleton */}
      <div className="fin-overview">
        <div className="fin-summary">
          <div className="skeleton" style={{ width: '90px', height: '13px', marginBottom: '8px' }}></div>
          <div className="skeleton" style={{ width: '220px', height: '38px', marginBottom: '14px' }}></div>
          <div className="fin-detail-row">
            <div className="skeleton" style={{ width: '110px', height: '15px' }}></div>
            <div className="skeleton" style={{ width: '110px', height: '15px' }}></div>
          </div>
        </div>

        {/* Budget Bar Skeleton */}
        <div className="budget-section">
          <div className="budget-top">
            <div className="skeleton" style={{ width: '110px', height: '14px' }}></div>
            <div className="skeleton" style={{ width: '75px', height: '22px', borderRadius: '6px' }}></div>
          </div>
          <div className="skeleton" style={{ width: '150px', height: '14px', marginBottom: '8px' }}></div>
          <div className="skeleton" style={{ width: '100%', height: '3px', marginBottom: '8px', borderRadius: '2px' }}></div>
          <div className="skeleton" style={{ width: '80px', height: '12px' }}></div>
        </div>
      </div>

      {/* Monthly Insight Skeleton */}
      <div className="monthly-insight">
        <div className="skeleton" style={{ width: '70px', height: '10px', marginBottom: '6px' }}></div>
        <div className="skeleton" style={{ width: '75%', height: '14px' }}></div>
      </div>

      {/* Analytics Surface Skeleton */}
      <div className="analytics-surface">
        <div className="analytics-grid">
          <div className="trend-chart-section">
            <div className="skeleton" style={{ width: '80px', height: '16px', marginBottom: '14px' }}></div>
            <div className="chart-container" style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', padding: '16px 0' }}>
              {[
                { a: 40, b: 30 },
                { a: 60, b: 20 },
                { a: 50, b: 40 },
                { a: 70, b: 35 },
                { a: 80, b: 50 },
                { a: 65, b: 45 }
              ].map((h, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', gap: '4px', alignItems: 'flex-end', height: '100%' }}>
                  <div className="skeleton" style={{ flex: 1, height: `${h.a}%`, borderRadius: '4px 4px 0 0' }}></div>
                  <div className="skeleton" style={{ flex: 1, height: `${h.b}%`, borderRadius: '4px 4px 0 0' }}></div>
                </div>
              ))}
            </div>
          </div>
          <div className="category-breakdown">
            <div className="skeleton" style={{ width: '120px', height: '16px', marginBottom: '14px' }}></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[1, 2, 3].map(i => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <div className="skeleton" style={{ width: '70px', height: '13px' }}></div>
                    <div className="skeleton" style={{ width: '90px', height: '13px' }}></div>
                  </div>
                  <div className="skeleton" style={{ width: '100%', height: '3px', borderRadius: '2px' }}></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Goals Skeleton */}
      <div className="goals-section">
        <div className="skeleton" style={{ width: '60px', height: '16px', marginBottom: '12px' }}></div>
        <div className="skeleton" style={{ width: '100%', height: '32px', borderRadius: '6px' }}></div>
      </div>

      {/* Transactions Skeleton (Overview Preview) */}
      <div className="transactions-container">
        <div className="txn-header">
          <div className="skeleton" style={{ width: '120px', height: '16px' }}></div>
          <div className="skeleton" style={{ width: '120px', height: '30px', borderRadius: '6px' }}></div>
        </div>
        <div className="expense-list">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="expense-item">
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ width: '45%', height: '14px', marginBottom: '6px' }}></div>
                <div className="skeleton" style={{ width: '25%', height: '11px' }}></div>
              </div>
              <div className="skeleton" style={{ width: '90px', height: '18px' }}></div>
            </div>
          ))}
        </div>
        <div className="txn-preview-footer">
          <div className="skeleton" style={{ width: '110px', height: '12px' }}></div>
          <div className="skeleton" style={{ width: '130px', height: '12px' }}></div>
        </div>
      </div>
    </div>
  );
}
