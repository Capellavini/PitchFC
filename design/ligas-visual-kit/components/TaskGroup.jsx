import { SectionHeading } from './SectionHeading.jsx';

export function TaskGroup({ title, items }) {
  return <section><SectionHeading title={title} aside={<span className="pl-meta">{items.length} assuntos</span>} />
    <ul className="pl-tasks">{items.map(item => <li key={item.id}><button type="button" onClick={item.onClick}
      disabled={!item.onClick} className="pl-task"><span><strong>{item.title}</strong><small>{item.description}</small></span>
      {item.count != null && <span className="pl-task-count">{item.count}</span>}<span aria-hidden="true">↗</span>
    </button></li>)}</ul>
  </section>;
}
