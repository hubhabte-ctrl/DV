#!/usr/bin/env node
/**
 * Apply UI Terminology Standard (frontend/docs/ui_terminology_standard.md)
 * to all studio TSX files.
 *
 * Fixes:
 * 1. Encoding corruption: `  *` -> `·`, `   "` -> `—`, `   ` -> `…`, blank degree -> `°`
 * 2. ALL CAPS labels -> Title Case
 * 3. Abbreviated labels -> Full terms (per standard §3)
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Encoding corruption map
const ENCODING_FIXES = [
  // Middle dot (between peer facts)
  { pattern: /(\w)\s\s\*\s(\w)/g, replacement: '$1 · $2' },

  // Em dash (before explanations)
  { pattern: /(\w)\s\s\s"\s/g, replacement: '$1 — ' },

  // Ellipsis in placeholders
  { pattern: /placeholder="([^"]+)\s\s\s"/g, replacement: 'placeholder="$1…"' },

  // Degree symbol in units
  { pattern: /unit="\s\s"/g, replacement: 'unit="°"' },
];

// Label fixes: ALL CAPS -> Title Case
const LABEL_FIXES = [
  // Position & Layout
  { pattern: /<label>POSITION<\/label>/g, replacement: '<label>Position</label>' },
  { pattern: /<label>X<\/label>/g, replacement: '<label>X</label>' }, // Keep
  { pattern: /<label>Y<\/label>/g, replacement: '<label>Y</label>' }, // Keep
  { pattern: /<label>W<\/label>/g, replacement: '<label>Width</label>' },
  { pattern: /<label>H<\/label>/g, replacement: '<label>Height</label>' },
  { pattern: /<label>MIN W<\/label>/g, replacement: '<label>Min Width</label>' },
  { pattern: /<label>MAX W<\/label>/g, replacement: '<label>Max Width</label>' },

  // Display & Flex
  { pattern: /<label>DISPLAY<\/label>/g, replacement: '<label>Display</label>' },
  { pattern: /<label>DIRECTION<\/label>/g, replacement: '<label>Direction</label>' },
  { pattern: /<label>WRAP<\/label>/g, replacement: '<label>Wrap</label>' },
  { pattern: /<label>ALIGN<\/label>/g, replacement: '<label>Align</label>' },
  { pattern: /<label>JUSTIFY<\/label>/g, replacement: '<label>Justify</label>' },
  { pattern: /<label>GAP<\/label>/g, replacement: '<label>Gap</label>' },
  { pattern: /<label>COLUMNS<\/label>/g, replacement: '<label>Columns</label>' },
  { pattern: /<label>ROWS<\/label>/g, replacement: '<label>Rows</label>' },

  // Background
  { pattern: /<label>BG IMAGE<\/label>/g, replacement: '<label>Background Image</label>' },
  { pattern: /<label>BG SIZE<\/label>/g, replacement: '<label>Background Size</label>' },
  { pattern: /<label>BG POSITION<\/label>/g, replacement: '<label>Background Position</label>' },
  { pattern: /<label>BG COLOR<\/label>/g, replacement: '<label>Background</label>' },

  // Outline
  { pattern: /<label>OUTLINE W<\/label>/g, replacement: '<label>Outline Width</label>' },
  { pattern: /<label>OUTLINE COLOR<\/label>/g, replacement: '<label>Outline Color</label>' },
  { pattern: /<label>OUTLINE OFFSET<\/label>/g, replacement: '<label>Outline Offset</label>' },

  // Opacity & Blend
  { pattern: /<label>OPACITY<\/label>/g, replacement: '<label>Opacity</label>' },
  { pattern: /<label>BLEND<\/label>/g, replacement: '<label>Blend Mode</label>' },

  // Transform
  { pattern: /<label>TRANSLATE X<\/label>/g, replacement: '<label>Translate X</label>' },
  { pattern: /<label>TRANSLATE Y<\/label>/g, replacement: '<label>Translate Y</label>' },
  { pattern: /<label>ROTATE<\/label>/g, replacement: '<label>Rotate</label>' },
  { pattern: /<label>ORIGIN<\/label>/g, replacement: '<label>Transform Origin</label>' },
  { pattern: /<label>SCALE X<\/label>/g, replacement: '<label>Scale X</label>' },
  { pattern: /<label>SCALE Y<\/label>/g, replacement: '<label>Scale Y</label>' },
  { pattern: /<label>SKEW X<\/label>/g, replacement: '<label>Skew X</label>' },
  { pattern: /<label>SKEW Y<\/label>/g, replacement: '<label>Skew Y</label>' },

  // Accessibility
  { pattern: /<label>ARIA LABEL<\/label>/g, replacement: '<label>ARIA Label</label>' },
  { pattern: /<label>ARIA HIDDEN<\/label>/g, replacement: '<label>ARIA Hidden</label>' },
  { pattern: /<label>ROLE<\/label>/g, replacement: '<label>Role</label>' },

  // Typography
  { pattern: /<label>TEXT<\/label>/g, replacement: '<label>Content</label>' },
  { pattern: /<label>TAG<\/label>/g, replacement: '<label>Tag</label>' },
  { pattern: /<label>FONT<\/label>/g, replacement: '<label>Font Family</label>' },
  { pattern: /<label>WEIGHT<\/label>/g, replacement: '<label>Weight</label>' },
  { pattern: /<label>SIZE<\/label>/g, replacement: '<label>Size</label>' },
  { pattern: /<label>LINE HT<\/label>/g, replacement: '<label>Line Height</label>' },
  { pattern: /<label>SPACING<\/label>/g, replacement: '<label>Letter Spacing</label>' },
];

// Section title fixes: ALL CAPS -> Title Case
const SECTION_TITLE_FIXES = [
  { pattern: /title="POSITION"/g, replacement: 'title="Position"' },
  { pattern: /title="DISPLAY"/g, replacement: 'title="Display"' },
  { pattern: /title="TRANSFORM"/g, replacement: 'title="Transform"' },
  { pattern: /title="BACKGROUND"/g, replacement: 'title="Background"' },
  { pattern: /title="BORDER"/g, replacement: 'title="Border"' },
  { pattern: /title="SHADOW"/g, replacement: 'title="Shadow"' },
  { pattern: /title="TYPOGRAPHY"/g, replacement: 'title="Typography"' },
  { pattern: /title="APPEARANCE"/g, replacement: 'title="Appearance"' },
  { pattern: /title="ACCESSIBILITY"/g, replacement: 'title="Accessibility"' },
  { pattern: /title="COMPONENT"/g, replacement: 'title="Component"' },
  { pattern: /title="LIGHTING"/g, replacement: 'title="Lighting"' },
  { pattern: /title="ENVIRONMENT"/g, replacement: 'title="Environment"' },
  { pattern: /title="CAMERA"/g, replacement: 'title="Camera"' },
  { pattern: /title="MATERIAL"/g, replacement: 'title="Material"' },
  { pattern: /title="GEOMETRY"/g, replacement: 'title="Geometry"' },
  { pattern: /title="TEXTURES"/g, replacement: 'title="Textures"' },
  { pattern: /title="RENDERING"/g, replacement: 'title="Rendering"' },

  // Fix specific corrupted patterns found in the audit
  { pattern: /title="Shadows\s\s\*\s/g, replacement: 'title="Shadow · ' },
  { pattern: /title="Active Overrides\s\s\*\s/g, replacement: 'title="Active Overrides · ' },
  { pattern: /title="Timeline Bindings\s\s\*\s/g, replacement: 'title="Timeline Bindings · ' },
];

function applyFixes(content) {
  let result = content;

  // 1. Fix encoding corruption
  for (const fix of ENCODING_FIXES) {
    result = result.replace(fix.pattern, fix.replacement);
  }

  // 2. Fix section titles
  for (const fix of SECTION_TITLE_FIXES) {
    result = result.replace(fix.pattern, fix.replacement);
  }

  // 3. Fix field labels
  for (const fix of LABEL_FIXES) {
    result = result.replace(fix.pattern, fix.replacement);
  }

  return result;
}

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const fixed = applyFixes(content);

  if (content !== fixed) {
    fs.writeFileSync(filePath, fixed, 'utf8');
    return true;
  }

  return false;
}

function main() {
  const studiosPattern = 'studios/*/components/**/*.tsx';
  const files = glob.sync(studiosPattern, { cwd: process.cwd() });

  let changedCount = 0;

  for (const file of files) {
    if (processFile(file)) {
      console.log(`✓ ${file}`);
      changedCount++;
    }
  }

  console.log(`\nFixed ${changedCount} of ${files.length} files`);
}

main();
