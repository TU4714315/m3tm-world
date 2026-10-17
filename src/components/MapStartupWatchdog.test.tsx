import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MapStartupWatchdog from './MapStartupWatchdog';

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
describe('WorldMap pre-hydration watchdog', () => {
  it('shows real delayed state and allows manual recovery without auto-restarting map', () => {
    vi.useFakeTimers();
    const retry = vi.fn();
    const { rerender } = render(<MapStartupWatchdog ready={false} attempt={0} waitMs={1000} onRetry={retry}/>);
    expect(screen.queryByTestId('m3tm-world-startup-delayed')).toBeNull();
    act(() => vi.advanceTimersByTime(1001));
    expect(screen.getByTestId('m3tm-world-startup-delayed')).toBeTruthy();
    expect(retry).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'إعادة تهيئة الخريطة' }));
    expect(retry).toHaveBeenCalledTimes(1);
    rerender(<MapStartupWatchdog ready={true} attempt={0} waitMs={1000} onRetry={retry}/>);
    expect(screen.queryByTestId('m3tm-world-startup-delayed')).toBeNull();
  });
  it('does not label a map unavailable while its tab is hidden', () => {
    vi.useFakeTimers();
    const retry = vi.fn();
    const hidden = vi.spyOn(document, 'hidden', 'get');
    hidden.mockReturnValue(true);
    render(<MapStartupWatchdog ready={false} attempt={0} waitMs={1000} onRetry={retry}/>);
    act(() => vi.advanceTimersByTime(1200));
    expect(screen.queryByRole('alert')).toBeNull();
    hidden.mockReturnValue(false);
    act(() => { document.dispatchEvent(new Event('visibilitychange')); vi.advanceTimersByTime(1001); });
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});
