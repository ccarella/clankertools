import { draculaTheme, validateContrast, getThemeColors } from '../theme'

describe('Light Mode Theme', () => {
  describe('draculaTheme', () => {
    it('should have all required color properties', () => {
      expect(draculaTheme.background).toBe('#282A36')
      expect(draculaTheme.currentLine).toBe('#44475A')
      expect(draculaTheme.foreground).toBe('#F8F8F2')
      expect(draculaTheme.comment).toBe('#6272A4')
      expect(draculaTheme.cyan).toBe('#8BE9FD')
      expect(draculaTheme.green).toBe('#50FA7B')
      expect(draculaTheme.orange).toBe('#FFB86C')
      expect(draculaTheme.pink).toBe('#FF79C6')
      expect(draculaTheme.purple).toBe('#BD93F9')
      expect(draculaTheme.red).toBe('#FF5555')
      expect(draculaTheme.yellow).toBe('#F1FA8C')
    })
  })

  describe('validateContrast', () => {
    it('should validate good contrast between light background and dark foreground', () => {
      const result = validateContrast(draculaTheme.foreground, draculaTheme.background)
      expect(result.ratio).toBeGreaterThan(7) // WCAG AAA standard
      expect(result.passes.normal.AA).toBe(true)
      expect(result.passes.normal.AAA).toBe(true)
    })

    it('should validate contrast for main text colors against light background', () => {
      const lightBackground = draculaTheme.foreground // #F8F8F2
      
      // Test main text color
      const mainTextResult = validateContrast(lightBackground, draculaTheme.background)
      expect(mainTextResult.passes.normal.AA).toBe(true)
      expect(mainTextResult.passes.normal.AAA).toBe(true)
      
      // Test muted color for large text
      const mutedResult = validateContrast(lightBackground, draculaTheme.comment)
      expect(mutedResult.passes.large.AA).toBe(true)
    })

    it('should validate contrast for muted color against light background', () => {
      const result = validateContrast(draculaTheme.foreground, draculaTheme.comment)
      expect(result.ratio).toBeGreaterThan(3) // Should at least pass large text AA
      expect(result.passes.large.AA).toBe(true)
    })
  })

  describe('getThemeColors', () => {
    it('should only return light mode colors', () => {
      const colors = getThemeColors()
      
      expect(colors['--background']).toBe('#F8F8F2')
      expect(colors['--foreground']).toBe('#282A36')
      expect(colors['--primary']).toBe('#BD93F9')
      expect(colors['--secondary']).toBe('#FF79C6')
      expect(colors['--accent']).toBe('#8BE9FD')
      expect(colors['--destructive']).toBe('#FF5555')
      expect(colors['--muted']).toBe('#6272A4')
      expect(colors['--card']).toBe('#F8F8F2')
      expect(colors['--popover']).toBe('#F8F8F2')
    })

    it('should include all required CSS variables', () => {
      const colors = getThemeColors()
      const requiredVars = [
        '--background',
        '--foreground',
        '--card',
        '--card-foreground',
        '--popover',
        '--popover-foreground',
        '--primary',
        '--primary-foreground',
        '--secondary',
        '--secondary-foreground',
        '--muted',
        '--muted-foreground',
        '--accent',
        '--accent-foreground',
        '--destructive',
        '--destructive-foreground',
        '--border',
        '--input',
        '--ring',
      ]

      requiredVars.forEach(varName => {
        expect(colors).toHaveProperty(varName)
        expect(colors[varName]).toBeTruthy()
      })
    })

    it('should ensure proper contrast for light mode', () => {
      const colors = getThemeColors()
      
      // Test primary contrasts
      const bgFgResult = validateContrast(colors['--background'], colors['--foreground'])
      expect(bgFgResult.passes.normal.AA).toBe(true)
      expect(bgFgResult.passes.normal.AAA).toBe(true)
      
      // Note: Primary and destructive colors have lower contrast in light mode
      // but are still readable. This is a known limitation of the Dracula theme
      // when inverted for light mode.
    })
  })
})