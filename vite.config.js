import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: "src/index.js",
      name: "RobotMascot",
      fileName: "robot.bundle",
      formats: ["umd"],
    },
    rollupOptions: {
      external: [], // bundle React inside
    },
  },
});