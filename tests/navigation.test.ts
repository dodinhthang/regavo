import assert from 'node:assert/strict';
import test from 'node:test';
import { protectMatchNavigation, returnToLobby } from '../src/ui/match-navigation.ts';

function navigationBrowser(previous = 'https://regavo.test/previous') {
  const target = new EventTarget();
  const entries: { url: string; state: unknown }[] = [
    { url: previous, state: null },
    { url: 'https://regavo.test/', state: { existing: 'retained' } },
  ];
  let index = 1;
  const location = {
    get href() {
      return entries[index].url;
    },
  };
  const history = {
    get state() {
      return entries[index].state;
    },
    pushState(state: unknown, _unused: string, url: string) {
      entries.splice(index + 1);
      entries.push({ state, url });
      index++;
    },
    replaceState(state: unknown, _unused: string, url: string) {
      entries[index] = { state, url };
    },
    go(delta: number) {
      // History traversal is asynchronous; pushState does not fire popstate.
      queueMicrotask(() => {
        const next = index + delta;
        if (next < 0 || next >= entries.length) return;
        index = next;
        target.dispatchEvent(new Event('popstate'));
      });
    },
    back() {
      this.go(-1);
    },
  };
  const browser = Object.assign(target, { history, location }) as unknown as Window;
  const refresh = () => {
    const event = new Event('beforeunload', { cancelable: true });
    Object.defineProperty(event, 'returnValue', { value: '', writable: true });
    target.dispatchEvent(event);
    return event;
  };
  return { browser, history, location, entries, refresh };
}

test('refresh is protected only while the match guard is active, with previous history state retained', async () => {
  const host = navigationBrowser();
  const guard = protectMatchNavigation(host.browser, () =>
    assert.fail('Refresh is handled by the browser dialog'),
  );
  assert.equal((host.history.state as { existing: string }).existing, 'retained');
  assert.equal(host.refresh().defaultPrevented, true);
  await guard.leave();
  assert.equal(host.refresh().defaultPrevented, false);
  assert.deepEqual(host.history.state, { existing: 'retained' });
  assert.equal(host.location.href, 'https://regavo.test/');
});

test('repeated Back attempts keep the live match and a bounded history until leaving is confirmed', async () => {
  const host = navigationBrowser();
  let requests = 0;
  const guard = protectMatchNavigation(host.browser, () => requests++);
  for (let attempt = 0; attempt < 3; attempt++) {
    host.history.back();
    await Promise.resolve();
    assert.equal(host.location.href, 'https://regavo.test/');
    assert.equal(host.entries.length, 3);
    assert.equal(host.refresh().defaultPrevented, true);
  }
  assert.equal(requests, 3);
  await guard.leave('history');
  assert.equal(host.location.href, 'https://regavo.test/previous');
  assert.equal(requests, 3);
  assert.equal(host.refresh().defaultPrevented, false);
});

test('leaving to the lobby removes the guard once and allows the next Back normally', async () => {
  const host = navigationBrowser();
  const guard = protectMatchNavigation(host.browser, () =>
    assert.fail('A released guard cannot request confirmation'),
  );
  const leaving = guard.leave('menu');
  assert.equal(guard.leave('menu'), leaving);
  await leaving;
  assert.equal(host.location.href, 'https://regavo.test/');
  host.history.back();
  await Promise.resolve();
  assert.equal(host.location.href, 'https://regavo.test/previous');
});

test('jumping back to an earlier same-document route preserves the intended destination after confirmation', async () => {
  const host = navigationBrowser('https://regavo.test/#workshop');
  let requests = 0;
  const guard = protectMatchNavigation(host.browser, () => requests++);
  host.history.go(-2);
  await Promise.resolve();
  assert.equal(host.location.href, 'https://regavo.test/');
  assert.equal(requests, 1);
  await guard.leave('history');
  assert.equal(host.location.href, 'https://regavo.test/#workshop');
  assert.equal(requests, 1);
});

test('confirmed exit after a workshop visit always lands on the lobby, including a Back jump', async () => {
  for (const jump of [false, true]) {
    const host = navigationBrowser('https://regavo.test/#workshop');
    // Starting a match from an existing workshop route leaves that hash behind.
    host.history.replaceState(host.history.state, '', 'https://regavo.test/#workshop');
    let requests = 0;
    const guard = protectMatchNavigation(host.browser, () => requests++);
    if (jump) {
      host.history.go(-2);
      await Promise.resolve();
      assert.equal(requests, 1);
    }
    await guard.leave('menu');
    returnToLobby(host.browser);
    guard.dispose();
    await Promise.resolve();
    assert.equal(host.location.href, 'https://regavo.test/');
    assert.equal(host.refresh().defaultPrevented, false);
  }
});

test('unmount cleanup restores state synchronously without a late history traversal', async () => {
  const host = navigationBrowser('https://regavo.test/#workshop');
  host.history.replaceState(host.history.state, '', 'https://regavo.test/#workshop');
  const guard = protectMatchNavigation(host.browser, () => assert.fail('Disposed guard'));
  returnToLobby(host.browser);
  guard.dispose();
  await Promise.resolve();
  assert.equal(host.location.href, 'https://regavo.test/');
  assert.deepEqual(host.history.state, { existing: 'retained' });
  assert.equal(host.refresh().defaultPrevented, false);
});
