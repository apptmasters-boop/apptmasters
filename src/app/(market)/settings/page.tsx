"use client";
/**
 * Settings (fix F13, owner 2026-10-17: "notification, privacy, all are in
 * setting"): one place for everything you change. Each part has its own page,
 * as on Airbnb; Dark mode is a single switch, so it stays here.
 */
import { useDarkMode } from "@/components/DarkModeProvider";
import { Group, PageTitle, Row, SwitchRow, loading, pageWidth, useSignedIn } from "@/components/market/SettingsList";
import { BellIcon, LockIcon, MoonIcon, UserIcon } from "@/components/landing/icons";

export default function SettingsPage() {
  const me = useSignedIn();
  const [dark, toggleDark] = useDarkMode();
  if (!me) return loading;

  return (
    <main className={pageWidth}>
      <PageTitle back={{ href: "/more", label: "More" }} title="Settings" subtitle="Your account and how ApptMasters looks for you." />

      <Group title="Account">
        <Row href="/settings/personal-information" icon={<UserIcon className="h-5 w-5" />} label="Personal information"
          description="Name, photo and email" />
        <Row href="/settings/notifications" icon={<BellIcon className="h-5 w-5" />} label="Notifications"
          description="Push and email, topic by topic" />
        <Row href="/settings/security" icon={<LockIcon className="h-5 w-5" />} label="Login & security"
          description="Password, two-step sign-in, recent sign-ins" />
      </Group>

      <Group title="Preferences">
        <SwitchRow icon={<MoonIcon className="h-5 w-5" />} label="Dark mode" description="Easier on the eyes at night"
          checked={dark} onChange={toggleDark} />
      </Group>
    </main>
  );
}
