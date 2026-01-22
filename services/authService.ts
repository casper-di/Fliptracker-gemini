
// Authentication service removed as requested.
export const auth = {
  signOut: () => {},
  onAuthStateChanged: (callback: (user: null) => void) => {
    callback(null);
    return () => {};
  },
  getCurrentUser: () => null
};
