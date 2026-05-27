import { createSidebarRoutePage } from "@/app/lib/navigation/create-sidebar-route-page";

export default createSidebarRoutePage(
  {
    eager: () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require("./vault-page-client");
    },
    lazy: () => import("./vault-page-client"),
  },
  {
    title: "Loading vault",
    detail: "Preparing encrypted storage...",
  },
);
