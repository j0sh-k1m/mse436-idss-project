export default function LockToggle({ locked, label, onToggle }) {
  return (
    <button
      type="button"
      className="lock-toggle"
      aria-pressed={locked}
      aria-label={locked ? `Unlock ${label}` : `Lock ${label}`}
      onClick={onToggle}
    >
      <svg className="icon" role="presentation" aria-hidden="true">
        <use href={`/icons.svg#${locked ? 'lock-closed-icon' : 'lock-open-icon'}`} />
      </svg>
    </button>
  )
}
