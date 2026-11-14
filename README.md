# Art to GIF

Post your artwork on Twitter/X as a GIF or a video, so AI editing tools can't modify it in one click. Or turn a picture into 3D strips, where the subject pops out in front of a row of bars.

[![YouTube Demo](https://img.youtube.com/vi/_HxkhYOjdN0/0.jpg)](https://www.youtube.com/watch?v=_HxkhYOjdN0)

## Installation

The extension is available for multiple browsers:

- **Chrome Web Store** - <https://chromewebstore.google.com/detail/art-to-gif/ieaaafobhbfkdamlidcookclikabngok>
- **Firefox Add-ons** - <https://addons.mozilla.org/firefox/addon/art-to-gif/>
- **Microsoft Edge Add-ons** - <https://microsoftedge.microsoft.com/addons/detail/art-to-gif/mhkdchgbgfefbcgajfihdonajafhckan>
- **Safari Extensions** - <https://apps.apple.com/app/id6756991514>

## Usage

1. Install the extension in your browser
2. Go to Twitter/X (x.com)
3. When creating a post, look for the extra button next to the image upload button. Its icon shows the current mode
4. Click it and select your artwork (PNG/JPG)
5. The extension converts the image and adds the result to your post
6. Post as usual

To change what the button does, click the extension's icon in the browser toolbar to open its settings and pick a mode. The button on Twitter/X updates right away.

## Modes

### GIF

Converts each image to a GIF. This is the default.

- **File size limit**: 15 MB
- **Color depth**: 256 colors maximum
- **Resolution**: Maximum 2048x2048
- **Best for**: Wide compatibility, smaller images

### Video (MP4)

Converts each image to a short looping video.

- **File size limit**: 512 MB
- **Color depth**: Millions of colors
- **Compression**: Better compression efficiency
- **Best for**: Higher quality, larger images

Why video instead of GIF?

- **Better file size limits**: Twitter allows up to 512 MB for videos vs 15 MB for GIFs
- **Smaller file sizes**: Modern video codecs compress much better than GIF
- **Better quality**: Videos support millions of colors instead of GIF's 256 color limit
- **Same protection**: AI editing tools still can't process video files

### 3D Strips

Splits one picture into several images that Twitter/X shows side by side as vertical bars, with the subject drawn in front of the gaps between them so it appears to stand out from the post.

1. Select a picture. The extension finds its subject automatically
2. A preview shows how the post will look in your current theme
3. Adjust the number of columns, and optionally give the bars a color
4. Click **Add to post**. The images are added in the right order

Things to know:

- **It is a style, not a protection.** The result is still made of ordinary images, so use GIF or Video when you want to stop AI editing
- **Everything runs on your device.** The subject is found by a small model bundled with the extension. Your picture is not uploaded anywhere except to Twitter/X when you post
- **Pictures with a clear subject in the middle work best**, ideally one that is taller than it is wide. A subject that fills the whole width is shown smaller, because Twitter/X crops any image wider than 9:14
- **Plain white or black backgrounds get a bar color by default.** Without one, the bars would blend into the light or dark theme
- **The gaps are transparent**, so the effect works in both light and dark themes
- The gaps are sized for the timeline. In a quoted post, where images are shown smaller, they look narrower than the real gaps between images

## Development

```sh
pnpm install
pnpm dev            # Chrome
pnpm dev:firefox    # Firefox
pnpm build:safari   # Xcode project in .output/ (requires Xcode)
pnpm compile        # type check
pnpm test
```

Releases are published through [extport](https://extport.dev): bumping the version in `package.json` on `main` builds the extension and pushes it to the Chrome, Edge, Firefox and Safari stores.

## Acknowledgements

- [U²-Net](https://github.com/xuebinqin/U-2-Net) (Apache-2.0), the model used to find the subject in 3D Strips mode
- [ONNX Runtime Web](https://github.com/microsoft/onnxruntime) (MIT), which runs it in the browser

## License

This project is licensed under the GPL-3.0 License. See the [LICENSE](LICENSE) file for details.
