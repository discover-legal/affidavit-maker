# Utah Notary Instruction Box - Spacing Analysis

## Issue
The notary instruction box spacing differs slightly between the preview and PDF output.

## Current Implementation

### Preview (DocumentPreview.js:802-820)
```css
.affidavit-notary-instruction {
  margin-top: 24px;              /* PAGE_CONFIG.lineHeight */
  margin-bottom: 24px;           /* PAGE_CONFIG.lineHeight */
  padding: 7px;                  /* UNIFORM on all sides */
  border: 2px solid #0066cc;
  font-size: 13px;              /* PAGE_CONFIG.fontSize - 3 */
}

.affidavit-notary-instruction pre {
  line-height: 1.6;             /* = 13px × 1.6 = 20.8px per line */
}
```

### PDF (pdfService.js:327-361)
```javascript
// Font: 10pt
// lineGap: 6pt

// Border positioning:
- Top of border: startY - 5pt = text start - 5pt (top padding)
- Text rendered with lineGap: 6pt
- Bottom of border: doc.y + 10pt (bottom padding = 10pt)

// Border margins:
const instructionBorderMargin = 10pt;  /* extends 10pt on left/right */

// After instruction:
doc.moveDown(1.5);  /* = 18pt spacing after */
```

## Spacing Discrepancies

### 1. Internal Bottom Padding
- **Preview**: 7px uniform padding (bottom = 7px)
- **PDF**: ~10pt bottom padding = **13.33px** at 96 DPI
- **Difference**: ~6.33px or ~90% more bottom padding in PDF

### 2. Line Height
- **Preview**: 1.6 × 13px = **20.8px** per line
- **PDF**: ~12pt baseline + 6pt lineGap = **18pt = 24px** per line
- **Difference**: 3.2px per line or ~15% taller lines in PDF

### 3. Left/Right Internal Margins
- **Preview**: 7px padding on left/right
- **PDF**: Border extends 10pt beyond margins = **13.33px** at 96 DPI
- **Note**: This affects the border width, but text positioning is similar

## Visual Impact

For a typical Utah notary instruction (4-5 lines of text):
- **Height difference from line spacing**: 3.2px × 5 lines = ~16px
- **Height difference from bottom padding**: 6.33px
- **Total approximate difference**: ~22px taller in PDF

The PDF notary instruction box appears:
1. **Vertically more spacious** (lines further apart)
2. **More bottom padding** (more space below text before border)
3. **Slightly wider border margins**

## Conversion Reference
At 96 DPI (CSS) vs 72 DPI (PDF):
- 1pt × (96/72) = 1.333px
- 5pt = 6.67px ≈ 7px ✓
- 6pt = 8px
- 10pt = 13.33px
- 18pt = 24px

## Recommendation

To achieve perfect WYSIWYG matching:

### Option 1: Adjust Preview to Match PDF (More Spacing)
```css
.affidavit-notary-instruction {
  padding: 7px 13px 13px 13px;  /* top, right, bottom, left - match PDF */
}

.affidavit-notary-instruction pre {
  line-height: 1.85;  /* 13px × 1.85 = 24px - match PDF */
}
```

### Option 2: Adjust PDF to Match Preview (Less Spacing)
```javascript
// In pdfService.js, change lineGap from 6 to 4
instructionLines.forEach(line => {
  doc.text(line, {
    align: 'left',
    width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
    lineGap: 4  // Changed from 6 (reduces to ~21px per line)
  });
});

// Adjust bottom padding from 10pt to 5pt
const endY = doc.y + 5;  // Already correct
// Change border calculation:
doc.rect(
  doc.page.margins.left - instructionBorderMargin,
  startY - 5,
  doc.page.width - doc.page.margins.left - doc.page.margins.right + (instructionBorderMargin * 2),
  endY - startY + 5  // Changed from +10 to +5
).stroke('#0066cc');
```

## Recommended Fix

**Option 1** is recommended because:
1. More spacing = better readability (important for legal instructions)
2. Avoids regression in PDF layout (which is the authoritative format)
3. Preview should match the final PDF, not vice versa
