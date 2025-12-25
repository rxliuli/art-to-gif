export async function createOrOpen(url: string) {
  const tab = await browser.tabs.query({
    url,
  })
  if (tab.length) {
    await browser.tabs.update(tab[0].id!, { active: true })
    if (tab[0].windowId) {
      await browser.windows.update(tab[0].windowId, { focused: true })
    }
  } else {
    await browser.tabs.create({
      url,
    })
  }
}
