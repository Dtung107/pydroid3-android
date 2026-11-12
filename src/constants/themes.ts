import { SyntaxColors } from '../types';

export const THEME_PALETTES: Record<string, SyntaxColors> = {
  'pydroid-dark': {
    keyword: '#ff7b72',      // warm red-orange
    builtin: '#79c0ff',      // soft blue
    string: '#a5d6ff',       // sky blue / cyan
    number: '#7ee787',       // mint green
    comment: '#8b949e',      // muted slate
    function: '#d2a8ff',     // lavender purple
    variable: '#e6edf3',     // clean off-white
    operator: '#ff7b72',     // coral
    background: '#161b22',   // pydroid dark
    foreground: '#c9d1d9',
    lineHighlight: '#21262d',
    gutterBg: '#0d1117',
    gutterFg: '#6e7681',
  },
  'amoled-black': {
    keyword: '#ff5370',
    builtin: '#82aaff',
    string: '#c3e88d',
    number: '#f78c6c',
    comment: '#546e7a',
    function: '#c792ea',
    variable: '#eeffff',
    operator: '#89ddff',
    background: '#000000',   // Pure OLED black
    foreground: '#ffffff',
    lineHighlight: '#111111',
    gutterBg: '#000000',
    gutterFg: '#444444',
  },
  'monokai': {
    keyword: '#f92672',
    builtin: '#66d9ef',
    string: '#e6db74',
    number: '#ae81ff',
    comment: '#75715e',
    function: '#a6e22e',
    variable: '#f8f8f2',
    operator: '#f92672',
    background: '#272822',
    foreground: '#f8f8f2',
    lineHighlight: '#3e3d32',
    gutterBg: '#1e1f1c',
    gutterFg: '#75715e',
  },
  'cyberpunk': {
    keyword: '#ff007f',
    builtin: '#00f0ff',
    string: '#ffe600',
    number: '#00ff66',
    comment: '#6b668d',
    function: '#ff0055',
    variable: '#00ffff',
    operator: '#ff9900',
    background: '#0d0d1a',
    foreground: '#00ffff',
    lineHighlight: '#1a103c',
    gutterBg: '#07070f',
    gutterFg: '#ff007f',
  },
};

export const DEFAULT_CUSTOM_COLORS: SyntaxColors = {
  keyword: '#f43f5e',
  builtin: '#38bdf8',
  string: '#34d399',
  number: '#fbbf24',
  comment: '#94a3b8',
  function: '#a855f7',
  variable: '#f1f5f9',
  operator: '#fb923c',
  background: '#18181b',
  foreground: '#f8fafc',
  lineHighlight: '#27272a',
  gutterBg: '#09090b',
  gutterFg: '#71717a',
};
