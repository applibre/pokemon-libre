import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'

/* La app anterior guardaba sus imágenes en cachés llamadas «pokemon-libre-…».
   La nueva usa las suyas: se borran las viejas para no dejar decenas de MB
   olvidados en el móvil. Las marcas (localStorage) no se tocan. */
try {
  caches?.keys().then((ks) => ks.filter((k) => k.startsWith('pokemon-libre')).forEach((k) => caches.delete(k)))
} catch { /* sin caché no pasa nada */ }

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
