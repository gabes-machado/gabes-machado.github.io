const PROMPT_TEXT = "visitor@portfolio:~$";

const MAX_HISTORY_LENGTH = 50;

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const navigationTargets = new Map([
  [
    "home",
    {
      sectionId: "home",
      label: "home",
    },
  ],
  [
    "about",
    {
      sectionId: "about",
      label: "about",
    },
  ],
  [
    "now",
    {
      sectionId: "now",
      label: "now",
    },
  ],
]);

const commandDefinitions = [
  {
    name: "help",
    description: "Show the available commands.",
    handler: handleHelp,
  },
  {
    name: "whoami",
    description: "Show information about me.",
    handler: handleWhoAmI,
  },
  {
    name: "pwd",
    description: "Print the current location.",
    handler: handlePwd,
  },
  {
    name: "ls",
    description: "List the available sections.",
    handler: handleList,
  },
  {
    name: "open",
    description: "Open a section: open <section>.",
    handler: handleOpen,
  },
  {
    name: "home",
    description: "Go to the terminal section.",
    handler: handleNavigation,
  },
  {
    name: "about",
    description: "Go to the about section.",
    handler: handleNavigation,
  },
  {
    name: "now",
    description: "Go to the now section.",
    handler: handleNavigation,
  },
  {
    name: "history",
    description: "Show the command history.",
    handler: handleHistory,
  },
  {
    name: "echo",
    description: "Print text to the terminal.",
    handler: handleEcho,
  },
  {
    name: "date",
    description: "Show the local date and time.",
    handler: handleDate,
  },
  {
    name: "clear",
    description: "Clear the terminal output.",
    handler: handleClear,
  },
];

const commandHandlers = new Map(
  commandDefinitions.map((definition) => [definition.name, definition.handler]),
);

const availableCommands = [...commandHandlers.keys()];

const availableSections = [...navigationTargets.keys()];

export function initializeTerminal() {
  const terminalForm = document.querySelector("[data-terminal-form]");

  const terminalInput = document.querySelector("#terminal-input");

  const terminalOutput = document.querySelector("#terminal-output");

  if (
    !(terminalForm instanceof HTMLFormElement) ||
    !(terminalInput instanceof HTMLInputElement) ||
    !(terminalOutput instanceof HTMLElement)
  ) {
    console.warn("Terminal could not be initialized.");

    return;
  }

  const commandHistory = [];

  let historyIndex = 0;
  let draftCommand = "";
  let lastAmbiguousCompletion = "";

  terminalForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const rawCommand = terminalInput.value.trim();

    if (rawCommand === "") {
      terminalInput.value = "";

      return;
    }

    addCommandToHistory(commandHistory, rawCommand);

    historyIndex = commandHistory.length;

    draftCommand = "";
    lastAmbiguousCompletion = "";
    terminalInput.value = "";

    appendCommand(terminalOutput, rawCommand);

    executeCommand({
      terminalOutput,
      rawCommand,
      commandHistory,
    });

    scrollTerminalToBottom(terminalOutput);
  });

  terminalInput.addEventListener("input", () => {
    lastAmbiguousCompletion = "";

    historyIndex = commandHistory.length;

    draftCommand = terminalInput.value;
  });

  terminalInput.addEventListener("keydown", (event) => {
    if (event.key === "Tab" && !event.shiftKey) {
      const completionResult = completeInput({
        terminalInput,
        terminalOutput,
        lastAmbiguousCompletion,
      });

      lastAmbiguousCompletion = completionResult.nextAmbiguousCompletion;

      if (completionResult.handled) {
        event.preventDefault();

        scrollTerminalToBottom(terminalOutput);
      }

      return;
    }

    const isHistoryKey = event.key === "ArrowUp" || event.key === "ArrowDown";

    if (!isHistoryKey || commandHistory.length === 0) {
      return;
    }

    event.preventDefault();

    lastAmbiguousCompletion = "";

    if (event.key === "ArrowUp") {
      if (historyIndex === commandHistory.length) {
        draftCommand = terminalInput.value;
      }

      historyIndex = Math.max(0, historyIndex - 1);
    }

    if (event.key === "ArrowDown") {
      historyIndex = Math.min(commandHistory.length, historyIndex + 1);
    }

    terminalInput.value =
      historyIndex === commandHistory.length
        ? draftCommand
        : commandHistory[historyIndex];

    moveCaretToEnd(terminalInput);
  });
}

