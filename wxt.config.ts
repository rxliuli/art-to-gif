import { defineConfig, type UserManifest } from 'wxt'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  modules: ['@wxt-dev/module-react', '@extport/wxt'],
  extport: {
    extension: 'ext_4NAXKGc4GSG6ZlIgelqN',
    analytics: true,
    // Builds the Xcode project for macOS and iOS on `wxt zip -b safari`.
    safari: {
      appCategory: 'public.app-category.productivity',
      bundleIdentifier: 'com.rxliuli.art-to-gif',
      developmentTeam: 'N2X78TUUFG',
      issuerId: '48f39427-c063-4e33-98d2-31de80aad0be',
      keyId: '8N27UWG9RG',
    },
  },
  vite: () => ({
    plugins: [tailwindcss()],
    resolve: {
      tsconfigPaths: true,
    },
  }),
  manifestVersion: 3,
  manifest: (env) => {
    const manifest: UserManifest = {
      name: 'Art to GIF',
      description:
        'Convert your artwork to GIF format on Twitter/X to prevent AI editing.',
      author: {
        email: 'rxliuli@gmail.com',
      },
      action: {
        default_icon: {
          '16': 'icon/16.png',
          '32': 'icon/32.png',
          '48': 'icon/48.png',
          '96': 'icon/96.png',
          '128': 'icon/128.png',
        },
      },
      permissions: ['storage'],
      homepage_url: 'https://rxliuli.com/project/art-to-gif',
    }
    if (env.browser === 'firefox') {
      manifest.browser_specific_settings = {
        gecko: {
          id:
            manifest.name!.toLowerCase().replaceAll(/[^a-z0-9]/g, '-') +
            '@rxliuli.com',
          data_collection_permissions: {
            required: ['none'],
          },
        },
        // Empty = compatible with Firefox for Android at AMO's default
        // minimum.
        gecko_android: {},
      }
      // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/author
      // @ts-expect-error
      manifest.author = 'rxliuli'
    }
    return manifest
  },
  webExt: {
    disabled: true,
  },
  hooks: {
    // wxt 0.21 turns on noUncheckedIndexedAccess in the generated tsconfig,
    // which flags every indexed access in the existing code. Opt out of that
    // one option, as imp-translate does; adopting it is a separate change.
    'prepare:tsconfig': (_, { tsconfig }) => {
      delete tsconfig.compilerOptions.noUncheckedIndexedAccess
    },
  },
})
