import inquirer from 'inquirer';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { getRepos, addRepo } from './config';
import { fetchMarkdownFiles, downloadFile, parseGitHubRepo, parseGitHubFileUrl, fetchSingleFile } from './github';
import { addManagedInstruction, ensureInstructionsDir, getManagedInstructions, removeManagedInstruction } from './tracker';
import { RepoFile } from './types';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function getGitHubToken(hostname?: string): Promise<string | null> {
  try {
    // Try to get token from GitHub CLI
    const host = hostname && hostname !== 'github.com' ? hostname : 'github.com';
    const { stdout } = await execAsync(`gh auth token --hostname ${host}`);
    return stdout.trim();
  } catch (error) {
    // GitHub CLI not available or not authenticated
    return null;
  }
}

/**
 * Ensures that instruction content has the required front matter.
 * If front matter is missing, adds it to the beginning of the content.
 */
function ensureFrontMatter(content: string): string {
  const frontMatterRegex = /^---\s*\n[\s\S]*?\n---\s*\n/;

  if (frontMatterRegex.test(content)) {
    // Front matter already exists
    return content;
  }

  // Add default front matter
  const defaultFrontMatter = `---
applyTo: "**"
---

`;

  return defaultFrontMatter + content;
}

export async function interactiveInstall(): Promise<void> {
  const repos = getRepos();

  if (repos.length === 0) {
    console.log(chalk.yellow('No repositories configured. Please add repositories first using:'));
    console.log(chalk.cyan('  instruction-hub config add <repo>'));
    return;
  }

  // Step 1: Select repository with search
  const { selectedRepo } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedRepo',
      message: 'Select a repository:',
      choices: repos,
      pageSize: 10
    }
  ]);

  console.log(chalk.blue('Fetching instructions from repository...'));

  // Step 2: Fetch markdown files
  let files: RepoFile[];
  try {
    files = await fetchMarkdownFiles(selectedRepo);
  } catch (error) {
    console.log(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    return;
  }

  if (files.length === 0) {
    console.log(chalk.yellow('No markdown files found in this repository.'));
    return;
  }

  // Step 3: Select files with checkbox for multiple selection
  const fileChoices = files.map(f => ({
    name: f.path,
    value: f
  }));

  const { selectedFiles } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selectedFiles',
      message: 'Select instruction files to install (use space to select):',
      choices: fileChoices,
      pageSize: 15
    }
  ]);

  if (selectedFiles.length === 0) {
    console.log(chalk.yellow('No files selected.'));
    return;
  }

  // Step 4: Download and install each selected file
  console.log(chalk.blue(`Installing ${selectedFiles.length} instruction(s)...`));
  console.log();

  // Get token for authenticated download if needed
  const { baseUrl } = parseGitHubRepo(selectedRepo);
  const hostname = baseUrl.includes('api.github.com') ? 'github.com' : new URL(baseUrl).hostname;
  const token = await getGitHubToken(hostname);

  let successCount = 0;
  let errorCount = 0;

  for (const selectedFile of selectedFiles) {
    try {
      console.log(chalk.blue(`Downloading ${selectedFile.path}...`));

      const content = await downloadFile(selectedFile.download_url, token || undefined);
      ensureInstructionsDir();

      let filename = path.basename(selectedFile.path);

      // Ensure filename ends with .instruction.md for valid instructions
      if (!filename.endsWith('.instructions.md')) {
        const nameWithoutExt = filename.replace(/\.md$/, '');
        filename = `${nameWithoutExt}.instructions.md`;
      }

      let targetPath = path.join('.github/instructions', filename);

      // Check if file already exists and handle conflicts
      if (fs.existsSync(targetPath)) {
        const managed = getManagedInstructions();
        const existingInstruction = managed.find(inst => inst.filename === filename);

        if (existingInstruction && existingInstruction.sourceRepo !== selectedRepo) {
          // File exists from different source - create differentiated filename
          const nameWithoutExt = filename.replace(/\.instruction\.md$/, '');
          const repoName = parseGitHubRepo(selectedRepo).repo;
          const differentiatedFilename = `${nameWithoutExt}.${repoName}.instruction.md`;
          targetPath = path.join('.github/instructions', differentiatedFilename);
          filename = differentiatedFilename;

          console.log(chalk.yellow(`  File ${path.basename(selectedFile.path)} already exists from different source.`));
          console.log(chalk.blue(`  Installing as ${filename} to avoid conflict.`));
        } else {
          // Same source or unmanaged file - automatically overwrite
          console.log(chalk.yellow(`  File ${filename} already exists. Overwriting...`));
        }
      }

      let fileContent = content;

      // Ensure the file content has the required front matter
      fileContent = ensureFrontMatter(content);

      fs.writeFileSync(targetPath, fileContent);

      // Track the installation
      addManagedInstruction({
        filename,
        sourceRepo: selectedRepo,
        sourcePath: selectedFile.path,
        installedAt: new Date().toISOString()
      });

      console.log(chalk.green(`✓ Installed ${filename}`));
      successCount++;
    } catch (error) {
      console.log(chalk.red(`✗ Failed to install ${selectedFile.path}: ${error instanceof Error ? error.message : 'Unknown error'}`));
      errorCount++;
    }
  }

  console.log();
  console.log(chalk.bold(`Installation complete: ${chalk.green(successCount + ' succeeded')}, ${errorCount > 0 ? chalk.red(errorCount + ' failed') : chalk.gray('0 failed')}`));
}

