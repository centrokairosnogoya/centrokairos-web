/* Centro Kairós como app en el celular.
   - Registra el service worker (sw.js), que es lo que permite instalar la web.
   - Expone window.KairosApp para que el portal muestre el botón "Agregar a mi celular"
     con el camino que corresponde a cada teléfono:
       'prompt'  → Android con Chrome: aparece la ventanita oficial de instalar.
       'ios'     → iPhone: hay que hacerlo a mano desde Compartir > Agregar a inicio.
       'android' → otro navegador de Android: desde el menú del navegador.
       'webview' → la página se abrió dentro de Instagram o Facebook: hay que abrirla en el navegador.
       null      → ya está instalada, o es una compu: no se ofrece nada. */
(function () {
  const ua = navigator.userAgent || '';
  const esIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const esAndroid = /Android/i.test(ua);
  const esWebview = /FBAN|FBAV|FB_IAB|Instagram|Line\//i.test(ua);
  const CLAVE_NO = 'kairos-app-no';
  const DIAS_SIN_INSISTIR = 21;
  let pedido = null;

  const avisar = () => window.dispatchEvent(new Event('kairos-app'));

  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); pedido = e; avisar(); });
  window.addEventListener('appinstalled', () => { pedido = null; try { localStorage.setItem('kairos-app-instalada', '1'); } catch (e) {} avisar(); });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
  }

  window.KairosApp = {
    instalada() {
      return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    },
    modo() {
      if (this.instalada() || !(esIOS || esAndroid)) return null;
      if (esWebview) return 'webview';
      if (pedido) return 'prompt';
      return esIOS ? 'ios' : 'android';
    },
    async instalar() {
      if (!pedido) return 'sin-ventana';
      pedido.prompt();
      const r = await pedido.userChoice.catch(() => ({ outcome: 'dismissed' }));
      pedido = null;
      avisar();
      return r.outcome;
    },
    descartar() { try { localStorage.setItem(CLAVE_NO, String(Date.now())); } catch (e) {} },
    descartada() {
      try { return Date.now() - (+localStorage.getItem(CLAVE_NO) || 0) < DIAS_SIN_INSISTIR * 864e5; } catch (e) { return false; }
    }
  };
})();
