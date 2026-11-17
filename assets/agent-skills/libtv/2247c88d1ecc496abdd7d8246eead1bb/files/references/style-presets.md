# Style presets

Select one preset and place it at the beginning of the generation prompt. Preserve a user-provided style when it is more specific.

## 2D

- **二次元 / 网络条漫**: `二次元风格，2D动画感，流行网络漫画，赛璐璐着色，线条流畅，色块清晰`
- **国漫古风玄幻**: `2D国漫风格，古风玄幻美术，精致线稿，线条流畅，层次清晰`
- **Q版五头身**: `可爱Q版，五头身，二次元2D卡通风格，线条圆润，色彩鲜艳明快`
- **Q版二头身**: `超可爱Q版，二头身，大头娃娃比例，二次元2D卡通风格，线条圆润，色彩鲜艳明快`

## 3D

- **3D国漫**: `3D动漫角色，古风玄幻风格，精致角色建模，材质层次清晰`
- **次时代游戏角色**: `3D动漫角色，次时代游戏建模，高精度角色模型，PBR材质，清晰服装结构`
- **乙女游戏角色**: `乙女游戏3D角色建模，未来感与优雅并存，柔和梦幻氛围，电影感光影，照片级材质，虚幻引擎风格渲染，超精细`

## Photorealistic

- **影视写实**: `写实人物，电影级质感，真实皮肤纹理，准确人体比例，克制自然的棚拍光线，高细节`
- **网感超写实**: `超写实人物，照片级真实感，柔光滤镜，精致网感妆容，清晰眼线，亮泽唇妆，细腻皮肤纹理与真实毛孔，高细节`

## Adaptation rules

- Avoid naming a living artist. Translate the request into visible traits such as line quality, rendering method, palette, materials, and lighting.
- Keep white-background, full-body, strict front-view, and character-sheet requirements outside the style preset so they remain invariant.
- Reduce cinematic shadows for character sheets even when the chosen style normally uses dramatic lighting; construction readability takes priority.
- For chibi characters, preserve the exact head-to-body ratio across all views.

These presets adapt the structure found in the supplied reference document: style + specification + appearance + costume/action description. They add consistency controls needed for a front-view anchor and a later three-view turnaround.