function executeCommand({ terminalOutput, rawCommand, commandHistory }) {
  const parsedCommand = parseCommandLine(rawCommand);

  if (parsedCommand.error) {
    appendLines(
      terminalOutput,
      [`parse error: ${parsedCommand.error}`],
      "terminal-output-error",
    );

    return;
  }

  const { commandName, args } = parsedCommand;

  const commandHandler = commandHandlers.get(commandName);

  if (!commandHandler) {
    appendLines(
      terminalOutput,
      [
        `command not found: ${commandName}`,
        "Type help to see the available commands.",
      ],
      "terminal-output-error",
    );

    return;
  }

  commandHandler({
    terminalOutput,
    commandName,
    args,
    commandHistory,
  });
}

function parseCommandLine(commandLine) {
  const tokens = [];

  let currentToken = "";
  let quoteCharacter = null;
  let isEscaping = false;
  let tokenStarted = false;

  for (const character of commandLine) {
    if (isEscaping) {
      currentToken += character;
      tokenStarted = true;
      isEscaping = false;

      continue;
    }

    if (character === "\\") {
      isEscaping = true;
      tokenStarted = true;

      continue;
    }

    if (quoteCharacter !== null) {
      if (character === quoteCharacter) {
        quoteCharacter = null;
      } else {
        currentToken += character;
      }

      tokenStarted = true;

      continue;
    }

    if (character === '"' || character === "'") {
      quoteCharacter = character;
      tokenStarted = true;

      continue;
    }

    if (/\s/.test(character)) {
      if (tokenStarted) {
        tokens.push(currentToken);

        currentToken = "";
        tokenStarted = false;
      }

      continue;
    }

    currentToken += character;
    tokenStarted = true;
  }

  if (quoteCharacter !== null) {
    return {
      error: "unmatched quote.",
    };
  }

  if (isEscaping) {
    currentToken += "\\";
  }

  if (tokenStarted) {
    tokens.push(currentToken);
  }

  const [rawCommandName = "", ...args] = tokens;

  const commandName = rawCommandName.toLowerCase();

  if (commandName === "") {
    return {
      error: "missing command.",
    };
  }

  return {
    error: null,
    commandName,
    args,
  };
}

function completeInput({
  terminalInput,
  terminalOutput,
  lastAmbiguousCompletion,
}) {
  const completionContext = getCompletionContext(terminalInput.value);

  const unhandledResult = {
    handled: false,
    nextAmbiguousCompletion: "",
  };

  if (!completionContext) {
    return unhandledResult;
  }

  const { prefix, fragment, candidates } = completionContext;

  const matchingCandidates = candidates.filter((candidate) =>
    candidate.startsWith(fragment),
  );

  if (matchingCandidates.length === 0) {
    return unhandledResult;
  }

  if (matchingCandidates.length === 1 && matchingCandidates[0] === fragment) {
    return unhandledResult;
  }

  if (matchingCandidates.length === 1) {
    terminalInput.value = `${prefix}${matchingCandidates[0]}`;

    moveCaretToEnd(terminalInput);

    return {
      handled: true,
      nextAmbiguousCompletion: "",
    };
  }

  const commonPrefix = findLongestCommonPrefix(matchingCandidates);

  if (commonPrefix.length > fragment.length) {
    terminalInput.value = `${prefix}${commonPrefix}`;

    moveCaretToEnd(terminalInput);

    return {
      handled: true,
      nextAmbiguousCompletion: "",
    };
  }

  const completionKey = `${prefix}${fragment}`;

  if (lastAmbiguousCompletion === completionKey) {
    return unhandledResult;
  }

  appendLines(
    terminalOutput,
    [`Completions: ${matchingCandidates.join("  ")}`],
    "terminal-output-suggestion",
  );

  return {
    handled: true,
    nextAmbiguousCompletion: completionKey,
  };
}

