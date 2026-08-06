# UI Terminology Standard

**Version:** 1.0 · 2026-08-06  
**Applies to:** all studios — DOM, 3D (Scene3D), Material, Animation, Asset, Preview  
**Scope:** visible interface text only. This document governs wording, casing, and terminology. It does not govern layout, behavior, or logic.

---

## 1. Core Rules

1. **Title Case** for section titles and field labels. Never ALL CAPS.
2. **Section titles are short nouns.** "Transform", "Material", "Lighting" — not "Model Transform (3D)".
3. **No internal identifiers in UI text.** Node IDs, asset IDs, and file hashes are debug data. Show human labels instead.
4. **No internal document references.** Never surface `goal.md`, `Doc 05`, spec numbers, or ticket IDs.
5. **Expand abbreviations** unless the short form is genuinely standard for the audience (see §4).
6. **One term per concept**, across every studio. See §3.
7. **Separators:** middle dot `·` between peer facts, em dash `—` before an explanation. Ellipsis `…` (single character) in placeholders.
8. **Helper text only when it adds guidance.** No restating the label, no implementation notes.
9. **Sentence case for helper text and tooltips**, ending without a period when it is a fragment.
10. **No redundant breadcrumbs.** If a header already names the object, the line beneath it must add information or be removed.

---

## 2. Encoding Requirement

An earlier encoding-unsafe transformation corrupted non-ASCII punctuation throughout the source. The damage is visible in the UI:

| Corrupted bytes | Intended character | Appears as |
|---|---|---|
| `  *` (2 spaces + asterisk) | `·` middle dot | `Environment  * IBL` |
| `   "` (3 spaces + quote) | `—` em dash | `pick it here   " every` |
| (blank) | `°` degree | `unit="  "` |
| `   ` (spaces) | `…` ellipsis | `track name   ` |

**Rule:** all UI strings use real Unicode characters, saved as UTF-8. Any occurrence of `  *` or `   "` inside a user-visible string is a defect.

> Corrupted punctuation also exists in **code comments**. That is a separate cleanup, out of scope for this UI-text pass, and is tracked as a follow-up.

---

## 3. Canonical Terms

Use the **Standard** column everywhere. The **Never** column lists forms found in the codebase that must not reappear.

### Geometry & Layout
| Concept | Standard | Never |
|---|---|---|
| Object placement | **Position** | Pos, Pos X/Y/Z, Translate, TRANSLATE X |
| Object rotation | **Rotation** | Rot, Rot X/Y/Z, ROTATE |
| Object scale | **Scale** | Scale X/Y/Z (as separate labels) |
| Combined transform | **Transform** | 3D Transform, Model Transform (3D) |
| Width / height | **Width**, **Height** | W, H, Size X, Size Y |
| Overall size block | **Size** | Shape, Dimensions (when it means size) |
| Stacking depth | **Stacking Order** | Z-Index, Z Index, zIndex |
| Canvas extents | **Canvas Bounds** | 2D Canvas Bounds |
| Alignment to grid | **Snapping** | Snap Settings, Snap |
| Mesh subdivisions | **Segments** | Subdivisions, Subdiv |
| Corner rounding | **Corner Radius** | Corner |
| Extrude depth | **Depth** | Extrusion |
| Bevel segment count | **Bevel Segments** | Bevel Sides |

### Appearance
| Concept | Standard | Never |
|---|---|---|
| Fill color | **Fill** | Background Color (for element fill) |
| Page/scene background | **Background** | BG, BG Color, BG COLOR |
| Transparency amount | **Opacity** | Opacity & Blend, OPACITY & BLEND |
| Transparency mode | **Transparency** | Alpha Mode |
| Opacity + alpha block | **Opacity** | Opacity & Alpha |
| Border | **Border** | Stroke (in DOM Studio) |
| Shadow | **Shadow** | Box Shadow, Drop Shadow |
| Text body | **Content** | Text Content, TEXT CONTENT |

