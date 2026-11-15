import { maxColumns, TIMELINE_HEIGHT } from './layout'
import {
  drawPreview,
  type PreparedImage,
  prepareImage,
  renderStrips,
  type StripResult,
  toFiles,
} from './render'

/** The most images X accepts in one post. */
const COLUMN_LIMIT = 20
const MIN_COLUMNS = 2

const STYLE = `
  :host { all: initial; }
  .backdrop {
    position: fixed; inset: 0; z-index: 2147483647;
    display: flex; align-items: center; justify-content: center;
    background: rgba(91, 112, 131, 0.4);
    font: 14px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: var(--text);
  }
  .panel {
    box-sizing: border-box; display: flex; flex-direction: column;
    width: min(640px, calc(100vw - 32px)); max-height: calc(100dvh - 32px);
    overflow-y: auto;
    padding: 20px; border-radius: 16px; background: var(--page);
    border: 1px solid var(--border);
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.3);
  }
  h2 { margin: 0 0 12px; font-size: 18px; }
  /* The preview takes whatever height the controls and buttons leave, so
     everything stays on screen on a phone; object-fit keeps its proportions
     when the width runs out first. */
  .preview {
    display: flex; align-items: center; justify-content: center;
    height: clamp(160px, calc(100dvh - 300px), 420px);
  }
  canvas {
    display: block; width: auto; height: 100%; max-width: 100%; object-fit: contain;
  }
  .status { min-height: 20px; margin: 12px 0; color: var(--muted); }
  .status.error { color: #f4212e; }
  label { display: flex; align-items: center; gap: 8px; }
  input[type='range'] { flex: 1; min-width: 0; }
  output { min-width: 2ch; text-align: right; font-variant-numeric: tabular-nums; }
  footer { display: flex; justify-content: flex-end; gap: 12px; margin-top: 16px; }
  button {
    min-height: 36px; padding: 0 16px; border-radius: 9999px;
    border: 1px solid var(--border-strong); background: transparent;
    color: inherit; font: inherit; font-weight: 700; cursor: pointer;
  }
  button.primary { border-color: var(--text); background: var(--text); color: var(--page); }
  button:disabled { opacity: 0.5; cursor: default; }

  @media (max-width: 600px) {
    .backdrop { align-items: flex-end; }
    .panel {
      width: 100%; max-height: 100dvh; padding: 16px;
      padding-bottom: max(16px, env(safe-area-inset-bottom));
      border-radius: 16px 16px 0 0; border-width: 1px 0 0;
    }
    footer button { flex: 1; min-height: 44px; }
  }
`

/** X has a light theme and two dark ones; read whichever is in use. */
function readTheme(): { page: string; dark: boolean } {
  const page = getComputedStyle(document.body).backgroundColor
  const [r, g, b] = (page.match(/[\d.]+/g) ?? ['255', '255', '255']).map(Number)
  return { page, dark: 0.299 * r + 0.587 * g + 0.114 * b < 128 }
}

/**
 * Let the user turn one picture into a set of strips. Resolves with the
 * files to upload, in order, or null if the dialog was dismissed.
 */
export function openStripDialog(file: File): Promise<File[] | null> {
  return new Promise((resolve) => {
    const theme = readTheme()
    const host = document.createElement('div')
    host.style.setProperty('--page', theme.page)
    host.style.setProperty('--text', theme.dark ? '#e7e9ea' : '#0f1419')
    host.style.setProperty('--muted', theme.dark ? '#8b98a5' : '#536471')
    host.style.setProperty('--border', theme.dark ? '#2f3336' : '#cfd9de')
    host.style.setProperty('--border-strong', theme.dark ? '#536471' : '#cfd9de')
    const root = host.attachShadow({ mode: 'open' })
    root.innerHTML = `
      <style>${STYLE}</style>
      <div class="backdrop">
        <div class="panel" role="dialog" aria-modal="true" aria-label="Strips">
          <h2>Strips</h2>
          <div class="preview"><canvas></canvas></div>
          <div class="status" role="status"></div>
          <label>Columns <input type="range" class="columns" min="${MIN_COLUMNS}" max="${COLUMN_LIMIT}" value="8" disabled /><output>8</output></label>
          <footer>
            <button type="button" class="cancel">Cancel</button>
            <button type="button" class="primary" disabled>Add to post</button>
          </footer>
        </div>
      </div>
    `
    const $ = <T extends Element>(selector: string) =>
      root.querySelector<T>(selector)!
    const backdrop = $<HTMLDivElement>('.backdrop')
    const canvas = $<HTMLCanvasElement>('canvas')
    const status = $<HTMLDivElement>('.status')
    const columns = $<HTMLInputElement>('.columns')
    const columnsOutput = $<HTMLOutputElement>('output')
    const submit = $<HTMLButtonElement>('.primary')

    let prepared: PreparedImage | null = null
    let result: StripResult | null = null
    let closed = false

    const close = (files: File[] | null) => {
      if (closed) return
      closed = true
      window.removeEventListener('resize', redraw)
      host.remove()
      resolve(files)
    }

    const setStatus = (text: string, kind: '' | 'error' = '') => {
      status.textContent = text
      status.className = `status ${kind}`.trim()
    }

    // Drawn at the timeline's proportions, on the page's own background, and
    // scaled down by CSS when the dialog has less room than that.
    const redraw = () => {
      if (result) drawPreview(canvas, result, theme.page, theme.dark)
    }
    window.addEventListener('resize', redraw)

    const update = () => {
      if (!prepared) return
      columnsOutput.textContent = columns.value
      result = renderStrips(prepared, Number(columns.value))
      redraw()
      const note = result.cropped
        ? ' The sides were cropped to fit the timeline.'
        : ''
      setStatus(`${result.images.length} images will be added to the post.${note}`)
      submit.disabled = false
    }

    // X listens for keyboard shortcuts on the document; keep typing and
    // arrow keys inside the dialog from reaching it.
    for (const type of ['keydown', 'keyup', 'keypress'] as const) {
      host.addEventListener(type, (event) => {
        event.stopPropagation()
        if (type === 'keydown' && event.key === 'Escape') close(null)
      })
    }
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) close(null)
    })
    $('.cancel').addEventListener('click', () => close(null))
    columns.addEventListener('input', update)
    submit.addEventListener('click', async () => {
      if (!result) return
      submit.disabled = true
      setStatus('Preparing images…')
      try {
        const baseName = file.name.replace(/\.[^.]+$/, '') || 'strip'
        close(await toFiles(result, baseName))
      } catch (error) {
        console.error('Failed to export strips:', error)
        setStatus('Could not prepare the images.', 'error')
        submit.disabled = false
      }
    })

    document.body.appendChild(host)
    $<HTMLButtonElement>('.cancel').focus()

    void (async () => {
      try {
        const image = await createImageBitmap(file)
        if (closed) {
          image.close()
          return
        }
        prepared = prepareImage(image)
        image.close()

        const { width, height } = prepared.canvas
        const limit = Math.min(COLUMN_LIMIT, maxColumns(width, height))
        columns.max = String(limit)
        // Bars about 45 px wide in the timeline.
        columns.value = String(
          Math.max(
            MIN_COLUMNS,
            Math.min(
              limit,
              Math.round(((width / height) * TIMELINE_HEIGHT) / 45),
            ),
          ),
        )
        columns.disabled = false
        update()
      } catch (error) {
        console.error('Failed to build strips:', error)
        setStatus('Could not process this image.', 'error')
      }
    })()
  })
}
