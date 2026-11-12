# OpenFilm integration sources

Engine and Studio: OpenFilm 0.3.2, https://github.com/openfilm/openfilm.
Desktop modules in `desktop-runtime/` copied from commit
`758b1a3888819bf191db191f690c4ca2fcb292af`, `apps/desktop/src/`.
The upstream license is retained at `desktop-runtime/LICENSE`; each package retains its own license.
These desktop modules are unmodified. CanvasFlow's host adapters are adjacent files.
`editor-adapter.mjs` adapts the served OpenFilm 0.3.2 UI copy so MediaPool imports
open its existing browser file input synchronously. The upstream package is kept
unchanged; the adapted module graph has its own content-hashed directory so lazy
chunks share the same React instance. Native linking remains intact.
Timeline drag/drop, magnetic editing, snapping, splitting, clipboard, deletion,
undo/redo and context-menu ordering are the upstream implementation. The host
reads StudioHost.onSelection (including keyboard selection and deselection),
reports only changed host state, and delegates autoplay/fullscreen/clipboard-write
to the local editor iframe. It does not install competing editor shortcuts or
timeline drag handlers. No microphone, camera or clipboard-read access is delegated.
Canvas entry and its keyboard shortcut delegate to CanvasFlow's live canvas;
the upstream canvas is not initialized or mirrored. This narrow, version-checked
adapter preserves the native player's pause behavior. Editor processes, registries,
libraries and exports are scoped to a CanvasFlow project (including empty drafts).
ACP adapters and SDK retain their own package licenses. They launch the user's own installed Agent.

Runtime distribution also includes Node.js, Chromium (Playwright), FFmpeg and Git for Windows.
Their license and notice files must remain in the corresponding runtime folders.
Git for Windows source: https://github.com/git-for-windows/git ; build source/toolchain:
https://github.com/git-for-windows/build-extra . FFmpeg source: https://ffmpeg.org/download.html .
Do not strip third-party license files during protection or packaging.

The upstream source checkout and its downloaded archive are development audit inputs and are not packaged.
