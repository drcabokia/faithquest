import Link from "next/link";
export function Logo({ short = false }: { short?: boolean }) {
  return (
    <Link href="/" className="brand" aria-label="FaithQuest365 home">
      <svg width="42" height="42" viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="18" fill="currentColor" />
        <g
          stroke="#fffaf0"
          strokeWidth="2.8"
          fill="none"
          strokeLinejoin="round"
        >
          <path d="M12 17q10-3 20 4 10-7 20-4v28q-10-3-20 4-10-7-20-4Z" />
          <path d="M32 22v25" />
        </g>
        <path
          d="M24 39q1-7 8-8t8-8"
          fill="none"
          stroke="#ddbc69"
          strokeWidth="3"
        />
        <path
          d="m43 10 1.4 3.6L48 15l-3.6 1.4L43 20l-1.4-3.6L38 15l3.6-1.4Z"
          fill="#ddbc69"
        />
      </svg>
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
