export type ExecutionEngine = 'cpython' | 'pyodide';

export type AppTheme = 'pydroid-dark' | 'amoled-black' | 'monokai' | 'cyberpunk' | 'custom';

export interface SyntaxColors {
  keyword: string;
  builtin: string;
  string: string;
  number: string;
  comment: string;
  function: string;
  variable: string;
  operator: string;
  background: string;
  foreground: string;
  lineHighlight: string;
  gutterBg: string;
  gutterFg: string;
}

export interface KeyItem {
  id: string;
  label: string;
  insertValue: string;
  visible: boolean;
  type?: 'char' | 'keyword' | 'action';
  isCustom?: boolean;
}

export type KeySize = 'small' | 'medium' | 'large';

export interface LessonItem {
  id: string;
  title: string;
  level: 'basic' | 'intermediate' | 'advanced';
  description: string;
  starterCode: string;
  solutionCode: string;
  explanation: string;
  sampleInput?: string;
  sampleOutput?: string;
  completed?: boolean;
}

export interface TerminalEntry {
  type: 'stdout' | 'stderr' | 'stdin' | 'system' | 'prompt';
  text: string;
  timestamp?: number;
}

export interface ExecutionResult {
  exitCode: number | null;
  executionTimeMs: number;
  stopped?: boolean;
  error?: string;
}

export interface AiDebugResult {
  errorType: string;
  vietnameseSummary: string;
  rootCause: string;
  tips: string[];
  fixedCode: string;
  diffExplanation: string;
}

export interface SavedFile {
  id: string;
  name: string;
  code: string;
  lastModified: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: number;
}

export interface LintError {
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  type: string;
  message: string;
  vietnameseMessage?: string;
  text?: string;
}
