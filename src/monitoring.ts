import { datadogRum } from '@datadog/browser-rum';

export function initializeMonitoring() {
  console.log(`practice-recorder ${import.meta.env.VITE_PRACTICE_VERSION}`);
  datadogRum.init({
      applicationId: 'cf5b1a0f-eb93-4fa2-a37f-6a5f3b2f9a76',
      clientToken: 'pub43c914b5be206019b947216e1f4b9d3c',
      // `site` refers to the Datadog site parameter of your organization
      // see https://docs.datadoghq.com/getting_started/site/
      site: 'datadoghq.com',
      service: 'practice-recorder',
      env: 'prod',
      // Specify a version number to identify the deployed version of your application in Datadog
      version: import.meta.env.VITE_PRACTICE_VERSION || 'v0.0.0',
      sessionSampleRate: 100,
      sessionReplaySampleRate: 20,
      defaultPrivacyLevel: 'mask-user-input',
  });
}

let userEmail = "";
export function setMonitoredUser(name: string, email: string, googleId: string) {
  userEmail = email;
  datadogRum.setUser({
    id: email.replace('@', '_at_'),
    name: name,
    email: email,
    googleId: googleId,
  });
}

interface SendRecordingEventData {
  user?: string;
  duration: number;
}

interface SendPlaybackEventData {
  user?: string;
  duration: number;
  playbackSpeed: number;
}

export function sendRecordingEvent(data: SendRecordingEventData) {
  data.user = userEmail;
  datadogRum.addAction('Recording', data);
}

export function sendPlaybackEvent(data: SendPlaybackEventData) {
  data.user = userEmail;
  datadogRum.addAction('Playback', data);
}
