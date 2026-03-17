/**
 * AUTHENTICATION SERVICE
 * Uses Web Crypto API for proper password hashing (SHA-256 + random salt).
 * Stores user data in LocalStorage with salted hashes — never plaintext passwords.
 */

import { Analytics } from './analyticsService';

const STORAGE_KEY_USERS = 'photogenix_users';
const STORAGE_KEY_CURRENT_USER = 'photogenix_current_session';

export interface UserProfile {
  id: string;
  email: string;
  passwordHash: string;
  salt: string;
  name: string;
  signUpDate: string;
  plan: 'free' | 'pro';
}

/** Generate a cryptographically random salt */
function generateSalt(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

/** Hash password with salt using SHA-256 */
async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function getUsers(): UserProfile[] {
  return JSON.parse(localStorage.getItem(STORAGE_KEY_USERS) || '[]');
}

function saveUsers(users: UserProfile[]): void {
  localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
}

export const AuthService = {
  register: async (email: string, password: string, name: string): Promise<UserProfile> => {
    const users = getUsers();

    if (users.find(u => u.email === email)) {
      throw new Error("User already exists");
    }

    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);

    const newUser: UserProfile = {
      id: 'user_' + Date.now(),
      email,
      passwordHash,
      salt,
      name,
      signUpDate: new Date().toISOString(),
      plan: 'free'
    };

    users.push(newUser);
    saveUsers(users);

    Analytics.logEvent('user_signup', { userId: newUser.id, email: newUser.email });
    return newUser;
  },

  login: async (email: string, password: string): Promise<UserProfile> => {
    const users = getUsers();
    const user = users.find(u => u.email === email);

    if (!user) {
      Analytics.logEvent('login_failed', { email });
      throw new Error("Invalid credentials");
    }

    const hash = await hashPassword(password, user.salt);
    if (hash !== user.passwordHash) {
      Analytics.logEvent('login_failed', { email });
      throw new Error("Invalid credentials");
    }

    localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(user));
    Analytics.initSession({
      userId: user.id,
      email: user.email,
      loginTime: Date.now(),
      device: navigator.platform
    });

    return user;
  },

  getCurrentUser: (): UserProfile | null => {
    const stored = localStorage.getItem(STORAGE_KEY_CURRENT_USER);
    return stored ? JSON.parse(stored) : null;
  },

  logout: () => {
    Analytics.logEvent('user_logout');
    localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
  }
};
