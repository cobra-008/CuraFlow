// "Molten" gooey orb loader for the mission-planning wait -- an SVG mask of
// blurred, independently-rotating polygons pushed back to sharp edges via an
// oscillating contrast filter (the classic gooey-effect trick), so the shapes
// inside the orb continuously melt into and separate from each other. Markup
// only -- see index.css's .coord-loader rules for the actual animation.
export function CoordinatingLoader() {
  return (
    <div className="coord-loader">
      <svg width={100} height={100} viewBox="0 0 100 100">
        <defs>
          <linearGradient id="coord-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="30%" stopColor="var(--color-one)" />
            <stop offset="70%" stopColor="var(--color-two)" />
          </linearGradient>
          <filter id="coord-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 15 -5" result="goo" />
          </filter>
        </defs>
        <g filter="url(#coord-goo)" fill="url(#coord-grad)" id="coord-shapes">
          <polygon points="25,25 75,25 50,75" />
          <polygon points="50,25 75,75 25,75" />
          <polygon points="35,35 65,35 50,65" />
          <polygon points="35,35 65,35 50,65" />
          <polygon points="35,35 65,35 50,65" />
          <polygon points="35,35 65,35 50,65" />
        </g>
      </svg>
    </div>
  )
}
