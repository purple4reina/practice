export default class Cookies {
  static set(name: string, value: string): void {
    const date = new Date();
    date.setTime(date.getTime() + (10 * 365 * 24 * 60 * 60 * 1000));  // 10 years
    const path = window.location.pathname;
    document.cookie = name+"="+value+"; expires="+date.toUTCString()+"; path="+path;
  }

  static get(name: string): string {
    const value = "; " + document.cookie;
    const parts = value.split("; " + name + "=");
    if (parts.length == 2) {
      return parts.pop()?.split(";").shift() || "";
    }
    return "";
  }

  static getAll(): Record<string, string> {
    const cookies: Record<string, string> = {};
    const cookieString = document.cookie;

    if (!cookieString) {
      return cookies;
    }

    cookieString.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      if (name) {
        cookies[name] = value || '';
      }
    });

    return cookies;
  }

  static delete(name: string): void {
    const date = new Date();
    date.setTime(date.getTime() + (-1 * 24 * 60 * 60 * 1000));  // -1 days
    const path = window.location.pathname;
    document.cookie = name+"=; expires="+date.toUTCString()+"; path="+path;
  }
}
