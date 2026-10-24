"use client";
/**
 * Settings (fix F13, owner 2026-10-17: "notification, privacy, all are in
 * setting"): one place for everything you change. Each part has its own page,
 * as on Airbnb; Dark mode is a single switch, so it stays here.
 */
import { useLocale, useTranslations } from "next-intl";
import { useDarkMode } from "@/components/DarkModeProvider";
import { languagesOn } from "@/components/LanguageButton";
import { LOCALE_NAMES } from "@/i18n/locales";
import { Group, PageTitle, Row, SwitchRow, loading, pageWidth, useSignedIn } from "@/components/market/SettingsList";
import { BellIcon, GlobeIcon, LockIcon, MoonIcon, UserIcon } from "@/components/landing/icons";

export default function SettingsPage() {
  const me = useSignedIn();
  const [dark, toggleDark] = useDarkMode();
  const t = useTranslations("settings");
  const nav = useTranslations("nav");
  const language = useTranslations("language");
  const locale = useLocale();
  if (!me) return loading;

  return (
    <main className={pageWidth}>
      <PageTitle back={{ href: "/more", label: nav("more") }} title={t("title")} subtitle={t("subtitle")} />

      <Group title={t("groupAccount")}>
        <Row href="/settings/personal-information" icon={<UserIcon className="h-5 w-5" />} label={t("personal")}
          description={t("personalText")} />
        <Row href="/settings/notifications" icon={<BellIcon className="h-5 w-5" />} label={t("notifications")}
          description={t("notificationsText")} />
        <Row href="/settings/security" icon={<LockIcon className="h-5 w-5" />} label={t("security")}
          description={t("securityText")} />
      </Group>

      <Group title={t("groupPreferences")}>
        {languagesOn && <Row href="/settings/language" icon={<GlobeIcon className="h-5 w-5" />} label={language("title")} description={LOCALE_NAMES[locale]} />}
        <SwitchRow icon={<MoonIcon className="h-5 w-5" />} label={t("darkMode")} description={t("darkModeText")}
          checked={dark} onChange={toggleDark} />
      </Group>
    </main>
  );
}