export async function interactiveUninstall(): Promise<void> {
  const managed = getManagedInstructions();

  if (managed.length === 0) {
    console.log(chalk.yellow('No managed instructions found.'));
    return;
  }

  const choices = managed.map(inst => ({
    name: `${inst.filename} ${chalk.gray(`(from ${inst.sourceRepo})`)}`,
    value: inst
  }));

  let selectedInstructions;

  if (managed.length === 1) {
    // Auto-select the single instruction
    selectedInstructions = managed;
    console.log(chalk.cyan(`Uninstalling: ${managed[0].filename}`));
  } else {
    // Multiple instructions - show checkbox selection
    const result = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedInstructions',
        message: 'Select instructions to uninstall (use space to select):',
        choices,
        pageSize: 15
      }
    ]);
    selectedInstructions = result.selectedInstructions;
  }

  if (selectedInstructions.length === 0) {
    console.log(chalk.yellow('No instructions selected.'));
    return;
  }

  for (const inst of selectedInstructions) {
    const filePath = path.join('.github/instructions', inst.filename);

    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      removeManagedInstruction(inst.filename);
      console.log(chalk.green(`✓ Uninstalled ${inst.filename}`));
    } catch (error) {
      console.log(chalk.red(`✗ Failed to uninstall ${inst.filename}: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  }
}

export async function interactiveUpdate(): Promise<void> {
  const managed = getManagedInstructions();

  if (managed.length === 0) {
    console.log(chalk.yellow('No managed instructions found to update.'));
    return;
  }

  console.log(chalk.bold(`Updating ${managed.length} managed instruction(s):`));
  managed.forEach((inst, index) => {
    console.log(chalk.cyan(`  ${index + 1}. ${inst.filename} ${chalk.gray(`(from ${inst.sourceRepo})`)}`));
  });
  console.log();

  let successCount = 0;
  let errorCount = 0;

  for (const inst of managed) {
    try {
      console.log(chalk.blue(`Updating ${inst.filename}...`));

      // Parse the repository to get authentication details
      const { baseUrl } = parseGitHubRepo(inst.sourceRepo);
      const hostname = baseUrl.includes('api.github.com') ? 'github.com' : new URL(baseUrl).hostname;
      const token = await getGitHubToken(hostname);

      // Fetch the latest content
      const files = await fetchMarkdownFiles(inst.sourceRepo);
      const sourceFile = files.find(f => f.path === inst.sourcePath);

      if (!sourceFile) {
        console.log(chalk.red(`✗ Source file not found: ${inst.sourcePath}`));
        errorCount++;
        continue;
      }

      const content = await downloadFile(sourceFile.download_url, token || undefined);
      const targetPath = path.join('.github/instructions', inst.filename);

      // Ensure the file content has the required front matter
      const fileContent = ensureFrontMatter(content);

      // Check if content has changed
      const existingContent = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, 'utf-8') : '';

      if (fileContent === existingContent) {
        console.log(chalk.gray(`  ${inst.filename} is already up to date`));
        continue;
      }

      // Write the updated content
      fs.writeFileSync(targetPath, fileContent);

      // Update the installation timestamp
      const updatedInstruction = {
        ...inst,
        installedAt: new Date().toISOString()
      };

      // Remove old entry and add updated one
      removeManagedInstruction(inst.filename);
      addManagedInstruction(updatedInstruction);

      console.log(chalk.green(`✓ Updated ${inst.filename}`));
      successCount++;

    } catch (error) {
      console.log(chalk.red(`✗ Failed to update ${inst.filename}: ${error instanceof Error ? error.message : 'Unknown error'}`));
      errorCount++;
    }
  }

  console.log();
  if (successCount > 0) {
    console.log(chalk.green(`✓ Successfully updated ${successCount} instruction(s)`));
  }
  if (errorCount > 0) {
    console.log(chalk.red(`✗ Failed to update ${errorCount} instruction(s)`));
  }
}

/**
 * Install instruction directly from a GitHub file URL
 * This will automatically add the repo to config if not present
 * and install the specific instruction file
 */
export async function installFromUrl(url: string): Promise<void> {
  console.log(chalk.blue('Processing URL...'));

  // Parse the URL to extract repo and file information
  const parsed = parseGitHubFileUrl(url);

  if (!parsed) {
    console.log(chalk.red('Error: Invalid GitHub file URL.'));
    console.log(chalk.yellow('Expected format: https://github.com/owner/repo/blob/branch/path/to/file.md'));
    return;
  }

  const { repo, filePath } = parsed;

  // Check if repo is already in config, if not add it
  const repos = getRepos();
  if (!repos.includes(repo)) {
    addRepo(repo);
    console.log(chalk.green(`✓ Added repository to config: ${repo}`));
  } else {
    console.log(chalk.gray(`Repository already in config: ${repo}`));
  }

  console.log(chalk.blue(`Downloading instruction from ${filePath}...`));

  try {
    // Fetch the file
    const { content, filename, path: sourcePath } = await fetchSingleFile(url);

    ensureInstructionsDir();

    let instructionFilename = filename;

    // Ensure filename ends with .instructions.md for valid instructions
    if (!instructionFilename.endsWith('.instructions.md')) {
      const nameWithoutExt = instructionFilename.replace(/\.md$/, '');
      instructionFilename = `${nameWithoutExt}.instructions.md`;
    }

    let targetPath = path.join('.github/instructions', instructionFilename);

    // Check if file already exists and handle conflicts
    if (fs.existsSync(targetPath)) {
      const managed = getManagedInstructions();
      const existingInstruction = managed.find(inst => inst.filename === instructionFilename);

      if (existingInstruction && existingInstruction.sourceRepo !== repo) {
        // File exists from different source - create differentiated filename
        const nameWithoutExt = instructionFilename.replace(/\.instructions\.md$/, '');
        const repoName = parseGitHubRepo(repo).repo;
        const differentiatedFilename = `${nameWithoutExt}.${repoName}.instructions.md`;
        targetPath = path.join('.github/instructions', differentiatedFilename);
        instructionFilename = differentiatedFilename;

        console.log(chalk.yellow(`  File ${filename} already exists from different source.`));
        console.log(chalk.blue(`  Installing as ${instructionFilename} to avoid conflict.`));
      } else {
        // Same source or unmanaged file - automatically overwrite
        console.log(chalk.yellow(`  File ${instructionFilename} already exists. Overwriting...`));
      }
    }

    // Ensure the file content has the required front matter
    const fileContent = ensureFrontMatter(content);

    // Write the file
    fs.writeFileSync(targetPath, fileContent);

    // Track the installation
    addManagedInstruction({
      filename: instructionFilename,
      sourceRepo: repo,
      sourcePath: sourcePath,
      installedAt: new Date().toISOString()
    });

    console.log(chalk.green(`✓ Successfully installed ${instructionFilename}`));
    console.log(chalk.gray(`  Source: ${repo}`));
    console.log(chalk.gray(`  Path: ${sourcePath}`));

  } catch (error) {
    console.log(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
  }
}
