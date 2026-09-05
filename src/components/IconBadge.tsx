import { badgeClasses, type CategoryColor } from "@/lib/categoryStyle";

const SIZES = {
  sm: { box: "w-8 h-8", icon: "w-4 h-4" },
  md: { box: "w-9 h-9", icon: "w-[18px] h-[18px]" },
  lg: { box: "w-12 h-12", icon: "w-6 h-6" },
  xl: { box: "w-16 h-16", icon: "w-8 h-8" },
};

interface Props {
  icon: React.ReactNode;
  color: CategoryColor;
  size?: keyof typeof SIZES;
  className?: string;
}

export default function IconBadge({ icon, color, size = "md", className = "" }: Props) {
  const { box, icon: iconSize } = SIZES[size];
  return (
    <span className={`${box} rounded-full flex items-center justify-center flex-shrink-0 ${badgeClasses(color)} ${className}`}>
      <span className={iconSize}>{icon}</span>
    </span>
  );
}
