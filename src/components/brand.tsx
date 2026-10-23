import Link from "next/link";
import Image from "next/image";
export function Logo({ short = false }: { short?: boolean }) {
  return (
    <Link href="/" className="brand" aria-label="FaithQuest365 home">
      <Image
        src="/brand/faithquest365-mark.svg"
        width={42}
        height={42}
        alt=""
        aria-hidden="true"
        unoptimized
      />
      <span>
        {short ? (
          "FaithQuest"
        ) : (
          <>
            FaithQuest<span className="brand-365">365</span>
          </>
        )}
        <small>YOUR DAILY WALK IN THE WORD</small>
      </span>
    </Link>
  );
}
