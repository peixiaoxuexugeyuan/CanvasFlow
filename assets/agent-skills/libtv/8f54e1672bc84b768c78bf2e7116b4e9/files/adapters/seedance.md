# Seedance Adapter

> Platform capabilities, limits and policies are version-sensitive. Verify the current interface before use.

## Stable adaptation principle

Convert the model-agnostic director record into Seedance's current reference syntax. Map every uploaded asset
to an explicit responsibility—identity, product geometry, scene, wardrobe, first/last frame, camera path,
subject action, effect mechanism, rhythm, voice or sound. Do not upload or reference an asset with no job.

For each reference include:

- `inherits`: exact dimensions to follow.
- `does_not_inherit`: subject, set, edit, light or style dimensions to ignore.
- `priority`: conflict order.
- `phase`: when in the shot it applies.

Use the platform's current `@` labels only at final serialization. The director core must not depend on label numbers.

## Seedance prompt assembly

1. Stable subject/product/world anchors.
2. Starting frame and spatial topology.
3. One primary subject action.
4. Motivated camera path and speed curve.
5. Event phases and landing frame.
6. Light/material/environment responses.
7. Transition and audio anchors.
8. Known model failure exclusions.

Never ask for “complete replication” of a reference. Extract observable camera, action, timing, effect and sound
traits. If the shot exceeds current stable capacity, split or composite it.

