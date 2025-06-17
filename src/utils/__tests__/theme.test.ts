import { draculaTheme, validateContrast, getThemeColors } from '../theme'

describe('Dracula Theme', () => {
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
    it('should validate good contrast between background and foreground', () => {
      const result = validateContrast(draculaTheme.background, draculaTheme.foreground)
      expect(result.ratio).toBeGreaterThan(7) // WCAG AAA standard
      expect(result.passes.normal.AA).toBe(true)
      expect(result.passes.normal.AAA).toBe(true)
    })

    it('should validate contrast for all text colors against background', () => {
      const textColors = [
        draculaTheme.foreground,
        draculaTheme.cyan,
        draculaTheme.green,
        draculaTheme.orange,
        draculaTheme.pink,
        draculaTheme.purple,
        draculaTheme.red,
        draculaTheme.yellow,
      ]

      textColors.forEach(color => {
        const result = validateContrast(draculaTheme.background, color)
        expect(result.passes.normal.AA).toBe(true)
      })
    })

    it('should validate contrast for comment color', () => {
      const result = validateContrast(draculaTheme.background, draculaTheme.comment)
      // Comment color has lower contrast by design in Dracula theme
      expect(result.ratio).toBeGreaterThan(3) // Should at least pass large text AA
      expect(result.passes.large.AA).toBe(true)
    })
  })

  describe('getThemeColors', () => {
    it('should return CSS variables object for light mode', () => {
      const colors = getThemeColors('light')
      
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

    it('should return CSS variables object for dark mode', () => {
      const colors = getThemeColors('dark')
      
      expect(colors['--background']).toBe('#282A36')
      expect(colors['--foreground']).toBe('#F8F8F2')
      expect(colors['--primary']).toBe('#BD93F9')
      expect(colors['--secondary']).toBe('#FF79C6')
      expect(colors['--accent']).toBe('#8BE9FD')
      expect(colors['--destructive']).toBe('#FF5555')
      expect(colors['--muted']).toBe('#6272A4')
      expect(colors['--card']).toBe('#44475A')
      expect(colors['--popover']).toBe('#44475A')
    })

    it('should include all required CSS variables', () => {
      const colors = getThemeColors('dark')
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
  })
})