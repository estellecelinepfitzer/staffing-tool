'use client';

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="no-print"
      style={{
        display: 'block',
        marginBottom: '24px',
        padding: '8px 16px',
        background: '#111',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        fontSize: '13px',
        cursor: 'pointer',
      }}
    >
      Print / Save as PDF
    </button>
  );
}
