import { useState } from 'react'
import { getSettings, saveSettings, ConversionFormat } from '@/lib/settings'
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query'
import { FaDiscord } from 'react-icons/fa'

// Check if MediaRecorder supports MP4 video format
const isVideoSupported = typeof MediaRecorder !== 'undefined' &&
  MediaRecorder.isTypeSupported('video/mp4')

export function OptionsContent() {
  const queryClient = useQueryClient()
  const [saved, setSaved] = useState(false)

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  })

  const mutation = useMutation({
    mutationFn: saveSettings,
    onSuccess: (_, newSettings) => {
      queryClient.setQueryData(['settings'], newSettings)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  const handleFormatChange = (format: ConversionFormat) => {
    if (!settings) return
    mutation.mutate({ ...settings, defaultFormat: format })
  }

  if (!settings) {
    return <div className="min-h-dvh bg-background p-4 sm:p-8">Loading...</div>
  }

  return (
    <div className="min-h-dvh bg-background p-4 sm:p-6 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-start justify-between gap-3 mb-3 sm:mb-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Art to GIF Settings
          </h1>
          <a
            href="https://discord.gg/gFhKUthc88"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-lg transition-colors shadow-lg shrink-0 p-2 sm:px-4 sm:py-2"
            title="Join our Discord"
          >
            <FaDiscord className="w-5 h-5" />
            <span className="hidden sm:inline">Discord</span>
          </a>
        </div>
        <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8">
          Configure how images are converted when uploading to Twitter/X
        </p>

        <div className="space-y-4 sm:space-y-6">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-2">
              Default Conversion Format
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mb-4">
              Choose which format to use by default when converting images
            </p>

            <div className="space-y-3 sm:space-y-4">
              <label className="flex items-start gap-2 sm:gap-3 p-3 sm:p-4 border border-border rounded-lg cursor-pointer hover:bg-accent transition-colors">
                <input
                  type="radio"
                  name="format"
                  value="gif"
                  checked={settings.defaultFormat === 'gif'}
                  onChange={() => handleFormatChange('gif')}
                  className="mt-1 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground text-sm sm:text-base">
                    GIF Format
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground mt-1">
                    Traditional animated GIF format
                    <ul className="list-disc list-inside mt-2 space-y-0.5 sm:space-y-1">
                      <li>15 MB file size limit</li>
                      <li>256 colors maximum</li>
                      <li>Maximum 2048x2048 resolution</li>
                      <li>Wide compatibility</li>
                    </ul>
                  </div>
                </div>
              </label>

              <label className={`flex items-start gap-2 sm:gap-3 p-3 sm:p-4 border border-border rounded-lg ${isVideoSupported ? 'cursor-pointer hover:bg-accent' : 'cursor-not-allowed opacity-50'} transition-colors`}>
                <input
                  type="radio"
                  name="format"
                  value="video"
                  checked={settings.defaultFormat === 'video'}
                  onChange={() => handleFormatChange('video')}
                  disabled={!isVideoSupported}
                  className="mt-1 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground text-sm sm:text-base">
                    Video Format (MP4)
                    {!isVideoSupported && (
                      <span className="ml-2 text-xs text-red-500 dark:text-red-400">
                        (Not supported in this browser)
                      </span>
                    )}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground mt-1">
                    Modern video format with better compression
                    <ul className="list-disc list-inside mt-2 space-y-0.5 sm:space-y-1">
                      <li>512 MB file size limit</li>
                      <li>Millions of colors</li>
                      <li>Better compression efficiency</li>
                      <li>Higher quality output</li>
                    </ul>
                  </div>
                </div>
              </label>
            </div>

            {saved && (
              <div className="text-green-600 dark:text-green-400 text-xs sm:text-sm font-medium mt-3">
                ✓ Settings saved successfully
              </div>
            )}
          </div>

          <div className="text-xs sm:text-sm text-muted-foreground pt-2 border-t border-border">
            <p>
              Both formats help protect your artwork from AI editing tools on
              Twitter/X. Choose the format that best suits your needs.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
