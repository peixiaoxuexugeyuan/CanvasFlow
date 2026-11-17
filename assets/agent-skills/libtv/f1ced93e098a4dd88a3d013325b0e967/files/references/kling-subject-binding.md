# Kling Principal Subject Binding

## Purpose

Use Kling VIDEO 3.0 Omni's subject/element reference capability to replace and stabilize the main short-drama characters. Keep this identity control separate from the continuation clip's duties for motion, framing, audio, and color continuity.

Official guidance supports binding uploaded image or video references as Elements, preserving subject appearance through camera movement and multi-shot development. A character element may also carry a bound voice.

## 1. Identify principal-character candidates

After the visual and dialogue audit, mark as principal candidates only characters who meet at least one condition:

- speak an audible line;
- drive the current plot action;
- recur across multiple shots or segments;
- require stable identity during close-ups, profile/back views, occlusion, motion blur, or re-entry;
- are explicitly named by the user as a replacement character.

Do not bind anonymous extras, crowds, or incidental background people unless the user explicitly requests it.

## 2. Mandatory user-confirmation question

If the current segment does not already contain an explicit, unambiguous subject map, stop before prompt delivery and use exactly one compact question. Begin with the project-location line and stage `主体绑定待确认`, then ask:

`本段检测到的主要人物候选为：{角色列表}。请确认 Kling O3 主体绑定，按“角色名＝主体元素准确名称｜参考来源（图号/视频号）｜声音状态（已绑定/未绑定）”回复；未列出的角色按普通画面角色处理。`

Example answer:

`王雨棠＝王雨棠_主体｜图3、图5｜已绑定；王管家＝王管家_主体｜图4｜未绑定。`

Rules:

- Ask once per segment or whenever the user changes a principal character.
- Do not ask again when the complete answer already exists in the conversation.
- Do not invent an element name from a person's role or filename.
- The element name may be an existing Kling subject name or the exact name the user plans to create and bind before generation.
- Do not deliver either final model prompt while a principal candidate remains unmapped or ambiguous.

## 3. Replacement update rules

When the user replaces a principal character:

1. Update the shared role identity and Seedance image mapping.
2. Update the Kling role-to-subject-element mapping.
3. Remove the superseded image, element name, voice state, and appearance description from active prompt state.
4. Keep the audited performance, dialogue timing, blocking, props, camera, color, and audio unchanged unless the user explicitly changes them.
5. In S02+, let the new subject element replace the old actor's identity while the continuation clip still controls opening pose, action phase, framing, camera inertia, audio phase, and grade.

Never let a continuation clip restore the superseded actor's face or costume.

## 4. Subject authority and asset responsibilities

For Kling principal characters:

- `主体元素` controls identity, facial traits, hairstyle, age presentation, body proportions, costume, makeup, accessories, and any voice already bound to that element.
- `衔接视频` controls final-frame geometry, pose, gaze, action phase, camera path/inertia, native-audio phase, environment, and clip-derived color state.
- `色卡图` is secondary to the continuation clip for S02+ color.
- Text controls the new shot actions, expressions, English lines, and camera instructions.

If these sources conflict, use this priority:

1. Confirmed subject element for principal-character identity and bound voice.
2. Accepted continuation clip for opening state, motion, audio, and grade.
3. Separate color/style references for non-conflicting visual support.
4. Text for the new segment's performance and shot plan.

## 5. Voice-bound behavior

Record one state per subject:

- `已绑定声音`: Do not specify a new vocal timbre, age, gendered tone, accent, or contradictory voice profile. You may still specify language, emotion, pace, volume, breath, interruption, and on/off-screen position.
- `未绑定声音`: Describe only the minimum necessary voice qualities for the role and line. Avoid repeating the same voice description in every shot.

Every English line remains attached directly to the exact speaking subject name in the relevant Kling shot.

## 6. Kling prompt syntax

Include one global block before the shots:

`【主体参考绑定】`

`角色A＝主体元素「准确名称」；参考来源＝图X/视频X；声音状态＝已绑定/未绑定。`

`角色B＝主体元素「准确名称」；参考来源＝图Y/视频Y；声音状态＝已绑定/未绑定。`

`身份规则：主体元素只锁定人物身份与已绑定声音；衔接视频只继承动作、机位、环境、原生音频和色卡状态，不恢复被替换角色。`

Inside each `Shot N`, use the exact subject element name consistently. Do not alternate among role name, actor name, filename, `girl`, `woman`, or other synonyms for the same principal character.

## 7. Prompt-pollution controls

- State each subject's appearance responsibility once in the binding block.
- Do not repeat full facial or costume descriptions in every shot.
- Do not bind the same role to two elements.
- Do not reuse an old element name after replacement.
- Do not add UI operation instructions inside the final generation prompt.
- Do not write unsupported weights or API syntax.
- Do not define a new voice timbre for an element with a bound voice.

## 8. Delivery gate

Before delivery, confirm:

- every principal candidate has exactly one confirmed subject element;
- element names match the user's exact wording;
- reference source and voice-bound state are recorded;
- every speaking line uses the correct subject name;
- no superseded subject remains;
- identity authority and continuation/color authority are not mixed;
- both model prompts preserve the same character-role facts even though Seedance uses images and Kling uses subjects.

## Official source

Kling VIDEO 3.0 Model User Guide: https://app.klingai.com/cn/quickstart/klingai-video-3-model-user-guide
