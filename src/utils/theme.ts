interface ContrastResult {
  ratio: number
  passes: {
    normal: {
      AA: boolean
      AAA: boolean
    }
    large: {
      AA: boolean
      AAA: boolean
    }
  }
}

export const draculaTheme = {
  background: '#282A36',
  currentLine: '#44475A',
  foreground: '#F8F8F2',
  comment: '#6272A4',
  cyan: '#8BE9FD',
  green: '#50FA7B',
  orange: '#FFB86C',
  pink: '#FF79C6',
  purple: '#BD93F9',
  red: '#FF5555',
  yellow: '#F1FA8C',
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null
}

function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

export function validateContrast(bg: string, fg: string): ContrastResult {
  const bgRgb = hexToRgb(bg)
  const fgRgb = hexToRgb(fg)

  if (!bgRgb || !fgRgb) {
    throw new Error('Invalid color format')
  }

  const bgLuminance = getLuminance(bgRgb.r, bgRgb.g, bgRgb.b)
  const fgLuminance = getLuminance(fgRgb.r, fgRgb.g, fgRgb.b)

  const ratio =
    (Math.max(bgLuminance, fgLuminance) + 0.05) /
    (Math.min(bgLuminance, fgLuminance) + 0.05)

  return {
    ratio,
    passes: {
      normal: {
        AA: ratio >= 4.5,
        AAA: ratio >= 7,
      },
      large: {
        AA: ratio >= 3,
        AAA: ratio >= 4.5,
      },
    },
  }
}

export function getThemeColors(): Record<string, string> {
  return {
    '--background': draculaTheme.foreground,
    '--foreground': draculaTheme.background,
    '--card': draculaTheme.foreground,
    '--card-foreground': draculaTheme.background,
    '--popover': draculaTheme.foreground,
    '--popover-foreground': draculaTheme.background,
    '--primary': draculaTheme.purple,
    '--primary-foreground': draculaTheme.foreground,
    '--secondary': draculaTheme.pink,
    '--secondary-foreground': draculaTheme.foreground,
    '--muted': draculaTheme.comment,
    '--muted-foreground': draculaTheme.background,
    '--accent': draculaTheme.cyan,
    '--accent-foreground': draculaTheme.background,
    '--destructive': draculaTheme.red,
    '--destructive-foreground': draculaTheme.foreground,
    '--border': draculaTheme.comment,
    '--input': draculaTheme.currentLine,
    '--ring': draculaTheme.purple,
    '--chart-1': draculaTheme.cyan,
    '--chart-2': draculaTheme.green,
    '--chart-3': draculaTheme.orange,
    '--chart-4': draculaTheme.pink,
    '--chart-5': draculaTheme.purple,
  }
}