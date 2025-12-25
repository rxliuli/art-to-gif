import { createOrOpen } from '@/lib/createOrOpen'

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(async () => {
    if (import.meta.env.DEV) {
      await browser.tabs.create({
        url: browser.runtime.getURL('/options.html'),
      })
    }
  })
  browser.action.onClicked.addListener(async () => {
    await createOrOpen(browser.runtime.getURL('/options.html'))
  })
})
