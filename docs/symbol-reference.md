# NeedlePoint Designer - Symbol Reference

This document defines the standard symbols used for printed pattern charts.

## Symbol Tiers

Symbols are assigned in order of visual distinctiveness. Tier 1 symbols are used first.

### Tier 1: Primary Symbols (Most Distinct)
Use these first - they're the most visually distinct and print clearly.

| Symbol | Unicode | Name | Best For |
|:------:|---------|------|----------|
| ● | U+25CF | Black Circle | Dark colors (Black, Navy) |
| ■ | U+25A0 | Black Square | Bold colors |
| ▲ | U+25B2 | Black Triangle | Warm colors |
| ★ | U+2605 | Black Star | Accent colors |
| ◆ | U+25C6 | Black Diamond | Medium tones |
| ✕ | U+2715 | Multiplication X | Neutral colors |
| ♦ | U+2666 | Diamond Suit | Rich colors |
| ♥ | U+2665 | Heart Suit | Reds/Pinks |

### Tier 2: Secondary Symbols (Clear Outlines)
Use when Tier 1 is exhausted.

| Symbol | Unicode | Name | Best For |
|:------:|---------|------|----------|
| ○ | U+25CB | White Circle | Light colors |
| □ | U+25A1 | White Square | Pastels |
| △ | U+25B3 | White Triangle | Light warm tones |
| ☆ | U+2606 | White Star | Highlights |
| ◇ | U+25C7 | White Diamond | Light accents |
| ✚ | U+271A | Heavy Greek Cross | Greens |
| ⬡ | U+2B21 | White Hexagon | Blues |
| ♠ | U+2660 | Spade Suit | Dark accents |

### Tier 3: Alphanumeric (Extended Palette)
Use for patterns with many colors (17+).

| Symbol | Category |
|:------:|----------|
| A B C D E F G H I J K L M N O P Q R S T U V W X Y Z | Letters |
| 1 2 3 4 5 6 7 8 9 0 | Numbers |

### Tier 4: Additional Shapes
For very complex patterns (40+ colors).

| Symbol | Unicode | Name |
|:------:|---------|------|
| ◐ | U+25D0 | Circle Left Half |
| ◑ | U+25D1 | Circle Right Half |
| ◒ | U+25D2 | Circle Bottom Half |
| ◓ | U+25D3 | Circle Top Half |
| ⊕ | U+2295 | Circled Plus |
| ⊗ | U+2297 | Circled Times |
| ⊞ | U+229E | Squared Plus |
| ⊠ | U+22A0 | Squared Times |

---

## Example: DMC Color to Symbol Mapping

A typical pattern might assign symbols like this:

| Symbol | DMC Code | Color Name | RGB |
|:------:|----------|------------|-----|
| ● | 310 | Black | (0, 0, 0) |
| ■ | 820 | Very Dark Royal Blue | (14, 57, 105) |
| ▲ | 321 | Red | (199, 43, 59) |
| ★ | 444 | Dark Lemon | (255, 214, 0) |
| ◆ | 700 | Bright Green | (7, 115, 27) |
| ✕ | 415 | Pearl Gray | (175, 175, 175) |
| ○ | B5200 | Snow White | (255, 255, 255) |
| □ | 818 | Baby Pink | (255, 223, 217) |
| △ | 3823 | Ultra Pale Yellow | (255, 253, 227) |
| ☆ | 746 | Off White | (252, 252, 238) |

---

## Sample Pattern Chart

Here's how a simple 10x10 pattern would look with symbols:

