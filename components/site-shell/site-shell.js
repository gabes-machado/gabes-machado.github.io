import { getNextMenuOpenState } from "./navigation-state.mjs";

const SECTION_IDS = ["home", "about", "now"];

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const MOBILE_NAVIGATION_QUERY = "(max-width: 56rem)";

const ACTIVE_SECTION_THRESHOLDS = [0, 0.1, 0.25, 0.4, 0.6, 0.8];

/**
 * Initializes the navigation, header state, terminal shortcut, and current year.
 *
 * @returns {void}
 */
export function initializeSiteShell() {
  const header = document.querySelector("[data-site-header]");

  const navigationLinks = [
    ...document.querySelectorAll("[data-section-link]"),
  ].filter((element) => element instanceof HTMLAnchorElement);

  const terminalTrigger = document.querySelector("[data-terminal-trigger]");

  const terminalInput = document.querySelector("#terminal-input");

  const currentYear = document.querySelector("[data-current-year]");

  if (currentYear instanceof HTMLElement) {
    currentYear.textContent = String(new Date().getFullYear());
  }

  initializeHeaderScrollState(header);
  initializeHeaderNavigation(header);

  initializeActiveSectionNavigation({
    navigationLinks,
  });

  initializeSectionLinkFocus();

  initializeTerminalTrigger({
    terminalTrigger,
    terminalInput,
  });
}

/**
 * Updates the header's elevated visual state without running work per scroll event.
 *
 * @param {Element | null} header - Site header candidate.
 * @returns {void}
 */
function initializeHeaderScrollState(header) {
  if (!(header instanceof HTMLElement)) {
    return;
  }

  let updateFrameId = null;

  /** Applies the header state during the next available animation frame. */
  const updateHeaderState = () => {
    updateFrameId = null;
    header.dataset.scrolled = window.scrollY > 24 ? "true" : "false";
  };

  /** Coalesces scroll events into a single visual update per frame. */
  const scheduleUpdate = () => {
    if (updateFrameId !== null) {
      return;
    }

    updateFrameId = window.requestAnimationFrame(updateHeaderState);
  };

  window.addEventListener("scroll", scheduleUpdate, {
    passive: true,
  });

  updateHeaderState();
}

/**
 * Initializes the responsive navigation while preserving a visible no-script fallback.
 *
 * @param {Element | null} header - Site header candidate.
 * @returns {void}
 */
function initializeHeaderNavigation(header) {
  if (!(header instanceof HTMLElement)) {
    return;
  }

  const navigation = header.querySelector("[data-site-navigation]");
  const toggle = header.querySelector("[data-navigation-toggle]");

  if (
    !(navigation instanceof HTMLElement) ||
    !(toggle instanceof HTMLButtonElement)
  ) {
    return;
  }

  const mobileNavigationQuery = window.matchMedia(MOBILE_NAVIGATION_QUERY);

  /**
   * Applies menu visibility and its matching accessible label.
   *
   * @param {boolean} isOpen - Whether the navigation menu should be open.
   * @param {object} options - Focus management options.
   * @param {boolean} options.restoreFocus - Whether focus should return to the toggle.
   * @returns {void}
   */
  const setMenuState = (isOpen, { restoreFocus = false } = {}) => {
    header.dataset.navigationOpen = String(isOpen);
    toggle.setAttribute("aria-expanded", String(isOpen));

    const accessibleLabel = isOpen ? "Close navigation" : "Open navigation";
    const label = toggle.querySelector(".visually-hidden");

    if (label instanceof HTMLElement) {
      label.textContent = accessibleLabel;
    }

    if (restoreFocus) {
      toggle.focus();
    }
  };

  /**
   * Closes the navigation menu after selection or dismissal.
   *
   * @param {object} options - Focus management options.
   * @param {boolean} options.restoreFocus - Whether focus should return to the toggle.
   * @returns {void}
   */
  const closeMenu = ({ restoreFocus = false } = {}) => {
    setMenuState(
      getNextMenuOpenState({
        isOpen: header.dataset.navigationOpen === "true",
        action: "close",
        isMobile: mobileNavigationQuery.matches,
      }),
      { restoreFocus },
    );
  };

  toggle.addEventListener("click", () => {
    setMenuState(
      getNextMenuOpenState({
        isOpen: header.dataset.navigationOpen === "true",
        action: "toggle",
        isMobile: mobileNavigationQuery.matches,
      }),
    );
  });

  navigation.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      closeMenu();
    }
  });

  document.addEventListener("click", (event) => {
    if (event.target instanceof Node && !header.contains(event.target)) {
      closeMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && header.dataset.navigationOpen === "true") {
      closeMenu({ restoreFocus: true });
    }
  });

  mobileNavigationQuery.addEventListener("change", () => {
    setMenuState(
      getNextMenuOpenState({
        isOpen: header.dataset.navigationOpen === "true",
        action: "viewport-change",
        isMobile: mobileNavigationQuery.matches,
      }),
    );
  });

  setMenuState(false);
  header.dataset.siteShellReady = "true";
}

/**
 * Tracks visible homepage sections and reflects the active location in navigation.
 *
 * @param {object} options - Active-navigation options.
 * @param {HTMLAnchorElement[]} options.navigationLinks - Homepage section links.
 * @returns {void}
 */
