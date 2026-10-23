import { useEffect, useState } from "react";
import { usePublicData } from "@/lib/publicData";
import { fileUrl } from "@/lib/api";

/** Wide advertising space shared by the customer and provider apps; shows active top-banner ads from administration. */
export function AdSpace({ className = "" }: { className?: string }) {
  const ads = usePublicData().ads.filter((a) => a.placement === "top_banner").slice(0, 5);
  const [i, setI] = useState(0);

  useEffect(() => {
    if (ads.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % ads.length), 5000);
    return () => clearInterval(t);
  }, [ads.length]);

  const ad = ads[i];
  const inner = ad?.image_url ? (
    <img src={fileUrl(ad.image_url)} alt={ad.title} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
  ) : (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-primary-foreground px-6 text-center">
      <p className="font-bold text-lg">{ad?.title ?? "مساحة اعلانية"}</p>
      {ad?.sponsor && <p className="text-xs opacity-90 mt-1">{ad.sponsor}</p>}
    </div>
  );

  return (
    <div className={`-mx-2 sm:-mx-6 ${className}`}>
      {ad?.link ? (
        <a href={ad.link} target="_blank" rel="noopener noreferrer" className="mohemah-banner block relative overflow-hidden rounded-2xl aspect-[3/1] min-h-28">{inner}</a>
      ) : (
        <div className="mohemah-banner relative overflow-hidden rounded-2xl aspect-[3/1] min-h-28">{inner}</div>
      )}
      <div className="flex justify-center gap-1.5 mt-2">
        {Array.from({ length: Math.max(ads.length, 3) }).map((_, k) => (
          <span key={k} className={`w-6 h-1.5 rounded-full ${k === i ? "bg-mohemah-coral" : "bg-border"}`} />
        ))}
      </div>
    </div>
  );
}
