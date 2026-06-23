export default function Loading() {
  return (
    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
      {/* Skeleton Email List Pane */}
      <div style={{ 
        width: '400px', 
        height: '100%', 
        borderRight: '1px solid var(--glass-border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px'
      }}>
        <div className="skeleton-box" style={{ height: '30px', width: '50%', marginBottom: '24px' }} />
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
            <div className="skeleton-box" style={{ height: '16px', width: '40%' }} />
            <div className="skeleton-box" style={{ height: '14px', width: '70%' }} />
            <div className="skeleton-box" style={{ height: '12px', width: '90%' }} />
          </div>
        ))}
      </div>

      {/* Skeleton Reading Pane */}
      <div style={{ flex: 1, height: '100%', padding: '40px', background: 'var(--glass-bg)' }}>
        <div className="skeleton-box" style={{ height: '40px', width: '60%', marginBottom: '32px' }} />
        <div className="skeleton-box" style={{ height: '20px', width: '30%', marginBottom: '16px' }} />
        <div className="skeleton-box" style={{ height: '20px', width: '20%', marginBottom: '40px' }} />
        
        <div className="skeleton-box" style={{ height: '400px', width: '100%' }} />
      </div>
    </div>
  );
}
