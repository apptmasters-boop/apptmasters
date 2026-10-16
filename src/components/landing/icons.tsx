// Stroke icons for the marketplace landing page (24x24, lucide-style paths).
type P = { className?: string };
const base = "h-4 w-4";

function Svg({ className = base, children }: P & { children: React.ReactNode }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

export const PinIcon = (p: P) => <Svg {...p}><path d="M20 10c0 5-8 12-8 12s-8-7-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></Svg>;
export const SearchIcon = (p: P) => <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>;
export const HomeIcon = (p: P) => <Svg {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9v11h14V9" /><path d="M10 20v-6h4v6" /></Svg>;
export const BedIcon = (p: P) => <Svg {...p}><path d="M3 19V6M21 19v-6a3 3 0 0 0-3-3h-8v6M3 16h18" /><circle cx="6.5" cy="11.5" r="1.5" /></Svg>;
export const BuildingIcon = (p: P) => <Svg {...p}><rect x="5" y="3" width="14" height="18" rx="1.5" /><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1M10 21v-3h4v3" /></Svg>;
export const DollarIcon = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6.5v11" /></Svg>;
export const ShieldCheckIcon = (p: P) => <Svg {...p}><path d="M12 3 4.5 6v6c0 4.5 3.2 7.8 7.5 9 4.3-1.2 7.5-4.5 7.5-9V6L12 3Z" /><path d="m9 12 2 2 4-4" /></Svg>;
export const UsersIcon = (p: P) => <Svg {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.5a6.5 6.5 0 0 1 3 5.5" /></Svg>;
export const MoonIcon = (p: P) => <Svg {...p}><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" /></Svg>;
export const SunriseIcon = (p: P) => <Svg {...p}><path d="M12 3v4M5 10l1.5 1.5M19 10l-1.5 1.5M3 18h18M7 18a5 5 0 0 1 10 0" /></Svg>;
export const QuietIcon = (p: P) => <Svg {...p}><path d="M11 5 6 9H3v6h3l5 4V5Z" /><path d="m22 9-6 6M16 9l6 6" /></Svg>;
export const NoSmokeIcon = (p: P) => <Svg {...p}><path d="M3 3l18 18M3 14h11v4H3zM18 14h3v4h-3M18 9c0-2-1.5-2.5-1.5-4.5" /></Svg>;
export const PawIcon = (p: P) => <Svg {...p}><circle cx="5.5" cy="10" r="1.8" /><circle cx="9.5" cy="6" r="1.8" /><circle cx="14.5" cy="6" r="1.8" /><circle cx="18.5" cy="10" r="1.8" /><path d="M8 17.5c0-2.5 1.8-5 4-5s4 2.5 4 5c0 1.5-1.2 2.5-2.5 2.5-.6 0-1-.3-1.5-.3s-.9.3-1.5.3C9.2 20 8 19 8 17.5Z" /></Svg>;
export const CapIcon = (p: P) => <Svg {...p}><path d="M2 9.5 12 5l10 4.5-10 4.5L2 9.5Z" /><path d="M6 11.5V16c2 1.5 4 2 6 2s4-.5 6-2v-4.5M22 9.5V15" /></Svg>;
export const CalendarIcon = (p: P) => <Svg {...p}><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M8 3v4M16 3v4M3.5 10h17" /></Svg>;
export const BathIcon = (p: P) => <Svg {...p}><path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-3ZM6 12V5.5A1.5 1.5 0 0 1 9 5.5M7 19l-1 2M17 19l1 2" /></Svg>;
export const ArrowRightIcon = (p: P) => <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>;
export const PlusCircleIcon = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></Svg>;
export const UserIcon = (p: P) => <Svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Svg>;
export const HeartHandIcon = (p: P) => <Svg {...p}><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" /></Svg>;
export const SproutIcon = (p: P) => <Svg {...p}><path d="M12 21v-9M12 12c0-4 3-7 8-7 0 5-3 7-8 7ZM12 14c0-3-2.5-5.5-7-5.5 0 4 2.5 5.5 7 5.5Z" /></Svg>;
export const MessageIcon = (p: P) => <Svg {...p}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12Z" /></Svg>;
export const FlagIcon = (p: P) => <Svg {...p}><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></Svg>;
export const MailCheckIcon = (p: P) => <Svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></Svg>;
export const ClipboardCheckIcon = (p: P) => <Svg {...p}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1M9 13l2 2 4-4" /></Svg>;
export const MailIcon = (p: P) => <Svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 6.5 8.5 6.5 8.5-6.5" /></Svg>;
export const LockIcon = (p: P) => <Svg {...p}><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5M12 14.5v2.5" /></Svg>;
export const EyeIcon = (p: P) => <Svg {...p}><path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" /><circle cx="12" cy="12" r="3" /></Svg>;
export const EyeOffIcon = (p: P) => <Svg {...p}><path d="M3 3l18 18M10.6 5.1A9.7 9.7 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-3 3.8M6.5 6.6C3.9 8.3 2.5 12 2.5 12s3.5 7 9.5 7a9.3 9.3 0 0 0 4.4-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2" /></Svg>;
export const LogInIcon = (p: P) => <Svg {...p}><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M9 16l4-4-4-4M13 12H3" /></Svg>;
export const UserPlusIcon = (p: P) => <Svg {...p}><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 14 0M19 8v6M16 11h6" /></Svg>;
export const ArrowLeftIcon = (p: P) => <Svg {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></Svg>;
export const CheckIcon = (p: P) => <Svg {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>;
export const MoreIcon = (p: P) => <Svg {...p}><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></Svg>;
export const ChevronRightIcon = (p: P) => <Svg {...p}><path d="m9 6 6 6-6 6" /></Svg>;
export const BroomIcon = (p: P) => <Svg {...p}><path d="M19 3 11 11M8 12l4 4M5.5 13.5c-1.5 2-2 4.5-2.5 7 2.5-.5 5-1 7-2.5l3-3-4.5-4.5-3 3Z" /></Svg>;
export const CartIcon = (p: P) => <Svg {...p}><circle cx="9" cy="20" r="1.4" /><circle cx="17" cy="20" r="1.4" /><path d="M3 4h2l2.4 11h10.3l2-8H6.2" /></Svg>;
export const BoxIcon = (p: P) => <Svg {...p}><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5v-9Z" /><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" /></Svg>;
export const RepeatIcon = (p: P) => <Svg {...p}><path d="M17 2l3 3-3 3M3 11V9a4 4 0 0 1 4-4h13M7 22l-3-3 3-3M21 13v2a4 4 0 0 1-4 4H4" /></Svg>;
export const WrenchIcon = (p: P) => <Svg {...p}><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4 2.6-2.6Z" /></Svg>;
export const ChartIcon = (p: P) => <Svg {...p}><path d="M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3" /></Svg>;
export const BellIcon = (p: P) => <Svg {...p}><path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9ZM10 20a2 2 0 0 0 4 0" /></Svg>;
export const LogOutIcon = (p: P) => <Svg {...p}><path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 16l4-4-4-4M19 12H9" /></Svg>;
export const SettingsIcon = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></Svg>;
export const StarIcon = (p: P) => <Svg {...p}><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9L12 3Z" /></Svg>;
export const ScaleIcon = (p: P) => <Svg {...p}><path d="M12 3v18M5 21h14M6 7h12M6 7l-3 7a3 3 0 0 0 6 0L6 7ZM18 7l-3 7a3 3 0 0 0 6 0l-3-7Z" /></Svg>;
export const SearchDocIcon = (p: P) => <Svg {...p}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5M14 3l5 5v3M14 3v5h5" /><circle cx="17" cy="17" r="3" /><path d="m21 21-1.8-1.8" /></Svg>;
// Home Setup (Sprint 11b)
export const LinkIcon = (p: P) => <Svg {...p}><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4l-1 1" /><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1-1" /></Svg>;
export const SendIcon = (p: P) => <Svg {...p}><path d="M21 3 10 14" /><path d="M21 3l-7 18-4-7-7-4 18-7Z" /></Svg>;
export const InfoIcon = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.5v.5" /></Svg>;
export const XIcon = (p: P) => <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>;
export const KeyHouseIcon = (p: P) => <Svg {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9v11h6M19 9v4" /><circle cx="16.5" cy="17" r="2.5" /><path d="m18.3 18.8 2.7 2.7M20 20.5l-1 1" /></Svg>;
// Find a Home (Sprint 12)
export const HeartIcon = (p: P & { filled?: boolean }) => <Svg className={p.className}><path fill={p.filled ? "currentColor" : "none"} d="M12 20.5s-7.5-4.6-9.2-9.3C1.7 8 3.6 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.6 0 5.5 3.5 4.4 6.7-1.7 4.7-9.2 9.3-9.2 9.3Z" /></Svg>;
export const ShareIcon = (p: P) => <Svg {...p}><path d="M12 15V3M8 7l4-4 4 4" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></Svg>;
export const SlidersIcon = (p: P) => <Svg {...p}><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></Svg>;
export const SortIcon = (p: P) => <Svg {...p}><path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4" /></Svg>;
export const ChevronDownIcon = (p: P) => <Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>;
export const HelpCircleIcon = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.7M12 17h.01" /></Svg>;
export const ListIcon = (p: P) => <Svg {...p}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z" /><path d="M14 3v6h6M8 13h8M8 17h5" /></Svg>;
export const WifiIcon = (p: P) => <Svg {...p}><path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01" /></Svg>;
export const SofaIcon = (p: P) => <Svg {...p}><path d="M5 11V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3" /><path d="M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v5H3v-5ZM6 18v2M18 18v2" /></Svg>;
export const WasherIcon = (p: P) => <Svg {...p}><rect x="4" y="3" width="16" height="18" rx="2" /><circle cx="12" cy="13" r="4" /><path d="M8 6.5h.01M11 6.5h2" /></Svg>;
export const BoltIcon = (p: P) => <Svg {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" /></Svg>;
export const CarIcon = (p: P) => <Svg {...p}><path d="M5 17h14M5 17v2M19 17v2M3 13l2-6a2 2 0 0 1 1.9-1.4h10.2A2 2 0 0 1 19 7l2 6v4H3v-4Z" /><path d="M7 13.5h.01M17 13.5h.01" /></Svg>;
export const ElevatorIcon = (p: P) => <Svg {...p}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M12 3v18M7.5 10 9 8l1.5 2M13.5 14l1.5 2 1.5-2" /></Svg>;
export const AccessibleIcon = (p: P) => <Svg {...p}><circle cx="12" cy="4.5" r="1.5" /><path d="M12 7v6h5l2 6M8.5 10a6 6 0 1 0 7.2 9" /></Svg>;
export const ShowerIcon = (p: P) => <Svg {...p}><path d="M4 20V7a3 3 0 0 1 6 0" /><path d="M7 9.5h6M8 13v.01M10 15v.01M12 13v.01M14 15v.01M12 17v.01" /></Svg>;
export const TagIcon = (p: P) => <Svg {...p}><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" /><circle cx="7.5" cy="7.5" r="1.5" /></Svg>;
export const ReceiptIcon = (p: P) => <Svg {...p}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6M9 12h6" /></Svg>;
export const GridIcon = (p: P) => <Svg {...p}><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></Svg>;