### 3D, Lighting & Material
| Concept | Standard | Never |
|---|---|---|
| Environment lighting block | **Lighting** | Environment & IBL, ENVIRONMENT * IBL, IBL |
| Environment settings block | **Environment** | Environment · HDR, 3D Environment & Stage |
| Environment brightness | **Environment Intensity** | Env Power, ENV POWER, envIntensity |
| Environment image | **Environment Image** | HDR Env, HDR, hdrAssetId |
| Camera block | **Camera** | Camera Settings |
| Camera angle | **Field of View** | FOV |
| Light block | **Light** | Light Intensity (as a section title) |
| Light strength | **Intensity** | Power, Strength |
| Material block | **Material** | Material · PBR, PBR Material |
| Texture block | **Textures** | Texture Maps |
| Texture placement | **Texture Placement** | UV Transform |
| Texture repeat | **Tiling** | UV Tiling |
| Texture shift | **Offset** | UV Offset |
| Face hiding | **Visible Faces** | Cull Mode |
| Draw sequence | **Draw Order** | Render Order |
| Geometry block | **Geometry** | Mesh & Geometry, Mesh Geometry & Shadows |
| Shadow casting block | **Rendering** | Mesh Geometry & Shadows |
| 3D model reference | **3D Model** | GLB Asset, GLB, 3D Asset Model |

> **Retained industry terms.** `Clearcoat`, `Transmission`, `Emission`, `Base Color`, `Wireframe`, `Cast Shadows`, `Receive Shadows`, and `Roughness`/`Metalness` stay as-is. These are the standard vocabulary of every professional 3D tool; replacing them would reduce clarity for the intended audience.

### Animation & Interaction
| Concept | Standard | Never |
|---|---|---|
| Keyframe block | **Keyframe** | KEYFRAME |
| Animation curve | **Easing** | EASING, Easing & Curves, EASING & CURVES |
| Curve type | **Curve** | Interpolation, INTERPOLATION |
| Scroll-driven trigger | **Scroll Trigger** | Scroll Triggers, SCROLL TRIGGERS |
| Target connection | **Target** | Target Binding, TARGET BINDING |
| Animation track | **Track** | TRACK |
| Time value | **Time** | TIME (t) |

### Assets & Organization
| Concept | Standard | Never |
|---|---|---|
| Asset identifier block | **Identity** | Asset Identity |
| File location | **Location** | Folder |
| File categories | **Tags** | Organization & Tags (as a section title) |
| File format block | **Format** | Format & Compression |
| File metadata | **Properties** | (generic — keep context-specific titles) |
| Optimization status | **Optimization** | Optimization Status |
| Related files | **Dependencies** | Dependency Health |
| Change history | **History** | Version History, Version Control & Immutability |

### Casing & Punctuation
| Correct | Never |
|---|---|
| **Position** | POSITION |
| **Transform** | TRANSFORM, Transform (3D) |
| **Lighting** | LIGHTING, Lighting · HDR |
| **Environment · HDR** ← *only in this specific form* | Environment  * HDR, ENVIRONMENT * IBL |
| **Field of View** | FOV, fov |
| **Environment Intensity** | Env Power, ENV POWER |
| **Background Color** | BG Color, BG COLOR |

---

## 4. Abbreviations

**Expand** these unless the long form is ambiguous or genuinely foreign to the audience:

| Expand to | Not |
|---|---|
| Field of View | FOV |
| High Dynamic Range | HDR *(exception: "HDR" alone is acceptable when space is tight)* |
| Physically Based Rendering | PBR *(exception: "PBR" may appear in technical contexts)* |
| Image-Based Lighting | IBL *(always expand to **Lighting**)* |
| degrees | ° (degree symbol) |

**Retain** standard industry short forms:
- **UV** (texture coordinates — "UV" is the standard, not "texture coordinates")
- **RGB, RGBA** (color models)
- **GLB, GLTF** (3D model formats)
- **MIME** (file type identifier — `MIME Type` is correct)

---

## 5. Helper Text

Helper text **adds guidance**, never restates the label.

### Good
```tsx
<FieldRow label="Environment Intensity">
  <NumberField … />
</FieldRow>
<p className="hint">Higher values increase scene brightness</p>
```

### Bad
```tsx
<FieldRow label="Environment Intensity">
  <NumberField … />
</FieldRow>
<p className="hint">Controls the environment intensity</p>  {/* Redundant */}
```

### Never in UI
```tsx
<p className="hint">Import a .hdr file in the Asset Studio, then pick it here — every PBR material responds to the environment (goal.md § 3).</p>
```
**Problems:**
- `goal.md § 3` is an internal document reference
- The entire explanation is too long for an inline hint

**Fix:** move the explanation to documentation; keep the hint to `"Higher values increase reflected light from the environment"` or remove it entirely if the label is self-explanatory.

---

## 6. Object Identity Lines

Many inspectors render a muted metadata line above the object name:

```tsx
<div className="kind">section · hero-1</div>
<div className="name">Hero Section</div>
```

