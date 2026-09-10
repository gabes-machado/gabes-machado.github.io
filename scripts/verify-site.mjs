import { constants } from "node:fs";
import { lstat, open, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_EXTENSIONS = new Set([".css", ".html", ".js", ".mjs"]);
const SKIPPED_DIRECTORIES = new Set([".git", "node_modules"]);
const REGULAR_EXPRESSION_PREFIX_KEYWORDS = new Set([
  "await",
  "case",
  "delete",
  "return",
  "throw",
  "typeof",
  "void",
  "yield",
]);
const REGULAR_EXPRESSION_PREFIX_PUNCTUATORS = new Set([
  "(",
  "{",
  "[",
  "=",
  ",",
  ":",
  ";",
  "!",
  "?",
  "&",
  "|",
  "+",
  "*",
  "%",
  "^",
  "~",
  "<",
  ">",
  "-",
  "=>",
]);
const STATEMENT_CONDITION_KEYWORDS = new Set(["for", "if", "while", "with"]);

export const EXPECTED_SITEMAP_URLS = [
  "https://gabes-machado.github.io/",
  "https://gabes-machado.github.io/talks/",
  "https://gabes-machado.github.io/links/",
];

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) {
        files.push(...(await collectSourceFiles(entryPath)));
      }
      continue;
    }

    if (
      (entry.isFile() || entry.isSymbolicLink()) &&
      SOURCE_EXTENSIONS.has(path.extname(entry.name))
    ) {
      files.push(entryPath);
    }
  }

  return files;
}

function extractMatches(source, pattern, valueGroup = 2) {
  return [...source.matchAll(pattern)].map((match) => match[valueGroup]);
}

function extractAttributeValues(source, pattern) {
  return [...source.matchAll(pattern)].map((match) => match[2] ?? match[3]);
}

function extractSourceSetUrls(sourceSet) {
  const urls = [];
  let index = 0;

  while (index < sourceSet.length) {
    while (/[\s,]/u.test(sourceSet[index] ?? "")) {
      index += 1;
    }

    const urlStart = index;
    while (index < sourceSet.length && !/\s/u.test(sourceSet[index])) {
      index += 1;
    }

    const rawUrl = sourceSet.slice(urlStart, index);
    const url = rawUrl.replace(/,+$/u, "");
    if (url) {
      urls.push(url);
    }

    if (rawUrl.endsWith(",")) {
      continue;
    }

    let parenthesesDepth = 0;
    while (index < sourceSet.length) {
      if (sourceSet[index] === "(") {
        parenthesesDepth += 1;
      } else if (sourceSet[index] === ")") {
        parenthesesDepth -= 1;
      } else if (sourceSet[index] === "," && parenthesesDepth === 0) {
        index += 1;
        break;
      }

      index += 1;
    }
  }

  return urls;
}

function closesStatementCondition(tokens) {
  let parenthesisDepth = 0;

  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    if (tokens[index].value === ")") {
      parenthesisDepth += 1;
    } else if (tokens[index].value === "(") {
      parenthesisDepth -= 1;
      if (parenthesisDepth === 0) {
        const keyword = tokens[index - 1];
        return (
          keyword?.type === "identifier" &&
          STATEMENT_CONDITION_KEYWORDS.has(keyword.value) &&
          tokens[index - 2]?.value !== "."
        );
      }
    }
  }

  return false;
}

function canStartRegularExpression(tokens) {
  const previousToken = tokens.at(-1);

  if (!previousToken) {
    return true;
  }

  if (previousToken.type === "identifier") {
    return REGULAR_EXPRESSION_PREFIX_KEYWORDS.has(previousToken.value);
  }

  return (
    (previousToken.type === "punctuator" &&
      REGULAR_EXPRESSION_PREFIX_PUNCTUATORS.has(previousToken.value)) ||
    (previousToken.value === ")" && closesStatementCondition(tokens))
  );
}

