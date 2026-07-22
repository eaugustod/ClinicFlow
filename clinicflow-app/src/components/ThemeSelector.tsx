import React, { useState, useRef, useEffect } from 'react';
import { Palette, Check, Moon, Sun } from 'lucide-react';
import { useTheme, THEME_OPTIONS, ThemeId } from '../context/ThemeContext';

export const ThemeSelector: React.FC = () => {
  const { currentTheme, setTheme, activeOption } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const darkThemes = THEME_OPTIONS.filter(t => t.category === 'dark');
  const lightThemes = THEME_OPTIONS.filter(t => t.category === 'light');

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer border border-[var(--border)] hover:border-[var(--accent)] bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm hover:shadow-[0_0_12px_var(--accent-glow)]"
        title="Alternar Tema de Cores"
      >
        <Palette size={15} style={{ color: activeOption.previewAccent }} />
        <span className="hidden md:inline">{activeOption.name}</span>
        <div
          className="w-3 h-3 rounded-full border border-white/20"
          style={{ backgroundColor: activeOption.previewAccent }}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-mid)] shadow-[0_25px_60px_rgba(0,0,0,0.7)] p-4 z-[9999] animate-in fade-in slide-in-from-top-2 duration-200 backdrop-blur-2xl">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <Palette size={16} className="text-[var(--accent)]" />
              <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                Paleta de Cores (6 Opções)
              </span>
            </div>
            <span className="text-[10px] font-medium text-[var(--text-muted)] bg-[var(--bg-raised)] px-2 py-0.5 rounded-full">
              6 Temas
            </span>
          </div>

          <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
            {/* SEÇÃO MODOS ESCUROS */}
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                <Moon size={12} className="text-indigo-400" />
                <span>Modos Escuros (3 Opções)</span>
              </div>
              <div className="space-y-1.5">
                {darkThemes.map((t) => (
                  <ThemeItem
                    key={t.id}
                    theme={t}
                    isActive={currentTheme === t.id}
                    onSelect={(id) => {
                      setTheme(id);
                      setIsOpen(false);
                    }}
                  />
                ))}
              </div>
            </div>

            {/* SEÇÃO MODOS CLAROS */}
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                <Sun size={12} className="text-amber-500" />
                <span>Modos Claros (3 Opções)</span>
              </div>
              <div className="space-y-1.5">
                {lightThemes.map((t) => (
                  <ThemeItem
                    key={t.id}
                    theme={t}
                    isActive={currentTheme === t.id}
                    onSelect={(id) => {
                      setTheme(id);
                      setIsOpen(false);
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface ThemeItemProps {
  theme: typeof THEME_OPTIONS[0];
  isActive: boolean;
  onSelect: (id: ThemeId) => void;
}

const ThemeItem: React.FC<ThemeItemProps> = ({ theme, isActive, onSelect }) => {
  return (
    <button
      onClick={() => onSelect(theme.id)}
      className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs transition-all duration-150 cursor-pointer border ${
        isActive
          ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--text-primary)] shadow-sm'
          : 'bg-[var(--bg-raised)]/40 border-transparent hover:border-[var(--border)] hover:bg-[var(--bg-raised)] text-[var(--text-secondary)]'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Color swatches */}
        <div className="flex items-center -space-x-1">
          <div
            className="w-4 h-4 rounded-full border border-white/20 shadow-sm"
            style={{ backgroundColor: theme.previewBg }}
          />
          <div
            className="w-4 h-4 rounded-full border border-white/20 shadow-sm"
            style={{ backgroundColor: theme.previewCard }}
          />
          <div
            className="w-4 h-4 rounded-full border border-white/20 shadow-sm"
            style={{ backgroundColor: theme.previewAccent }}
          />
        </div>
        <div>
          <p className="font-bold text-[12px] leading-tight text-[var(--text-primary)]">{theme.name}</p>
          <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{theme.description}</p>
        </div>
      </div>
      {isActive && <Check size={14} className="text-[var(--accent)] flex-shrink-0" />}
    </button>
  );
};
