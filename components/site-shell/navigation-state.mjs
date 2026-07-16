/**
 * Calculates the next mobile-navigation state for a user or viewport action.
 *
 * @param {object} options - Navigation state transition options.
 * @param {boolean} options.isOpen - Whether the menu is currently open.
 * @param {"toggle" | "close" | "viewport-change"} options.action - State transition action.
 * @param {boolean} options.isMobile - Whether the mobile menu layout is active.
 * @returns {boolean} Whether the menu should be open after the action.
 */
export function getNextMenuOpenState({ isOpen, action, isMobile }) {
  if (!isMobile || action === "close" || action === "viewport-change") {
    return false;
  }

  if (action === "toggle") {
    return !isOpen;
  }

  return isOpen;
}
