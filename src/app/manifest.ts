import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { id: "/", name: "Ateliê · Nail Studio", short_name: "Ateliê", description: "Sua agenda, com leveza.", start_url: "/", scope: "/", display: "standalone", background_color: "#faf8f5", theme_color: "#faf8f5", icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" }] };
}
