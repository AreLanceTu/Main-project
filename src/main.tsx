import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ThemeProvider } from "@/components/theme-provider";
import "./index.css";

createRoot(document.getElementById("root")!).render(
	<ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="gigflow-theme">
		<App />
	</ThemeProvider>,
);
