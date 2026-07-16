const SECTION_IDS = ["home", "about", "now"];

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const ACTIVE_SECTION_THRESHOLDS = [0, 0.1, 0.25, 0.4, 0.6, 0.8];

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

  initializeActiveSectionNavigation({
    navigationLinks,
  });

  initializeSectionLinkFocus();

  initializeTerminalTrigger({
    terminalTrigger,
    terminalInput,
  });
}

function initializeHeaderScrollState(header) {
  if (!(header instanceof HTMLElement)) {
    return;
  }

  let updateFrameId = null;

  const updateHeaderState = () => {
    updateFrameId = null;

    header.dataset.scrolled = window.scrollY > 24 ? "true" : "false";
  };

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

  const initialSectionId = getInitialSectionId();

  setActiveNavigationLink({
    navigationLinks,
    activeSectionId: initialSectionId,
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

      if (!activeSectionId) {
        return;
      }

      setActiveNavigationLink({
        navigationLinks,
        activeSectionId,
      });
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

    if (!sectionId) {
      return;
    }

    setActiveNavigationLink({
      navigationLinks,
      activeSectionId: sectionId,
    });
  });
}

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

      const sectionId = link.hash.replace(/^#/, "");

      const targetSection = document.getElementById(sectionId);

      if (!(targetSection instanceof HTMLElement)) {
        return;
      }

      targetSection.focus({
        preventScroll: true,
      });
    });
  }
}

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

function setActiveNavigationLink({ navigationLinks, activeSectionId }) {
  for (const link of navigationLinks) {
    const isActive = link.dataset.sectionLink === activeSectionId;

    if (isActive) {
      link.setAttribute("aria-current", "location");

      continue;
    }

    link.removeAttribute("aria-current");
  }
}

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
      terminalInput.focus({
        preventScroll: true,
      });
    }

    const prefersReducedMotion =
      window.matchMedia(REDUCED_MOTION_QUERY).matches;

    homeSection.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",

      block: "start",
    });
  });
}

function getInitialSectionId() {
  return getSectionIdFromHash() ?? "home";
}

function getSectionIdFromHash() {
  const sectionId = window.location.hash.replace(/^#/, "");

  return SECTION_IDS.includes(sectionId) ? sectionId : null;
}
