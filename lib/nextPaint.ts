/**
 * Resolve once the browser has had a chance to paint what is currently in the
 * DOM. Use it before long synchronous work so a loading indicator is on screen
 * first. Falls back to a timer because animation frames do not fire in a
 * background tab.
 */
export function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, 100)
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        clearTimeout(timer)
        resolve()
      }),
    )
  })
}
