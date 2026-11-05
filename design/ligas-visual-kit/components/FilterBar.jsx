


export function FilterBar({ options, value, onChange, label = 'Filtrar jogos' }) {
  return <div role="group" aria-label={label} className="pl-filters">{options.map(option =>
    <button key={option.value} type="button" className="pl-filter" aria-pressed={value === option.value}
      onClick={() => onChange(option.value)} disabled={option.disabled}>
      {option.label}{option.count != null && <span className="pl-filter-count">{option.count}</span>}
    </button>)}</div>;
}
