import React from "react";
import ReactDOM from "react-dom/client";
import { RoomEditor } from "./editor/RoomEditor.tsx";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RoomEditor />
  </React.StrictMode>,
);
