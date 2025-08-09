/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Primary colors (Blue scale)
        primary: {
          100: '#E1E2F8',
          200: '#C3C5F1',
          300: '#B4B7ED',
          400: '#A5A9E9',
          500: '#959CE5',
          600: '#858EE1',
          700: '#7381DD',
          800: '#6174D9',
          900: '#4C68D5',
        },
        // Semantic colors
        yellow: {
          100: '#FEEED7',
          200: '#FCDEAF',
          300: '#F9D69B',
          400: '#F7CE87',
          500: '#F4C673',
          600: '#F0BE5E',
          700: '#EDB648',
          800: '#E8AF2F',
          900: '#E4A704',
        },
        red: {
          100: '#FAD8D0',
          200: '#F5C5BA',
          300: '#EB9F8E',
          400: '#E48B78',
          500: '#DD7864',
          600: '#D46450',
          700: '#CC4F3C',
          800: '#C23729',
          900: '#B81616',
        },
        green: {
          100: '#D4E3D6',
          200: '#BFD6C2',
          300: '#96BA9C',
          400: '#81AD89',
          500: '#6DA076',
          600: '#589264',
          700: '#428553',
          800: '#2A7841',
          900: '#036B30',
        },
        // Kaspa green accent colors
        kaspa: {
          50: '#E8F5E8',
          100: '#C8E6C8',
          200: '#A8D7A8',
          300: '#88C888',
          400: '#68B968',
          500: '#2FCF99', // main accent (light)
          600: '#2FCF99', // main accent (light)
          700: '#29B885', // hover (light)
          800: '#22A172', // active (light)
          900: '#1A341A',
          '600-dark': '#42CA9C', // main accent (dark)
          '700-dark': '#38B88C', // hover (dark, slightly darker)
          '800-dark': '#2EA77C', // active (dark, even darker)
        },
        accent: {
          light: '#2FCF99',
          dark: '#06EEA0',
        },
        // Darker neutral colors - adjusted to be lighter
        black: {
          100: '#666666',
          200: '#525252',
          300: '#404040',
          400: '#333333',
          500: '#2B2B2B',
          600: '#242424',
          700: '#1E1E1E',
          800: '#181818',
          900: '#000000',
        },
        white: {
          DEFAULT: '#FFFFFF',
          100: '#FAFBFF',
          200: '#F1F4F9',
          300: '#ECF0F5',
          400: '#E2E8F0',
          900: '#FFFFFF',
        },
        // Cyberpunk colors
        neon: {
          cyan: '#00FFFF',
          'cyan-dark': '#00CCCC',
          'cyan-glow': '#00FFFF',
          magenta: '#FF00FF',
          'magenta-dark': '#CC00CC',
          'magenta-glow': '#FF00FF',
          pink: '#FF10F0',
          'pink-dark': '#CC0DCC',
          blue: '#00D4FF',
          'blue-dark': '#00A8CC',
          purple: '#B026FF',
          'purple-dark': '#8B1FCC',
          green: '#39FF14',
          'green-dark': '#2ECC11',
          yellow: '#FFFF00',
          'yellow-dark': '#CCCC00',
          orange: '#FF6600',
          'orange-dark': '#CC5200',
        },
        cyber: {
          'dark-1': '#0a0a0a',
          'dark-2': '#111111',
          'dark-3': '#1a1a1a',
          'dark-4': '#222222',
          'dark-5': '#2a2a2a',
          'gray-1': '#333333',
          'gray-2': '#444444',
          'gray-3': '#666666',
          'gray-4': '#888888',
          'gray-5': '#aaaaaa',
        },
      },
      spacing: {
        1: '4px',   // 01
        1.5: '6px', // 02
        2: '8px',   // 03
        3: '12px',  // 04
        4: '16px',  // 05
        6: '24px',  // 06
        8: '32px',  // 07
        10: '40px', // 08
        12: '48px', // 09
        14: '56px', // 10
        16: '64px', // 11
        18: '72px', // 12
        20: '80px', // 13
        22: '88px', // 14
        24: '96px', // 15
        26: '104px', // 16
        28: '112px', // 17
        30: '120px', // 18
        32: '128px', // 19
        34: '136px', // 20
        36: '144px', // 21
        38: '152px', // 22
        40: '160px', // 23
        42: '168px', // 24
      },
      fontFamily: {
        // Default theme fonts
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Georgia', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
        
        // Default theme specific fonts
        heading: ['Inter', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        
        // Cyberpunk theme fonts (only used when cyberpunk theme is active)
        cyber: ['Orbitron', 'monospace'],
        tech: ['Rajdhani', 'sans-serif'],
      },
      fontSize: {
        // Labels
        'label': ['12px', { lineHeight: 'auto', letterSpacing: '-0.4%' }],
        
        // Body text
        'body': ['14px', { lineHeight: '175%' }],
        
        // Headings
        'h6': ['14px', { lineHeight: 'auto' }],
        'h5': ['16px', { lineHeight: 'auto' }],
        'h4': ['18px', { lineHeight: 'auto' }],
        'h3': ['24px', { lineHeight: 'auto' }],
        'h2': ['32px', { lineHeight: 'auto' }],
        'h1': ['40px', { lineHeight: 'auto' }],
      },
      fontWeight: {
        'regular': '400',
        'medium': '500',
        'semibold': '600',
        'bold': '700',
      },
      boxShadow: {
        'small': '2px 2px 10px 0px rgba(0, 0, 0, 0.01)',
        'medium': '2px 2px 30px 0px rgba(0, 0, 0, 0.05)',
      },
      borderRadius: {
        'none': '0',
        'sm': '4px',
        'md': '8px',
        'full': '999px',
      },
    },
  },
  plugins: [],
}