function findTemplateExpressionEnd(source, expressionStart) {
  let braceDepth = 1;
  let index = expressionStart;

  while (index < source.length) {
    const character = source[index];
    const nextCharacter = source[index + 1];

    if (character === '"' || character === "'" || character === "`") {
      const quote = character;
      index += 1;
      while (index < source.length && source[index] !== quote) {
        index += source[index] === "\\" ? 2 : 1;
      }
      index += source[index] === quote ? 1 : 0;
      continue;
    }

    if (character === "/" && nextCharacter === "/") {
      index = source.indexOf("\n", index + 2);
      index = index === -1 ? source.length : index + 1;
      continue;
    }

    if (character === "/" && nextCharacter === "*") {
      const commentEnd = source.indexOf("*/", index + 2);
      index = commentEnd === -1 ? source.length : commentEnd + 2;
      continue;
    }

    if (character === "{") {
      braceDepth += 1;
    } else if (character === "}") {
      braceDepth -= 1;
      if (braceDepth === 0) {
        return index;
      }
    }

    index += 1;
  }

  return source.length;
}

function tokenizeJavaScript(source) {
  const tokens = [];
  let index = 0;

  while (index < source.length) {
    const character = source[index];
    const nextCharacter = source[index + 1];

    if (/\s/u.test(character)) {
      index += 1;
      continue;
    }

    if (character === "/" && nextCharacter === "/") {
      index = source.indexOf("\n", index + 2);
      index = index === -1 ? source.length : index + 1;
      continue;
    }

    if (character === "/" && nextCharacter === "*") {
      const commentEnd = source.indexOf("*/", index + 2);
      index = commentEnd === -1 ? source.length : commentEnd + 2;
      continue;
    }

    if (character === "/" && canStartRegularExpression(tokens)) {
      index += 1;
      let inCharacterClass = false;

      while (index < source.length) {
        if (source[index] === "\\") {
          index += 2;
          continue;
        }

        if (source[index] === "[") {
          inCharacterClass = true;
        } else if (source[index] === "]") {
          inCharacterClass = false;
        } else if (source[index] === "/" && !inCharacterClass) {
          index += 1;
          while (/\p{L}/u.test(source[index] ?? "")) {
            index += 1;
          }
          break;
        }

        index += 1;
      }
      continue;
    }

    if (character === '"' || character === "'") {
      const quote = character;
      let value = "";
      index += 1;

      while (index < source.length && source[index] !== quote) {
        if (source[index] === "\\" && index + 1 < source.length) {
          value += source[index + 1];
          index += 2;
        } else {
          value += source[index];
          index += 1;
        }
      }

      index += source[index] === quote ? 1 : 0;
      tokens.push({ type: "string", value });
      continue;
    }

    if (character === "`") {
      let hasInterpolation = false;
      let value = "";
      index += 1;
      while (index < source.length && source[index] !== "`") {
        if (source[index] === "\\") {
          value += source[index + 1] ?? "";
          index += 2;
          continue;
        }

        if (source[index] === "$" && source[index + 1] === "{") {
          hasInterpolation = true;
          const expressionStart = index + 2;
          const expressionEnd = findTemplateExpressionEnd(source, expressionStart);
          tokens.push(...tokenizeJavaScript(source.slice(expressionStart, expressionEnd)));
          index = expressionEnd + 1;
          continue;
        }

        value += source[index];
        index += 1;
      }
      index += source[index] === "`" ? 1 : 0;
      tokens.push({
        type: hasInterpolation ? "template-expression" : "template",
        value,
      });
      continue;
    }

    if (/[$\p{L}_]/u.test(character)) {
      const identifierStart = index;
      index += 1;
      while (/[$\p{L}\p{N}_]/u.test(source[index] ?? "")) {
        index += 1;
      }
      tokens.push({ type: "identifier", value: source.slice(identifierStart, index) });
      continue;
    }

    const twoCharacterPunctuator = source.slice(index, index + 2);
    const punctuator = ["=>", "++", "--"].includes(twoCharacterPunctuator)
      ? twoCharacterPunctuator
      : character;
    tokens.push({ type: "punctuator", value: punctuator });
    index += punctuator.length;
  }

  return tokens;
}

