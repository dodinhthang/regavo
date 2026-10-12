import { useCallback, useEffect, useRef } from 'react';

export type ExitReason = 'menu' | 'history';
const MARKER = 'regavoMatchGuard';

/** One same-document entry catches Back before the live match is unmounted. */
export function protectMatchNavigation(browser: Window, onBack: () => void) {
  const { history } = browser;
  const url = browser.location.href;
  const token = crypto.randomUUID();
  const state = {
    ...(history.state && typeof history.state === 'object' ? history.state : {}),
    [MARKER]: token,
  };
  let released = false;
  let leaving: Promise<void> | undefined;
  let historyExitDelta = -2;
  history.pushState(state, '', url);
  const beforeUnload = (event: BeforeUnloadEvent) => {
    event.preventDefault();
    event.returnValue = 'Trận đấu đang diễn ra.';
  };
  const pop = () => {
    if (released || history.state?.[MARKER] === token) return;
    historyExitDelta = browser.location.href === url ? -2 : -1;
    history.pushState(state, '', url);
    onBack();
  };
  browser.addEventListener('beforeunload', beforeUnload);
  browser.addEventListener('popstate', pop);
  const detach = () => {
    released = true;
    browser.removeEventListener('beforeunload', beforeUnload);
    browser.removeEventListener('popstate', pop);
  };
  const leave = (reason: ExitReason = 'menu'): Promise<void> => {
    if (leaving) return leaving;
    if (released) return Promise.resolve();
    detach();
    const ownsEntry = history.state?.[MARKER] === token;
    if (!ownsEntry && reason !== 'history') return Promise.resolve();
    // Finish traversal before React chooses the next screen. A delayed hashchange
    // must not put the workshop back on top of the freshly rendered lobby.
    leaving = new Promise<void>((resolve) => {
      browser.addEventListener('popstate', () => resolve(), { once: true });
      if (ownsEntry) history.go(reason === 'history' ? historyExitDelta : -1);
      else history.back();
    });
    return leaving;
  };
  const dispose = () => {
    if (released) return;
    detach();
    if (history.state?.[MARKER] === token) {
      const previous = { ...state };
      delete previous[MARKER];
      history.replaceState(previous, '', browser.location.href);
    }
  };
  return { leave, dispose };
}

/** All confirmed match exits land on the home screen, including Back from a workshop visit. */
export function returnToLobby(browser: Window) {
  const url = new URL(browser.location.href);
  url.hash = '';
  browser.history.replaceState(browser.history.state, '', url.href);
}

export function useMatchNavigationGuard(enabled: boolean, onBack: () => void) {
  const guard = useRef<ReturnType<typeof protectMatchNavigation> | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const current = protectMatchNavigation(window, onBack);
    guard.current = current;
    return () => {
      current.dispose();
      guard.current = null;
    };
  }, [enabled, onBack]);
  return useCallback((reason: ExitReason) => guard.current?.leave(reason) ?? Promise.resolve(), []);
}
