'use client';

export function FormError({ message }: Readonly<{ message: string | null }>) {
  if (!message) return null;
  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        marginBottom: '0.75rem',
        padding: '0.5rem 0.75rem',
        borderRadius: 6,
        border: '1px solid #fecaca',
        background: '#fef2f2',
        color: '#991b1b',
        fontSize: '0.875rem',
      }}
    >
      {message}
    </div>
  );
}