function extractJavaScriptReferences(source) {
  const tokens = tokenizeJavaScript(source);
  const references = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (token.type !== "identifier" || !["export", "import"].includes(token.value)) {
      continue;
    }

    const nextToken = tokens[index + 1];
    const previousToken = tokens[index - 1];

    if (token.value === "import" && previousToken?.value === ".") {
      continue;
    }

    if (token.value === "import" && nextToken?.type === "string") {
      references.push(nextToken.value);
      continue;
    }

    if (
      token.value === "import" &&
      nextToken?.value === "(" &&
      ["string", "template"].includes(tokens[index + 2]?.type) &&
      [")", ","].includes(tokens[index + 3]?.value)
    ) {
      references.push(tokens[index + 2].value);
      continue;
    }

    if (token.value === "import" && nextToken?.value === ".") {
      continue;
    }

    for (let statementIndex = index + 1; statementIndex < tokens.length; statementIndex += 1) {
      if (tokens[statementIndex].value === ";") {
        break;
      }

      if (
        tokens[statementIndex].value === "from" &&
        tokens[statementIndex + 1]?.type === "string"
      ) {
        references.push(tokens[statementIndex + 1].value);
        break;
      }
    }
  }

  return references;
}

function readCssString(source, stringStart) {
  const quote = source[stringStart];
  let index = stringStart + 1;
  let value = "";

  while (index < source.length && source[index] !== quote) {
    if (source[index] === "\\" && index + 1 < source.length) {
      value += source[index + 1];
      index += 2;
    } else {
      value += source[index];
      index += 1;
    }
  }

  return { index: index + (source[index] === quote ? 1 : 0), value };
}

