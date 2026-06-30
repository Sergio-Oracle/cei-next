type Variant = 'success' | 'danger' | 'warning' | 'info' | 'secondary'

const icons: Record<Variant, string> = {
  success: 'fa-circle-check',
  danger:  'fa-circle-xmark',
  warning: 'fa-triangle-exclamation',
  info:    'fa-circle-info',
  secondary: 'fa-circle',
}

export default function StatusBadge({ variant, children }: { variant: Variant; children: React.ReactNode }) {
  return (
    <span className={`status-badge ${variant}`}>
      <i className={`fa-solid ${icons[variant]}`} />
      {children}
    </span>
  )
}
