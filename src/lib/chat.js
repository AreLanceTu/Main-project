import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  increment,
} from "firebase/firestore";

/**
 * Deterministic one-to-one chat id.
 * Ensures the same two users always map to the same chat document.
 */
export function chatIdForUsers(uidA, uidB) {
  const a = String(uidA || "").trim();
  const b = String(uidB || "").trim();
  if (!a || !b) return null;
  return [a, b].sort().join("_");
}

/**
 * Creates a chat document if it doesn't exist.
 * Safe against concurrent creation.
 * Does NOT read first (avoids permission errors).
 */
export async function ensureChatExists(db, { clientUid, freelancerUid }) {
  const chatId = chatIdForUsers(clientUid, freelancerUid);
  if (!chatId) throw new Error("Missing UIDs for chat creation");

  const chatRef = doc(db, "chats", chatId);

  // 🔐 Blind create/update using merge — no read required
  await setDoc(
    chatRef,
    {
      participants: [clientUid, freelancerUid].sort(),
      lastMessage: "",
      lastUpdated: serverTimestamp(),
      unreadCount: {
        [clientUid]: 0,
        [freelancerUid]: 0,
      },
      hiddenFor: {
        [clientUid]: false,
        [freelancerUid]: false,
      },
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );

  return { chatId, chatRef };
}

/**
 * Sends a message in a chat and updates chat metadata.
 */
export async function sendChatMessage(db, {
  chatId,
  senderId,
  receiverId,
  text,
}) {
  const trimmed = String(text || "").trim();
  if (!chatId || !senderId || !receiverId) {
    throw new Error("Missing chatId/senderId/receiverId");
  }
  if (!trimmed) return;

  const chatRef = doc(db, "chats", chatId);
  const messagesRef = collection(chatRef, "messages");

  await addDoc(messagesRef, {
    senderId,
    receiverId,
    text: trimmed,
    createdAt: serverTimestamp(),
    read: false,
  });

  await updateDoc(chatRef, {
    lastMessage: trimmed,
    lastUpdated: serverTimestamp(),
    [`unreadCount.${receiverId}`]: increment(1),
    [`unreadCount.${senderId}`]: 0,
    [`hiddenFor.${senderId}`]: false,
    [`hiddenFor.${receiverId}`]: false,
  });
}

/**
 * "Deletes" a chat for a specific user by hiding it from their inbox.
 * The other participant still keeps the chat.
 * If a new message is sent later, the chat is unhidden for both participants.
 */
export async function hideChatForUser(db, { chatId, uid }) {
  if (!chatId || !uid) throw new Error("Missing chatId/uid");
  const chatRef = doc(db, "chats", chatId);
  await updateDoc(chatRef, {
    [`hiddenFor.${uid}`]: true,
    [`unreadCount.${uid}`]: 0,
  });
}

/**
 * Clears chat history for both participants ("delete for everyone").
 * This does not delete Firestore documents (rules block deletes);
 * instead it sets a purge timestamp and hides the conversation for both users.
 * New messages will automatically unhide it (sendChatMessage sets hiddenFor false).
 */
export async function purgeChatForEveryone(db, { chatId, byUid, participants }) {
  if (!chatId || !byUid) throw new Error("Missing chatId/byUid");
  const list = Array.isArray(participants) ? participants.filter(Boolean) : [];
  if (list.length !== 2) throw new Error("Missing participants for purge");

  const chatRef = doc(db, "chats", chatId);
  const payload = {
    purgedAt: serverTimestamp(),
    purgedBy: byUid,
    lastMessage: "",
    lastUpdated: serverTimestamp(),
  };

  // reset unread + hide for both
  for (const uid of list) {
    payload[`unreadCount.${uid}`] = 0;
    payload[`hiddenFor.${uid}`] = true;
  }

  await updateDoc(chatRef, payload);
}
