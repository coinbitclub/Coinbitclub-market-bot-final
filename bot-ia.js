import { Pool } from "pg";
import axios from "axios";
import OpenAI from "openai";
import cron from "node-cron";
import dotenv from "dotenv";
dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;
const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER;
const ZAPI_INSTANCE_URL = process.env.ZAPI_INSTANCE_URL;
const ZAPI_TOKEN = process.env.ZAPI_TOKEN;

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

async function enviarWhatsappZapi(numero, mensagem) {
  const url = `${ZAPI_INSTANCE_URL}/send-message`;
  try {
    const { data } = await axios.post(
      url,
      { phone: numero, message: mensagem },
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": ZAPI_TOKEN
        }
      }
    );
    console.log("Mensagem WhatsApp enviada!", data);
    return data;
  } catch (e) {
    console.error("Erro ao enviar mensagem no WhatsApp:", e.response?.data || e.message);
    return null;
  }
}

async function monitorarOrdensEExecutarIA() {
  try {
    const { rows: ordens } = await pool.query("SELECT * FROM orders WHERE status='aberta'");
    const contextoMercado = { sinais: [], baleias: [], noticias: [] };

    const messages = [
      {
        role: "system",
        content:
          "Você é uma IA especialista em trading automatizado no mercado de criptomoedas, um ambiente de extrema volatilidade e forte influência de movimentos de grandes players ('baleias'). Seu dever é monitorar continuamente o mercado global, analisar dados em tempo real, identificar padrões suspeitos de movimentação de baleias e antecipar movimentos bruscos. Fique atento a notícias e relatórios econômicos globais que possam impactar o preço dos ativos digitais. Sua prioridade é proteger o capital, fechar operações no lucro sempre que possível, e nunca permitir grandes prejuízos. Em caso de movimento abrupto ou risco elevado, feche todas as operações imediatamente para preservar o saldo. Relate e corrija erros automaticamente no sistema, sempre sugerindo melhorias para o fluxo operacional. Se o usuário tiver alguma dificuldade técnica ou dúvida sobre a automação, explique passo a passo e proponha as melhores práticas para manter o sistema sempre otimizado e seguro."
      },
      {
        role: "user",
        content:
          `Ordens abertas: ${JSON.stringify(ordens)}
           Contexto de mercado: ${JSON.stringify(contextoMercado)}`
      }
    ];

    const resposta = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
    });

    const analise = resposta.choices[0].message.content;
    console.log("Análise da IA:", analise);

    await enviarWhatsappZapi(WHATSAPP_NUMBER, "🚨 Análise IA CoinBitClub:\n\n" + analise);

    await pool.query(
      `INSERT INTO audit_logs (evento, detalhes, status, payload)
       VALUES ($1, $2, $3, $4)`,
      [
        "análise_ia",
        analise,
        "sucesso",
        JSON.stringify({ ordens, contextoMercado })
      ]
    );

  } catch (e) {
    console.error("Erro no bot IA:", e);
    await enviarWhatsappZapi(WHATSAPP_NUMBER, "❌ Erro no bot IA CoinBitClub: " + (e.message || e));
    await pool.query(
      `INSERT INTO audit_logs (evento, detalhes, status)
       VALUES ($1, $2, $3)`,
      ["erro_bot_ia", e.message, "falha"]
    );
  }
}

async function enviarRelatorioDiario() {
  try {
    const { rows: ordensFechadas } = await pool.query("SELECT * FROM orders WHERE status='fechada' AND fechada_em > NOW() - INTERVAL '1 day'");
    const resumo = `Relatório diário CoinBitClub:\n\nOrdens fechadas nas últimas 24h:\n${JSON.stringify(ordensFechadas, null, 2)}`;
    await enviarWhatsappZapi(WHATSAPP_NUMBER, resumo);
    console.log("Relatório diário enviado!");
  } catch (e) {
    console.error("Erro ao enviar relatório diário:", e.message);
  }
}

// IA a cada 4h
cron.schedule("0 */4 * * *", monitorarOrdensEExecutarIA);
// Relatório diário às 8h
cron.schedule("0 8 * * *", enviarRelatorioDiario);

console.log("Bot IA CoinBitClub rodando! Monitoramento e alertas automáticos via WhatsApp.");
