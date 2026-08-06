/**
 * Track / clip color mapping   " pure move from shell/TimelineBar.tsx (IL-11,
 * Spec 07   9.2 migration). Values match the production UI Kit reference.
 */

export function getTrackColor(label: string): string {
  const lbl = label.toLowerCase();
  // DOM / overlay / waypoint tracks   ' teal (accent-waypoint)
  if (
    lbl.includes('dom') ||
    lbl.includes('text') ||
    lbl.includes('title') ||
    lbl.includes('subtitle') ||
    lbl.includes('hero') ||
    lbl.includes('button') ||
    lbl.includes('fade') ||
    lbl.includes('parallax') ||
    lbl.includes('opacity') ||
    lbl.includes('blur') ||
    lbl.includes('waypoint')
  ) {
    return 'var(--bs-color-accent-waypoint, oklch(70% 0.12 210))';
  }
  // Camera tracks   ' info blue
  if (lbl.includes('camera')) {
    return 'var(--bs-color-state-info, oklch(64% 0.1 232))';
  }
  // Light tracks   ' warning amber
  if (lbl.includes('light') || lbl.includes('intensity') || lbl.includes('key')) {
    return 'var(--bs-color-state-warning, oklch(74% 0.14 80))';
  }
  // Material / emissive / signal tracks   ' clay orange
  if (
    lbl.includes('material') ||
    lbl.includes('emissive') ||
    lbl.includes('signal') ||
    lbl.includes('color') ||
    lbl.includes('roughness') ||
    lbl.includes('metallic')
  ) {
    return 'var(--bs-color-accent-clay, oklch(63% 0.15 44))';
  }
  // Audio   ' danger red
  if (lbl.includes('audio') || lbl.includes('sound')) {
    return 'var(--bs-color-state-danger, oklch(64% 0.19 28))';
  }
  // Default 3D mesh / rotation / scale / position   ' success green
  return 'var(--bs-color-state-success, oklch(66% 0.13 156))';
}

/**
 * Returns the clip bar background color   " darker/deeper shade of the track
 * accent, matching the production UI Kit reference exactly.
 * Hero/DOM  : oklch(62% 0.1 210)    " dark teal
 * 3D mesh   : oklch(55% 0.1 210)    " deeper teal
 * Clay/mat  : oklch(58% 0.13 44)    " dark orange
 * Light     : oklch(60% 0.12 80)    " dark amber
 * Camera    : oklch(52% 0.08 232)   " muted blue
 * Audio     : oklch(52% 0.15 28)    " dark red
 * Default   : oklch(55% 0.1 210 / 0.65)   " muted teal with alpha
 */
export function getClipColor(label: string): string {
  const lbl = label.toLowerCase();
  if (
    lbl.includes('dom') ||
    lbl.includes('text') ||
    lbl.includes('title') ||
    lbl.includes('subtitle') ||
    lbl.includes('hero') ||
    lbl.includes('button') ||
    lbl.includes('fade') ||
    lbl.includes('parallax') ||
    lbl.includes('opacity') ||
    lbl.includes('blur') ||
    lbl.includes('waypoint')
  ) {
    return 'oklch(62% 0.1 210)';
  }
  if (lbl.includes('camera')) {
    return 'oklch(52% 0.08 232)';
  }
  if (lbl.includes('light') || lbl.includes('intensity') || lbl.includes('key')) {
    return 'oklch(60% 0.12 80)';
  }
  if (
    lbl.includes('material') ||
    lbl.includes('emissive') ||
    lbl.includes('signal') ||
    lbl.includes('color') ||
    lbl.includes('roughness') ||
    lbl.includes('metallic')
  ) {
    return 'oklch(58% 0.13 44)';
  }
  if (lbl.includes('audio') || lbl.includes('sound')) {
    return 'oklch(52% 0.15 28)';
  }
  // Default 3D: same teal hue but deeper, with alpha for full-width tracks
  return 'oklch(55% 0.1 210 / 0.65)';
}
