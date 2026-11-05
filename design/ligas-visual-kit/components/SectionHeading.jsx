


export function SectionHeading({ title, aside }) {
  return <header className="pl-section-heading"><h2>{title}</h2>{aside}</header>;
}

/** Scores and winner are provided by the caller; the component does not decide a match. */
