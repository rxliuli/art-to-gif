import { observeElement } from '@/lib/observeElement'
import { fileSelector } from '@/lib/fileSelector'
import { convertToVideo, convertToGif } from '@/lib/imageConverter'
import { debounce } from 'es-toolkit'
import { simulateFileUpload } from '@/lib/simulateFileUpload'
import { getSettings } from '@/lib/settings'
import iconUrl from './assets/32.png'

export default defineContentScript({
  matches: ['https://x.com/**'],
  main() {
    observeElement({
      selector:
        '[role="presentation"]:has(button [d="M15 7c1.105 0 2 .895 2 2s-.895 2-2 2-2-.895-2-2 .895-2 2-2z"])',
      onElement: debounce((element: Element) => {
        injectConvertButton(element)
      }, 100),
    })

    function injectConvertButton(uploadButtonContainer: Element) {
      // Skip if we already injected for this container
      if (uploadButtonContainer.querySelector('[data-art-to-gif-button]')) {
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

      // Create a "Convert to Video" button next to the upload button
      const convertButton = createConvertButton(
        uploadButtonContainer,
        fileInput,
      )

      // Insert the button after the upload button container
      uploadButtonContainer.parentElement?.insertBefore(
        convertButton,
        uploadButtonContainer.nextSibling,
      )
    }

    function createConvertButton(
      uploadButtonContainer: Element,
      fileInput: HTMLInputElement,
    ): HTMLDivElement {
      const buttonContainer = document.createElement('div')
      buttonContainer.setAttribute('data-art-to-gif-button', 'true')
      buttonContainer.setAttribute('role', 'presentation')
      buttonContainer.style.width = getComputedStyle(
        uploadButtonContainer,
      ).width
      buttonContainer.style.height = getComputedStyle(
        uploadButtonContainer,
      ).height

      const button = document.createElement('button')
      button.type = 'button'
      button.setAttribute('aria-label', 'Convert to Video')
      button.style.cssText = `
        background-color: rgba(0, 0, 0, 0);
        border-color: rgba(0, 0, 0, 0);
        border: 0;
        padding: 0;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
      `

      // Create SVG icon (Video icon)

      button.innerHTML = `
        <img src="${iconUrl}" alt="Video" style="width: 20px; height: 20px;" />
      `

      button.title = 'Click to select and auto-convert PNG/JPG to Video'

      // Add click handler
      button.addEventListener('click', async () => {
        await handleConvertAndUpload(fileInput)
      })

      buttonContainer.appendChild(button)
      return buttonContainer
    }

    async function handleConvertAndUpload(fileInput: HTMLInputElement) {
      try {
        const files = await fileSelector({
          accept: 'image/png, image/jpeg, image/jpg',
          multiple: true,
        })

        if (!files || files.length === 0) {
          return
        }

        // Get user's preferred format from settings
        const settings = await getSettings()
        const convertedFiles: File[] = []

        for (const file of files) {
          const converted = settings.defaultFormat === 'video'
            ? await convertToVideo(file)
            : await convertToGif(file)
          convertedFiles.push(converted)
        }

        simulateFileUpload(fileInput, convertedFiles)
      } catch (error) {
        console.error('Error in handleConvertAndUpload:', error)
      }
    }
  },
})
