export default function EmptyState({ icon = 'fa-inbox', message = 'Aucun élément', action }: {
  icon?: string; message?: string; action?: React.ReactNode
}) {
  return (
    <div className="empty-message">
      <i className={`fa-solid ${icon}`} />
      <p>{message}</p>
      {action}
    </div>
  )
}
