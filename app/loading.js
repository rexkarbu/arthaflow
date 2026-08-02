export default function Loading() {
  return (
    <div className="wrap" style={{ pointerEvents: 'none' }}>
      {/* Header Skeleton */}
      <header className="site-header">
        <div>
          <div className="skeleton" style={{ width: '150px', height: '24px', marginBottom: '8px' }}></div>
          <div className="skeleton" style={{ width: '100px', height: '14px' }}></div>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div className="skeleton" style={{ width: '120px', height: '36px', borderRadius: '6px' }}></div>
          <div className="skeleton" style={{ width: '36px', height: '36px', borderRadius: '50%' }}></div>
        </div>
      </header>

      {/* Ringkasan Skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="total-card" style={{ marginBottom: 0 }}>
            <div className="skeleton" style={{ width: '100px', height: '12px', marginBottom: '1rem' }}></div>
            <div className="skeleton" style={{ width: '80%', height: '32px', marginBottom: '0.5rem' }}></div>
            <div className="skeleton" style={{ width: '120px', height: '12px' }}></div>
          </div>
        ))}
      </div>

      {/* Budget Bar Skeleton */}
      <div className="budget-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <div className="skeleton" style={{ width: '120px', height: '12px', marginBottom: '1rem' }}></div>
          <div className="skeleton" style={{ width: '100%', height: '4px', marginBottom: '0.5rem' }}></div>
          <div className="skeleton" style={{ width: '200px', height: '12px' }}></div>
        </div>
      </div>

      {/* Main Grid Skeleton */}
      <div className="main-grid">
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Form Skeleton */}
          <div className="card">
            <div className="card-head">
               <div className="skeleton" style={{ width: '80px', height: '14px' }}></div>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="skeleton" style={{ width: '100%', height: '36px' }}></div>
              <div className="skeleton" style={{ width: '100%', height: '36px' }}></div>
              <div className="skeleton" style={{ width: '100%', height: '36px' }}></div>
              <div className="skeleton" style={{ width: '100%', height: '42px', marginTop: '0.5rem' }}></div>
            </div>
          </div>
          {/* Chart Skeleton */}
          <div className="card">
             <div className="card-body" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '250px' }}>
                <div className="skeleton" style={{ width: '180px', height: '180px', borderRadius: '50%' }}></div>
             </div>
          </div>
        </aside>

        <main>
          {/* Filter Bar Skeleton */}
          <div className="filter-bar" style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
            <div className="skeleton" style={{ width: '100%', height: '36px', flex: 1 }}></div>
          </div>
          
          {/* List Skeleton */}
          <div className="list-head">
             <div className="skeleton" style={{ width: '100px', height: '14px' }}></div>
             <div className="skeleton" style={{ width: '150px', height: '14px' }}></div>
          </div>

          <div className="expense-list">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="expense-item" style={{ padding: '1rem', borderBottom: '1px solid var(--border)' }}>
                <div className="skeleton" style={{ width: '40px', height: '40px', borderRadius: '8px', marginRight: '1rem' }}></div>
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ width: '60%', height: '16px', marginBottom: '8px' }}></div>
                  <div className="skeleton" style={{ width: '30%', height: '12px' }}></div>
                </div>
                <div className="skeleton" style={{ width: '100px', height: '20px' }}></div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
