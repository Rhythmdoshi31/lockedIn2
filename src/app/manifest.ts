import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Locked In",
    short_name: "Locked In",
    description:
      "Compare your résumé with a job description to uncover evidence-backed strengths, gaps and practical improvements.",
    start_url: "/",
    display: "standalone",
    background_color: "#f2eddf",
    theme_color: "#8e2e24",
    icons: [
      { src: "/192x192.webp", sizes: "192x192", type: "image/webp" },
      { src: "/512x512.webp", sizes: "512x512", type: "image/webp" },
    ],
  };
}
