/* global firebase */
(function () {
  const cfg = window.__TRAVACEBU_FIREBASE_CONFIG__;
  if (!cfg || !cfg.apiKey || cfg.apiKey === 'YOUR_API_KEY') {
    console.error('Create assets/js/firebase-config.js from firebase-config.example.js');
  }
  if (typeof firebase !== 'undefined' && cfg && cfg.apiKey) {
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(cfg);
      }
      firebase.auth().setPersistence(firebase.auth.Auth.PERSISTENCE.LOCAL).catch(() => {});
    } catch (e) {
      console.error('TravaCebu: Firebase initialize failed', e);
    }
  }

  function adminBasePath() {
    const p = location.pathname;
    const i = p.indexOf('/admin');
    if (i === -1) {
      return '/admin/';
    }
    return p.slice(0, i + '/admin'.length) + '/';
  }

  /** Absolute URL to a file under /admin/ (works with /admin/login or /admin/login.html). */
  function adminPage(file) {
    const f = file.replace(/^\//, '');
    return location.origin + adminBasePath() + f;
  }

  function getAdminLoginHref() {
    return adminPage('login.html');
  }

  function redirectToLogin() {
    const ret = location.href;
    const p = location.pathname;
    const onLogin =
      /\/admin\/login$/i.test(p) || /\/admin\/login\.html$/i.test(p) || /\/login\.html$/i.test(p);
    if (!onLogin) {
      sessionStorage.setItem('tc_return', ret);
    }
    location.href = getAdminLoginHref();
  }

  /**
   * @returns {Promise<firebase.User|null>}
   */
  async function requireAdmin() {
    if (typeof firebase === 'undefined') return null;
    await firebase.auth().authStateReady();
    const u = firebase.auth().currentUser;
    if (!u) {
      redirectToLogin();
      return null;
    }
    let snap;
    try {
      snap = await firebase.firestore().collection('admins').doc(u.uid).get();
    } catch (e) {
      console.error('requireAdmin: admins/{uid} read failed', e);
      redirectToLogin();
      return null;
    }
    if (!snap.exists) {
      await firebase.auth().signOut();
      alert('This account is not authorized for administrative access.');
      redirectToLogin();
      return null;
    }
    return u;
  }

  const ADMIN_ACCESS_DENIED = 'ADMIN_ACCESS_DENIED';

  async function adminSignIn(email, password) {
    const cred = await firebase.auth().signInWithEmailAndPassword(email, password);
    try {
      const snap = await firebase.firestore().collection('admins').doc(cred.user.uid).get();
      if (!snap.exists) {
        await firebase.auth().signOut();
        throw new Error(ADMIN_ACCESS_DENIED);
      }
    } catch (e) {
      if (e && e.message === ADMIN_ACCESS_DENIED) {
        throw e;
      }
      await firebase.auth().signOut().catch(() => {});
      throw e;
    }
    return cred.user;
  }

  async function signOut() {
    try {
      document.dispatchEvent(new CustomEvent('tc-before-logout', { bubbles: true }));
    } catch (e) {
      /* ignore */
    }
    const login = getAdminLoginHref();
    try {
      if (typeof firebase !== 'undefined' && firebase.auth) {
        await firebase.auth().signOut();
      }
    } catch (e) {
      console.warn('TC.signOut', e);
    }
    setTimeout(function () {
      window.location.href = login;
    }, 0);
  }

  async function logApiCall(api, endpoint, params) {
    try {
      const u = firebase.auth().currentUser;
      if (!u) return;
      const tz = new Date();
      const date = tz.toISOString().slice(0, 10);
      await firebase
        .firestore()
        .collection('api_usage')
        .doc(u.uid)
        .collection('calls')
        .add({
          api,
          endpoint,
          params: params || null,
          success: true,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          date,
          userId: u.uid,
        });
    } catch (e) {
      console.warn('logApiCall', e);
    }
  }

  /** @param {string} fileURL */
  async function deleteFileByURL(fileURL) {
    if (!fileURL || !String(fileURL).includes('firebasestorage.googleapis.com')) return;
    try {
      const ref = firebase.storage().refFromURL(fileURL);
      await ref.delete();
    } catch (e) {
      console.warn('deleteFileByURL', e);
    }
  }

  window.TC = {
    adminPage,
    adminBasePath,
    getAdminLoginHref,
    redirectToLogin,
    requireAdmin,
    adminSignIn,
    signOut,
    logApiCall,
    deleteFileByURL,
    get db() {
      return firebase.firestore();
    },
    get auth() {
      return firebase.auth();
    },
    get storage() {
      return firebase.storage();
    },
    ADMIN_ACCESS_DENIED,
  };
})();
