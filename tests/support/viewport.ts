import { test } from 'vite-plus/test'

// The browser project runs every file twice: at desktop width and at phone
// width. This is the app's `md` breakpoint, the same one the toolkit uses to
// name mobile screenshot baselines.
const phoneBreakpoint = 768

export const isPhone = () => window.innerWidth < phoneBreakpoint

// A test for one viewport. On the other instance it shows as skipped, where an
// early `return` would pass without asserting anything.
export const phoneOnly = test.runIf(isPhone())

export const desktopOnly = test.runIf(!isPhone())