function getCompletionContext(inputValue) {
  const normalizedInput = inputValue.trimStart();

  if (normalizedInput === "") {
    return null;
  }

  const firstWhitespaceIndex = normalizedInput.search(/\s/);

  if (firstWhitespaceIndex === -1) {
    return {
      prefix: "",

      fragment: normalizedInput.toLowerCase(),

      candidates: availableCommands,
    };
  }

  const commandName = normalizedInput
    .slice(0, firstWhitespaceIndex)
    .toLowerCase();

  const argumentFragment = normalizedInput
    .slice(firstWhitespaceIndex)
    .trimStart();

  if (commandName !== "open" || /\s/.test(argumentFragment)) {
    return null;
  }

  return {
    prefix: "open ",

    fragment: argumentFragment.toLowerCase(),

    candidates: availableSections,
  };
}

function findLongestCommonPrefix(values) {
  if (values.length === 0) {
    return "";
  }

  return values.reduce((currentPrefix, value) => {
    const maximumLength = Math.min(currentPrefix.length, value.length);

    let characterIndex = 0;

    while (
      characterIndex < maximumLength &&
      currentPrefix[characterIndex] === value[characterIndex]
    ) {
      characterIndex += 1;
    }

    return currentPrefix.slice(0, characterIndex);
  });
}

function addCommandToHistory(commandHistory, command) {
  commandHistory.push(command);

  if (commandHistory.length > MAX_HISTORY_LENGTH) {
    commandHistory.shift();
  }
}

function appendCommand(terminalOutput, command) {
  const line = document.createElement("p");

  const prompt = document.createElement("span");

  const commandText = document.createTextNode(command);

  line.classList.add("terminal-output-line", "terminal-output-command");

  prompt.classList.add("terminal-prompt");

  prompt.setAttribute("aria-hidden", "true");

  prompt.textContent = `${PROMPT_TEXT} `;

  line.append(prompt, commandText);

  terminalOutput.append(line);
}

function appendLines(terminalOutput, lines, className = "") {
  for (const text of lines) {
    const line = document.createElement("p");

    line.classList.add("terminal-output-line");

    if (className !== "") {
      line.classList.add(className);
    }

    line.textContent = text;

    terminalOutput.append(line);
  }
}

function handleHelp({ terminalOutput, args }) {
  if (
    rejectUnexpectedArguments({
      terminalOutput,
      args,
      usage: "help",
    })
  ) {
    return;
  }

  const longestCommandName = Math.max(
    ...commandDefinitions.map(({ name }) => name.length),
  );

  const commandLines = commandDefinitions.map(
    ({ name, description }) =>
      `  ${name.padEnd(longestCommandName)}  ${description}`,
  );

  appendLines(terminalOutput, [
    "Available commands:",
    ...commandLines,
    "",
    "Use Tab to autocomplete commands.",
    "Use ArrowUp and ArrowDown to browse history.",
    'Quotes are supported: echo "hello world"',
  ]);
}

function handleWhoAmI({ terminalOutput, args }) {
  if (
    rejectUnexpectedArguments({
      terminalOutput,
      args,
      usage: "whoami",
    })
  ) {
    return;
  }

  appendLines(terminalOutput, [
    "Gabes Machado",
    "Software Engineer",
    "Banking & financial services",
    "Brasília, Brazil",
  ]);
}

function handlePwd({ terminalOutput, args }) {
  if (
    rejectUnexpectedArguments({
      terminalOutput,
      args,
      usage: "pwd",
    })
  ) {
    return;
  }

  appendLines(terminalOutput, ["/portfolio"]);
}

function handleList({ terminalOutput, args }) {
  if (
    rejectUnexpectedArguments({
      terminalOutput,
      args,
      usage: "ls",
    })
  ) {
    return;
  }

  appendLines(terminalOutput, ["./", "|-- home/", "|-- about/", "`-- now/"]);
}

