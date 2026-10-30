"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Lightbulb, LoaderCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { ICP } from "@/contract/types";
import { api } from "@/lib/api";
import { scrollToOffice } from "@/lib/office-navigation";
import { useWorkspace } from "./workspace-provider";

export function IntakeForm() {
  const { intake, setIntake, setIcp } = useWorkspace();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const router = useRouter();
  useEffect(() => () => request.current?.abort(), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (request.current) return;
    if (!intake.productDescription.trim()) { setError("Tell us what your product does to get started."); return; }
    const controller = new AbortController(); request.current = controller;
    setPending(true); setError(null);
    try {
      const icp = await api<ICP>("/api/icp", { method: "POST", signal: controller.signal, body: JSON.stringify({ productDescription: intake.productDescription.trim(), customers: intake.customers.trim(), pricing: intake.pricing.trim() }) });
      setIcp(icp);
      toast.success("Your customer profile is ready", { description: "Review it at the customer folder." });
      router.push("/icp", { scroll: false });
      scrollToOffice();
    } catch (caught) {
      if (caught instanceof Error && caught.name === "AbortError") return;
      const message = caught instanceof Error ? caught.message : "Could not generate a customer profile.";
      setError(message); toast.error(message);
    } finally { request.current = null; setPending(false); }
  }

  function fillExample() {
    setIntake({ productDescription: "An AI tool that automatically reconciles invoices for mid-size finance teams, so they can close the books faster with fewer manual checks.", customers: "Two logistics companies with around 300 employees each.", pricing: "$1,500 per month, annual contract." });
    setError(null);
  }

  return <>
    <div className="page-heading"><div className="eyebrow">A good campaign starts with a little context</div><h1>What are you building?</h1><p>Tell us about your product. We’ll turn it into a clear picture of your ideal customer.</p></div>
    <div className="intake-layout"><form className="intake-form" onSubmit={submit} aria-busy={pending}>
      <div className="field-group"><div className="field-heading"><label htmlFor="product-description">Your product<span className="required-mark"> *</span></label><button type="button" className="text-button" onClick={fillExample} disabled={pending}><Sparkles size={13} />Use an example</button></div><textarea id="product-description" name="productDescription" required rows={5} placeholder="What does it do, who does it help, and what makes it useful?" value={intake.productDescription} onChange={event => setIntake(current => ({ ...current, productDescription: event.target.value }))} disabled={pending} aria-describedby="product-hint" /><p className="field-hint" id="product-hint">Plain language is perfect. Start with the problem you solve.</p></div>
      <div className="form-two-columns"><div className="field-group"><label htmlFor="existing-customers">Existing customers<span className="optional-label">Optional</span></label><textarea id="existing-customers" name="customers" rows={4} placeholder="Who already uses it? Industries, company sizes, or a few examples." value={intake.customers} onChange={event => setIntake(current => ({ ...current, customers: event.target.value }))} disabled={pending} /></div><div className="field-group"><label htmlFor="pricing">Pricing<span className="optional-label">Optional</span></label><textarea id="pricing" name="pricing" rows={4} placeholder="For example: $99/month per team, or an annual contract." value={intake.pricing} onChange={event => setIntake(current => ({ ...current, pricing: event.target.value }))} disabled={pending} /></div></div>
      {error && <div className="inline-error" role="alert">{error}</div>}
      <div className="form-actions"><div className="form-reassurance"><Check size={14} /><span>You review the profile before we find leads.</span></div><button className="office-button primary-button large-button" type="submit" disabled={pending || !intake.productDescription.trim()}>{pending ? <><LoaderCircle size={16} className="spin" />Building your profile…</> : <>Generate customer profile<ArrowRight size={16} /></>}</button></div>
      {pending && <p className="pending-copy" role="status">Looking at your product, target buyers, and market. You can follow progress in Agent Thinking.</p>}
    </form><aside className="desk-note"><span className="note-tape" aria-hidden="true" /><Lightbulb size={19} strokeWidth={1.5} /><h2>A useful little brief.</h2><p>The more we understand your product, the better the match.</p><ul><li>The problem you solve</li><li>The people who feel it most</li><li>What makes your approach different</li></ul><div className="note-foot">A few honest sentences go a long way.</div></aside></div>
  </>;
}
