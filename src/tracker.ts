import * as fs from 'fs';
import * as path from 'path';
import { InstructionHubData, ManagedInstruction } from './types';

const INSTRUCTIONS_DIR = '.github/instructions';
const TRACKER_FILE = path.join(INSTRUCTIONS_DIR, '.instruction-hub.json');

export function ensureInstructionsDir(): void {
  if (!fs.existsSync(INSTRUCTIONS_DIR)) {
    fs.mkdirSync(INSTRUCTIONS_DIR, { recursive: true });
  }
}

export function loadTrackerData(): InstructionHubData {
  ensureInstructionsDir();
  if (!fs.existsSync(TRACKER_FILE)) {
    return { instructions: [] };
  }
  try {
    const data = fs.readFileSync(TRACKER_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return { instructions: [] };
  }
}

export function saveTrackerData(data: InstructionHubData): void {
  ensureInstructionsDir();
  fs.writeFileSync(TRACKER_FILE, JSON.stringify(data, null, 2));
}

export function addManagedInstruction(instruction: ManagedInstruction): void {
  const data = loadTrackerData();
  // Remove existing entry with same filename if exists
  data.instructions = data.instructions.filter(i => i.filename !== instruction.filename);
  data.instructions.push(instruction);
  saveTrackerData(data);
}

export function removeManagedInstruction(filename: string): void {
  const data = loadTrackerData();
  data.instructions = data.instructions.filter(i => i.filename !== filename);
  saveTrackerData(data);
}

export function getManagedInstructions(): ManagedInstruction[] {
  return loadTrackerData().instructions;
}

export function isManaged(filename: string): boolean {
  const data = loadTrackerData();
  return data.instructions.some(i => i.filename === filename);
}