function handleOpen({ terminalOutput, args }) {
  if (args.length !== 1) {
    appendLines(
      terminalOutput,
      ["usage: open <home|about|now>"],
      "terminal-output-error",
    );

    return;
  }

  const targetName = args[0].toLowerCase();

  navigateToSection({
    terminalOutput,
    targetName,
  });
}

function handleNavigation({ terminalOutput, commandName, args }) {
  if (
    rejectUnexpectedArguments({
      terminalOutput,
      args,
      usage: commandName,
    })
  ) {
    return;
  }

  navigateToSection({
    terminalOutput,
    targetName: commandName,
  });
}

function navigateToSection({ terminalOutput, targetName }) {
  const navigationTarget = navigationTargets.get(targetName);

  if (!navigationTarget) {
    appendLines(
      terminalOutput,
      [
        `section not found: ${targetName}`,
        "Run ls to see the available sections.",
      ],
      "terminal-output-error",
    );

    return;
  }

  const targetSection = document.getElementById(navigationTarget.sectionId);

  if (!(targetSection instanceof HTMLElement)) {
    appendLines(
      terminalOutput,
      [`section unavailable: ${navigationTarget.sectionId}`],
      "terminal-output-error",
    );

    return;
  }

  appendLines(terminalOutput, [
    `Opening /portfolio/${navigationTarget.label}...`,
  ]);

  const focusTarget = getSectionFocusTarget({
    targetName,
    targetSection,
  });

  focusTarget.focus({
    preventScroll: true,
  });

  targetSection.scrollIntoView({
    behavior: getNavigationScrollBehavior(),

    block: "start",
  });

  updateLocationHash(targetName);
}

function getSectionFocusTarget({ targetName, targetSection }) {
  if (targetName !== "home") {
    return targetSection;
  }

  const terminalInput = document.querySelector("#terminal-input");

  return terminalInput instanceof HTMLInputElement
    ? terminalInput
    : targetSection;
}

function updateLocationHash(sectionName) {
  const nextHash = `#${sectionName}`;

  if (window.location.hash === nextHash) {
    return;
  }

  window.history.pushState(null, "", nextHash);
}

function handleHistory({ terminalOutput, args, commandHistory }) {
  if (
    rejectUnexpectedArguments({
      terminalOutput,
      args,
      usage: "history",
    })
  ) {
    return;
  }

  const indexWidth = String(commandHistory.length).length;

  const historyLines = commandHistory.map(
    (command, index) =>
      `${String(index + 1).padStart(indexWidth, " ")}  ${command}`,
  );

  appendLines(terminalOutput, historyLines);
}

function handleEcho({ terminalOutput, args }) {
  appendLines(terminalOutput, [args.join(" ")]);
}

function handleDate({ terminalOutput, args }) {
  if (
    rejectUnexpectedArguments({
      terminalOutput,
      args,
      usage: "date",
    })
  ) {
    return;
  }

  const locale = document.documentElement.lang || navigator.language || "en";

  let formattedDate;

  try {
    formattedDate = new Intl.DateTimeFormat(locale, {
      dateStyle: "full",
      timeStyle: "long",
    }).format(new Date());
  } catch {
    formattedDate = new Date().toString();
  }

  appendLines(terminalOutput, [formattedDate]);
}

function handleClear({ terminalOutput, args }) {
  if (
    rejectUnexpectedArguments({
      terminalOutput,
      args,
      usage: "clear",
    })
  ) {
    return;
  }

  terminalOutput.replaceChildren();
}

function rejectUnexpectedArguments({ terminalOutput, args, usage }) {
  if (args.length === 0) {
    return false;
  }

  appendLines(terminalOutput, [`usage: ${usage}`], "terminal-output-error");

  return true;
}

function getNavigationScrollBehavior() {
  const prefersReducedMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;

  return prefersReducedMotion ? "auto" : "smooth";
}

function scrollTerminalToBottom(terminalOutput) {
  terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

function moveCaretToEnd(input) {
  const endPosition = input.value.length;

  input.setSelectionRange(endPosition, endPosition);
}
