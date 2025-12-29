
/**
 * AUTHENTICATION SERVICE
 * Simulates a robust backend auth system using LocalStorage.
 */

import { Analytics } from './analyticsService';

const STORAGE_KEY_USERS = 'photogenix_users';
const STORAGE_KEY_CURRENT_USER = 'photogenix_current_session';

export interface UserProfile {
  id: string;
  email: string;
  passwordHash: string; // In real app, never store plain text
  name: string;
  signUpDate: string;
  plan: 'free' | 'pro';
}

export const AuthService = {
  // Sign Up
  register: (email: string, password: string, name: string): UserProfile => {
    const users: UserProfile[] = JSON.parse(localStorage.getItem(STORAGE_KEY_USERS) || '[]');
    
    if (users.find(u => u.email === email)) {
      throw new Error("User already exists");
    }

    const newUser: UserProfile = {
      id: 'user_' + Date.now(),
      email,
      passwordHash: btoa(password), // Simple encoding for simulation
      name,
      signUpDate: new Date().toISOString(),
      plan: 'free'
    };

    users.push(newUser);
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
    
    Analytics.logEvent('user_signup', { userId: newUser.id, email: newUser.email });
    return newUser;
  },

  // Sign In
  login: (email: string, password: string): UserProfile => {
    const users: UserProfile[] = JSON.parse(localStorage.getItem(STORAGE_KEY_USERS) || '[]');
    const user = users.find(u => u.email === email && u.passwordHash === btoa(password));

    if (!user) {
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

  // Get Current User
  getCurrentUser: (): UserProfile | null => {
    const stored = localStorage.getItem(STORAGE_KEY_CURRENT_USER);
    return stored ? JSON.parse(stored) : null;
  },

  // Sign Out
  logout: () => {
    Analytics.logEvent('user_logout');
    localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
  }
};
