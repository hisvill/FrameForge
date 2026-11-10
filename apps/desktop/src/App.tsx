import { useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { useT } from './i18n';
import { startEngine } from './lib/engine';
import { AutopilotScreen } from './screens/Autopilot';
import { CalendarScreen } from './screens/Calendar';
import { ChatHome, ChatThread } from './screens/Chat';
import { Onboarding } from './screens/Onboarding';
import { SettingsScreen } from './screens/Settings';
import { StyleScreen } from './screens/Style';
import { Videos } from './screens/Videos';
import { useApp } from './state/app';

export function App() {
  const t = useT();
  const loaded = useApp((s) => s.loaded);
  const route = useApp((s) => s.route);
  const init = useApp((s) => s.init);
  const lang = useApp((s) => s.settings.language);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    if (loaded) return startEngine();
  }, [loaded]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  if (!loaded) return <div className="flex h-full items-center justify-center text-sm text-ink-400">{t('common.loading')}</div>;
  if (route.name === 'onboarding') return <Onboarding />;

  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="min-w-0 flex-1">
        {route.name === 'chat' && (route.chatId ? <ChatThread key={route.chatId} chatId={route.chatId} /> : <ChatHome />)}
        {route.name === 'videos' && <Videos />}
        {route.name === 'style' && <StyleScreen />}
        {route.name === 'calendar' && <CalendarScreen />}
        {route.name === 'autopilot' && <AutopilotScreen />}
        {route.name === 'settings' && <SettingsScreen />}
      </main>
    </div>
  );
}
