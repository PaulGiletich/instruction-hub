import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';
import { RepoFile } from './types';

const execAsync = promisify(exec);

export function parseGitHubRepo(repo: string): { owner: string; repo: string; path?: string; baseUrl: string } {
  // Handle formats like:
  // - owner/repo
  // - owner/repo/path/to/folder
  // - https://github.com/owner/repo
  // - https://github.com/owner/repo/tree/main/path
  // - https://ghe.company.com/owner/repo

  let cleaned = repo.trim();
  let baseUrl = 'https://api.github.com';

  // Check if it's a GitHub Enterprise URL
  if (cleaned.includes('://')) {
    const url = new URL(cleaned);
    if (url.hostname !== 'github.com') {
      // GitHub Enterprise
      baseUrl = `${url.protocol}//${url.hostname}/api/v3`;
    }
    cleaned = url.pathname.substring(1); // Remove leading /
  }

  // Remove tree/branch part
  if (cleaned.includes('/tree/')) {
    const parts = cleaned.split('/tree/');
    const beforeTree = parts[0];
    const afterBranch = parts[1].split('/').slice(1).join('/');
    cleaned = afterBranch ? `${beforeTree}/${afterBranch}` : beforeTree;
  }

  const parts = cleaned.split('/');
  const owner = parts[0];
  const repoName = parts[1];
  const pathParts = parts.slice(2);

  return {
    owner,
    repo: repoName,
    path: pathParts.length > 0 ? pathParts.join('/') : undefined,
    baseUrl
  };
}

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

export async function fetchMarkdownFiles(repo: string): Promise<RepoFile[]> {
  const { owner, repo: repoName, path: repoPath, baseUrl } = parseGitHubRepo(repo);

  // Extract hostname for token lookup
  const hostname = baseUrl.includes('api.github.com') ? 'github.com' : new URL(baseUrl).hostname;

  const url = `${baseUrl}/repos/${owner}/${repoName}/contents/${repoPath || ''}`;

  // Try to get authentication token
  const token = await getGitHubToken(hostname);

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'instruction-hub'
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await axios.get(url, { headers });

    const files: RepoFile[] = [];

    for (const item of response.data) {
      if (item.type === 'file' && item.name.endsWith('.md')) {
        files.push({
          name: item.name,
          path: item.path,
          download_url: item.download_url
        });
      } else if (item.type === 'dir') {
        // Recursively fetch files from subdirectories
        const subFiles = await fetchMarkdownFiles(`${baseUrl.replace('/api/v3', '')}/${owner}/${repoName}/${item.path}`);
        files.push(...subFiles);
      }
    }

    return files;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        if (!token && hostname !== 'github.com') {
          throw new Error(`Repository not found or private. Please authenticate with GitHub CLI: gh auth login --hostname ${hostname}`);
        } else if (!token) {
          throw new Error(`Repository not found or private. Please authenticate with GitHub CLI: gh auth login`);
        } else {
          throw new Error(`Repository not found: ${owner}/${repoName}`);
        }
      } else if (error.response?.status === 401) {
        throw new Error(`Authentication failed. Please check your GitHub CLI authentication: gh auth status`);
      } else if (error.response?.status === 403) {
        throw new Error(`Access forbidden. You may not have permission to access this repository.`);
      }
      throw new Error(`Failed to fetch from GitHub: ${error.message}`);
    }
    throw error;
  }
}

export async function downloadFile(url: string, token?: string): Promise<string> {
  const headers: Record<string, string> = {
    'User-Agent': 'instruction-hub'
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await axios.get(url, { headers });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Failed to download file: ${error.message}`);
    }
    throw error;
  }
}
