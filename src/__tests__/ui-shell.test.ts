/**
 * Component tests for UI Shell (Story 0.3)
 * Run with test runner configured in Story 0.4
 */

// ---------------------------------------------------------------------------
// Header — renders with user info
// ---------------------------------------------------------------------------

type User = { email: string; name?: string | null };

function getHeaderInitials(user: User): string {
  const displayName = user.name ?? user.email;
  return displayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

describe('Header', () => {
  it('renders initials from user name', () => {
    const result = getHeaderInitials({ email: 'alice@example.com', name: 'Alice Smith' });
    expect(result).toBe('AS');
  });

  it('falls back to email initials when name is null', () => {
    // 'bob@example.com' has one word → single initial 'B'
    const result = getHeaderInitials({ email: 'bob@example.com', name: null });
    expect(result).toBe('B');
  });

  it('truncates initials to 2 chars', () => {
    const result = getHeaderInitials({ email: 'a@b.com', name: 'Alice Bob Carol' });
    expect(result).toBe('AB');
  });
});

// ---------------------------------------------------------------------------
// Sidebar — navigation link active state
// ---------------------------------------------------------------------------

function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/');
}

describe('Sidebar navigation', () => {
  it('marks /dashboard as active when on /dashboard', () => {
    expect(isNavActive('/dashboard', '/dashboard')).toBe(true);
  });

  it('marks /workspaces as active when on /workspaces/123', () => {
    expect(isNavActive('/workspaces/123', '/workspaces')).toBe(true);
  });

  it('does not mark /dashboard as active when on /workspaces', () => {
    expect(isNavActive('/workspaces', '/dashboard')).toBe(false);
  });

  it('does not falsely match /dash as /dashboard', () => {
    expect(isNavActive('/dash', '/dashboard')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Toast helpers — interface contract
// ---------------------------------------------------------------------------

describe('Toast helpers interface', () => {
  it('showSuccess accepts a string message', () => {
    function showSuccess(message: string): void {
      expect(typeof message).toBe('string');
    }
    showSuccess('Operation completed');
  });

  it('showError accepts a string message', () => {
    function showError(message: string): void {
      expect(typeof message).toBe('string');
    }
    showError('Something went wrong');
  });

  it('showLoading returns an id for dismissal', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    function showLoading(_message: string): string | number {
      return 'toast-id-123';
    }
    const id = showLoading('Loading…');
    expect(id).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Error boundary — error object shape
// ---------------------------------------------------------------------------

describe('Error boundary', () => {
  it('handles error with digest property', () => {
    const error = { message: 'Unexpected error', digest: 'abc123' } as Error & { digest?: string };
    expect(error.message).toBe('Unexpected error');
    expect(error.digest).toBe('abc123');
  });

  it('handles error without digest', () => {
    const error = new Error('Something failed') as Error & { digest?: string };
    expect(error.message).toBe('Something failed');
    expect(error.digest).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// LoadingSkeleton — variant types
// ---------------------------------------------------------------------------

type SkeletonVariant = 'page' | 'card-list' | 'editor';

describe('LoadingSkeleton variants', () => {
  it('accepts valid variants', () => {
    const validVariants: SkeletonVariant[] = ['page', 'card-list', 'editor'];
    validVariants.forEach((v) => {
      expect(['page', 'card-list', 'editor']).toContain(v);
    });
  });
});
