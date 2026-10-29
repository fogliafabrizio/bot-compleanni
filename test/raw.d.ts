// Import di file come testo (`?raw` di Vite), per le fixture condivise con Postman.
declare module "*?raw" {
  const content: string;
  export default content;
}
