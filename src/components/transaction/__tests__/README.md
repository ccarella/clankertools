# Transaction Component Test Suite

This directory contains comprehensive test files for transaction status UI components following Test-Driven Development (TDD) principles.

## Test Files

### TransactionStatusCard.test.tsx
Tests for the individual transaction status card component that displays:
- Transaction details (type, status, hash, timestamps)
- Real-time status updates (pending, processing, success, failed)
- Progress indicators and animations
- User interactions (cancel, retry, copy hash, view in explorer)
- Mobile responsiveness and touch targets
- Accessibility features (ARIA labels, keyboard navigation)

### TransactionQueue.test.tsx
Tests for the transaction queue component that manages:
- Display of multiple transactions
- Filtering and sorting capabilities
- Bulk actions (select all, bulk cancel/retry)
- Real-time updates and live indicators
- Queue management (pause/resume, clear completed)
- Mobile-optimized views with collapsible filters
- Performance optimization (virtualization for long lists)

### TransactionHistory.test.tsx
Tests for the transaction history component that provides:
- Historical transaction display grouped by date
- Search and filtering functionality
- Pagination for long transaction lists
- Export capabilities (CSV, JSON)
- Analytics and summary statistics
- Mobile-responsive date headers and filters
- Lazy loading and virtualization for performance

## Component Requirements

When implementing these components, ensure they:

1. **Use existing UI components** from shadcn/ui:
   - Card, Badge, Button, Progress, Skeleton
   - DropdownMenu, Select, Checkbox
   - Separator, Alert, Tooltip

2. **Support mobile-first design**:
   - Minimum 44px touch targets
   - Responsive layouts with proper breakpoints
   - Optimized for viewport sizes 375px and up

3. **Implement real-time updates**:
   - WebSocket or polling for status changes
   - Optimistic UI updates
   - Proper error recovery

4. **Follow accessibility standards**:
   - ARIA labels and roles
   - Keyboard navigation support
   - Screen reader announcements

5. **Integrate with existing providers**:
   - HapticProvider for haptic feedback
   - FarcasterProvider for user context
   - Use existing hooks and utilities

## Running Tests

```bash
# Run all transaction component tests
npm test -- src/components/transaction/__tests__/

# Run specific test file
npm test -- src/components/transaction/__tests__/TransactionStatusCard.test.tsx

# Run tests in watch mode
npm test:watch -- src/components/transaction/__tests__/
```

## Implementation Notes

These tests define the expected behavior and API for the transaction components. When implementing:

1. Start with the simplest test cases
2. Build components incrementally to pass each test
3. Ensure mobile responsiveness from the start
4. Use existing design patterns from other components
5. Maintain high test coverage (>90%)

The mock component definitions in each test file serve as the type contracts for the actual implementations.