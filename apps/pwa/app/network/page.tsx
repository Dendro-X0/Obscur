import { createSidebarRoutePage } from "@/app/lib/navigation/create-sidebar-route-page";

export default createSidebarRoutePage(
  {
    eager: () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require("./network-page-client");
    },
    lazy: () => import("./network-page-client"),
  },
  {
    title: "Network",
    detail: "Opening from this device…",
  },
);
