import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "NexHRMS — Human Resource Management System",
        short_name: "NexHRMS",
        description: "Human Resource Management System",
        start_url: "/login",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#0f172a",
        icons: [
            {
                src: "/logo.svg",
                sizes: "any",
                type: "image/svg+xml",
                purpose: "maskable",
            },
        ],
    };
}
