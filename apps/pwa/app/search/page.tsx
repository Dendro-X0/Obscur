import { createSidebarRoutePage } from "@/app/lib/navigation/create-sidebar-route-page";

export default createSidebarRoutePage(
  {
    eager: () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require("./search-page-client");
    },
    lazy: () => import("./search-page-client"),
  },
  {
    title: "Loading search",
    detail: "Preparing discovery tools...",
  },
);
