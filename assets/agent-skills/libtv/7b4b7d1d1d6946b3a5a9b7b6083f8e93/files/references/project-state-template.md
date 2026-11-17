# 项目状态模板 v3

```yaml
project:
  title: ""
  model: "Seedance 2.0"
  aspect_ratio: "9:16"
  max_segment_seconds: 15
  status: INTAKE

script:
  locked: true
  original_text: ""
  segments: []

communication_strategy:
  mode: ""  # direct_recommendation / experience_sharing / overheard_conversation / formal_explanation
  reason: ""
  sales_resistance_risk: ""
  product_reveal_stage: ""

relationship_design:
  mode: ""  # solo_life / two_person_dialogue / three_person_table / scene_interaction
  protagonist_speaks_to: ""
  camera_role: ""
  foreground_person: ""
  side_listener: ""

assets:
  character: {status: missing, approved: false}
  scene: {status: missing, approved: false}
  product:
    status: missing
    dimensions_mm: {width: null, height: null, depth: null}
    approved: false
  voice: {status: missing, approved: false}

audio_policy:
  subtitles: forbidden
  background_music: forbidden
  extra_sfx: forbidden
  environment_sound: continuous_scene_specific
  strong_denoise: forbidden

segments:
  - id: 1
    exact_text: ""
    behavior_anchor: ""
    relationship_anchor: ""
    environment_anchor: ""
    scene_native_prop: ""
    prop_action: ""
    camera_owner: ""
    left_hand_role: ""
    right_hand_role: ""
    prop_support: []
    gaze_pattern: ""
    speaks_to: ""
    product_reveal_stage: ""
    continuity_bible:
      fixed_space: []
      furniture: []
      relationship_positions: []
      prop_positions: []
      lighting: ""
      background_people: []
      camera_axis: ""
    ambient_sound_bed: []
    start_state: ""
    end_state: ""
    transition_in: hard_cut
    transition_out: undecided
    generation_status: not_started
    qc: null
```
