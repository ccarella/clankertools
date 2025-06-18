import React from 'react';
import { render, screen } from '@testing-library/react';
import { CastContextDisplay } from '../CastContextDisplay';
import { CastContext } from '@/lib/types/cast-context';

describe('CastContextDisplay', () => {
  it('should display cast context information', () => {
    const castContext: CastContext = {
      type: 'cast',
      castId: '0x1234567890abcdef',
      parentCastId: '0x0987654321fedcba',
      author: {
        fid: 123,
        username: 'testuser',
        displayName: 'Test User',
        pfpUrl: 'https://example.com/pfp.png'
      },
      embedUrl: 'https://example.com/frame'
    };

    render(<CastContextDisplay context={castContext} />);

    expect(screen.getByText('Launched from cast')).toBeInTheDocument();
    expect(screen.getByText('@testuser')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View cast/i })).toHaveAttribute(
      'href',
      'https://warpcast.com/testuser/0x1234567890abcdef'
    );
  });

  it('should display parent cast link when available', () => {
    const castContext: CastContext = {
      type: 'cast',
      castId: '0x1234567890abcdef',
      parentCastId: '0x0987654321fedcba',
      author: {
        fid: 123,
        username: 'testuser',
        displayName: 'Test User'
      }
    };

    render(<CastContextDisplay context={castContext} />);

    expect(screen.getByText('Reply to parent cast')).toBeInTheDocument();
    const parentLink = screen.getByText('Reply to parent cast').closest('a');
    expect(parentLink).toHaveAttribute(
      'href',
      'https://warpcast.com/~/conversations/0x0987654321fedcba'
    );
  });

  it('should not display parent cast link when not available', () => {
    const castContext: CastContext = {
      type: 'cast',
      castId: '0x1234567890abcdef',
      author: {
        fid: 123,
        username: 'testuser',
        displayName: 'Test User'
      }
    };

    render(<CastContextDisplay context={castContext} />);

    expect(screen.queryByText('Reply to parent cast')).not.toBeInTheDocument();
  });

  it('should handle null context', () => {
    render(<CastContextDisplay context={null} />);

    expect(screen.queryByText('Launched from cast')).not.toBeInTheDocument();
  });

  it('should display author profile image when available', () => {
    const castContext: CastContext = {
      type: 'cast',
      castId: '0x1234567890abcdef',
      author: {
        fid: 123,
        username: 'testuser',
        displayName: 'Test User',
        pfpUrl: 'https://example.com/pfp.png'
      }
    };

    render(<CastContextDisplay context={castContext} />);

    const profileImage = screen.getByAltText('Test User');
    expect(profileImage).toHaveAttribute('src', 'https://example.com/pfp.png');
  });

  it('should display placeholder when no profile image', () => {
    const castContext: CastContext = {
      type: 'cast',
      castId: '0x1234567890abcdef',
      author: {
        fid: 123,
        username: 'testuser',
        displayName: 'Test User'
      }
    };

    render(<CastContextDisplay context={castContext} />);

    expect(screen.getByText('TE')).toBeInTheDocument(); // Initials
  });

  it('should truncate long cast IDs', () => {
    const castContext: CastContext = {
      type: 'cast',
      castId: '0x1234567890abcdef1234567890abcdef',
      author: {
        fid: 123,
        username: 'testuser',
        displayName: 'Test User'
      }
    };

    render(<CastContextDisplay context={castContext} />);

    expect(screen.getByText('Cast ID: 0x123456...cdef')).toBeInTheDocument();
  });
});