"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as T from "three";
import { buildOffice } from "./build-office";
import { stations, type StationPath } from "./stations";

interface Props { activePath: string; overview: boolean; hidden: boolean; onNavigate: (path: StationPath) => void }
interface SceneController { focus: (path: string | null, instant: boolean) => void }

export default function OfficeScene({ activePath, overview, hidden, onNavigate }: Props) {
  const canvasHost = useRef<HTMLDivElement>(null);
  const labelHost = useRef<HTMLDivElement>(null);
  const controller = useRef<SceneController | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const host = canvasHost.current, labels = labelHost.current;
    if (!host || !labels) return;
    let disposed = false, frameId = 0;
    let renderer: T.WebGLRenderer;
    try { renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" }); }
    catch { queueMicrotask(() => { if (!disposed) setUnavailable(true); }); return () => { disposed = true; }; }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.18;
    renderer.domElement.setAttribute("aria-hidden", "true");
    host.appendChild(renderer.domElement);
    const scene = new T.Scene();
    const office = buildOffice(scene);
    const camera = new T.OrthographicCamera(-7, 7, 6, -6, 0.1, 70);
    camera.position.set(10.5, 8.7, 12);
    const target = new T.Vector3(0, 1.4, -0.4);
    let vertical = 12;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const elements = stations.map(station => ({ station, label: labels.querySelector<HTMLElement>(`[data-hotspot="${station.href}"]`)!, dot: labels.querySelector<HTMLElement>(`[data-anchor="${station.href}"]`)!, line: labels.querySelector<HTMLElement>(`[data-line="${station.href}"]`)! }));
    function draw() {
      if (disposed || !host) return;
      const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
      const mobile = width < 650, span = mobile ? Math.max(vertical, 14) : vertical;
      camera.left = -span * width / height / 2; camera.right = span * width / height / 2; camera.top = span / 2; camera.bottom = -span / 2;
      camera.updateProjectionMatrix(); camera.lookAt(target); camera.updateMatrixWorld();
      renderer.render(scene, camera);
      for (const { station, label, dot, line } of elements) {
        const point = new T.Vector3(...station.anchor).project(camera);
        const x = (point.x * 0.5 + 0.5) * width, y = (-point.y * 0.5 + 0.5) * height;
        const lx = Math.max(mobile ? 25 : 70, Math.min(width - (mobile ? 25 : 70), x + station.offset[0] * (mobile ? 0.4 : 1)));
        const ly = Math.max(65, Math.min(height - 45, y + station.offset[1] * (mobile ? 0.6 : 1)));
        label.style.left = `${lx}px`; label.style.top = `${ly}px`;
        dot.style.left = `${x}px`; dot.style.top = `${y}px`;
        line.style.left = `${x}px`; line.style.top = `${y}px`; line.style.width = `${Math.hypot(lx - x, ly - y)}px`; line.style.transform = `rotate(${Math.atan2(ly - y, lx - x)}rad)`;
      }
    }
    const focus = (path: string | null, instant: boolean) => {
      cancelAnimationFrame(frameId);
      const station = stations.find(station => station.href === path);
      const destination = new T.Vector3(...(station?.camera ?? [10.5, 8.7, 12]));
      const endTarget = new T.Vector3(...(station?.target ?? [0, 1.4, -0.4]));
      const startPosition = camera.position.clone(), startTarget = target.clone(), startSpan = vertical, endSpan = station?.span ?? 12;
      const duration = instant || reduced.matches ? 0 : 680;
      const start = performance.now();
      host.dataset.destination = path ?? "overview";
      host.dataset.traveling = String(duration > 0);
      function frame(now: number) {
        if (disposed) return;
        const fraction = duration ? Math.min(1, (now - start) / duration) : 1, eased = 1 - Math.pow(1 - fraction, 3);
        camera.position.lerpVectors(startPosition, destination, eased); target.lerpVectors(startTarget, endTarget, eased); vertical = startSpan + (endSpan - startSpan) * eased;
        draw();
        if (fraction < 1) frameId = requestAnimationFrame(frame); else host!.dataset.traveling = "false";
      }
      frameId = requestAnimationFrame(frame);
    };
    controller.current = { focus };
    const resize = () => { renderer.setSize(host.clientWidth, host.clientHeight, false); draw(); };
    const observer = new ResizeObserver(resize); observer.observe(host);
    const raycaster = new T.Raycaster(), pointer = new T.Vector2();
    function hitAt(event: PointerEvent | MouseEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(office.hitRegions)[0]?.object.userData.href as StationPath | undefined;
    }
    const onClick = (event: MouseEvent) => { const path = hitAt(event); if (path) onNavigate(path); };
    const onPointer = (event: PointerEvent) => { renderer.domElement.style.cursor = hitAt(event) ? "pointer" : "default"; };
    const onContextLost = (event: Event) => { event.preventDefault(); cancelAnimationFrame(frameId); setUnavailable(true); };
    renderer.domElement.addEventListener("click", onClick);
    renderer.domElement.addEventListener("pointermove", onPointer);
    renderer.domElement.addEventListener("webglcontextlost", onContextLost);
    resize(); host.dataset.ready = "true";
    return () => {
      disposed = true; controller.current = null; cancelAnimationFrame(frameId); observer.disconnect();
      renderer.domElement.removeEventListener("click", onClick); renderer.domElement.removeEventListener("pointermove", onPointer); renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      office.dispose(); renderer.dispose(); renderer.domElement.remove();
    };
  }, [onNavigate]);

  useEffect(() => { controller.current?.focus(overview ? null : activePath, hidden); }, [activePath, overview, hidden]);

  return <div className={`office-scene ${overview ? "is-overview" : ""} ${unavailable ? "is-unavailable" : ""}`}>
    <div className="office-canvas" ref={canvasHost} />
    {unavailable && <div className="office-fallback"><span className="eyebrow">A quieter view</span><p>Your workspace is ready. Use the navigation above to move between stations.</p></div>}
    <div className="office-hotspots" ref={labelHost} aria-label="Office objects" hidden={unavailable}>
      {stations.map((station, index) => {
        const selected = !overview && activePath === station.href, Icon = station.icon;
        return <div className={`station-marker ${selected ? "is-selected" : ""}`} key={station.href}>
          <span className="station-connector" data-line={station.href} aria-hidden="true" /><span className="station-anchor" data-anchor={station.href} aria-hidden="true" />
          <Link className="station-hotspot" data-hotspot={station.href} href={station.href} scroll={false} aria-current={selected ? "page" : undefined} aria-label={`${station.title}: open the ${station.object.toLowerCase()}`} onClick={event => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onNavigate(station.href); } }}><span className="station-number">{index + 1}</span><Icon size={14} aria-hidden="true" /><span className="station-label">{station.title}</span></Link>
        </div>;
      })}
    </div>
  </div>;
}