function extractCssReferences(source) {
  const references = [];
  let index = 0;

  while (index < source.length) {
    if (source.startsWith("/*", index)) {
      const commentEnd = source.indexOf("*/", index + 2);
      index = commentEnd === -1 ? source.length : commentEnd + 2;
      continue;
    }

    if (source[index] === '"' || source[index] === "'") {
      index = readCssString(source, index).index;
      continue;
    }

    const remainingSource = source.slice(index);
    const importMatch = /^@import\b/iu.exec(remainingSource);
    if (importMatch) {
      index += importMatch[0].length;
      while (/\s/u.test(source[index] ?? "")) {
        index += 1;
      }

      if (source[index] === '"' || source[index] === "'") {
        const importedStyleSheet = readCssString(source, index);
        references.push(importedStyleSheet.value);
        index = importedStyleSheet.index;
      }
      continue;
    }

    const previousCharacter = source[index - 1] ?? "";
    const urlMatch = /^url\s*\(/iu.exec(remainingSource);
    if (urlMatch && !/[-\w]/u.test(previousCharacter)) {
      index += urlMatch[0].length;
      while (/\s/u.test(source[index] ?? "")) {
        index += 1;
      }

      if (source[index] === '"' || source[index] === "'") {
        const url = readCssString(source, index);
        references.push(url.value);
        index = url.index;
      } else {
        const urlEnd = source.indexOf(")", index);
        const valueEnd = urlEnd === -1 ? source.length : urlEnd;
        references.push(source.slice(index, valueEnd).trim());
        index = valueEnd;
      }

      continue;
    }

    index += 1;
  }

  return references;
}

function extractMetaImageReferences(markup) {
  const references = [];
  const metaTags = extractMatches(markup, /<meta\b([^>]*)>/giu, 1);

  for (const metaTag of metaTags) {
    const properties = extractAttributeValues(
      metaTag,
      /(?:^|\s)property\s*=\s*(?:(["'])(.*?)\1|([^\s"'=<>`]+))/giu,
    );
    const names = extractAttributeValues(
      metaTag,
      /(?:^|\s)name\s*=\s*(?:(["'])(.*?)\1|([^\s"'=<>`]+))/giu,
    );

    if (
      properties.some((property) => property.toLowerCase() === "og:image") ||
      names.some((name) => name.toLowerCase() === "twitter:image")
    ) {
      references.push(
        ...extractAttributeValues(
          metaTag,
          /(?:^|\s)content\s*=\s*(?:(["'])(.*?)\1|([^\s"'=<>`]+))/giu,
        ),
      );
    }
  }

  return references;
}

function extractReferences(filePath, source) {
  const extension = path.extname(filePath);

  if (extension === ".html") {
    const markup = source.replace(/<!--[\s\S]*?-->/gu, "");
    const references = extractAttributeValues(
      markup,
      /(?:^|[\s<])(?:action|background|cite|data|formaction|href|longdesc|manifest|poster|src|usemap|xlink:href)\s*=\s*(?:(["'])(.*?)\1|([^\s"'=<>`]+))/giu,
    );
    const sourceSets = extractAttributeValues(
      markup,
      /(?:^|[\s<])srcset\s*=\s*(?:(["'])(.*?)\1|([^\s"'=<>`]+))/giu,
    );
    const urlLists = extractAttributeValues(
      markup,
      /(?:^|[\s<])(?:archive|ping)\s*=\s*(?:(["'])(.*?)\1|([^\s"'=<>`]+))/giu,
    );

    for (const sourceSet of sourceSets) {
      references.push(...extractSourceSetUrls(sourceSet));
    }

    for (const urlList of urlLists) {
      references.push(...urlList.split(/\s+/u).filter(Boolean));
    }

    references.push(...extractMetaImageReferences(markup));

    return references;
  }

  if (extension === ".css") {
    return extractCssReferences(source);
  }

  return extractJavaScriptReferences(source);
}

function isSameOriginAbsoluteReference(reference, siteOrigin) {
  if (!reference.startsWith("//") && !/^https?:\/\//iu.test(reference)) {
    return false;
  }

  try {
    return new URL(reference, siteOrigin).origin === siteOrigin;
  } catch {
    return false;
  }
}

function isLocalReference(reference, extension, siteOrigin) {
  if (!reference) {
    return false;
  }

  if (reference.startsWith("//") || /^[a-z][a-z\d+.-]*:/iu.test(reference)) {
    return isSameOriginAbsoluteReference(reference, siteOrigin);
  }

  if (reference.startsWith("#")) {
    return extension === ".html";
  }

  if (extension === ".js" || extension === ".mjs") {
    return reference.startsWith(".") || reference.startsWith("/");
  }

  return true;
}

function resolveReference(rootDirectory, sourcePath, reference, siteOrigin) {
  const referenceValue = isSameOriginAbsoluteReference(reference, siteOrigin)
    ? new URL(reference, siteOrigin).pathname
    : reference;
  const referencePath = decodeURIComponent(referenceValue.split(/[?#]/u, 1)[0]);

  if (!referencePath) {
    return reference.startsWith("#") ? sourcePath : null;
  }

  return referencePath.startsWith("/")
    ? path.resolve(rootDirectory, `.${referencePath}`)
    : path.resolve(path.dirname(sourcePath), referencePath);
}

function isWithinRoot(rootDirectory, targetPath) {
  const relativeTarget = path.relative(rootDirectory, targetPath);

  return (
    relativeTarget !== ".." &&
    !relativeTarget.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativeTarget)
  );
}

async function openContainedPath(rootDirectory, targetPath) {
  let fileHandle;

  try {
    const canonicalPath = await realpath(targetPath);
    if (!isWithinRoot(rootDirectory, canonicalPath)) {
      return null;
    }

    fileHandle = await open(
      canonicalPath,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    const openedStats = await fileHandle.stat({ bigint: true });
    const revalidatedPath = await realpath(targetPath);
    const revalidatedStats = await lstat(revalidatedPath, { bigint: true });

    if (
      canonicalPath !== revalidatedPath ||
      !isWithinRoot(rootDirectory, revalidatedPath) ||
      revalidatedStats.isSymbolicLink() ||
      openedStats.dev !== revalidatedStats.dev ||
      openedStats.ino !== revalidatedStats.ino
    ) {
      await fileHandle.close();
      return null;
    }

    return { canonicalPath, fileHandle, stats: openedStats };
  } catch {
    if (fileHandle) {
      await fileHandle.close().catch(() => {});
    }

    return null;
  }
}

async function readContainedFile(rootDirectory, targetPath) {
  const openedPath = await openContainedPath(rootDirectory, targetPath);
  if (!openedPath) {
    return null;
  }

  try {
    if (!openedPath.stats.isFile()) {
      return null;
    }

    return {
      canonicalPath: openedPath.canonicalPath,
      contents: await openedPath.fileHandle.readFile("utf8"),
    };
  } catch {
    return null;
  } finally {
    await openedPath.fileHandle.close().catch(() => {});
  }
}

async function resolveExistingTarget(rootDirectory, targetPath, allowDirectoryIndex) {
  const openedTarget = await openContainedPath(rootDirectory, targetPath);
  if (!openedTarget) {
    return null;
  }

  try {
    if (openedTarget.stats.isDirectory()) {
      if (!allowDirectoryIndex) {
        return null;
      }

      return resolveExistingTarget(
        rootDirectory,
        path.join(openedTarget.canonicalPath, "index.html"),
        false,
      );
    }

    return openedTarget.stats.isFile() ? openedTarget.canonicalPath : null;
  } finally {
    await openedTarget.fileHandle.close().catch(() => {});
  }
}

async function htmlFragmentExists(rootDirectory, targetPath, fragment) {
  const target = await readContainedFile(rootDirectory, targetPath);
  if (!target) {
    return false;
  }

  const markup = target.contents.replace(/<!--[\s\S]*?-->/gu, "");
  const anchors = extractAttributeValues(
    markup,
    /(?:^|[\s<])(?:id|name)\s*=\s*(?:(["'])(.*?)\1|([^\s"'=<>`]+))/giu,
  );

  return anchors.includes(decodeURIComponent(fragment));
}

async function verifyLocalReferences(rootDirectory, siteOrigin) {
  const sourceFiles = (await collectSourceFiles(rootDirectory)).sort();
  const errors = [];
  let localReferencesChecked = 0;

  for (const sourcePath of sourceFiles) {
    const relativeSource = path.relative(rootDirectory, sourcePath);
    let canonicalSource;

    try {
      canonicalSource = await realpath(sourcePath);
    } catch {
      errors.push(`${relativeSource}: source could not be resolved`);
      continue;
    }

    if (!isWithinRoot(rootDirectory, canonicalSource)) {
      errors.push(`${relativeSource}: source resolves outside site root`);
      continue;
    }

    const sourceFile = await readContainedFile(rootDirectory, sourcePath);
    if (!sourceFile) {
      errors.push(`${relativeSource}: source could not be read safely`);
      continue;
    }

    const source = sourceFile.contents;
    const extension = path.extname(sourcePath);

    for (const reference of extractReferences(sourcePath, source)) {
      if (!isLocalReference(reference, extension, siteOrigin)) {
        continue;
      }

      localReferencesChecked += 1;
      const targetPath = resolveReference(
        rootDirectory,
        sourcePath,
        reference,
        siteOrigin,
      );
      const relativeTarget = targetPath && path.relative(rootDirectory, targetPath);
      const pointsOutsideRoot =
        targetPath && !isWithinRoot(rootDirectory, targetPath);
      const existingTarget =
        targetPath && !pointsOutsideRoot
          ? await resolveExistingTarget(
              rootDirectory,
              targetPath,
              extension !== ".js" && extension !== ".mjs",
            )
          : null;

      if (!existingTarget) {
        errors.push(
          `${relativeSource}: missing local reference "${reference}"` +
            (relativeTarget ? ` (resolved to ${relativeTarget})` : ""),
        );
        continue;
      }

      const fragmentIndex = reference.indexOf("#");
      if (
        extension === ".html" &&
        fragmentIndex !== -1 &&
        path.extname(existingTarget) === ".html" &&
        !(await htmlFragmentExists(
          rootDirectory,
          existingTarget,
          reference.slice(fragmentIndex + 1),
        ))
      ) {
        errors.push(
          `${relativeSource}: missing fragment "${reference.slice(fragmentIndex)}" in ` +
            path.relative(rootDirectory, existingTarget),
        );
      }
    }
  }

  return { errors, localReferencesChecked, sourceFilesChecked: sourceFiles.length };
}

function difference(left, right) {
  const availableValues = [...right];

  return left.filter((value) => {
    const matchingIndex = availableValues.indexOf(value);

    if (matchingIndex === -1) {
      return true;
    }

    availableValues.splice(matchingIndex, 1);
    return false;
  });
}

async function verifySitemap(rootDirectory, expectedSitemapUrls) {
  const sitemapPath = path.join(rootDirectory, "sitemap.xml");
  let canonicalSitemap;

  try {
    canonicalSitemap = await realpath(sitemapPath);
  } catch {
    throw new Error("sitemap.xml: source could not be resolved");
  }

  if (!isWithinRoot(rootDirectory, canonicalSitemap)) {
    throw new Error("sitemap.xml: source resolves outside site root");
  }

  const sitemapFile = await readContainedFile(rootDirectory, sitemapPath);
  if (!sitemapFile) {
    throw new Error("sitemap.xml: source could not be read safely");
  }

  const sitemap = sitemapFile.contents;
  const activeSitemap = sitemap.replace(/<!--[\s\S]*?-->/gu, "");
  const sitemapUrls = [];
  const errors = [];
  const urlEntries = extractMatches(
    activeSitemap,
    /<url(?:\s[^>]*)?>([\s\S]*?)<\/url>/giu,
    1,
  );

  for (const urlEntry of urlEntries) {
    const locations = extractMatches(
      urlEntry,
      /<loc>\s*([^<]*?)\s*<\/loc>/giu,
      1,
    );

    if (locations.length === 1) {
      sitemapUrls.push(locations[0]);
    } else {
      errors.push("sitemap.xml: each URL entry must contain exactly one location");
    }
  }

  const missingUrls = difference(expectedSitemapUrls, sitemapUrls);
  const unexpectedUrls = difference(sitemapUrls, expectedSitemapUrls);

  if (missingUrls.length > 0 || unexpectedUrls.length > 0) {
    const details = [
      missingUrls.length > 0 ? `missing ${missingUrls.join(", ")}` : "",
      unexpectedUrls.length > 0 ? `unexpected ${unexpectedUrls.join(", ")}` : "",
    ].filter(Boolean);

    errors.push(`sitemap.xml: URLs differ; ${details.join("; ")}`);
  }

  return { errors, sitemapUrls };
}

/**
 * Verify a static site's sitemap and local references.
 *
 * @param {string} rootDirectory - Site root to inspect.
 * @param {{ expectedSitemapUrls?: string[], siteOrigin?: string }} [options] - Verification options.
 * @returns {Promise<{ localReferencesChecked: number, sitemapUrls: string[], sourceFilesChecked: number }>}
 */
export async function verifySite(rootDirectory, options = {}) {
  const normalizedRoot = await realpath(path.resolve(rootDirectory));
  const expectedSitemapUrls =
    options.expectedSitemapUrls ?? EXPECTED_SITEMAP_URLS;
  const siteOrigin = new URL(
    options.siteOrigin ?? EXPECTED_SITEMAP_URLS[0],
  ).origin;
  const [referenceResult, sitemapResult] = await Promise.all([
    verifyLocalReferences(normalizedRoot, siteOrigin),
    verifySitemap(normalizedRoot, expectedSitemapUrls),
  ]);
  const errors = [...sitemapResult.errors, ...referenceResult.errors];

  if (errors.length > 0) {
    throw new Error(
      ["Site verification failed:", ...errors.map((error) => `- ${error}`)].join("\n"),
    );
  }

  return {
    localReferencesChecked: referenceResult.localReferencesChecked,
    sitemapUrls: sitemapResult.sitemapUrls,
    sourceFilesChecked: referenceResult.sourceFilesChecked,
  };
}

const scriptPath = fileURLToPath(import.meta.url);

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const repositoryRoot = path.resolve(path.dirname(scriptPath), "..");

  try {
    const result = await verifySite(repositoryRoot);
    console.log(
      `Verified ${result.sitemapUrls.length} sitemap URLs and ` +
        `${result.localReferencesChecked} local references across ` +
        `${result.sourceFilesChecked} source files.`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
