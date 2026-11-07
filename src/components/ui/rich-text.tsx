// نص المستخدم: اللينكات بتتحول لروابط مختصرة قابلة للضغط، والمنشن بيتلوّن، والكلام الطويل بيتلف جوه المربع
const TOKEN = /(https?:\/\/[^\s<>"]+|www\.[^\s<>"]+|@[a-zA-Z0-9._-]{2,})/g;

export function RichText({ text, className }: { text: string; className?: string }) {
  return (
    <span className={`whitespace-pre-wrap [overflow-wrap:anywhere] ${className ?? ""}`}>
      {text.split(TOKEN).map((part, i) => {
        if (i % 2 === 0) return part;
        if (part.startsWith("@")) {
          return <bdi key={i} dir="ltr" className="font-semibold text-brand-700">{part}</bdi>;
        }
        // علامات الترقيم في آخر اللينك مش جزء منه
        const trail = part.match(/[.,،؛;:!?)\]]+$/)?.[0] ?? "";
        const url = trail ? part.slice(0, -trail.length) : part;
        const href = url.startsWith("www.") ? `https://${url}` : url;
        return (
          <span key={i}>
            <a href={href} target="_blank" rel="noopener noreferrer" title={safeDecode(href)}
              className="mx-0.5 inline-flex max-w-full items-center gap-1 rounded-md bg-brand-50 px-1.5 py-0.5 align-middle text-[0.92em] font-medium text-brand-700 ring-1 ring-brand-100 transition hover:bg-brand-100 hover:text-brand-800"
              dir="ltr">
              <LinkIcon />
              <span className="truncate">{shortLabel(href)}</span>
            </a>
            {trail}
          </span>
        );
      })}
    </span>
  );
}

// "mersalcharity-my.sharepoint.com/…/محمد سعدى جادالرب" بدل اللينك الطويل المشفّر
export function shortLabel(href: string, max = 48): string {
  try {
    const u = new URL(href);
    const host = u.hostname.replace(/^www\./, "");
    const segs = safeDecode(u.pathname).split("/").filter(Boolean);
    // SharePoint / OneDrive بيحطوا مسار الملف في ?id=
    const idPath = u.searchParams.get("id");
    const last = idPath ? idPath.split("/").filter(Boolean).pop() : segs.pop();
    const label = last ? `${host}/…/${last}` : host;
    return label.length > max ? label.slice(0, max - 1) + "…" : label;
  } catch {
    return href.length > max ? href.slice(0, max - 1) + "…" : href;
  }
}

function safeDecode(s: string) {
  try { return decodeURIComponent(s); } catch { return s; }
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}
