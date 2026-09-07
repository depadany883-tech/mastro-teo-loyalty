// ==========================================================
// CONFIGURAZIONE — modifica solo qui, vale per entrambe le pagine
// ==========================================================
const CONFIG = {
  // Sostituisci con l'ID della tua API SheetDB (es. "n0b4exavnarff")
  // Lo trovi nella dashboard di sheetdb.io dopo aver collegato il tuo Google Sheet.
  SHEETDB_API_ID: "hnbemeypvwway",

  // Il tuo Google Sheet deve avere due fogli (tab in basso):
  //
  // Foglio "clienti" — colonne: piva | ragioneSociale | citta | agenteRif | saldoPunti | totaleSpeso
  // Foglio "ordini"  — colonne: piva | importo | punti | agente | data
  //
  // Nomi delle colonne ESATTI (case-sensitive), altrimenti SheetDB non li riconosce.

  PUNTI_PER_EURO: 1,
  // Premi a soglie crescenti — aggiungine o modificane quanti vuoi.
  // "soglia" = punti necessari, "nome" = cosa riceve il cliente.
  PREMI: [
    { soglia: 200, nome: "10€ di sconto" },
    { soglia: 350, nome: "20€ di sconto" },
    { soglia: 600, nome: "2 scatole omaggio" },
    { soglia: 800, nome: "30% di sconto in fattura" },
    { soglia: 5000, nome: "10 scatole omaggio" },
  ],
  NOME_AZIENDA: "Le delizie di Mastro Teo",
  AGENTI: ["Marco", "Luca", "Sara"], // modifica con i nomi reali dei tuoi agenti
};

CONFIG.PREMI.sort((a, b) => a.soglia - b.soglia);

const SHEETDB_BASE = `https://sheetdb.io/api/v1/${CONFIG.SHEETDB_API_ID}`;

function normPiva(v){ return (v || "").replace(/\s+/g, "").toUpperCase().trim(); }

// SheetDB (piano gratuito) può rifiutare richieste troppo ravvicinate.
// Questo helper ritenta automaticamente dopo una breve pausa prima di arrendersi.
async function sheetdbFetch(url, options, tentativi = 3, attesaMs = 700){
  let ultimoErrore;
  for(let i = 0; i < tentativi; i++){
    if(i > 0) await new Promise(r => setTimeout(r, attesaMs));
    try{
      const res = await fetch(url, options);
      if(res.ok) return res;
      ultimoErrore = new Error(`Richiesta fallita (${res.status})`);
    }catch(e){
      ultimoErrore = e;
    }
  }
  throw ultimoErrore;
}

// Helper: cerca un cliente per P.IVA nel foglio "clienti"
async function trovaCliente(piva){
  const url = `${SHEETDB_BASE}/search?sheet=clienti&piva=${encodeURIComponent(normPiva(piva))}`;
  const res = await sheetdbFetch(url);
  const rows = await res.json();
  return rows && rows.length ? rows[0] : null;
}

// Helper: recupera TUTTI gli ordini di un cliente (per calcolare il saldo)
async function tuttiOrdiniCliente(piva){
  const url = `${SHEETDB_BASE}/search?sheet=ordini&piva=${encodeURIComponent(normPiva(piva))}`;
  const res = await sheetdbFetch(url);
  const rows = await res.json();
  rows.sort((a, b) => new Date(b.data) - new Date(a.data));
  return rows;
}

// Il saldo NON è un campo salvato — è sempre la somma dei punti di tutti gli ordini.
// Evita ogni problema di sincronizzazione: non c'è nulla da "aggiornare".
function calcolaSaldo(ordini){
  return ordini.reduce((tot, o) => tot + (parseFloat(o.punti) || 0), 0);
}
