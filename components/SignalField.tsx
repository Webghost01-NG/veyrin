"use client";

import { type CSSProperties, type PointerEvent, useState } from "react";

type SignalStyle = CSSProperties & { "--signal-x": string; "--signal-y": string };

export function SignalField() {
  const [position, setPosition] = useState({ x: 68, y: 44 });

  function moveSignal(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    setPosition({
      x: Math.round(((event.clientX - bounds.left) / bounds.width) * 100),
      y: Math.round(((event.clientY - bounds.top) / bounds.height) * 100)
    });
  }

  const style: SignalStyle = {
    "--signal-x": `${position.x}%`,
    "--signal-y": `${position.y}%`
  };

  return (
    <div className="signal-field" onPointerMove={moveSignal} style={style} aria-hidden="true">
      <div className="signal-orbit signal-orbit-one" />
      <div className="signal-orbit signal-orbit-two" />
      <div className="signal-orbit signal-orbit-three" />
      <div className="signal-core"><span>intent</span></div>
      <span className="signal-caption">Move to examine the signal</span>
    </div>
  );
}
