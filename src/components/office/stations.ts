import { Archive, ChartNoAxesCombined, Columns3, FolderOpen, Mail, NotebookPen } from "lucide-react";

type Position = [number, number, number];

export const stations = [
  { href: "/", title: "Intake", object: "Notebook", icon: NotebookPen, anchor: [-1.7, 1.73, 0.7] as Position, offset: [-105, 25], camera: [7.8, 7.2, 10] as Position, target: [-0.8, 1.55, 0.3] as Position, span: 8.8 },
  { href: "/icp", title: "ICP brief", object: "Customer folder", icon: FolderOpen, anchor: [1.65, 1.82, -0.53] as Position, offset: [55, -60], camera: [9, 6.5, 5.4] as Position, target: [1.1, 1.7, -0.4] as Position, span: 8.5 },
  { href: "/leads", title: "Leads", object: "Filing cabinet", icon: Archive, anchor: [3.47, 1.2, -3.5] as Position, offset: [65, 5], camera: [10.6, 5.3, 5.8] as Position, target: [2.5, 1.4, -2.7] as Position, span: 9 },
  { href: "/review", title: "Outbox", object: "Letter tray", icon: Mail, anchor: [1.42, 1.8, 0.49] as Position, offset: [105, 55], camera: [5.1, 6, 10.4] as Position, target: [0.8, 1.7, 0.3] as Position, span: 8.5 },
  { href: "/pipeline", title: "Pipeline", object: "Wall board", icon: Columns3, anchor: [-4.7, 3.1, -0.25] as Position, offset: [-60, -55], camera: [4.7, 5.8, 9] as Position, target: [-2.8, 2.4, -0.7] as Position, span: 9.5 },
  { href: "/dashboard", title: "Reports", object: "Monitor", icon: ChartNoAxesCombined, anchor: [0.1, 2.8, -0.2] as Position, offset: [-20, -80], camera: [2.6, 5.5, 11] as Position, target: [0, 2, -0.3] as Position, span: 8.3 },
] as const;

export type StationPath = typeof stations[number]["href"];
