export default function Loading() {
  return (
    <div className="wrap" style={{ pointerEvents: 'none' }}>
      {/* Header Skeleton */}
      <header className="site-header">
        <div>
          <div className="skeleton" style={{ width: '120px', height: '24px' }}></div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <div className="skeleton" style={{ width: '130px', height: '30px', borderRadius: '6px' }}></div>
          <div className="skeleton" style={{ width: '30px', height: '30px', borderRadius: '6px' }}></div>
          <div className="skeleton" style={{ width: '30px', height: '30px', borderRadius: '6px' }}></div>
        </div>
      </header>

      {/* Financial Overview Skeleton */}
      <div className="fin-summary">
        <div className="skeleton" style={{ width: '100px', height: '14px', marginBottom: '8px' }}></div>
        <div className="skeleton" style={{ width: '240px', height: '42px', marginBottom: '16px' }}></div>
        <div className="fin-detail-row">
          <div className="skeleton" style={{ width: '120px', height: '16px' }}></div>
          <div className="skeleton" style={{ width: '120px', height: '16px' }}></div>
        </div>
      </div>

      {/* Budget Bar Skeleton */}
      <div className="budget-section">
        <div className="budget-top">
          <div className="skeleton" style={{ width: '120px', height: '16px' }}></div>
          <div className="skeleton" style={{ width: '80px', height: '24px', borderRadius: '6px' }}></div>
        </div>
        <div className="skeleton" style={{ width: '160px', height: '14px', marginBottom: '8px' }}></div>
        <div className="skeleton" style={{ width: '100%', height: '4px', marginBottom: '8px', borderRadius: '2px' }}></div>
        <div className="skeleton" style={{ width: '200px', height: '12px' }}></div>
      </div>

      {/* Monthly Insight Skeleton */}
      <div className="monthly-insight">
        <div className="skeleton" style={{ width: '80%', height: '16px' }}></div>
      </div>

      {/* Chart Skeleton */}
      <div className="chart-section">
        <div className="skeleton" style={{ width: '80px', height: '18px', marginBottom: '12px' }}></div>
        <div className="chart-container" style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', padding: '16px 0' }}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} style={{ flex: 1, display: 'flex', gap: '4px', alignItems: 'flex-end', height: '100%' }}>
              <div className="skeleton" style={{ flex: 1, height: `${Math.random() * 60 + 20}%`, borderRadius: '4px 4px 0 0' }}></div>
              <div className="skeleton" style={{ flex: 1, height: `${Math.random() * 40 + 10}%`, borderRadius: '4px 4px 0 0' }}></div>
            </div>
          ))}
        </div>
      </div>

      {/* Transactions Skeleton */}
      <div>
        <div className="txn-header">
          <div className="skeleton" style={{ width: '80px', height: '18px' }}></div>
          <div className="skeleton" style={{ width: '120px', height: '32px', borderRadius: '6px' }}></div>
        </div>
        <div className="filter-bar">
          <div className="skeleton" style={{ width: '100%', height: '36px', borderRadius: '6px' }}></div>
        </div>
        <div className="expense-list">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="expense-item">
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ width: '60%', height: '16px', marginBottom: '6px' }}></div>
                <div className="skeleton" style={{ width: '30%', height: '12px' }}></div>
              </div>
              <div className="skeleton" style={{ width: '100px', height: '20px' }}></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
