import { MAX_TOTAL_ASPECT, maxColumns, TIMELINE_HEIGHT } from './layout'
import {
  drawPreview,
  type PreparedImage,
  prepareImage,
  renderStrips,
  type StripResult,
  toFiles,
} from './render'
import { nextPaint } from '@/lib/nextPaint'
import { type SegmentAssets, segmentSubject } from './segment'

const DEFAULT_TINT = '#a99be0'
const COLUMN_LIMIT = 24

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
  .panel.loading canvas { display: none; }
  /* Finding the subject blocks the page's main thread for a moment. A
     transform animation runs off that thread, so this keeps turning. */
  .spinner {
    display: none; width: 32px; height: 32px; border-radius: 50%;
    border: 3px solid var(--border); border-top-color: var(--accent);
    animation: spin 0.8s linear infinite; will-change: transform;
  }
  .panel.loading .spinner { display: block; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) {
    .spinner { animation-duration: 2.4s; }
  }
  .status { min-height: 20px; margin: 12px 0; color: var(--muted); }
  .status.warning { color: var(--warning); }
  .status.error { color: #f4212e; }
  .controls { display: flex; flex-wrap: wrap; gap: 12px 24px; align-items: center; }
  label { display: inline-flex; align-items: center; gap: 8px; }
  label.grow { flex: 1 1 220px; }
  .group { display: inline-flex; align-items: center; gap: 8px; }
  input[type='range'] { flex: 1; min-width: 0; }
  input[type='checkbox'] { width: 18px; height: 18px; margin: 0; }
  input[type='color'] { width: 36px; height: 28px; padding: 0; border: 0; background: none; }
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

function describe(result: StripResult): { text: string; warning: boolean } {
  const count = result.images.length
  if (!result.popsOut) {
    return {
      text: 'The subject does not cross any gap, so nothing pops out. Try more columns.',
      warning: true,
    }
  }
  if (count === 1) {
    return {
      text: 'The subject covers every column, so this would upload as a single image. Try more columns, or a picture with room on the sides.',
      warning: true,
    }
  }
  if (result.subjectClipped) {
    return {
      text: `${count} images. The subject is wider than X shows in one image, so its outer edges will not pop out.`,
      warning: true,
    }
  }
  const note = result.cropped ? ' The sides were cropped to fit the timeline.' : ''
  return {
    text: `${count} images will be added to the post.${note}`,
    warning: false,
  }
}

/**
 * Let the user turn one picture into a set of strips. Resolves with the
 * files to upload, in order, or null if the dialog was dismissed.
 */
export function openStripDialog(
  file: File,
  assets: SegmentAssets,
): Promise<File[] | null> {
  return new Promise((resolve) => {
    const theme = readTheme()
    const host = document.createElement('div')
    host.style.setProperty('--page', theme.page)
    host.style.setProperty('--text', theme.dark ? '#e7e9ea' : '#0f1419')
    host.style.setProperty('--muted', theme.dark ? '#8b98a5' : '#536471')
    host.style.setProperty('--border', theme.dark ? '#2f3336' : '#cfd9de')
    host.style.setProperty('--border-strong', theme.dark ? '#536471' : '#cfd9de')
    host.style.setProperty('--warning', theme.dark ? '#ffd400' : '#b26a00')
    host.style.setProperty('--accent', 'rgb(29, 155, 240)')
    const root = host.attachShadow({ mode: 'open' })
    root.innerHTML = `
      <style>${STYLE}</style>
      <div class="backdrop">
        <div class="panel loading" role="dialog" aria-modal="true" aria-label="3D strips">
          <h2>3D strips</h2>
          <div class="preview"><div class="spinner"></div><canvas></canvas></div>
          <div class="status" role="status">Finding the subject…</div>
          <div class="controls">
            <label class="grow">Columns <input type="range" class="columns" min="3" max="12" value="8" disabled /><output>8</output></label>
            <span class="group">
              <label><input type="checkbox" class="tint-on" disabled /> Bar colour</label>
              <input type="color" class="tint" value="${DEFAULT_TINT}" disabled aria-label="Bar colour" />
            </span>
          </div>
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
    const panel = $<HTMLDivElement>('.panel')
    const canvas = $<HTMLCanvasElement>('canvas')
    const status = $<HTMLDivElement>('.status')
    const columns = $<HTMLInputElement>('.columns')
    const columnsOutput = $<HTMLOutputElement>('output')
    const tintOn = $<HTMLInputElement>('.tint-on')
    const tint = $<HTMLInputElement>('.tint')
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

    const setStatus = (text: string, kind: '' | 'warning' | 'error' = '') => {
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
      tint.disabled = !tintOn.checked
      result = renderStrips(prepared, {
        columns: Number(columns.value),
        tint: tintOn.checked ? tint.value : null,
      })
      redraw()
      const { text, warning } = describe(result)
      setStatus(text, warning ? 'warning' : '')
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
    tintOn.addEventListener('change', update)
    tint.addEventListener('input', update)
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
        // Let the dialog and its spinner reach the screen before the model
        // takes over the main thread.
        await nextPaint()
        const image = await createImageBitmap(file)
        const mask = await segmentSubject(image, assets)
        if (closed) return
        prepared = prepareImage(image, mask)
        image.close()

        // The picture is framed to at most MAX_TOTAL_ASPECT before it is cut.
        const aspect = Math.min(
          prepared.width / prepared.height,
          MAX_TOTAL_ASPECT,
        )
        const limit = Math.min(
          COLUMN_LIMIT,
          maxColumns(Math.round(aspect * 1000), 1000),
        )
        columns.max = String(limit)
        columns.value = String(
          Math.max(
            3,
            Math.min(limit, Math.round((aspect * TIMELINE_HEIGHT) / 45)),
          ),
        )
        columns.disabled = false
        tintOn.disabled = false
        // A plain white or black background is invisible against one of X's
        // themes, so give the bars a colour by default.
        tintOn.checked = prepared.background !== 'mixed'
        panel.classList.remove('loading')
        update()
      } catch (error) {
        console.error('Failed to build 3D strips:', error)
        panel.classList.remove('loading')
        setStatus('Could not process this image.', 'error')
      }
    })()
  })
}
