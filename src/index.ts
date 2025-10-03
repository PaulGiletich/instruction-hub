#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { addRepo, removeRepo, getRepos } from './config';
import { getManagedInstructions } from './tracker';
import { interactiveInstall, interactiveUninstall, interactiveUpdate } from './interactive';

const program = new Command();

program
  .name('instruction-hub')
  .description('CLI tool to manage GitHub Copilot instructions')
  .version('1.0.0')
  .configureHelp({
    sortSubcommands: true,
  })
  .showHelpAfterError();

// Config commands
const config = program
  .command('config')
  .description('Manage instruction repositories');

config
  .command('add <repo>')
  .description('Add a repository (format: owner/repo or owner/repo/path)')
  .action((repo: string) => {
    addRepo(repo);
    console.log(chalk.green(`✓ Added repository: ${repo}`));
  });

config
  .command('remove <repo>')
  .alias('rm')
  .description('Remove a repository')
  .action((repo: string) => {
    removeRepo(repo);
    console.log(chalk.green(`✓ Removed repository: ${repo}`));
  });

config
  .command('list')
  .alias('ls')
  .description('List configured repositories')
  .action(() => {
    const repos = getRepos();
    if (repos.length === 0) {
      console.log(chalk.yellow('No repositories configured.'));
      console.log(chalk.gray('Add a repository with: instruction-hub config add <repo>'));
      return;
    }
    console.log(chalk.bold('Configured repositories:'));
    repos.forEach((repo, index) => {
      console.log(chalk.cyan(`  ${index + 1}. ${repo}`));
    });
  });

// Install command
program
  .command('install')
  .alias('i')
  .alias('add')
  .description('Install instructions from configured repositories (interactive)')
  .action(async () => {
    await interactiveInstall();
  });

// Uninstall command
program
  .command('uninstall')
  .alias('rm')
  .alias('remove')
  .alias('delete')
  .description('Uninstall managed instructions')
  .action(async () => {
    await interactiveUninstall();
  });

// Update command
program
  .command('update')
  .alias('u')
  .alias('upgrade')
  .description('Update all managed instructions from their sources')
  .action(async () => {
    await interactiveUpdate();
  });

// List managed instructions
program
  .command('list')
  .alias('ls')
  .description('List managed instructions')
  .action(() => {
    const managed = getManagedInstructions();
    if (managed.length === 0) {
      console.log(chalk.yellow('No managed instructions.'));
      return;
    }
    console.log(chalk.bold('Managed instructions:'));
    managed.forEach((inst, index) => {
      console.log(chalk.cyan(`  ${index + 1}. ${inst.filename}`));
      console.log(chalk.gray(`     Source: ${inst.sourceRepo}`));
      console.log(chalk.gray(`     Path: ${inst.sourcePath}`));
      console.log(chalk.gray(`     Installed: ${new Date(inst.installedAt).toLocaleString()}`));
      console.log();
    });
  });

program.parse();

// If no command was matched and no arguments provided, show help
if (process.argv.length === 2) {
  program.help();
}
