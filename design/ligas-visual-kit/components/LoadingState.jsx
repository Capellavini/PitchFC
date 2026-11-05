


export function LoadingState({ label = 'A carregar os jogos…' }) {
  return <div className="pl-loading" role="status"><span className="pl-spinner" aria-hidden="true" /><span>{label}</span></div>;
}

/** Native dialog provides focus containment and Escape; caller owns open state. */
