import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const changeLanguage = (e) => {
    i18n.changeLanguage(e.target.value);
  };

  return (
    <div className="lang-switcher-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', width: '100%', borderRadius: 'var(--radius-sm)', transition: 'background-color 0.2s', cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
      <div className="lang-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', background: 'var(--surface2)', borderRadius: '50%', color: 'var(--text)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <Globe size={18} />
      </div>
      <select 
        value={i18n.resolvedLanguage || i18n.language} 
        onChange={changeLanguage}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text)',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          outline: 'none',
          flex: 1,
          appearance: 'none',
        }}
      >
        <option value="en" style={{ color: 'black' }}>English</option>
        <option value="ru" style={{ color: 'black' }}>Русский</option>
        <option value="uz" style={{ color: 'black' }}>O'zbekcha</option>
      </select>
    </div>
  );
}
