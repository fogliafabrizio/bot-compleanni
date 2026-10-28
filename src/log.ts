// Log solo con codici e numeri, mai dati personali (principio V, RNF-08).
export function log(code: string, extra?: Record<string, number | boolean>): void {
  console.log(JSON.stringify({ code, ...extra }));
}
