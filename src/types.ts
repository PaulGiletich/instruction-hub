// Configuration types
export interface Config {
  repos: string[];
}

// GitHub API types
export interface RepoFile {
  name: string;
  path: string;
  download_url: string;
}

// Instruction tracking types
export interface ManagedInstruction {
  filename: string;
  sourceRepo: string;
  sourcePath: string;
  installedAt: string;
}

export interface InstructionHubData {
  instructions: ManagedInstruction[];
}

// Force module recognition
export const module = true;
