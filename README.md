# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Real-time Chat (Firebase)

Schema, example queries, and security rules for the 1:1 chat implementation:
- [docs/firestore-chat.md](docs/firestore-chat.md)

### Switching Firebase project / domain

This app reads Firebase config from Vite environment variables (see [src/firebase.js](src/firebase.js)).

- Copy `.env.example` to `.env.local`
- Fill in your new Firebase project values (especially `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`)
- Restart the dev server

If you use Firebase Auth, also update in Firebase Console:
- **Authentication → Settings → Authorized domains** (add your new domain)
- Any OAuth redirect URIs (Google/GitHub providers), if applicable

#### Using `gigfl0w.web.app`

`gigfl0w.web.app` is the **Firebase Hosting** domain for the `gigfl0w` project. You generally do **not** set `VITE_FIREBASE_AUTH_DOMAIN` to `*.web.app`.

To use the app at `https://gigfl0w.web.app`:
- Deploy Hosting for the `gigfl0w` project (Firebase CLI): `firebase deploy --only hosting`
- In Firebase Console, ensure **Authentication → Settings → Authorized domains** includes `gigfl0w.web.app`
- If you use Google/GitHub OAuth providers, add `https://gigfl0w.web.app/__/auth/handler` as an authorized redirect URI (provider-specific)

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
