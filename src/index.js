import React from "react";
import ReactDOM from "react-dom/client";
import { RobotMascot as RobotMascotComponent } from "./RobotMascot";

// Mount function exposed globally
export function mount(selector) {
  const container =
    typeof selector === "string"
      ? document.querySelector(selector)
      : selector;

  if (!container) {
    console.error("RobotMascot: container not found");
    return;
  }

  const root = ReactDOM.createRoot(container);
  root.render(React.createElement(RobotMascotComponent));
}
