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
    title: "Search",
    detail: "Opening search on this device…",
  },
);
