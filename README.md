# Art to GIF

Protect your artwork on Twitter/X by automatically converting images to GIF format. Since AI editing tools like Grok don't support GIF files, this provides a simple way to prevent unauthorized AI modifications while sharing your art online.

[![YouTube Demo](https://img.youtube.com/vi/_HxkhYOjdN0/0.jpg)](https://www.youtube.com/watch?v=_HxkhYOjdN0)

## Installation

The extension is available for multiple browsers:

- **Chrome Web Store** - https://chromewebstore.google.com/detail/art-to-gif/ieaaafobhbfkdamlidcookclikabngok
- **Firefox Add-ons** - Coming soon
- **Microsoft Edge Add-ons** - Coming soon
- **Safari Extensions** - Coming soon

### Manual Installation

For development or early access:

1. Download the latest release from the [Releases](https://github.com/rxliuli/art-to-gif/releases) page
2. Unzip the downloaded file
3. Load the extension in your browser:
   - **Chrome/Edge**: Navigate to `chrome://extensions/`, enable "Developer mode", click "Load unpacked", and select the unzipped folder
   - **Firefox**: Navigate to `about:debugging#/runtime/this-firefox`, click "Load Temporary Add-on", and select the manifest.json file
   - **Safari**: Build using `pnpm run build:safari` and follow Safari extension installation steps

## Usage

1. Install the extension in your browser
2. Go to Twitter/X (x.com)
3. When creating a post, click the image upload button
4. Select your artwork image
5. The extension will automatically convert it to GIF format before uploading
6. Post as usual - your art is now protected from AI editing tools!

The conversion happens seamlessly in the background, so you can continue using Twitter/X normally.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
