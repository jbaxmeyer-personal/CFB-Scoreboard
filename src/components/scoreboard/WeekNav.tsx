import './WeekNav.css'

interface WeekNavProps {
  label: string
  onPrev: () => void
  onNext: () => void
}

export function WeekNav({ label, onPrev, onNext }: WeekNavProps) {
  return (
    <div className="week-nav">
      <button type="button" className="week-nav__arrow" onClick={onPrev} aria-label="Previous week">
        ‹
      </button>
      <span className="week-nav__label">{label}</span>
      <button type="button" className="week-nav__arrow" onClick={onNext} aria-label="Next week">
        ›
      </button>
    </div>
  )
}
