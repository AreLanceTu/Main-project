import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@/components/theme-provider";
import { firebaseInitError, missingFirebaseEnvVars } from "@/firebase";
import "./index.css";

function StartupError() {
	const firebaseMsg =
		firebaseInitError instanceof Error
			? firebaseInitError.message
			: firebaseInitError
				? String(firebaseInitError)
				: null;

	return (
		<div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
			<div className="w-full max-w-2xl rounded-lg border border-border bg-card text-card-foreground p-6 space-y-4">
				<div className="space-y-1">
					<h1 className="text-xl font-semibold">Setup required</h1>
					<p className="text-sm text-muted-foreground">
						The app can’t start locally because required configuration is missing or invalid.
					</p>
				</div>

				<div className="space-y-2">
					<p className="text-sm font-medium">What to do</p>
					<ol className="list-decimal pl-5 text-sm space-y-1">
						<li>Ensure <span className="font-mono">.env.local</span> exists (copy from <span className="font-mono">.env.example</span> if needed)</li>
						<li>Fill in the missing <span className="font-mono">VITE_*</span> variables</li>
						<li>Restart dev server: <span className="font-mono">npm run dev</span></li>
					</ol>
				</div>

				{Array.isArray(missingFirebaseEnvVars) && missingFirebaseEnvVars.length > 0 ? (
					<div className="space-y-2">
						<p className="text-sm font-medium">Missing Firebase env vars</p>
						<pre className="text-xs whitespace-pre-wrap rounded-md border border-border bg-background p-3 font-mono">
							{missingFirebaseEnvVars.join("\n")}
						</pre>
					</div>
				) : null}

				{firebaseMsg ? (
					<div className="space-y-2">
						<p className="text-sm font-medium">Firebase error</p>
						<pre className="text-xs whitespace-pre-wrap rounded-md border border-border bg-background p-3 font-mono">{firebaseMsg}</pre>
					</div>
				) : null}
			</div>
		</div>
	);
}

const rootEl = document.getElementById("root");
if (!rootEl) {
	throw new Error("Root element #root not found");
}

const root = createRoot(rootEl);

if (firebaseInitError) {
	root.render(
		<ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="gigflow-theme">
			<StartupError />
		</ThemeProvider>,
	);
} else {
	import("./App.tsx")
		.then(({ default: App }) => {
			root.render(
				<ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="gigflow-theme">
					<App />
				</ThemeProvider>,
			);
		})
		.catch((e) => {
			// Fallback: show a readable error instead of a blank screen.
			// eslint-disable-next-line no-console
			console.error("Failed to load App", e);
			root.render(
				<ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="gigflow-theme">
					<div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
						<div className="w-full max-w-2xl rounded-lg border border-border bg-card text-card-foreground p-6 space-y-3">
							<h1 className="text-xl font-semibold">App failed to load</h1>
							<pre className="text-xs whitespace-pre-wrap rounded-md border border-border bg-background p-3 font-mono">
								{e instanceof Error ? e.stack ?? e.message : String(e)}
							</pre>
						</div>
					</div>
				</ThemeProvider>,
			);
		});
}