function initializeActiveSectionNavigation({ navigationLinks }) {
  if (navigationLinks.length === 0) {
    return;
  }

  const sections = SECTION_IDS.map((sectionId) =>
    document.getElementById(sectionId),
  ).filter((section) => section instanceof HTMLElement);

  if (sections.length === 0) {
    return;
  }

  const intersectionState = new Map(
    sections.map((section) => [
      section.id,
      {
        ratio: 0,
        distanceFromActivationLine: Number.POSITIVE_INFINITY,
      },
    ]),
  );

  setActiveNavigationLink({
    navigationLinks,
    activeSectionId: getInitialSectionId(),
  });

  if (!("IntersectionObserver" in window)) {
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!(entry.target instanceof HTMLElement)) {
          continue;
        }

        intersectionState.set(entry.target.id, {
          ratio: entry.isIntersecting ? entry.intersectionRatio : 0,
          distanceFromActivationLine: Math.abs(
            entry.boundingClientRect.top - window.innerHeight * 0.28,
          ),
        });
      }

      const activeSectionId = findActiveSectionId(intersectionState);

      if (activeSectionId) {
        setActiveNavigationLink({ navigationLinks, activeSectionId });
      }
    },
    {
      root: null,
      rootMargin: "-12% 0px -48% 0px",
      threshold: ACTIVE_SECTION_THRESHOLDS,
    },
  );

  for (const section of sections) {
    observer.observe(section);
  }

  window.addEventListener("hashchange", () => {
    const sectionId = getSectionIdFromHash();

    if (sectionId) {
      setActiveNavigationLink({
        navigationLinks,
        activeSectionId: sectionId,
      });
    }
  });
}

/**
 * Moves focus to same-page sections after navigation without changing scroll behavior.
 *
 * @returns {void}
 */
function initializeSectionLinkFocus() {
  const sectionLinks = [
    ...document.querySelectorAll(
      ['a[href="#home"]', 'a[href="#about"]', 'a[href="#now"]'].join(","),
    ),
  ].filter((element) => element instanceof HTMLAnchorElement);

  for (const link of sectionLinks) {
    link.addEventListener("click", (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const targetSection = document.getElementById(
        link.hash.replace(/^#/, ""),
      );

      if (targetSection instanceof HTMLElement) {
        targetSection.focus({ preventScroll: true });
      }
    });
  }
}

/**
 * Chooses the most prominent currently visible homepage section.
 *
 * @param {Map<string, {ratio: number, distanceFromActivationLine: number}>} intersectionState - Section visibility measurements.
 * @returns {string | null} Active section identifier, if one is visible.
 */
function findActiveSectionId(intersectionState) {
  const visibleSections = [...intersectionState.entries()].filter(
    ([, state]) => state.ratio > 0,
  );

  if (visibleSections.length === 0) {
    return null;
  }

  visibleSections.sort(([, stateA], [, stateB]) => {
    const ratioDifference = stateB.ratio - stateA.ratio;

    if (Math.abs(ratioDifference) > 0.001) {
      return ratioDifference;
    }

    return (
      stateA.distanceFromActivationLine - stateB.distanceFromActivationLine
    );
  });

  return visibleSections[0][0];
}

/**
 * Applies the active-location state to homepage navigation links.
 *
 * @param {object} options - Active-link options.
 * @param {HTMLAnchorElement[]} options.navigationLinks - Homepage section links.
 * @param {string} options.activeSectionId - Active homepage section identifier.
 * @returns {void}
 */
function setActiveNavigationLink({ navigationLinks, activeSectionId }) {
  for (const link of navigationLinks) {
    if (link.dataset.sectionLink === activeSectionId) {
      link.setAttribute("aria-current", "location");
    } else {
      link.removeAttribute("aria-current");
    }
  }
}

/**
 * Connects the homepage terminal shortcut to focus and scroll behavior.
 *
 * @param {object} options - Terminal shortcut options.
 * @param {Element | null} options.terminalTrigger - Terminal trigger candidate.
 * @param {Element | null} options.terminalInput - Terminal input candidate.
 * @returns {void}
 */
function initializeTerminalTrigger({ terminalTrigger, terminalInput }) {
  if (!(terminalTrigger instanceof HTMLButtonElement)) {
    return;
  }

  const homeSection = document.getElementById("home");

  if (!(homeSection instanceof HTMLElement)) {
    return;
  }

  terminalTrigger.addEventListener("click", () => {
    if (terminalInput instanceof HTMLInputElement) {
      terminalInput.focus({ preventScroll: true });
    }

    homeSection.scrollIntoView({
      behavior: window.matchMedia(REDUCED_MOTION_QUERY).matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  });
}

/**
 * Resolves the initial homepage section from the URL, defaulting to home.
 *
 * @returns {string} Initial homepage section identifier.
 */
function getInitialSectionId() {
  return getSectionIdFromHash() ?? "home";
}

/**
 * Reads a supported homepage section identifier from the current URL hash.
 *
 * @returns {string | null} Supported section identifier, if present.
 */
function getSectionIdFromHash() {
  const sectionId = window.location.hash.replace(/^#/, "");

  return SECTION_IDS.includes(sectionId) ? sectionId : null;
}
