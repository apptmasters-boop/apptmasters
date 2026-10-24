"use client";
/**
 * My Profile (fix F13, owner 2026-10-17): who you are on ApptMasters — photo,
 * name, email, your Homes and, if you live in one, your room, move-in date
 * and dietary needs. Nothing is changed here: Edit opens Personal information,
 * and the password, notifications and the rest are on Settings.
 */
import Link from "next/link";
import { initials, type Me } from "@/components/market/useMe";
import { Card, Group, PageTitle, Row, loading, pageWidth, useSignedIn } from "@/components/market/SettingsList";
import { DIETARY_OPTIONS, parseDietary } from "@/lib/dietary";
import { CheckIcon, HomeIcon, SettingsIcon, UsersIcon } from "@/components/landing/icons";

const ROLE_LABELS: Record<string, string> = { ADMIN: "Household admin", MEMBER: "Roommate", GUEST: "Guest" };

const longDate = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <dt className="text-sm text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="text-end text-sm font-medium text-gray-900 dark:text-white">{children}</dd>
    </div>
  );
}

const notSet = <span className="font-normal text-gray-400">Not set</span>;

function HomeDetails({ me }: { me: Me }) {
  const dietary = parseDietary(me.dietaryFlags);
  return (
    <Card title="Home details" description="Shown to the people you live with.">
      <dl className="-my-3 divide-y divide-gray-100 dark:divide-gray-800">
        <Detail label="Room">{me.roomAssignment || notSet}</Detail>
        <Detail label="Move-in date">{me.moveInDate ? longDate(me.moveInDate) : notSet}</Detail>
        <Detail label="Dietary needs">
          {dietary.length === 0 ? <span className="font-normal text-gray-400">None</span> : (
            <span className="flex flex-wrap justify-end gap-1.5">
              {dietary.map(key => (
                <span key={key} className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand dark:bg-brand/30 dark:text-emerald-200">
                  {DIETARY_OPTIONS.find(o => o.key === key)?.label ?? key}
                </span>
              ))}
            </span>
          )}
        </Detail>
      </dl>
      <Link href="/settings/personal-information?from=profile#home-details" className="mt-4 inline-block text-sm font-semibold text-brand hover:underline dark:text-emerald-300">
        Edit home details
      </Link>
    </Card>
  );
}

export default function ProfilePage() {
  const me = useSignedIn();
  if (!me) return loading;

  return (
    <main className={pageWidth}>
      <PageTitle back={{ href: "/more", label: "More" }} title="My Profile"
        action={
          <Link href="/settings/personal-information?from=profile"
            className="shrink-0 rounded-full border border-gray-300 px-4 py-1.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800">
            Edit
          </Link>
        } />

      <section className="mt-5 flex flex-col items-center rounded-2xl border border-gray-200 bg-white px-5 py-6 text-center dark:border-gray-800 dark:bg-gray-900">
        {me.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={me.photo} alt="" className="h-24 w-24 rounded-full object-cover" />
        ) : (
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-brand-soft text-3xl font-semibold text-brand dark:bg-brand/30 dark:text-emerald-200">{initials(me.name)}</span>
        )}
        <p className="mt-3 text-xl font-semibold text-gray-900 dark:text-white">{me.name}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
          {me.email}
          {me.emailVerified && <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-brand dark:text-emerald-300"><CheckIcon className="h-3.5 w-3.5" />Verified</span>}
        </p>
        {me.createdAt && (
          <p className="mt-1 text-xs text-gray-400">
            Member since {new Date(me.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </p>
        )}
      </section>

      {me.homes.length > 0 ? (
        <Group title="My Homes">
          {me.homes.map(home => (
            <Row key={home.id} href={`/apartment/${home.id}`} icon={<HomeIcon className="h-5 w-5" />} label={home.name}
              description={ROLE_LABELS[home.role ?? ""] ?? "Member"} />
          ))}
        </Group>
      ) : (
        <Group title="My Homes">
          {me.pending ? (
            <Row href="/apartment/join/status" icon={<HomeIcon className="h-5 w-5" />} label="Your join request is waiting"
              description="See where it stands on Join status." />
          ) : (
            <p className="px-4 py-3.5 text-sm text-gray-500 dark:text-gray-400">No Home yet.</p>
          )}
          <Row href="/apartment/create" icon={<HomeIcon className="h-5 w-5" />} label="Create a Home"
            description="Already have a place? Manage your household, expenses and more." />
          <Row href="/apartment/join" icon={<UsersIcon className="h-5 w-5" />} label="Join a Home"
            description="A roommate invited you? Join with their code." />
        </Group>
      )}

      {me.homes.length > 0 && <HomeDetails me={me} />}

      <Group title="Account">
        <Row href="/settings" icon={<SettingsIcon className="h-5 w-5" />} label="Settings"
          description="Personal information, notifications, login & security" />
      </Group>
    </main>
  );
}
