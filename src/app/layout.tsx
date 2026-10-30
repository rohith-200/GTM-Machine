import type { Metadata } from "next";
import { OfficeShell } from "@/components/workspace/office-shell";
import { WorkspaceProvider } from "@/components/workspace/workspace-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "GTM Office — A place for every step",
  description: "Turn a product brief into a clear customer profile, evidence-backed leads, and thoughtful outreach.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full"><WorkspaceProvider><OfficeShell>{children}</OfficeShell></WorkspaceProvider></body>
    </html>
  );
}
