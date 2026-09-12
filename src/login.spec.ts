import { expect, describe, test, vi, beforeEach, afterEach } from "vitest";

const { setMonitoredUser } = vi.hoisted(() => ({ setMonitoredUser: vi.fn() }));
vi.mock("./monitoring", () => ({ setMonitoredUser }));

import googleLogin from "./login";

function makeJwt(payload: object): string {
  const base64url = (obj: object) => btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_");
  return `${base64url({ alg: "RS256" })}.${base64url(payload)}.signature`;
}

beforeEach(() => {
  document.body.innerHTML = '<div id="user"></div>';
  setMonitoredUser.mockClear();
  delete (window as any).google;
});

afterEach(() => {
  vi.useRealTimers();
  delete (window as any).google;
});

describe("googleLogin", () => {
  test("retries until window.google.accounts is available, then initializes and prompts", () => {
    vi.useFakeTimers();
    googleLogin();

    // Not yet available - no crash, nothing called yet.
    expect(true).toBe(true);

    const initialize = vi.fn();
    const prompt = vi.fn();
    (window as any).google = { accounts: { id: { initialize, prompt } } };

    vi.advanceTimersByTime(100);

    expect(initialize).toHaveBeenCalledTimes(1);
    const config = initialize.mock.calls[0][0];
    expect(config.client_id).toBe("1060381388264-frcdkvrnei1hv30mnbjdn0u0mm6mlaf2.apps.googleusercontent.com");
    expect(typeof config.callback).toBe("function");
    expect(prompt).toHaveBeenCalledTimes(1);
  });

  test("initializes immediately when google is already available", () => {
    const initialize = vi.fn();
    const prompt = vi.fn();
    (window as any).google = { accounts: { id: { initialize, prompt } } };

    googleLogin();

    expect(initialize).toHaveBeenCalledTimes(1);
    expect(prompt).toHaveBeenCalledTimes(1);
  });

  test("the credential callback decodes the JWT and registers the monitored user", () => {
    let callback: (response: { credential: string }) => void = () => {};
    (window as any).google = {
      accounts: { id: { initialize: (cfg: any) => { callback = cfg.callback; }, prompt: vi.fn() } },
    };

    googleLogin();

    const jwt = makeJwt({ name: "Jane Doe", email: "jane@example.com", sub: "google-123", given_name: "Jane" });
    callback({ credential: jwt });

    expect(setMonitoredUser).toHaveBeenCalledWith("Jane Doe", "jane@example.com", "google-123");
    expect((document.getElementById("user") as HTMLElement).innerText).toBe("Welcome Jane");
  });
});
