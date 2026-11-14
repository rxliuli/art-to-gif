import { observeElement } from '@/lib/observeElement'
import { fileSelector } from '@/lib/fileSelector'
import { convertToVideo, convertToGif } from '@/lib/imageConverter'
import { debounce } from 'es-toolkit'
import { simulateFileUpload } from '@/lib/simulateFileUpload'
import {
  ConversionFormat,
  DEFAULT_SETTINGS,
  getSettings,
  Settings,
} from '@/lib/settings'
import { openStripDialog } from '@/lib/strips/dialog'
import { nextPaint } from '@/lib/nextPaint'

// Icons follow X's own toolbar icons: a 24px grid and 2px lines. They carry no
// colour of their own; the button copies the class of X's icon onto the svg so
// they get the same colour, in every theme and composer state.
const LINE =
  'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'
const SOLID = 'fill="currentColor" stroke="none"'

const MODES: Record<
  ConversionFormat,
  { label: string; title: string; icon: string }
> = {
  // Two stacked frames.
  gif: {
    label: 'Convert to GIF',
    title: 'Click to select and auto-convert PNG/JPG to GIF',
    icon: `
      <rect x="3" y="8" width="14" height="12" rx="2.5" ${LINE} />
      <path d="M7.5 8V6.5A2.5 2.5 0 0 1 10 4h8.5A2.5 2.5 0 0 1 21 6.5v7A2.5 2.5 0 0 1 18.5 16H17" ${LINE} />
    `,
  },
  // A frame with a play button.
  video: {
    label: 'Convert to Video',
    title: 'Click to select and auto-convert PNG/JPG to Video',
    icon: `
      <rect x="3" y="5" width="18" height="14" rx="3" ${LINE} />
      <path d="M10 9v6l5-3z" ${SOLID} />
    `,
  },
  // Something standing in front of bars.
  strips: {
    label: '3D strips',
    title: 'Click to select a picture and split it into 3D strips',
    icon: `
      <path d="M4 4v16M20 4v16M12 4v1.5M12 18.5V20" ${LINE} />
      <circle cx="12" cy="12" r="4.5" ${SOLID} />
    `,
  },
}

// Shown in place of the mode's icon while a conversion is running.
const BUSY_ICON = `<path d="M12 3a9 9 0 1 0 9 9" ${LINE} />`

const BUTTON_ATTRIBUTE = 'data-art-to-gif-button'

