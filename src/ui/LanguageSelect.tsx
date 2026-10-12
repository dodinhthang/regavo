import { useI18n } from '../i18n/I18n.tsx';
import { GameSelect } from './GameSelect.tsx';
import './language-select.css';

const options = [
  { value: 'vi' as const, label: 'Tiếng Việt' },
  { value: 'en' as const, label: 'English' },
  { value: 'zh-CN' as const, label: '简体中文' },
];
export function LanguageSelect({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage } = useI18n();
  return (
    <div className={`language-select${compact ? ' language-compact' : ''}`}>
      <GameSelect label="Ngôn ngữ" value={language} options={options} onChange={setLanguage} />
    </div>
  );
}
