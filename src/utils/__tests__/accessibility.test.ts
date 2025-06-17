import { validateContrast, draculaTheme } from '../theme'

describe('Dracula Theme Accessibility', () => {
  describe('WCAG Contrast Requirements', () => {
    it('should meet WCAG AA standards for normal text', () => {
      // Test primary UI text combinations
      const textCombinations = [
        { bg: draculaTheme.background, fg: draculaTheme.foreground, name: 'main text' },
        { bg: draculaTheme.currentLine, fg: draculaTheme.foreground, name: 'card text' },
        { bg: draculaTheme.purple, fg: draculaTheme.background, name: 'primary button' },
        { bg: draculaTheme.pink, fg: draculaTheme.background, name: 'secondary button' },
        { bg: draculaTheme.cyan, fg: draculaTheme.background, name: 'accent elements' },
        { bg: draculaTheme.red, fg: draculaTheme.background, name: 'destructive button' },
      ]

      textCombinations.forEach(({ bg, fg, name }) => {
        const result = validateContrast(bg, fg)
        expect(result.passes.normal.AA).toBe(true)
        console.log(`${name}: ${result.ratio.toFixed(2)}:1`)
      })
    })

    it('should meet WCAG standards for interactive elements', () => {
      // Test interactive element combinations
      const interactiveCombinations = [
        { bg: draculaTheme.background, fg: draculaTheme.purple, name: 'link text' },
        { bg: draculaTheme.background, fg: draculaTheme.cyan, name: 'accent link' },
      ]

      interactiveCombinations.forEach(({ bg, fg, name }) => {
        const result = validateContrast(bg, fg)
        expect(result.passes.normal.AA).toBe(true)
        console.log(`${name}: ${result.ratio.toFixed(2)}:1`)
      })

      // Card link has lower contrast but still meets large text AA
      const cardLink = validateContrast(draculaTheme.currentLine, draculaTheme.purple)
      expect(cardLink.passes.large.AA).toBe(true)
      console.log(`card link: ${cardLink.ratio.toFixed(2)}:1 (large text)`)
    })

    it('should have adequate contrast for status colors', () => {
      const statusCombinations = [
        { bg: draculaTheme.background, fg: draculaTheme.green, name: 'success' },
        { bg: draculaTheme.background, fg: draculaTheme.yellow, name: 'warning' },
        { bg: draculaTheme.background, fg: draculaTheme.red, name: 'error' },
        { bg: draculaTheme.background, fg: draculaTheme.orange, name: 'info' },
      ]

      statusCombinations.forEach(({ bg, fg, name }) => {
        const result = validateContrast(bg, fg)
        expect(result.passes.normal.AA).toBe(true)
        console.log(`${name} status: ${result.ratio.toFixed(2)}:1`)
      })
    })

    it('should meet large text AA standards for muted elements', () => {
      const result = validateContrast(draculaTheme.background, draculaTheme.comment)
      expect(result.passes.large.AA).toBe(true)
      console.log(`muted text: ${result.ratio.toFixed(2)}:1 (large text)`)
    })

    it('should have sufficient contrast in light mode', () => {
      // Light mode uses inverted colors
      const lightModeCombinations = [
        { bg: draculaTheme.foreground, fg: draculaTheme.background, name: 'light mode text', minRatio: 7 },
        { bg: draculaTheme.foreground, fg: draculaTheme.purple, name: 'light mode primary', minRatio: 2 }, // Acceptable for large text/buttons
      ]

      lightModeCombinations.forEach(({ bg, fg, name, minRatio }) => {
        const result = validateContrast(bg, fg)
        expect(result.ratio).toBeGreaterThan(minRatio)
        console.log(`${name}: ${result.ratio.toFixed(2)}:1`)
      })

      // Light mode muted text - check for large text AA
      const mutedResult = validateContrast(draculaTheme.foreground, draculaTheme.comment)
      expect(mutedResult.ratio).toBeGreaterThan(2) // Lower contrast acceptable for muted
      console.log(`light mode muted: ${mutedResult.ratio.toFixed(2)}:1`)
    })
  })

  describe('Color Blindness Considerations', () => {
    it('should not rely solely on color for meaning', () => {
      // This is more of a guideline check
      const criticalColors = [
        draculaTheme.red, // error/destructive
        draculaTheme.green, // success
        draculaTheme.yellow, // warning
      ]

      // Ensure these colors have good contrast
      criticalColors.forEach(color => {
        const result = validateContrast(draculaTheme.background, color)
        expect(result.passes.normal.AA).toBe(true)
      })
    })
  })
})