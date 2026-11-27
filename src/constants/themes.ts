import { SyntaxColors, UiTheme } from '../types';

export interface UiThemeDefinition {
  id: UiTheme;
  name: string;
  subtitle: string;
  description: string;
  badge: string;
  preview: {
    bg: string;
    bar: string;
    surface: string;
    border: string;
    accent: string;
    accent2: string;
    glow: string;
  };
}

export const UI_THEMES: UiThemeDefinition[] = [
  {
    id: 'midnight-obsidian',
    name: 'Midnight Obsidian',
    subtitle: 'Đen sâu • Vàng kim loại • Xanh dương lạnh',
    description: 'Màu đen sâu sang trọng, viền sáng mỏng tinh xảo kết hợp vàng kim loại và xanh dương lạnh chuyên nghiệp.',
    badge: 'Executive',
    preview: {
      bg: '#07090e',
      bar: '#0b0f18',
      surface: '#101522',
      border: 'rgba(148, 179, 219, 0.35)',
      accent: '#e2be53',
      accent2: '#63a4ff',
      glow: '0 0 14px rgba(226, 190, 83, 0.32)',
    },
  },
  {
    id: 'neon-noir',
    name: 'Neon Noir Luxury',
    subtitle: 'Đen tuyền • Neon tím-hồng • Xanh cyan',
    description: 'Nền đen tuyền huyền bí kết hợp ánh sáng neon tím-hồng và xanh cyan rực rỡ theo phong cách cyber-luxury.',
    badge: 'Cyber-Lux',
    preview: {
      bg: '#030307',
      bar: '#070610',
      surface: '#0e0b1b',
      border: 'rgba(232, 121, 249, 0.45)',
      accent: '#e879f9',
      accent2: '#22d3ee',
      glow: '0 0 16px rgba(232, 121, 249, 0.45)',
    },
  },
  {
    id: 'graphite-gold',
    name: 'Graphite Gold Elite',
    subtitle: 'Xám đen graphite • Vàng champagne kim loại',
    description: 'Tông xám đen graphite tối giản kết hợp vàng champagne kim loại ấm áp, chuẩn mực thượng lưu.',
    badge: 'Minimal Elite',
    preview: {
      bg: '#121316',
      bar: '#17191d',
      surface: '#1d2025',
      border: 'rgba(226, 199, 146, 0.32)',
      accent: '#e2c792',
      accent2: '#cbd5e1',
      glow: '0 0 12px rgba(226, 199, 146, 0.25)',
    },
  },
];

export const THEME_PALETTES: Record<string, SyntaxColors> = {
  'midnight-obsidian': {
    keyword: '#e8c55a',      // metallic gold
    builtin: '#6cb6ff',      // cool steel blue
    string: '#8fd4e8',       // icy blue
    number: '#f3d479',       // warm gold
    comment: '#64748b',      // crisp slate
    function: '#7dc4ff',     // azure highlight
    variable: '#edf2f7',     // alabaster white
    operator: '#d4af37',     // antique gold
    background: '#07090e',   // deep obsidian
    foreground: '#e2e8f0',
    lineHighlight: '#111726',
    gutterBg: '#05070b',
    gutterFg: '#4e5d73',
  },
  'neon-noir': {
    keyword: '#f43f9c',      // neon magenta-pink
    builtin: '#22d3ee',      // electric cyan
    string: '#67e8f9',       // luminous ice cyan
    number: '#c084fc',       // neon orchid violet
    comment: '#6f658c',      // muted twilight
    function: '#e879f9',     // neon fuchsia
    variable: '#f5f3ff',     // pure pearl
    operator: '#38bdf8',     // crisp cyan
    background: '#030307',   // pitch noir
    foreground: '#f1ecff',
    lineHighlight: '#130c23',
    gutterBg: '#020205',
    gutterFg: '#6c4d8f',
  },
  'graphite-gold': {
    keyword: '#e2c792',      // champagne gold
    builtin: '#cbd5e1',      // brushed platinum
    string: '#a8ccb8',       // muted sage champagne
    number: '#d8ad78',       // warm bronze-gold
    comment: '#6e737d',      // graphite muted
    function: '#f3dfb6',     // pale champagne
    variable: '#f3f1ec',     // warm ivory
    operator: '#c9a96e',     // satin gold
    background: '#121316',   // matte graphite
    foreground: '#eceae4',
    lineHighlight: '#1d1f24',
    gutterBg: '#0e0f12',
    gutterFg: '#616670',
  },
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
