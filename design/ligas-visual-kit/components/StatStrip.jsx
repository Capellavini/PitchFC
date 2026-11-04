


export function StatStrip({ items }) {
  return <dl className="pl-stats">{items.map(item => <div key={item.label}>
    <dt>{item.label}</dt><dd>{item.value}</dd>{item.detail && <dd className="pl-stat-detail">{item.detail}</dd>}
  </div>)}</dl>;
}
