import { useRef, useState } from 'react';

// A failed request leaves the form intact; duplicate clicks share no second write.
export function useSaveAction() {
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const run = async (action, success = 'Serverga saqlandi.') => {
    if (locked.current) return false;
    locked.current = true; setBusy(true); setMessage('');
    try {
      const result = await action();
      if (!result) { setMessage('Saqlanmadi. Kiritilgan ma’lumotlar saqlandi; xatoni tekshirib qayta urinib ko‘ring.'); return false; }
      setMessage(success); return true;
    } catch (error) { setMessage(error.message || 'Saqlash bajarilmadi.'); return false; }
    finally { locked.current = false; setBusy(false); }
  };
  return { busy, message, setMessage, run };
}
