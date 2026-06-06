import { useThemeStore } from '../store/themeStore';
import { Sun, Moon, Monitor } from 'lucide-react';

export default function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();

  const toggleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  return (
    <button
      onClick={toggleTheme}
      className="theme-toggle-btn"
      title={`Current theme: ${theme}. Click to switch.`}
    >
      <div className="theme-toggle-icons">
        {theme === 'light' && <Sun size={18} />}
        {theme === 'dark' && <Moon size={18} />}
        {theme === 'system' && <Monitor size={18} />}
      </div>
      <span className="theme-toggle-text">
        {theme === 'light' ? 'Light Mode' : theme === 'dark' ? 'Dark Mode' : 'System Theme'}
      </span>
    </button>
  );
}
