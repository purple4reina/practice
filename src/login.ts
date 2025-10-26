import { setMonitoredUser } from "./monitoring";

declare global {
  interface Window {
    google: any;
  }
}

export default function googleLogin() {
  const CLIENT_ID = "1060381388264-frcdkvrnei1hv30mnbjdn0u0mm6mlaf2.apps.googleusercontent.com";

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
    setMonitoredUser(data.name, data.email, data.sub);
    (document.getElementById('user') as HTMLElement).innerText = `Welcome ${data.given_name}`;
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

    // Prompt One Tap
    window.google.accounts.id.prompt();
  }

  // Start initialization
  initializeGoogleSignIn();
}
