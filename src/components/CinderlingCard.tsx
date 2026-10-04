import Link from "next/link";

interface CinderlingCardProps {
  name: string;
  health: number;
  attack: number;
  speed: number;
  energy: number;
  uuid?: string;
  href?: string;
  variant?: "full" | "compact";
  flavor?: string;
  imageUrl?: string;
  children?: React.ReactNode;
}

function StatBadge({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-xs text-gray-400 uppercase">{label}</div>
      <div className="font-bold text-sm">{value}</div>
    </div>
  );
}

function CinderlingAvatar({
  name,
  imageUrl,
  size = "sm",
}: {
  name: string;
  imageUrl?: string;
  size?: "sm" | "lg";
}) {
  const sizeClasses = size === "lg" ? "w-24 h-24" : "w-10 h-10";
  const textSize = size === "lg" ? "text-2xl" : "text-sm";

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={`${sizeClasses} rounded-full object-cover border-2 border-gray-200`}
      />
    );
  }

  // Fallback: initials avatar with gradient
  return (
    <div
      className={`${sizeClasses} rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center ${textSize} font-bold text-white border-2 border-gray-200`}
    >
      {name[0]?.toUpperCase() || "?"}
    </div>
  );
}

function CompactContent({
  name,
  health,
  attack,
  speed,
  flavor,
  imageUrl,
  children,
}: {
  name: string;
  health: number;
  attack: number;
  speed: number;
  flavor?: string;
  imageUrl?: string;
  children?: React.ReactNode;
}) {
  return (
    <>
      <div className="flex items-center gap-2 mb-1">
        <CinderlingAvatar name={name} imageUrl={imageUrl} size="sm" />
        <h3 className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition truncate">
          {name}
        </h3>
      </div>
      {flavor && (
        <p className="text-[11px] text-gray-400 mb-2 line-clamp-2 leading-tight">
          {flavor}
        </p>
      )}
      <div className="flex justify-between px-1">
        <StatBadge label="HP" value={health} />
        <StatBadge label="ATK" value={attack} />
        <StatBadge label="SPD" value={speed} />
      </div>
      {children}
    </>
  );
}

export default function CinderlingCard({
  name,
  health,
  attack,
  speed,
  href,
  variant = "full",
  flavor,
  imageUrl,
  children,
}: CinderlingCardProps) {
  if (variant === "compact") {
    const content = (
      <CompactContent
        name={name}
        health={health}
        attack={attack}
        speed={speed}
        flavor={flavor}
        imageUrl={imageUrl}
      >
        {children}
      </CompactContent>
    );

    if (href) {
      return (
        <Link
          href={href}
          className="border border-gray-200 rounded-lg p-3 hover:border-blue-400 hover:shadow-md transition group block"
        >
          {content}
        </Link>
      );
    }
    return (
      <div className="border border-gray-200 rounded-lg p-3">{content}</div>
    );
  }

  // Full variant
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center gap-4 mb-4">
        <CinderlingAvatar name={name} imageUrl={imageUrl} size="lg" />
        <div>
          <h3 className="text-2xl font-bold">{name}</h3>
          {flavor && (
            <p className="text-sm text-gray-500 italic">{flavor}</p>
          )}
        </div>
      </div>
      <div className="flex gap-4 text-gray-700">
        <StatBadge label="HP" value={health} />
        <StatBadge label="ATK" value={attack} />
        <StatBadge label="SPD" value={speed} />
      </div>
      {children}
    </div>
  );
}
