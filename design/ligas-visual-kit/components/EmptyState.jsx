


export function EmptyState({ title, description, action }) {
  return <section className="pl-empty"><span className="pl-empty-field" aria-hidden="true" /><h2>{title}</h2>
    {description && <p>{description}</p>}{action}</section>;
}
