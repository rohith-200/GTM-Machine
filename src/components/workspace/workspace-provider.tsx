"use client";

import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { ICP, IcpRequest } from "@/contract/types";

interface WorkspaceState {
  intake: IcpRequest;
  setIntake: Dispatch<SetStateAction<IcpRequest>>;
  icp: ICP | null | undefined;
  setIcp: Dispatch<SetStateAction<ICP | null | undefined>>;
  dataVersion: number;
  resetData: () => void;
}

const WorkspaceContext = createContext<WorkspaceState | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [intake, setIntake] = useState<IcpRequest>({ productDescription: "", customers: "", pricing: "" });
  const [icp, setIcp] = useState<ICP | null | undefined>(undefined);
  const [dataVersion, setDataVersion] = useState(0);
  return <WorkspaceContext.Provider value={{ intake, setIntake, icp, setIcp, dataVersion, resetData: () => { setIcp(undefined); setDataVersion(value => value + 1); } }}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("Workspace components must be inside WorkspaceProvider.");
  return context;
}
