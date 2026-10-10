import { setMonitoredUser } from "./monitoring";

declare global {
  interface Window {
    google: any;
  }
}

interface LoginOptions {
  // Report the signed-in user to Datadog.
  monitoring: boolean;
  // Also sign in to the cloud so saves sync across devices.
  sync: boolean;
}

export function googleSignOut() {
  // Stop One Tap from instantly signing the user back in.
  window.google?.accounts?.id?.disableAutoSelect();
  (document.getElementById('user') as HTMLElement).innerText = "";
}

export default function googleLogin({ monitoring, sync }: LoginOptions) {
  // Firebase project practice-a5502's Web client. Firebase Auth only accepts
  // Google ID tokens issued to its own client, so sign-in must use this one.
  const CLIENT_ID = "1024885093535-m463vjrf17cdeharsmnt4jilfknhsuep.apps.googleusercontent.com";

  // Decode JWT response to get user data
  const decodeJwtResponse = function(token: string) {
    let base64Url = token.split('.')[1];
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    let jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  }

  // Callback function to handle credential response
  const handleCredentialResponse = (response: any) => {
    // https://developers.google.com/identity/gsi/web/reference/js-reference#credential
    const data = decodeJwtResponse(response.credential);
    if (monitoring) setMonitoredUser(data.name, data.email, data.sub);
    (document.getElementById('user') as HTMLElement).innerText = `Welcome ${data.given_name}`;
    if (sync) {
      import("./cloud")
        .then(cloud => cloud.signInWithGoogleIdToken(response.credential))
        .catch(e => console.warn('cloud sign-in failed', e));
    }
  }

  // Wait for Google Identity Services library to load
  const initializeGoogleSignIn = () => {
    if (typeof window.google === 'undefined' || !window.google.accounts) {
      console.warn('Google Identity Services library not loaded yet, retrying...');
      setTimeout(initializeGoogleSignIn, 100);
      return;
    }

    // Initialize Google Sign-In
    window.google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: handleCredentialResponse,
      auto_select: true,
      itp_support: true,
      use_fedcm_for_prompt: false,
      context: 'signin'
    });

    // One Tap alone is unreliable once dismissed, so also offer a button
    if (sync) {
      const target = document.getElementById('saves-signin');
      if (target) {
        window.google.accounts.id.renderButton(target, { theme: 'outline', size: 'medium' });
      }
    }

    // Prompt One Tap
    window.google.accounts.id.prompt();
  }

  // Start initialization
  initializeGoogleSignIn();
}
