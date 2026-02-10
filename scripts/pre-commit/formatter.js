#!/usr/bin/env node

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Supported file extensions for Prettier
const SUPPORTED_EXTENSIONS = /\.(js|ts|jsx|tsx|html|xhtml|css|less|json|md)$/;

/**
 * Finds the project directory containing node_modules
 * @param {string} baseDir - Base directory (usually __dirname)
 * @param {Object} fsModule - Filesystem module (mockable for tests)
 * @returns {string|null} Path to project directory or null if not found
 */
function findProjectDir(baseDir, fsModule = fs) {
  const repoRoot = path.join(baseDir, "../..");

  try {
    const entries = fsModule.readdirSync(repoRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith(".")) {
        const nodeModulesPath = path.join(repoRoot, entry.name, "node_modules");
        if (fsModule.existsSync(nodeModulesPath)) {
          return path.join(repoRoot, entry.name);
        }
      }
    }
  } catch (e) {
    // Ignore errors
  }

  return null;
}

/**
 * Gets the path to the Prettier binary (OS-independent)
 * @param {string} baseDir - Base directory (usually __dirname)
 * @param {Object} fsModule - Filesystem module (mockable for tests)
 * @returns {string|null} Path to Prettier binary or null if not found
 */
function getPrettierBinPath(baseDir, fsModule = fs) {
  const projectDir = findProjectDir(baseDir, fsModule);
  if (!projectDir) return null;

  const isWindows = process.platform === "win32";
  return path.join(
    projectDir,
    "node_modules/.bin",
    isWindows ? "prettier.cmd" : "prettier",
  );
}

/**
 * Checks if Prettier is installed
 * @param {string} prettierBin - Path to Prettier binary
 * @param {Object} fsModule - Filesystem module (mockable for tests)
 * @returns {boolean} true if Prettier exists
 */
function prettierExists(prettierBin, fsModule = fs) {
  return fsModule.existsSync(prettierBin);
}

/**
 * Gets the list of staged files from Git
 * @param {Function} execFn - Function to execute shell commands
 * @returns {string[]} List of staged files
 */
function getStagedFiles(execFn = execSync) {
  const output = execFn("git diff --cached --name-only --diff-filter=ACMR", {
    encoding: "utf8",
  });
  return output
    .split(/\r?\n/)
    .map((f) => f.trim())
    .filter((f) => f);
}

/**
 * Filters files by supported extensions
 * @param {string[]} files - List of file paths
 * @param {RegExp} pattern - Regex pattern for supported extensions
 * @returns {string[]} Filtered file list
 */
function filterPrettierFiles(files, pattern = SUPPORTED_EXTENSIONS) {
  return files.filter((f) => pattern.test(f));
}

/**
 * Runs Prettier on the specified files
 * @param {string[]} files - List of file paths
 * @param {string} prettierBin - Path to Prettier binary
 * @param {Function} execFn - Function to execute shell commands
 */
function runPrettier(files, prettierBin, execFn = execSync) {
  if (files.length === 0) return;

  const fileArgs = files.map((f) => `"${f}"`).join(" ");
  execFn(`"${prettierBin}" --write ${fileArgs}`, {
    stdio: "inherit",
  });
}

/**
 * Re-stages the formatted files
 * @param {string[]} files - List of file paths
 * @param {Function} execFn - Function to execute shell commands
 */
function stageFiles(files, execFn = execSync) {
  if (files.length === 0) return;

  const fileArgs = files.map((f) => `"${f}"`).join(" ");
  execFn(`git add ${fileArgs}`);
}

/**
 * Main function for the pre-commit hook
 * @param {Object} options - Options
 * @param {Function} options.execFn - Function to execute shell commands
 * @param {string} options.baseDir - Base directory
 * @param {Function} options.log - Logging function
 * @param {Function} options.exit - Exit function
 * @returns {Object} Result with execution information
 */
function runPreCommit(options = {}) {
  const {
    execFn = execSync,
    baseDir = __dirname,
    log = console.log,
    exit = process.exit,
    fsModule = fs,
  } = options;

  const prettierBin = getPrettierBinPath(baseDir, fsModule);
  const stagedFiles = getStagedFiles(execFn);

  if (stagedFiles.length === 0) {
    log("No staged files detected.");
    exit(0);
    return { success: true, filesProcessed: 0, reason: "no-staged-files" };
  }

  const prettierFiles = filterPrettierFiles(stagedFiles);

  if (prettierFiles.length > 0) {
    // Check if Prettier is installed
    if (!prettierBin || !prettierExists(prettierBin, fsModule)) {
      log("⚠️  Prettier not found. Skipping formatting.");
      log("   Run 'npm install' to enable formatting.");
      return { success: true, filesProcessed: 0, reason: "prettier-not-found" };
    }

    log("Running Prettier on staged files:");
    prettierFiles.forEach((f) => log("  ", f));

    runPrettier(prettierFiles, prettierBin, execFn);
    stageFiles(prettierFiles, execFn);
  }

  log("✅ Pre-commit hook finished successfully.");
  return { success: true, filesProcessed: prettierFiles.length };
}

// Export for tests
module.exports = {
  SUPPORTED_EXTENSIONS,
  findProjectDir,
  getPrettierBinPath,
  prettierExists,
  getStagedFiles,
  filterPrettierFiles,
  runPrettier,
  stageFiles,
  runPreCommit,
};

// Only execute when called directly (not when required)
if (require.main === module) {
  runPreCommit();
}
