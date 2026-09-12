import { expect, describe, test, vi, beforeEach } from "vitest";

const { init, setUser, addAction } = vi.hoisted(() => ({
  init: vi.fn(),
  setUser: vi.fn(),
  addAction: vi.fn(),
}));

vi.mock("@datadog/browser-rum", () => ({
  datadogRum: { init, setUser, addAction },
}));

import {
  initializeMonitoring,
  setMonitoredUser,
  sendRecordingEvent,
  sendPlaybackEvent,
} from "./monitoring";

beforeEach(() => {
  init.mockClear();
  setUser.mockClear();
  addAction.mockClear();
});

describe("initializeMonitoring", () => {
  test("initializes datadog RUM with the expected fixed config", () => {
    initializeMonitoring();
    expect(init).toHaveBeenCalledTimes(1);
    const config = init.mock.calls[0][0];
    expect(config.applicationId).toBe("cf5b1a0f-eb93-4fa2-a37f-6a5f3b2f9a76");
    expect(config.service).toBe("practice-recorder");
    expect(config.env).toBe("prod");
  });
});

describe("setMonitoredUser", () => {
  test("registers the user with datadog, deriving id from email", () => {
    setMonitoredUser("Jane Doe", "jane@example.com", "google-123");
    expect(setUser).toHaveBeenCalledWith({
      id: "jane_at_example.com",
      name: "Jane Doe",
      email: "jane@example.com",
      googleId: "google-123",
    });
  });

  test("subsequent events are tagged with the monitored user's email", () => {
    setMonitoredUser("Jane Doe", "jane@example.com", "google-123");
    sendRecordingEvent({ duration: 12.5 });
    expect(addAction).toHaveBeenCalledWith("Recording", { duration: 12.5, user: "jane@example.com" });
  });
});

describe("sendRecordingEvent / sendPlaybackEvent", () => {
  test("sendRecordingEvent reports a 'Recording' action with the given data", () => {
    sendRecordingEvent({ duration: 5 });
    expect(addAction).toHaveBeenCalledWith("Recording", expect.objectContaining({ duration: 5 }));
  });

  test("sendPlaybackEvent reports a 'Playback' action including playback speed", () => {
    sendPlaybackEvent({ duration: 5, playbackSpeed: 0.5 });
    expect(addAction).toHaveBeenCalledWith(
      "Playback",
      expect.objectContaining({ duration: 5, playbackSpeed: 0.5 }),
    );
  });
});
