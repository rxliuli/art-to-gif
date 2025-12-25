export default defineContentScript({
  matches: ['https://x.com/*'],
  main(ctx) {
    console.log('Content script loaded on x.com', ctx)
  },
})
