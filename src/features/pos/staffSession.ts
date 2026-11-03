const KEY = 'ad_pos_staff_session';

export function markStaffSession() {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    /* ignore */
  }
}

export function clearStaffSession() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function hasStaffSession() {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}