```
    1   2   3   4   5   6   7   8   9  10
  ┌───┬───┬───┬───┬───┬───┬───┬───┬───┬───┐
1 │ ○ │ ○ │ ○ │ ▲ │ ▲ │ ▲ │ ▲ │ ○ │ ○ │ ○ │
  ├───┼───┼───┼───┼───┼───┼───┼───┼───┼───┤
2 │ ○ │ ○ │ ▲ │ ▲ │ ★ │ ★ │ ▲ │ ▲ │ ○ │ ○ │
  ├───┼───┼───┼───┼───┼───┼───┼───┼───┼───┤
3 │ ○ │ ▲ │ ▲ │ ★ │ ★ │ ★ │ ★ │ ▲ │ ▲ │ ○ │
  ├───┼───┼───┼───┼───┼───┼───┼───┼───┼───┤
4 │ ▲ │ ▲ │ ★ │ ★ │ ● │ ● │ ★ │ ★ │ ▲ │ ▲ │
  ├───┼───┼───┼───┼───┼───┼───┼───┼───┼───┤
5 │ ▲ │ ★ │ ★ │ ● │ ● │ ● │ ● │ ★ │ ★ │ ▲ │
  ├───┼───┼───┼───┼───┼───┼───┼───┼───┼───┤
6 │ ▲ │ ★ │ ★ │ ● │ ● │ ● │ ● │ ★ │ ★ │ ▲ │
  ├───┼───┼───┼───┼───┼───┼───┼───┼───┼───┤
7 │ ▲ │ ▲ │ ★ │ ★ │ ● │ ● │ ★ │ ★ │ ▲ │ ▲ │
  ├───┼───┼───┼───┼───┼───┼───┼───┼───┼───┤
8 │ ○ │ ▲ │ ▲ │ ★ │ ★ │ ★ │ ★ │ ▲ │ ▲ │ ○ │
  ├───┼───┼───┼───┼───┼───┼───┼───┼───┼───┤
9 │ ○ │ ○ │ ▲ │ ▲ │ ★ │ ★ │ ▲ │ ▲ │ ○ │ ○ │
  ├───┼───┼───┼───┼───┼───┼───┼───┼───┼───┤
10│ ○ │ ○ │ ○ │ ▲ │ ▲ │ ▲ │ ▲ │ ○ │ ○ │ ○ │
  └───┴───┴───┴───┴───┴───┴───┴───┴───┴───┘

LEGEND:
  ○ = DMC B5200 (Snow White)
  ▲ = DMC 321 (Red)
  ★ = DMC 444 (Dark Lemon)
  ● = DMC 310 (Black)
```

---

## High-Contrast Mode (Accessibility)

For users with vision impairments, use only these highly distinct symbols:

| Symbol | Alternate |
|:------:|:---------:|
| ● | (filled) |
| ○ | (empty) |
| ■ | (square) |
| ▲ | (up arrow) |
| ▼ | (down arrow) |
| ✕ | (cross) |
| ✚ | (plus) |
| ★ | (star) |

Avoid using:
- Similar shapes (○ vs ◯)
- Thin lines that may not print well
- Symbols that look alike when rotated

---

## Symbol Assignment Algorithm

When auto-assigning symbols:

1. **Sort colors by usage** - Most-used colors get Tier 1 symbols
2. **Consider contrast** - Dark colors get filled symbols (●■▲), light colors get outline symbols (○□△)
3. **Group by family** - Similar colors can use related symbols (all triangles for warm tones)
4. **Avoid confusion** - Never use both O (letter) and ○ (circle) in the same pattern

---

## Implementation Constants

```typescript
// Symbol sets for automatic assignment
export const PATTERN_SYMBOLS = {
  tier1: ['●', '■', '▲', '★', '◆', '✕', '♦', '♥'],
  tier2: ['○', '□', '△', '☆', '◇', '✚', '⬡', '♠'],
  tier3: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
  tier4: ['◐', '◑', '◒', '◓', '⊕', '⊗', '⊞', '⊠'],

  // Combined in order of assignment
  all: [
    '●', '■', '▲', '★', '◆', '✕', '♦', '♥',
    '○', '□', '△', '☆', '◇', '✚', '⬡', '♠',
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H',
    'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P',
    'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X',
    'Y', 'Z', '1', '2', '3', '4', '5', '6',
    '7', '8', '9', '0',
    '◐', '◑', '◒', '◓', '⊕', '⊗', '⊞', '⊠',
  ],

  // High contrast subset for accessibility
  highContrast: ['●', '○', '■', '▲', '▼', '✕', '✚', '★'],
};

// For filled vs outline assignment based on color lightness
export function getSymbolForLightness(lightness: number, index: number): string {
  const filled = ['●', '■', '▲', '◆', '★'];
  const outline = ['○', '□', '△', '◇', '☆'];

  const symbols = lightness < 50 ? filled : outline;
  return symbols[index % symbols.length];
}
```

---

## Font Recommendations

For best printing results, use fonts that render these symbols clearly:

| Font | Platform | Notes |
|------|----------|-------|
| **Segoe UI Symbol** | Windows | Good Unicode coverage |
| **Arial Unicode MS** | Cross-platform | Widely available |
| **DejaVu Sans** | Linux | Open source, complete |
| **Noto Sans Symbols** | Cross-platform | Google font, excellent coverage |

For PDF export, embed the font to ensure symbols render correctly on any system.
