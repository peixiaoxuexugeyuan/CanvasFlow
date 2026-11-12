# CanvasFlow — third-party components

Electron and Chromium notices are included as LICENSE and LICENSES.chromium.html beside CanvasFlow.exe.
Three.js and the other browser libraries retain their licenses in resources/backend/public/vendor.
Python's license is included in resources/backend/PYTHON-LICENSE.txt.

Blender 4.5.9 is an unmodified, separate GPL application, included under resources/backend/.runtime/blender.
Its copyright.txt, license directory and bundled dependency notices are preserved. Blender source is available at
https://download.blender.org/source/ (blender-4.5.9.tar.xz).
The Blender Python adapter's corresponding source is included as resources/backend/blender_worker.py and blender_protocol.py.
These adapter files are kept separate from CanvasFlow's independently compiled backend.

OpenFilm 0.3.2 (MIT) provides the film editor, renderer, timeline, library, skills and export engine.
https://github.com/openfilm/openfilm
Unmodified desktop Agent modules are copied from commit 758b1a3888819bf191db191f690c4ca2fcb292af.
The complete MIT notice and trademark notice are retained under resources/backend/tools/openfilm/licenses;
desktop-runtime/LICENSE and each dependency's license are also retained. CanvasFlow is an independent host,
not the official OpenFilm application. Community resources retain their individual licenses.

ACP SDK and Agent adapters retain their package licenses under tools/openfilm/node_modules.
They launch separately installed Agent programs; those programs and subscriptions are not bundled.
Node.js, Playwright Chromium, FFmpeg and Git for Windows are separate, unmodified runtime components
under resources/backend/.runtime. Their full license/notice files are preserved. Versions and source URLs
are recorded in tools/openfilm/runtime-sources.json. Playwright is Apache-2.0; Chromium includes third-party
licenses. Node.js retains its combined LICENSE. Git for Windows retains LICENSE.txt and bundled notices.
Git source and build tooling: https://github.com/git-for-windows/git and https://github.com/git-for-windows/build-extra.
The Gyan FFmpeg build includes GPL components. Its LICENSE and README are retained; source/build references
are in that README and https://www.gyan.dev/ffmpeg/builds/ . Before distributing this new build, the release
process must supply corresponding source/build materials required by the actual binary licenses.
Keeping this notice alone is not completion of that release obligation.

CanvasFlow's proprietary application code is distributed in protected form. Protection does not change any
third-party license, prevent inspection of local data, or guarantee resistance to reverse engineering.
