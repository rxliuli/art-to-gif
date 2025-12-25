export type ConversionFormat = 'gif' | 'video'

export interface Settings {
  defaultFormat: ConversionFormat
}

export const DEFAULT_SETTINGS: Settings = {
  defaultFormat: 'gif',
}

export async function getSettings(): Promise<Settings> {
  const result = await browser.storage.sync.get('settings')
  return result.settings || DEFAULT_SETTINGS
}

export async function saveSettings(settings: Settings): Promise<void> {
  await browser.storage.sync.set({ settings })
}
