import { observeElement } from '@/lib/observeElement'
import { fileSelector } from '@/lib/fileSelector'
import { convertToGif } from '@/utils/imageConverter'
import { debounce } from 'es-toolkit'
import { simulateFileUpload } from '@/lib/simulateFileUpload'
import iconUrl from './assets/32.png'

export default defineContentScript({
  matches: ['https://x.com/**'],
  main() {
    const cleanup = observeElement({
      selector:
        '[role="presentation"]:has(button [d="M3 5.5C3 4.119 4.119 3 5.5 3h13C19.881 3 21 4.119 21 5.5v13c0 1.381-1.119 2.5-2.5 2.5h-13C4.119 21 3 19.881 3 18.5v-13zM5.5 5c-.276 0-.5.224-.5.5v9.086l3-3 3 3 5-5 3 3V5.5c0-.276-.224-.5-.5-.5h-13zM19 15.414l-3-3-5 5-3-3-3 3V18.5c0 .276.224.5.5.5h13c.276 0 .5-.224.5-.5v-3.086zM9.75 7C8.784 7 8 7.784 8 8.75s.784 1.75 1.75 1.75 1.75-.784 1.75-1.75S10.716 7 9.75 7z"])',
      onElement: debounce((element: Element) => {
        injectConvertButton(element)
      }, 100),
    })

    function injectConvertButton(uploadButtonContainer: Element) {
      console.log('Injecting convert button for:', uploadButtonContainer)

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

      // Create a "Convert to GIF" button next to the upload button
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
      button.setAttribute('aria-label', 'Convert to GIF')
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

      // Create SVG icon (GIF text icon)

      button.innerHTML = `
        <img src="${iconUrl}" alt="GIF" style="width: 20px; height: 20px;" />
      `

      button.title = 'Click to select and auto-convert PNG/JPG to GIF'

      // Add click handler
      button.addEventListener('click', async () => {
        await handleConvertAndUpload(fileInput)
      })

      buttonContainer.appendChild(button)
      return buttonContainer
    }

    async function handleConvertAndUpload(fileInput: HTMLInputElement) {
      try {
        // Open file selector
        const files = await fileSelector({
          accept: 'image/png, image/jpeg, image/jpg',
          multiple: true,
        })

        if (!files || files.length === 0) {
          return
        }

        let gifs: File[] = []
        for (const file of files) {
          gifs.push(await convertToGif(file))
        }
        simulateFileUpload(fileInput, gifs)
      } catch (error) {
        console.error('Error in handleConvertAndUpload:', error)
      }
    }
  },
})