export default defineContentScript({
  matches: ['https://x.com/**'],
  async main() {
    // The file picker has to open straight from the click, so the mode is
    // kept in memory rather than read from storage at that point.
    let format = (await getSettings()).defaultFormat
    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync' || !changes.settings) return
      const next = (changes.settings.newValue as Settings | undefined)
        ?.defaultFormat
      format = next ?? DEFAULT_SETTINGS.defaultFormat
      document
        .querySelectorAll<HTMLButtonElement>(`[${BUTTON_ATTRIBUTE}] button`)
        .forEach(applyMode)
    })

    observeElement({
      selector:
        '[role="presentation"]:has(button [d="M15 7c1.105 0 2 .895 2 2s-.895 2-2 2-2-.895-2-2 .895-2 2-2z"])',
      onElement: debounce((element: Element) => {
        injectConvertButton(element)
      }, 100),
    })

    function applyMode(button: HTMLButtonElement) {
      const mode = MODES[format]
      button.setAttribute('aria-label', mode.label)
      button.title = mode.title
      button.querySelector('svg')!.innerHTML = mode.icon
    }

    /**
     * Turn the button into a spinner while `work` runs. Converting keeps the
     * main thread busy, so the spinner is a transform animation, which the
     * browser keeps turning regardless.
     */
    async function showBusy(button: HTMLButtonElement, work: () => Promise<void>) {
      const icon = button.querySelector('svg')!
      icon.innerHTML = BUSY_ICON
      const spin = icon.animate(
        [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
        { duration: 800, iterations: Infinity },
      )
      button.disabled = true
      button.style.cursor = 'progress'
      try {
        await nextPaint()
        await work()
      } finally {
        spin.cancel()
        button.disabled = false
        button.style.cursor = 'pointer'
        applyMode(button)
      }
    }

    function injectConvertButton(uploadButtonContainer: Element) {
      // Skip if we already injected for this container
      if (
        uploadButtonContainer.nextElementSibling?.hasAttribute(BUTTON_ATTRIBUTE)
      ) {
        return
      }

      // Find the file input within or near this container
      const fileInput =
        uploadButtonContainer.querySelector<HTMLInputElement>(
          'input[type="file"]',
        )

      if (!fileInput) {
        console.warn('No file input found in container')
        return
      }

      // One button next to the upload button; what it does follows the mode
      // chosen in the settings.
      const container = createToolbarButton(uploadButtonContainer, () =>
        format === 'strips'
          ? handleStripsAndUpload(fileInput)
          : handleConvertAndUpload(fileInput, container.querySelector('button')!),
      )
      uploadButtonContainer.after(container)
    }

    function createToolbarButton(
      uploadButtonContainer: Element,
      onClick: () => Promise<void>,
    ): HTMLDivElement {
      const buttonContainer = document.createElement('div')
      buttonContainer.setAttribute(BUTTON_ATTRIBUTE, 'true')
      buttonContainer.setAttribute('role', 'presentation')
      buttonContainer.style.width = getComputedStyle(
        uploadButtonContainer,
      ).width
      buttonContainer.style.height = getComputedStyle(
        uploadButtonContainer,
      ).height

      const button = document.createElement('button')
      button.type = 'button'
      button.style.cssText = `
        background-color: transparent;
        border: 0;
        border-radius: 9999px;
        padding: 0;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        transition: background-color 0.2s;
      `
      const setHover = (hover: boolean) => {
        button.style.backgroundColor = hover
          ? 'color-mix(in srgb, currentColor 10%, transparent)'
          : 'transparent'
      }
      button.addEventListener('mouseenter', () => setHover(true))
      button.addEventListener('mouseleave', () => setHover(false))

      button.innerHTML =
        '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"></svg>'
      applyMode(button)

      // X colours its icons with a class on the svg plus a brightness filter
      // on a wrapper, and changes both with the theme and the composer's
      // state. Mirror them instead of guessing a colour.
      const icon = button.querySelector('svg')!
      const nativeIcon = uploadButtonContainer.querySelector('svg')
      if (nativeIcon) {
        const syncStyle = () => {
          icon.setAttribute('class', nativeIcon.getAttribute('class') ?? '')
          let filter = 'none'
          for (
            let el = nativeIcon.parentElement;
            el && uploadButtonContainer.contains(el);
            el = el.parentElement
          ) {
            filter = getComputedStyle(el).filter
            if (filter !== 'none') break
          }
          icon.style.filter = filter
        }
        syncStyle()
        new MutationObserver(syncStyle).observe(uploadButtonContainer, {
          attributes: true,
          attributeFilter: ['class', 'style'],
          subtree: true,
        })
      } else {
        button.style.color = 'rgb(29, 155, 240)'
      }

      button.addEventListener('click', onClick)

      buttonContainer.appendChild(button)
      return buttonContainer
    }

    async function handleConvertAndUpload(
      fileInput: HTMLInputElement,
      button: HTMLButtonElement,
    ) {
      try {
        const files = await fileSelector({
          accept: 'image/png, image/jpeg, image/jpg',
          multiple: true,
        })

        if (!files || files.length === 0) {
          return
        }

        await showBusy(button, async () => {
          const convertedFiles: File[] = []
          for (const file of files) {
            const converted =
              format === 'video'
                ? await convertToVideo(file)
                : await convertToGif(file)
            convertedFiles.push(converted)
          }
          simulateFileUpload(fileInput, convertedFiles)
        })
      } catch (error) {
        console.error('Error in handleConvertAndUpload:', error)
      }
    }

    async function handleStripsAndUpload(fileInput: HTMLInputElement) {
      try {
        const files = await fileSelector({
          accept: 'image/png, image/jpeg, image/jpg, image/webp',
        })
        if (!files || files.length === 0) {
          return
        }

        const strips = await openStripDialog(files[0], {
          modelUrl: browser.runtime.getURL('/u2netp/u2netp.onnx'),
          wasmUrl: browser.runtime.getURL(
            '/onnxruntime-web/ort-wasm-simd-threaded.wasm',
          ),
        })
        if (strips) {
          simulateFileUpload(fileInput, strips)
        }
      } catch (error) {
        console.error('Error in handleStripsAndUpload:', error)
      }
    }
  },
})
