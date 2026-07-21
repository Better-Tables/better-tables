import { afterEach, beforeEach } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register();

/**
 * Global viewport baseline.
 *
 * Several components branch on `window.innerWidth` in a mount effect (e.g.
 * `FilterBadge` picks a dialog-vs-popover shell; `FilterDropdown` a mobile
 * sheet). `window` is a single happy-dom instance shared by every test file in
 * the process, so a test that sets a mobile width and doesn't restore it would
 * leak that width into unrelated files — flipping `isMobile` on mount there and
 * causing extra renders (this is what made the ActiveFilters render-count tests
 * pass in isolation but fail in the full suite).
 *
 * Reset to a desktop width before AND after every test so each test starts from
 * a known viewport and can't pollute the next. A test that needs a different
 * width sets it in its own body (which runs after this `beforeEach`).
 */
const DESKTOP_WIDTH = 1024;

function setViewportWidth(width: number): void {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
}

beforeEach(() => {
  setViewportWidth(DESKTOP_WIDTH);
});

afterEach(() => {
  setViewportWidth(DESKTOP_WIDTH);
});
