import { createSidebarRoutePage } from "@/app/lib/navigation/create-sidebar-route-page";

export default createSidebarRoutePage(
  {
    eager: () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require("./settings-page-client");
    },
    lazy: () => import("./settings-page-client"),
  },
  {
    title: "Loading settings",
    detail: "Preparing preferences and account controls...",
  },
);
