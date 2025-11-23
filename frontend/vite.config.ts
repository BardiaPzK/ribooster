import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
  base: "/app/", // app will be served under /app
  server: {
    port: 5173
  }
});
