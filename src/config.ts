import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Config } from './types';

const CONFIG_DIR = path.join(os.homedir(), '.instruction-hub');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function loadConfig(): Config {
  ensureConfigDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    return { repos: [] };
  }
  try {
    const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return { repos: [] };
  }
}

export function saveConfig(config: Config): void {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function addRepo(repo: string): void {
  const config = loadConfig();
  if (!config.repos.includes(repo)) {
    config.repos.push(repo);
    saveConfig(config);
  }
}

export function removeRepo(repo: string): void {
  const config = loadConfig();
  config.repos = config.repos.filter(r => r !== repo);
  saveConfig(config);
}

export function getRepos(): string[] {
  return loadConfig().repos;
}

