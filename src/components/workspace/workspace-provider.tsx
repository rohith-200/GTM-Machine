"use client";

import { createContext, useCallback, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { Competitor, ICP, IcpRequest, Lead } from "@/contract/types";

interface WorkspaceState {
  intake: IcpRequest;
  setIntake: Dispatch<SetStateAction<IcpRequest>>;
  icp: ICP | null | undefined;
  setIcp: Dispatch<SetStateAction<ICP | null | undefined>>;
  leads: Lead[] | undefined;
  setLeads: Dispatch<SetStateAction<Lead[] | undefined>>;
  competitors: Competitor[] | undefined;
  setCompetitors: Dispatch<SetStateAction<Competitor[] | undefined>>;
  clearDiscovery: () => void;
  activityOpen: boolean;
  setActivityOpen: Dispatch<SetStateAction<boolean>>;
  dataVersion: number;
  resetData: () => void;
}

const WorkspaceContext = createContext<WorkspaceState | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [intake, setIntake] = useState<IcpRequest>({ productDescription: "", customers: "", pricing: "" });
  const [icp, setIcp] = useState<ICP | null | undefined>(undefined);
  const [leads, setLeads] = useState<Lead[] | undefined>(undefined);
  const [competitors, setCompetitors] = useState<Competitor[] | undefined>(undefined);
  const [activityOpen, setActivityOpen] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const clearDiscovery = useCallback(() => { setLeads(undefined); setCompetitors(undefined); }, []);
  const resetData = useCallback(() => { setIcp(undefined); clearDiscovery(); setDataVersion(value => value + 1); }, [clearDiscovery]);
  return <WorkspaceContext.Provider value={{ intake, setIntake, icp, setIcp, leads, setLeads, competitors, setCompetitors, clearDiscovery, activityOpen, setActivityOpen, dataVersion, resetData }}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("Workspace components must be inside WorkspaceProvider.");
  return context;
}
