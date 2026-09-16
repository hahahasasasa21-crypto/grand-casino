import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import { firebaseConfig, appId } from '../firebaseConfig';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export { appId };

/** 公開データのルート配下のコレクション参照 */
export const pub = (...segs) => collection(db, 'artifacts', appId, 'public', 'data', ...segs);

/** ニュース投稿（失敗しても落とさない） */
export async function postNews(dbRef, appIdRef, message, type = 'info') {
  try {
    const newsRef = collection(dbRef, 'artifacts', appIdRef, 'public', 'data', 'news');
    await addDoc(newsRef, { message, type, createdAt: Date.now() });
  } catch (e) {
    console.error('news post error', e);
  }
}
