import Image from "next/image";
import { getAvatarPath, getInitials } from "@/lib/avatars";

export function Avatar({ owner, size = 64 }: { owner: string; size?: number }) {
  const path = getAvatarPath(owner);

  if (path) {
    return (
      <Image
        src={path}
        alt={owner}
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size, border: "1px solid var(--border)" }}
      />
    );
  }

  return (
    <div
      className="rounded-full flex items-center justify-center font-semibold shrink-0"
      style={{
        width: size,
        height: size,
        background: "var(--series-1)",
        color: "#ffffff",
        fontSize: size * 0.36,
      }}
    >
      {getInitials(owner)}
    </div>
  );
}
