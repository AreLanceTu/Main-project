# Firestore Chat (1:1) – Schema, Queries, Rules

This app uses Firebase Authentication + Cloud Firestore (SDK v9 modular) to implement a production-ready one-to-one chat.

## Collections & Documents

### users (collection)
Document id: the user’s `uid`

```js
/users/{uid}
  name: string
  nameLower: string
  username: string
  usernameLower: string
  role: "client" | "freelancer"
  photoURL: string
```

### chats (collection)
Document id: `chatId` (deterministic from the two UIDs)

```js
/chats/{chatId}
  participants: [clientUid, freelancerUid] // size 2
  lastMessage: string
  lastUpdated: serverTimestamp
  unreadCount: {
    [uid]: number // unread messages for that user
  }
  hiddenFor: {
    [uid]: boolean // if true, hide chat from that user's inbox
  }
  purgedAt: serverTimestamp // clears history for both users (messages before this are hidden in UI)
  purgedBy: uid
```

### messages (subcollection under chats)

```js
/chats/{chatId}/messages/{messageId}
  senderId: uid
  receiverId: uid
  text: string
  createdAt: serverTimestamp
  read: boolean
```

## Deterministic chatId

Implementation: [src/lib/chat.js](src/lib/chat.js)

```js
chatId = [uidA, uidB].sort().join("_")
```

This guarantees a stable unique chat for the same 2 users.

## Example Queries (SDK v9)

### 1) Fetch chats for logged-in user (real-time)

```js
const q = query(
  collection(db, "chats"),
  where("participants", "array-contains", currentUid),
  orderBy("lastUpdated", "desc")
);

const unsub = onSnapshot(q, (snap) => {
  const chats = snap.docs.map((d) => ({ chatId: d.id, ...d.data() }));
});
```

### 2) Listen to messages in a chat (real-time)

```js
const q = query(
  collection(db, "chats", chatId, "messages"),
  orderBy("createdAt", "asc")
);

const unsub = onSnapshot(q, (snap) => {
  const messages = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
});
```

### 3) Send a message

```js
await addDoc(collection(db, "chats", chatId, "messages"), {
  senderId: currentUid,
  receiverId: otherUid,
  text,
  createdAt: serverTimestamp(),
  read: false,
});

await updateDoc(doc(db, "chats", chatId), {
  lastMessage: text,
  lastUpdated: serverTimestamp(),
  [`unreadCount.${otherUid}`]: increment(1),
  [`unreadCount.${currentUid}`]: 0,
});
```

### 4) Mark unread messages as read when opening a chat

```js
const unreadQ = query(
  collection(db, "chats", chatId, "messages"),
  where("receiverId", "==", currentUid),
  where("read", "==", false)
);

const unreadSnap = await getDocs(unreadQ);
const batch = writeBatch(db);

unreadSnap.docs.forEach((d) => batch.update(d.ref, { read: true }));
batch.update(doc(db, "chats", chatId), { [`unreadCount.${currentUid}`]: 0 });

await batch.commit();
```

## Security Rules

Rules live in: [firestore.rules](firestore.rules)

Key behavior:
- Only authenticated users can access chat data.
- Only users in `chats/{chatId}.participants` can read/write chat metadata.
- Only participants can read messages.
- Only the sender can create a message.
- Only the receiver can set `read: true`.

## Notes

## Attachments (Supabase Storage)

Chat attachments are uploaded to Supabase Storage via Supabase Edge Functions (the app uses Firebase Auth, so the functions verify Firebase ID tokens).

If you see browser errors like:
- "blocked by CORS policy" / "preflight request doesn't pass"
- "Requested function was not found" / HTTP 404 for `storage-upload`

Make sure these Edge Functions are deployed to your Supabase project:

```bash
supabase functions deploy storage-upload --no-verify-jwt
supabase functions deploy storage-signed-upload --no-verify-jwt
```

And make sure required secrets are set (values come from your Supabase + Firebase projects):

```bash
supabase secrets set FIREBASE_PROJECT_ID=your-firebase-project-id
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

- The `where(participants, array-contains)` + `orderBy(lastUpdated)` query may prompt Firestore to create a composite index in the console.
- To start a new chat from elsewhere in the app, deep-link to the dashboard messages tab with `?with=<otherUid>` (MessagesPage auto-creates the chat).