**Rules:**
1. Use middle dot `·` between peer facts: `section · hero-1`, `camera · main-cam`.
2. Do not repeat information already in the label or name.
3. ID suffixes are debug data — show them in this metadata line, not in the primary label.

**Examples:**

| Correct | Never |
|---|---|
| `scene · environment` | `scene  * environment` |
| `camera · main-cam` | `camera  * main-cam` |
| `div · hero-1` | `<div>  * hero-1` |
| `stage · scroll-driven 3D scene` | `stage  * scroll-driven 3D scene` |

---

## 7. Placeholders

1. Use ellipsis `…` (single character U+2026), not three periods.
2. Sentence case, no ending punctuation.
3. Be specific about what the user should type.

| Correct | Never |
|---|---|
| `placeholder="Search name or #tag…"` | `placeholder="Search folders   "` |
| `placeholder="Type a command or node name…"` | `placeholder="Type a command, node, or track name   "` |

---

## 8. Units

Always include the unit when displaying a numeric property with physical meaning.

| Correct | Never |
|---|---|
| `unit="°"` | `unit="  "` (corrupted bytes) |
| `unit="px"` | no unit on pixel values |
| `unit="%"` | implicit percentage |

---

## 9. Empty States

Every empty panel or list needs three components:
1. **Icon** (decorative, `aria-hidden="true"`)
2. **Heading** (short, Title Case)
3. **Description** (sentence case, one to two sentences)
4. **Call to Action** (optional button)

**Example:**
```tsx
<EmptyState
  icon={Icons.layers}
  heading="No Layers Yet"
  description="Create a container, text, or image element to start building your page."
  action={{ label: "Add Layer", onClick: handleAdd }}
/>
```

**Never:**
```tsx
<div>No matches</div>  {/* Bare text, no icon, no guidance */}
```

---

## 10. Tooltips & Accessible Names

1. **Tooltips** provide **additional context** on hover and focus. Use sentence case, no ending period for fragments.
2. **`aria-label`** provides the **accessible name** for controls without visible text. Use Title Case for button labels.

| Good | Bad |
|---|---|
| `<button aria-label="Reset Zoom">` | `<span onClick title="Reset zoom">` |
| `<button title="Double-click to collapse">` | `<button title="Drag to resize  * double-click…">` |

---

## 11. Encoding Corruption Map

These corrupted byte sequences appear throughout the source and must be fixed globally:

| Find | Replace with | Context |
|---|---|---|
| `  *` (2 spaces + asterisk) | `·` (middle dot, U+00B7) | Between peer facts in metadata lines |
| `   "` (3 spaces + quote) | `—` (em dash, U+2014) | Before explanations in hints |
| `   ` (3 spaces) at end of placeholder | `…` (ellipsis, U+2026) | Placeholder trailing punctuation |
| Blank `unit=""` where degrees expected | `°` (degree symbol, U+00B0) | Angle unit labels |

> **Scope reminder:** code comments also contain corrupted punctuation. That is a **separate cleanup**, tracked as a follow-up, and is **not** part of this UI-text pass.

---

## 12. Cross-Studio Consistency

Identical components must use identical labels:

- **Material inspector** appears in DOM Studio, Scene3D Studio, and Material Studio. All three copies must say `Material`, not `Material · PBR` in one and `PBR Material` in another.
- **Environment settings** appear in DOM Registration and Scene3D Registration. Both must use the same section title and field labels.
- **Command palettes** exist in all six studios. All six must have the same placeholder.

---

## Implementation Checklist

- [ ] Replace all `  *` with `·` in UI strings
- [ ] Replace all `   "` with `—` in UI strings  
- [ ] Replace all placeholder `   ` with `…`
- [ ] Restore `°` in angle unit labels
- [ ] Convert ALL CAPS section titles to Title Case
- [ ] Convert ALL CAPS field labels to Title Case
- [ ] Apply canonical terms from §3
- [ ] Expand abbreviations per §4
- [ ] Remove `goal.md` / `Doc ##` references from visible text
- [ ] Remove hardcoded IDs from primary labels (keep in metadata lines only)
- [ ] Ensure cross-studio label consistency (Material, Environment, Command Palette)
- [ ] Add missing empty states with icon + heading + description
- [ ] Fix placeholder text per §7
- [ ] Verify units on all numeric fields per §8
- [ ] Convert redundant helper text per §5
- [ ] Run `npm run typecheck && npm run lint` after each studio

---

**End of Standard · Version 1.0**

