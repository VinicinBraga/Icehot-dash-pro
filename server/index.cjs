const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const { pool } = require("./db.cjs");
const jwt = require("jsonwebtoken");
const JWT_SECRET =
  process.env.JWT_SECRET || "icehot-dashboard-super-secret-2025";
console.log(
  "TOKEN DEBUG (startup):",
  jwt.sign(
    { id: 198, email: "user01@teste.com.br", isMaster: false },
    JWT_SECRET,
    { expiresIn: "7d" }
  )
);

const bcrypt = require("bcryptjs");
const app = express();
const fetch = require("node-fetch");
const {
  getKpisFromBigQuery,
  getLitersByMachineFromBigQuery,
  getWaterSeriesFromBigQuery,
  getTriggerSeriesFromBigQuery,
  getEquipmentAggregatesFromBigQuery,
  getAspersorPresenceFromBigQuery,
} = require("./bigquery");

const MASTER_EMAILS = [
  "contato@icehot.net.br",
  "contato@devontecnologia.com.br",
];

/* --------------------------- CORS --------------------------- */
const ENV_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const ALLOWED_ORIGINS = [
  "https://icehot-dash-pro.vercel.app",
  "https://icehot-dash-api-750315205117.southamerica-east1.run.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization,Content-Type,X-User-Email"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json());

/* --------------------- Config / Helpers --------------------- */

const LITERS_SCALE = 0.001;
const BOTTLE_LITERS = 0.5;
const CO2_PER_LITER_KG = 0.1;

const asNum = (v) =>
  v === undefined || v === null || v === "" ? undefined : Number(v);

const isMasterEmail = (email) =>
  !!email && MASTER_EMAILS.includes(String(email).trim().toLowerCase());

function signToken(user) {
  const isMaster = isMasterEmail(user.email);
  const payload = {
    id: user.id,
    email: user.email,
    isMaster,
  };
  console.log(
    "TOKEN DEBUG:",
    jwt.sign(
      { id: 198, email: "user01@teste.com.br", isMaster: false },
      JWT_SECRET,
      { expiresIn: "7d" }
    )
  );
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

// máquinas do usuário (ou todas, se master)
async function getUserMachineIds(email, isMaster = false) {
  if (!email) return [];

  if (isMaster) {
    const [rows] = await pool.query(`SELECT id FROM maquinas`);
    return rows.map((r) => r.id);
  }

  const [machinesRows] = await pool.query(
    `SELECT ue.maquina_id
       FROM users u
       JOIN usuarios_equipamentos ue ON ue.usuario_id = u.id
      WHERE u.email = ?`,
    [email]
  );
  return machinesRows.map((r) => r.maquina_id);
}

// ===== Helper: pega coordenadas reais da cidade e guarda cache no MySQL =====
const removeDiacritics = (s = "") =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function normalizeCityUf(cidadeRaw, ufRaw) {
  const cidade = String(cidadeRaw || "").trim();
  const uf = String(ufRaw || "")
    .trim()
    .toUpperCase();

  const cidadeSlim = removeDiacritics(cidade).replace(/\s+/g, " ");
  return {
    cidade,
    uf,
    keyCidade: cidadeSlim.toLowerCase(),
  };
}

// cache em memória por cidade+UF (vale para todo o processo Node)
const cityCoordCache = new Map();

/**
 * Busca coordenadas da cidade/UF com 3 níveis:
 * - cache em memória (evita bater no MySQL toda hora)
 * - tabela city_coords (exato)
 * - tabela city_coords (normalizado)
 */
async function getCityCoords(pool, cidadeRaw, ufRaw) {
  const { cidade, uf, keyCidade } = normalizeCityUf(cidadeRaw, ufRaw);

  // sem cidade/UF → sem coordenada
  if (!cidade || !uf) {
    return { lat: null, lng: null, source: "missing" };
  }

  const cacheKey = `${cidade}|${uf}`;

  // 0) cache em memória
  const cached = cityCoordCache.get(cacheKey);
  if (cached) {
    return { ...cached, source: "memory" };
  }

  // 1) cache exato no MySQL
  const [hit1] = await pool.query(
    "SELECT lat, lng FROM city_coords WHERE cidade = ? AND uf = ? LIMIT 1",
    [cidade, uf]
  );

  if (hit1.length) {
    const value = {
      lat: Number(hit1[0].lat),
      lng: Number(hit1[0].lng),
    };
    cityCoordCache.set(cacheKey, value);
    return { ...value, source: "cache" };
  }

  // 2) cache “normalizado” (sem acentos / minúsculas)
  const [hit2] = await pool.query(
    `SELECT lat, lng
       FROM city_coords
      WHERE LOWER(REPLACE(CONVERT(cidade USING ascii), '  ', ' ')) = ?
        AND uf = ?
      LIMIT 1`,
    [keyCidade, uf]
  );

  if (hit2.length) {
    const value = {
      lat: Number(hit2[0].lat),
      lng: Number(hit2[0].lng),
    };
    cityCoordCache.set(cacheKey, value);
    return { ...value, source: "cache-slim" };
  }

  // 3) nada encontrado → não inventa coordenada
  const missing = { lat: null, lng: null };
  cityCoordCache.set(cacheKey, missing);
  return { ...missing, source: "missing" };
}

/**
 * resolveMachineIds:
 * - baseia-se nas máquinas vinculadas ao usuário
 * - se isMaster => começa com TODAS as máquinas
 * - aplica filtros: usuario, modelo, equipamento, serie, status
 */
async function resolveMachineIds(userEmail, q = {}, isMaster = false) {
  const usuario = asNum(q.usuario);
  const modelo = asNum(q.modelo);
  const equipamento = asNum(q.equipamento);
  const serie = q.serie?.trim();
  const status = q.status?.trim();

  let baseIds = [];

  // ✅ PRIORIDADE: se vier ?usuario=123, usamos a visão daquele usuário
  // (mesmo se o caller for master). Isso garante filtros corretos e modules corretos.
  if (usuario) {
    const [rows] = await pool.query(
      `
      SELECT ue.maquina_id
        FROM usuarios_equipamentos ue
        JOIN maquinas m ON m.id = ue.maquina_id
       WHERE ue.usuario_id = ?
         AND m.status <> 3
      `,
      [usuario]
    );
    baseIds = rows.map((r) => r.maquina_id);
  } else if (isMaster) {
    const [rows] = await pool.query(
      `SELECT id FROM maquinas WHERE status <> 3`
    );
    baseIds = rows.map((r) => r.id);
  } else {
    const [baseRows] = await pool.query(
      `
      SELECT ue.maquina_id
        FROM users u
        JOIN usuarios_equipamentos ue ON ue.usuario_id = u.id
        JOIN maquinas m ON m.id = ue.maquina_id
       WHERE u.email = ?
         AND m.status <> 3
      `,
      [userEmail]
    );
    baseIds = baseRows.map((r) => r.maquina_id);
  }

  if (!baseIds.length) return [];

  // filtro de equipamento tem precedência
  if (equipamento) {
    return baseIds.includes(equipamento) ? [equipamento] : [];
  }

  // filtros adicionais em cima do conjunto base
  const where = [`m.id IN (?)`, `m.status <> 3`];
  const params = [baseIds];

  if (modelo) {
    where.push(`m.tipo_id = ?`);
    params.push(modelo);
  }

  if (serie) {
    where.push(`(m.numeroSerieEquipamento = ? OR m.serialNumber = ?)`);
    params.push(serie, serie);
  }

  // ⚠️ Removido:
  // if (usuario) EXISTS(...) ...
  // Porque quando usuario está presente, baseIds já são desse usuario.

  if (status) {
    const s = String(status).trim().toLowerCase();

    if (s === "ativo" || s === "inativo") {
      const defaultTo = new Date();
      const defaultFrom = new Date();
      defaultFrom.setDate(defaultFrom.getDate() - 30);

      const toStr =
        typeof q.to === "string" && q.to
          ? q.to
          : defaultTo.toISOString().slice(0, 10);

      const fromStr =
        typeof q.from === "string" && q.from
          ? q.from
          : defaultFrom.toISOString().slice(0, 10);

      const [activeRows] = await pool.query(
        `
        SELECT DISTINCT inf.maquina_id
          FROM informacoes inf FORCE INDEX (idx_informacoes_maquina_created)
         WHERE inf.maquina_id IN (?)
           AND inf.created_at >= ?
           AND inf.created_at < DATE_ADD(?, INTERVAL 1 DAY)
        `,
        [baseIds, fromStr, toStr]
      );

      const activeSet = new Set(
        activeRows.map((r) => r.maquina_id).filter(Boolean)
      );

      baseIds =
        s === "ativo"
          ? baseIds.filter((id) => activeSet.has(id))
          : baseIds.filter((id) => !activeSet.has(id));

      if (!baseIds.length) return [];

      // atualiza o IN (?) com o novo conjunto filtrado
      params[0] = baseIds;
    } else {
      // mantém comportamento anterior (se existir status textual)
      where.push(`LOWER(TRIM(m.status)) = ?`);
      params.push(s);
    }
  }

  const [rows] = await pool.query(
    `SELECT m.id FROM maquinas m WHERE ${where.join(" AND ")}`,
    params
  );

  return rows.map((r) => r.id);
}

const PUBLIC_PATHS = new Set(["/api/_debug/ping", "/api/health"]);

// ===== DEV AUTH BYPASS (LOCAL ONLY)
app.use((req, res, next) => {
  if (process.env.BYPASS_AUTH === "1") {
    req.userEmail = req.header("x-user-email") || "contato@icehot.net.br";
    req.isMaster = String(req.header("x-is-master") || "true") === "true";
  }
  next();
});

/* ---------------------- Middleware Auth JWT ---------------------- */

app.use((req, res, next) => {
  if (req.method === "OPTIONS") return res.sendStatus(204);
  if (PUBLIC_PATHS.has(req.path)) return next();
  if (req.path === "/api/auth/login") return next();
  if (process.env.BYPASS_AUTH === "1") {
    req.userId = 0;
    req.userEmail = req.header("x-user-email") || "contato@icehot.net.br";
    req.isMaster = String(req.header("x-is-master") || "true") === "true";
    return next();
  }
  const auth = req.header("authorization");
  const legacyEmail = req.header("x-user-email");

  if (auth && auth.startsWith("Bearer ")) {
    const token = auth.slice(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.userId = decoded.id;
      req.userEmail = decoded.email;
      req.isMaster = !!decoded.isMaster || isMasterEmail(decoded.email);
      return next();
    } catch (err) {
      console.warn("JWT inválido:", err.message);
      return res.status(401).json({ error: "Token inválido ou expirado" });
    }
  }

  if (legacyEmail) {
    req.userEmail = legacyEmail;
    req.isMaster = isMasterEmail(legacyEmail);
    return next();
  }

  return res.status(401).json({ error: "Não autenticado" });
});

/* --------------------------- Auth --------------------------- */

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Informe email e senha." });
    }

    const [rows] = await pool.query(
      "SELECT id, email, password FROM users WHERE email = ? LIMIT 1",
      [email]
    );
    if (!rows.length) {
      return res.status(401).json({ error: "Credenciais inválidas." });
    }

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ error: "Credenciais inválidas." });
    }

    const token = signToken(user);
    const isMaster = isMasterEmail(user.email);

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        isMaster,
      },
    });
  } catch (e) {
    console.error("Erro no login:", e);
    return res.status(500).json({ error: "Erro ao autenticar." });
  }
});

app.get("/api/auth/me", (req, res) => {
  if (!req.userEmail) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  res.json({
    id: req.userId || null,
    email: req.userEmail,
    isMaster: !!req.isMaster,
  });
});

/* ----------------------- Rotas utilitárias ----------------------- */

app.get("/api/_debug/ping", (_req, res) => {
  res.json({
    ok: true,
    file: "server/index.cjs",
    ts: new Date().toISOString(),
  });
});

app.get("/api/health", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT 1 AS ok");
    res.json({
      status: "ok",
      db: rows[0].ok,
      userEmail: req.userEmail || null,
      isMaster: !!req.isMaster,
    });
  } catch (e) {
    res.status(500).json({ status: "error", error: String(e) });
  }
});

/* ----------------------------- KPIs ----------------------------- */

app.get("/api/kpis", async (req, res) => {
  try {
    // Usa o email vindo do JWT (middleware de auth já preenche req.userEmail)
    const userEmail = req.userEmail || req.header("x-user-email") || null;
    const { from, to } = req.query; // esperado YYYY-MM-DD

    // datas padrão (últimos 30 dias)
    const defaultTo = new Date();
    const defaultFrom = new Date();
    defaultFrom.setDate(defaultFrom.getDate() - 30);

    const toStr =
      typeof to === "string" && to ? to : defaultTo.toISOString().slice(0, 10);
    const fromStr =
      typeof from === "string" && from
        ? from
        : defaultFrom.toISOString().slice(0, 10);

    // 1) Descobre as máquinas visíveis para esse usuário (ou todas, se master)
    const machineIds = await resolveMachineIds(
      userEmail,
      req.query,
      req.isMaster
    );

    console.log("DEBUG /api/kpis machineIds", {
      userEmail,
      isMaster: req.isMaster,
      query: req.query,
      machineIdsCount: machineIds?.length || 0,
      machineIdsSample: (machineIds || []).slice(0, 10),
    });

    if (!machineIds.length) {
      return res.json({
        water: { total: 0, fria: 0, quente: 0, pets: 0 },
        triggers: { total: 0, fria: 0, quente: 0, pets: 0, aspersor: 0 },
        equipamentos_utilizados: 0,
        garrafas_poupadas: 0,
        co2_poupado_kg: 0,
        modules: { fria: false, quente: false, pets: false, aspersor: false },
        _period: { from: fromStr, to: toStr, email: userEmail },
      });
    }

    // ============================
    // ✅ MODULES (MySQL)
    // - Se vier ?usuario=123 (master filtrando), usa esse usuario_id
    // - Se NÃO for master, usa o próprio req.userId (usuário logado)
    // - Se for master e NÃO vier usuario na query, mantém "global" (IN máquina)
    // ============================
    let modules = { fria: true, quente: true, pets: true }; // fallback

    if (machineIds?.length) {
      const placeholders = machineIds.map(() => "?").join(",");

      const usuarioQuery = asNum(req.query.usuario);
      const usuarioFilter =
        usuarioQuery || (!req.isMaster ? asNum(req.userId) : undefined);

      const sql = usuarioFilter
        ? `
          SELECT
            MAX(COALESCE(ue.agua_gelada, 0)) AS fria,
            MAX(COALESCE(ue.agua_quente, 0)) AS quente,
            MAX(COALESCE(ue.agua_pet, 0))    AS pets
          FROM usuarios_equipamentos ue
          JOIN maquinas m ON m.id = ue.maquina_id
          WHERE ue.usuario_id = ?
            AND ue.maquina_id IN (${placeholders})
        `
        : `
          SELECT
            MAX(COALESCE(ue.agua_gelada, 0)) AS fria,
            MAX(COALESCE(ue.agua_quente, 0)) AS quente,
            MAX(COALESCE(ue.agua_pet, 0))    AS pets
          FROM usuarios_equipamentos ue
          JOIN maquinas m ON m.id = ue.maquina_id
          WHERE ue.maquina_id IN (${placeholders})
        `;

      const params = usuarioFilter
        ? [usuarioFilter, ...machineIds]
        : machineIds;

      const [rows] = await pool.execute(sql, params);

      const r = rows?.[0] || {};
      modules = {
        fria: Boolean(r.fria),
        quente: Boolean(r.quente),
        pets: Boolean(r.pets),
      };
      /*let aspersorEnabled = false;

      try {
        aspersorEnabled = await getAspersorPresenceFromBigQuery(
          machineIds,
          toStr
        ); // retorna true / false
      } catch (e) {
        console.warn(
          "Aviso: falha ao checar aspersor no BQ, mantendo false.",
          e
        );
      }

      modules = { ...modules, aspersor: aspersorEnabled };*/
    }

    // ✅ DEV ONLY: quando estiver testando local sem credencial do BigQuery,
    // devolve só o modules pra validar a lógica
    if (
      process.env.BYPASS_AUTH === "1" &&
      String(req.query.onlyModules) === "1"
    ) {
      return res.json({
        ok: true,
        modules,
        machineIdsCount: machineIds.length,
        machineIdsSample: machineIds.slice(0, 10),
        _period: { from: fromStr, to: toStr, email: userEmail },
      });
    }
    let aspersorSelected = false;

    try {
      // se tiver 1 equipamento filtrado, consulta só ele
      if (req.query.equipamento) {
        const equipamentoId = Number(req.query.equipamento);

        const resp = await fetch(
          `http://localhost:7070/equipamentos/${equipamentoId}/modules`
        );
        const json = await resp.json();
        aspersorSelected = Boolean(json?.data?.aspersor);
      } else {
        // ✅ sem filtro de equipamento: se QUALQUER máquina do usuário tiver aspersor=1 no cadastro, habilita
        const checks = await Promise.all(
          machineIds.map(async (id) => {
            try {
              const resp = await fetch(
                `http://localhost:7070/equipamentos/${id}/modules`
              );
              const json = await resp.json();
              return Boolean(json?.data?.aspersor);
            } catch {
              return false;
            }
          })
        );

        aspersorSelected = checks.some(Boolean);
      }
    } catch (e) {
      console.warn("Falha ao consultar aspersor no cadastro:", e?.message || e);
    }
    // 2) Agora buscamos os KPIs no BigQuery
    const row = await getKpisFromBigQuery(machineIds, fromStr, toStr);
    const aggRows = await getEquipmentAggregatesFromBigQuery(
      machineIds,
      fromStr,
      toStr
    );

    const sum_v_fria = Number(row?.sum_v_fria || 0);
    const sum_v_quente = Number(row?.sum_v_quente || 0);
    const sum_v_pet = Number(row?.sum_v_pet || 0);

    const sum_c_fria = Number(row?.sum_c_fria || 0);
    const sum_c_quente = Number(row?.sum_c_quente || 0);
    const sum_c_pet = Number(row?.sum_c_pet || 0);
    const sum_c_asp = Number(row?.sum_c_asp || 0);

    modules = { ...modules, aspersor: sum_c_asp > 0 || aspersorSelected };
    // Aqui JÁ são litros/dia prontos no BQ (não aplica LITERS_SCALE)
    const litros_fria = sum_v_fria;
    const litros_quente = sum_v_quente;
    const litros_pets = sum_v_pet;
    const litros_total = litros_fria + litros_quente + litros_pets;

    const trg_fria = sum_c_fria;
    const trg_quente = sum_c_quente;
    const trg_pets = sum_c_pet;
    const trg_aspersor = sum_c_asp;
    const trg_total = trg_fria + trg_quente + trg_pets + trg_aspersor;

    const equipamentos_utilizados = (aggRows || []).length;

    const garrafas_poupadas = litros_total / BOTTLE_LITERS;
    const co2_poupado_kg = litros_total * CO2_PER_LITER_KG;

    console.log("KPIs BQ debug:", {
      email: userEmail,
      fromStr,
      toStr,
      machineIds,
      row,
    });

    return res.json({
      water: {
        total: litros_total,
        fria: litros_fria,
        quente: litros_quente,
        pets: litros_pets,
      },
      triggers: {
        total: trg_total,
        fria: trg_fria,
        quente: trg_quente,
        pets: trg_pets,
        aspersor: trg_aspersor,
      },
      equipamentos_utilizados,
      garrafas_poupadas,
      co2_poupado_kg,
      modules,
      _period: { from: fromStr, to: toStr, email: userEmail },
    });
  } catch (e) {
    console.error("Erro em /api/kpis:", e);
    res.status(500).json({ error: String(e) });
  }
});

/* ===== Localização (mapa - por equipamento, alinhado com KPIs) ===== */

app.get("/api/localizacao", async (req, res) => {
  try {
    const userEmail = req.userEmail || req.header("x-user-email");
    const { from, to } = req.query;

    if (!userEmail && !req.isMaster) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    // intervalo padrão: últimos 30 dias
    const defaultTo = new Date();
    const defaultFrom = new Date();
    defaultFrom.setDate(defaultFrom.getDate() - 30);

    const toStr =
      typeof to === "string" && to ? to : defaultTo.toISOString().slice(0, 10);
    const fromStr =
      typeof from === "string" && from
        ? from
        : defaultFrom.toISOString().slice(0, 10);

    // 0) máquinas visíveis pro usuário / filtros
    const machineIds = await resolveMachineIds(
      userEmail,
      req.query,
      req.isMaster
    );

    if (!machineIds.length) {
      return res.json({
        points: [],
        _period: { from: fromStr, to: toStr, email: userEmail },
      });
    }

    // 1) litros por máquina no BigQuery (NOVA FONTE)
    const litersRows = await getLitersByMachineFromBigQuery(
      machineIds,
      fromStr,
      toStr
    );

    const litersByMachine = new Map();
    for (const r of litersRows || []) {
      const mid = Number(r.maquina_id);
      const litros = Number(r.litros || 0); // já vem em litros do BQ
      litersByMachine.set(mid, litros);
    }

    // 2) metadados das máquinas (cidade/UF, nome, status) ainda via MySQL
    const [machines] = await pool.query(
      `
      SELECT
        m.id,
        COALESCE(m.nome, CONCAT('EQP-', m.id)) AS equipamento,
        c.nome AS cidade,
        c.uf   AS uf,
        m.status
      FROM maquinas m
      LEFT JOIN cidades c ON c.id = m.cidade_id
      WHERE m.id IN (?)
      `,
      [machineIds]
    );

    // 3) monta os pontos que o front usa no mapa
    const points = await Promise.all(
      (machines || []).map(async (m) => {
        const mid = Number(m.id);
        const litros = Number(litersByMachine.get(mid) || 0);

        // Normaliza status vindo do banco
        let statusNorm = (m.status ?? "").toString().trim().toLowerCase();

        // Se vier como código numérico (0 / 2), converte
        const sNum = Number(statusNorm);
        if (!Number.isNaN(sNum)) {
          if (sNum === 0) statusNorm = "ativo";
          else if (sNum === 2) statusNorm = "inativo";
        }

        // Se teve consumo no período, consideramos ativo
        if (litros > 0) {
          statusNorm = "ativo";
        }

        const status = statusNorm === "ativo" ? "Ativo" : "Inativo";

        // Coordenadas (cacheadas) da cidade
        const coords = await getCityCoords(pool, m.cidade, m.uf);

        return {
          lat: coords.lat,
          lng: coords.lng,
          cidade: m.cidade || "Sem Cidade",
          uf: m.uf || "",
          qtd: 1,
          status,
          litros,
          equipamento: m.equipamento,
        };
      })
    );

    res.json({
      points,
      _period: { from: fromStr, to: toStr, email: userEmail },
    });
  } catch (e) {
    console.error("Erro em /api/localizacao:", e);
    res.status(500).json({ error: String(e) });
  }
});

/* -------------------- Séries Water / Triggers -------------------- */

app.get("/api/series/water", async (req, res) => {
  try {
    const userEmail = req.userEmail || req.header("x-user-email");
    const { from, to } = req.query;

    // Período padrão = últimos 6 meses
    const defaultTo = new Date();
    const defaultFrom = new Date();
    defaultFrom.setMonth(defaultFrom.getMonth() - 5);

    const toStr =
      typeof to === "string" && to ? to : defaultTo.toISOString().slice(0, 10);
    const fromStr =
      typeof from === "string" && from
        ? from
        : defaultFrom.toISOString().slice(0, 10);

    // 1) máquinas visíveis ao usuário
    const machineIds = await resolveMachineIds(
      userEmail,
      req.query,
      req.isMaster
    );

    if (!machineIds.length) {
      return res.json({
        labels: [],
        series: [
          { key: "total", values: [] },
          { key: "fria", values: [] },
          { key: "quente", values: [] },
          { key: "pets", values: [] },
        ],
        _period: { from: fromStr, to: toStr, email: userEmail },
      });
    }

    // 2) Busca no BigQuery (já agrupa por mês e preenche com zeros)
    const rows = await getWaterSeriesFromBigQuery(machineIds, fromStr, toStr);

    // 3) Monta labels (meses)
    const labels = rows.map((r) => {
      const [y, m] = r.ym.split("-");
      const dt = new Date(Number(y), Number(m) - 1, 1);
      return dt
        .toLocaleDateString("pt-BR", { month: "short" })
        .replace(".", "");
    });

    // 4) Monta séries
    const series = [
      {
        key: "total",
        values: rows.map(
          (r) =>
            Number(r.sum_v_fria || 0) +
            Number(r.sum_v_quente || 0) +
            Number(r.sum_v_pet || 0)
        ),
      },
      {
        key: "fria",
        values: rows.map((r) => Number(r.sum_v_fria || 0)),
      },
      {
        key: "quente",
        values: rows.map((r) => Number(r.sum_v_quente || 0)),
      },
      {
        key: "pets",
        values: rows.map((r) => Number(r.sum_v_pet || 0)),
      },
    ];

    // Debug
    console.log("Water Series BQ:", {
      email: userEmail,
      machineIds,
      fromStr,
      toStr,
      rows,
    });

    res.json({
      labels,
      series,
      _period: { from: fromStr, to: toStr, email: userEmail },
    });
  } catch (e) {
    console.error("Erro em /api/series/water:", e);
    res.status(500).json({ error: String(e) });
  }
});

app.get("/api/series/triggers", async (req, res) => {
  try {
    const userEmail = req.userEmail || req.header("x-user-email");
    const { from, to } = req.query;

    // Período padrão – últimos 6 meses
    const defaultTo = new Date();
    const defaultFrom = new Date();
    defaultFrom.setMonth(defaultFrom.getMonth() - 5);

    const toStr =
      typeof to === "string" && to ? to : defaultTo.toISOString().slice(0, 10);
    const fromStr =
      typeof from === "string" && from
        ? from
        : defaultFrom.toISOString().slice(0, 10);

    // 1) máquinas visíveis ao usuário
    const machineIds = await resolveMachineIds(
      userEmail,
      req.query,
      req.isMaster
    );

    if (!machineIds.length) {
      return res.json({
        labels: [],
        series: [
          { key: "total", values: [] },
          { key: "fria", values: [] },
          { key: "quente", values: [] },
          { key: "pets", values: [] },
          { key: "aspersor", values: [] },
        ],
        _period: { from: fromStr, to: toStr, email: userEmail },
      });
    }

    // 2) Busca as séries mensais no BigQuery
    const rows = await getTriggerSeriesFromBigQuery(machineIds, fromStr, toStr);

    // 3) Labels (mês abreviado: jan, fev, mar…)
    const labels = rows.map((r) => {
      const [y, m] = r.ym.split("-");
      const dt = new Date(Number(y), Number(m) - 1, 1);
      return dt
        .toLocaleDateString("pt-BR", { month: "short" })
        .replace(".", "");
    });

    // 4) Séries
    const series = [
      {
        key: "total",
        values: rows.map(
          (r) =>
            Number(r.sum_c_fria || 0) +
            Number(r.sum_c_quente || 0) +
            Number(r.sum_c_pet || 0) +
            Number(r.sum_c_asp || 0)
        ),
      },
      { key: "fria", values: rows.map((r) => Number(r.sum_c_fria || 0)) },
      { key: "quente", values: rows.map((r) => Number(r.sum_c_quente || 0)) },
      { key: "pets", values: rows.map((r) => Number(r.sum_c_pet || 0)) },
      { key: "aspersor", values: rows.map((r) => Number(r.sum_c_asp || 0)) },
    ];

    // Debug útil
    console.log("Trigger Series BQ:", {
      email: userEmail,
      fromStr,
      toStr,
      machineIds,
      rows,
    });

    res.json({
      labels,
      series,
      _period: { from: fromStr, to: toStr, email: userEmail },
    });
  } catch (e) {
    console.error("Erro em /api/series/triggers:", e);
    res.status(500).json({ error: String(e) });
  }
});

/* -------- Séries - Instalações por mês / Acumulado -------- */

app.get("/api/series/installations", async (req, res) => {
  try {
    const userEmail = req.userEmail;
    const { from, to } = req.query;

    const defaultTo = new Date();
    const defaultFrom = new Date();
    defaultFrom.setMonth(defaultFrom.getMonth() - 5);

    const toStr =
      typeof to === "string" && to ? to : defaultTo.toISOString().slice(0, 10);
    const fromStr =
      typeof from === "string" && from
        ? from
        : defaultFrom.toISOString().slice(0, 10);

    const machineIds = await resolveMachineIds(
      userEmail,
      req.query,
      req.isMaster
    );
    if (!machineIds.length) {
      return res.json({
        labels: [],
        series: [{ key: "instalacoes", values: [] }],
        _period: { from: fromStr, to: toStr, email: userEmail },
      });
    }

    const [rows] = await pool.query(
      `
      SELECT
        DATE_FORMAT(m.data_instalacao, '%Y-%m') AS ym,
        COUNT(*) AS instalacoes
      FROM maquinas m
      WHERE m.id IN (?)
        AND m.data_instalacao IS NOT NULL
        AND m.data_instalacao >= ?
        AND m.data_instalacao < DATE_ADD(?, INTERVAL 1 DAY)
      GROUP BY ym
      ORDER BY ym
      `,
      [machineIds, fromStr, toStr]
    );

    const countsByYm = new Map();
    for (const r of rows) {
      countsByYm.set(r.ym, Number(r.instalacoes || 0));
    }

    const labels = [];
    const values = [];

    const start = new Date(
      fromStr.slice(0, 4),
      Number(fromStr.slice(5, 7)) - 1,
      1
    );
    const end = new Date(toStr.slice(0, 4), Number(toStr.slice(5, 7)) - 1, 1);

    for (let dt = new Date(start); dt <= end; dt.setMonth(dt.getMonth() + 1)) {
      const ym = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(
        2,
        "0"
      )}`;
      const label = dt
        .toLocaleString("pt-BR", { month: "short" })
        .replace(".", "");

      labels.push(label);
      values.push(countsByYm.get(ym) || 0);
    }

    res.json({
      labels,
      series: [{ key: "instalacoes", values }],
      _period: { from: fromStr, to: toStr, email: userEmail },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e) });
  }
});

app.get("/api/series/equipment-cumulative", async (req, res) => {
  try {
    const userEmail = req.userEmail;
    const { from, to } = req.query;

    const defaultTo = new Date();
    const defaultFrom = new Date();
    defaultFrom.setMonth(defaultFrom.getMonth() - 5);

    const toStr =
      typeof to === "string" && to ? to : defaultTo.toISOString().slice(0, 10);
    const fromStr =
      typeof from === "string" && from
        ? from
        : defaultFrom.toISOString().slice(0, 10);

    const machineIds = await resolveMachineIds(
      userEmail,
      req.query,
      req.isMaster
    );
    if (!machineIds.length) {
      return res.json({
        labels: [],
        series: [{ key: "acumulado", values: [] }],
        _period: { from: fromStr, to: toStr, email: userEmail },
      });
    }

    const [[prevRow]] = await pool.query(
      `
      SELECT COUNT(*) AS prev
      FROM maquinas m
      WHERE m.id IN (?)
        AND m.data_instalacao IS NOT NULL
        AND m.data_instalacao < ?
      `,
      [machineIds, fromStr]
    );
    let acumulado = Number(prevRow?.prev || 0);

    const [rows] = await pool.query(
      `
      SELECT
        DATE_FORMAT(m.data_instalacao, '%Y-%m') AS ym,
        COUNT(*) AS instalacoes
      FROM maquinas m
      WHERE m.id IN (?)
        AND m.data_instalacao IS NOT NULL
        AND m.data_instalacao >= ?
        AND m.data_instalacao < DATE_ADD(?, INTERVAL 1 DAY)
      GROUP BY ym
      ORDER BY ym
      `,
      [machineIds, fromStr, toStr]
    );

    const countsByYm = new Map();
    for (const r of rows) {
      countsByYm.set(r.ym, Number(r.instalacoes || 0));
    }

    const labels = [];
    const values = [];

    const start = new Date(
      Number(fromStr.slice(0, 4)),
      Number(fromStr.slice(5, 7)) - 1,
      1
    );
    const end = new Date(
      Number(toStr.slice(0, 4)),
      Number(toStr.slice(5, 7)) - 1,
      1
    );

    for (let dt = new Date(start); dt <= end; dt.setMonth(dt.getMonth() + 1)) {
      const ym = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(
        2,
        "0"
      )}`;
      const label = dt
        .toLocaleString("pt-BR", { month: "short" })
        .replace(".", "");

      const instalacoesMes = countsByYm.get(ym) || 0;
      acumulado += instalacoesMes;

      labels.push(label);
      values.push(acumulado);
    }

    res.json({
      labels,
      series: [{ key: "acumulado", values }],
      _period: { from: fromStr, to: toStr, email: userEmail },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e) });
  }
});

/* ---------------------- Pie de Modelos ---------------------- */

app.get("/api/models/pie", async (req, res) => {
  try {
    const userEmail = req.userEmail;
    const { from, to } = req.query;

    // Período padrão: últimos 30 dias
    const defaultTo = new Date();
    const defaultFrom = new Date();
    defaultFrom.setDate(defaultFrom.getDate() - 30);

    const toStr =
      typeof to === "string" && to ? to : defaultTo.toISOString().slice(0, 10);
    const fromStr =
      typeof from === "string" && from
        ? from
        : defaultFrom.toISOString().slice(0, 10);

    // Máquinas visíveis para o usuário
    const machineIds = await resolveMachineIds(
      userEmail,
      req.query,
      req.isMaster
    );

    if (!machineIds.length) {
      return res.json([]);
    }

    // 1) Busca litros por máquina no BigQuery (somando fria+quente+pet)
    const aggRows = await getEquipmentAggregatesFromBigQuery(
      machineIds,
      fromStr,
      toStr
    );

    if (!aggRows || !aggRows.length) {
      return res.json([]);
    }

    const litersByMachine = new Map();
    const idsFromAgg = [];

    for (const r of aggRows) {
      const id = Number(r.maquina_id);
      const litros =
        Number(r.sum_v_fria || 0) +
        Number(r.sum_v_quente || 0) +
        Number(r.sum_v_pet || 0);

      litersByMachine.set(id, litros);
      idsFromAgg.push(id);
    }

    if (!idsFromAgg.length) {
      return res.json([]);
    }

    // 2) Busca o modelo (tipo) de cada máquina no MySQL
    const [machines] = await pool.query(
      `
      SELECT
        m.id,
        COALESCE(NULLIF(t.nome, ''), 'Sem Modelo') AS modelo
      FROM maquinas m
      LEFT JOIN tipos t ON t.id = m.tipo_id
      WHERE m.id IN (?)
      `,
      [idsFromAgg]
    );

    // 3) Agrega litros por modelo
    const litersByModel = new Map();

    for (const m of machines || []) {
      const id = Number(m.id);
      const modelo = m.modelo || "Sem Modelo";
      const litros = litersByMachine.get(id) || 0;

      if (!litersByModel.has(modelo)) {
        litersByModel.set(modelo, 0);
      }
      litersByModel.set(modelo, litersByModel.get(modelo) + litros);
    }

    // 4) Monta o array para o pie (label, value), só modelos com > 0 litros
    const pie = Array.from(litersByModel.entries())
      .map(([label, value]) => ({
        label,
        value: Number(value || 0),
      }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);

    return res.json(pie);
  } catch (e) {
    console.error("Erro em /api/models/pie:", e);
    res.status(500).json({ error: String(e) });
  }
});

/* ---------------------- Tabela: Litros x Equip ---------------------- */

app.get("/api/tables/water-by-equipment", async (req, res) => {
  try {
    const userEmail = req.userEmail;
    const { from, to } = req.query;

    const defaultTo = new Date();
    const defaultFrom = new Date();
    defaultFrom.setDate(defaultFrom.getDate() - 30);

    const toStr =
      typeof to === "string" && to ? to : defaultTo.toISOString().slice(0, 10);
    const fromStr =
      typeof from === "string" && from
        ? from
        : defaultFrom.toISOString().slice(0, 10);

    // máquinas visíveis para o usuário
    const machineIds = await resolveMachineIds(
      userEmail,
      req.query,
      req.isMaster
    );

    if (!machineIds.length) {
      return res.json({
        columns: ["Equipamento", "Litros"],
        rows: [],
        total: 0,
        _period: { from: fromStr, to: toStr, email: userEmail },
      });
    }

    // 1) Busca litros por máquina no BigQuery (já em litros/dia, somados por período)
    const aggRows = await getEquipmentAggregatesFromBigQuery(
      machineIds,
      fromStr,
      toStr
    );

    if (!aggRows || !aggRows.length) {
      return res.json({
        columns: ["Equipamento", "Litros"],
        rows: [],
        total: 0,
        _period: { from: fromStr, to: toStr, email: userEmail },
      });
    }

    // 2) Mapeia litros totais por máquina
    const litersByMachine = new Map();
    const idsFromAgg = [];

    for (const r of aggRows) {
      const id = Number(r.maquina_id);
      const litros =
        Number(r.sum_v_fria || 0) +
        Number(r.sum_v_quente || 0) +
        Number(r.sum_v_pet || 0);

      litersByMachine.set(id, litros);
      idsFromAgg.push(id);
    }

    // 3) Busca nomes dos equipamentos no MySQL
    const [machines] = await pool.query(
      `
      SELECT
        m.id,
        COALESCE(NULLIF(m.nome,''), CONCAT('EQP-', m.id)) AS equipamento
      FROM maquinas m
      WHERE m.id IN (?)
      `,
      [idsFromAgg]
    );

    const nameById = new Map();
    for (const m of machines || []) {
      nameById.set(Number(m.id), m.equipamento);
    }

    // 4) Monta linhas da tabela e ordena por litros desc
    const tableRows = idsFromAgg
      .map((id) => {
        const nome = nameById.get(id) || `EQP-${id}`;
        const litros = litersByMachine.get(id) || 0;
        return [String(nome), litros];
      })
      .filter((row) => row[1] > 0) // só mostra quem teve consumo
      .sort((a, b) => Number(b[1]) - Number(a[1]));

    const columns = ["Equipamento", "Litros"];
    const total = tableRows.length;

    res.json({
      columns,
      rows: tableRows,
      total,
      _period: { from: fromStr, to: toStr, email: userEmail },
    });
  } catch (e) {
    console.error("Erro em /api/tables/water-by-equipment:", e);
    res.status(500).json({ error: String(e) });
  }
});

/* ----------------- Tabela: Lista de Equipamentos ----------------- */

app.get("/api/tables/equipment-list", async (req, res) => {
  try {
    const userEmail = req.userEmail;
    const { from, to } = req.query;

    // defaults (últimos 30 dias) — igual aos outros endpoints
    const defaultTo = new Date();
    const defaultFrom = new Date();
    defaultFrom.setDate(defaultFrom.getDate() - 30);

    const toStr =
      typeof to === "string" && to ? to : defaultTo.toISOString().slice(0, 10);
    const fromStr =
      typeof from === "string" && from
        ? from
        : defaultFrom.toISOString().slice(0, 10);

    // 1) máquinas visíveis / filtros (MySQL)
    const visibleMachineIds = await resolveMachineIds(
      userEmail,
      req.query,
      req.isMaster
    );

    if (!visibleMachineIds.length) {
      return res.json({
        columns: ["Equipamento", "Modelo", "Status", "Próx. troca filtro"],
        rows: [],
        total: 0,
        _period: { from: fromStr, to: toStr, email: userEmail },
      });
    }

    // 2) ✅ restringe para “máquinas com fato no período” (BigQuery)
    const aggRows = await getEquipmentAggregatesFromBigQuery(
      visibleMachineIds,
      fromStr,
      toStr
    );

    const usedIds = (aggRows || [])
      .map((r) => Number(r.maquina_id))
      .filter(Boolean);

    if (!usedIds.length) {
      return res.json({
        columns: ["Equipamento", "Modelo", "Status", "Próx. troca filtro"],
        rows: [],
        total: 0,
        _period: { from: fromStr, to: toStr, email: userEmail },
      });
    }

    // 3) busca detalhes no MySQL (só dos usados)
    const [rowsRaw] = await pool.query(
      `
      SELECT
        m.nome AS equipamento,
        t.nome AS modelo,
        m.status,
        m.data_instalacao
      FROM maquinas m
      LEFT JOIN tipos t ON m.tipo_id = t.id
      WHERE m.id IN (?)
      `,
      [usedIds]
    );

    const formatted = rowsRaw.map((r) => {
      const dataInst = r.data_instalacao ? new Date(r.data_instalacao) : null;
      if (dataInst) dataInst.setMonth(dataInst.getMonth() + 6);

      const proxTroca = dataInst
        ? dataInst.toISOString().slice(0, 10)
        : "Sem data";

      const statusNum = Number(r.status);

      let statusFormatado;
      if (statusNum === 0) statusFormatado = "Ativo";
      else if (statusNum === 1 || statusNum === 2) statusFormatado = "Inativo";
      else statusFormatado = "Desconhecido";

      return [r.equipamento, r.modelo, statusFormatado, proxTroca];
    });

    return res.json({
      columns: ["Equipamento", "Modelo", "Status", "Próx. troca filtro"],
      rows: formatted,
      total: formatted.length,
      _period: { from: fromStr, to: toStr, email: userEmail },
    });
  } catch (err) {
    console.error("Erro ao listar equipamentos:", err);
    res.status(500).json({ error: String(err) });
  }
});

/* ---------- Tabela: Acionamentos x Equipamentos ---------- */

app.get("/api/tables/triggers-by-equipment", async (req, res) => {
  try {
    const userEmail = req.userEmail;
    const { from, to } = req.query;

    const defaultTo = new Date();
    const defaultFrom = new Date();
    defaultFrom.setDate(defaultFrom.getDate() - 30);

    const toStr =
      typeof to === "string" && to ? to : defaultTo.toISOString().slice(0, 10);
    const fromStr =
      typeof from === "string" && from
        ? from
        : defaultFrom.toISOString().slice(0, 10);

    // máquinas visíveis para o usuário (ou todas, se master)
    const machineIds = await resolveMachineIds(
      userEmail,
      req.query,
      req.isMaster
    );

    if (!machineIds.length) {
      return res.json({
        columns: ["Equipamento", "Acionamentos"],
        rows: [],
        total: 0,
        _period: { from: fromStr, to: toStr, email: userEmail },
      });
    }

    // 1) Busca acionamentos por máquina no BigQuery
    const aggRows = await getEquipmentAggregatesFromBigQuery(
      machineIds,
      fromStr,
      toStr
    );

    if (!aggRows || !aggRows.length) {
      return res.json({
        columns: ["Equipamento", "Acionamentos"],
        rows: [],
        total: 0,
        _period: { from: fromStr, to: toStr, email: userEmail },
      });
    }

    // 2) Mapeia total de acionamentos por máquina
    const triggersByMachine = new Map();
    const idsFromAgg = [];

    for (const r of aggRows) {
      const id = Number(r.maquina_id);
      const acionamentos =
        Number(r.sum_c_fria || 0) +
        Number(r.sum_c_quente || 0) +
        Number(r.sum_c_pet || 0) +
        Number(r.sum_c_asp || 0);

      triggersByMachine.set(id, acionamentos);
      idsFromAgg.push(id);
    }

    // 3) Busca nomes dos equipamentos no MySQL
    const [machines] = await pool.query(
      `
      SELECT
        m.id,
        COALESCE(NULLIF(m.nome, ''), CONCAT('EQP-', m.id)) AS equipamento
      FROM maquinas m
      WHERE m.id IN (?)
      `,
      [idsFromAgg]
    );

    const nameById = new Map();
    for (const m of machines || []) {
      nameById.set(Number(m.id), m.equipamento);
    }

    // 4) Monta as linhas da tabela (apenas quem teve acionamento > 0)
    const tableRows = idsFromAgg
      .map((id) => {
        const nome = nameById.get(id) || `EQP-${id}`;
        const acionamentos = triggersByMachine.get(id) || 0;
        return [String(nome), acionamentos];
      })
      .filter((row) => row[1] > 0)
      .sort((a, b) => Number(b[1]) - Number(a[1]));

    const columns = ["Equipamento", "Acionamentos"];
    const total = tableRows.length;

    res.json({
      columns,
      rows: tableRows,
      total,
      _period: { from: fromStr, to: toStr, email: userEmail },
    });
  } catch (e) {
    console.error("Erro em /api/tables/triggers-by-equipment:", e);
    res.status(500).json({ error: String(e) });
  }
});

/* --------------------- KPIs e Summary de Localização --------------------- */

app.get("/api/kpis/equipment", async (req, res) => {
  try {
    const userEmail = req.userEmail;
    const { from, to } = req.query;

    const defaultTo = new Date();
    const defaultFrom = new Date();
    defaultFrom.setDate(defaultFrom.getDate() - 30);

    const toStr = to || defaultTo.toISOString().slice(0, 10);
    const fromStr = from || defaultFrom.toISOString().slice(0, 10);

    // 1) máquinas visíveis / filtros (MySQL)
    const visibleMachineIds = await resolveMachineIds(
      userEmail,
      req.query,
      req.isMaster
    );

    if (!visibleMachineIds.length) {
      return res.json({
        total_equipamentos: 0,
        ativos: 0,
        inativos: 0,
        _period: { from: fromStr, to: toStr, email: userEmail },
      });
    }

    // 2) ✅ restringe para “máquinas com fato no período” (BigQuery)
    const aggRows = await getEquipmentAggregatesFromBigQuery(
      visibleMachineIds,
      fromStr,
      toStr
    );

    const usedIds = (aggRows || [])
      .map((r) => Number(r.maquina_id))
      .filter(Boolean);

    if (!usedIds.length) {
      return res.json({
        total_equipamentos: 0,
        ativos: 0,
        inativos: 0,
        _period: { from: fromStr, to: toStr, email: userEmail },
      });
    }

    // 3) status (MySQL) apenas desses usados
    const [statusRows] = await pool.query(
      `SELECT m.status FROM maquinas m WHERE m.id IN (?)`,
      [usedIds]
    );

    let ativos = 0;
    let inativos = 0;

    for (const r of statusRows || []) {
      const s = Number(r.status);
      if (s === 0) ativos++;
      else if (s === 1 || s === 2) inativos++;
    }

    return res.json({
      total_equipamentos: statusRows.length,
      ativos,
      inativos,
      _period: { from: fromStr, to: toStr, email: userEmail },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e) });
  }
});

app.get("/api/location/kpis", async (req, res) => {
  try {
    const userEmail = req.userEmail;
    const { from, to } = req.query;

    const defaultTo = new Date();
    const defaultFrom = new Date();
    defaultFrom.setDate(defaultFrom.getDate() - 30);

    const toStr =
      typeof to === "string" && to ? to : defaultTo.toISOString().slice(0, 10);
    const fromStr =
      typeof from === "string" && from
        ? from
        : defaultFrom.toISOString().slice(0, 10);

    // 1) máquinas visíveis / filtros (MySQL)
    const visibleMachineIds = await resolveMachineIds(
      userEmail,
      req.query,
      req.isMaster
    );

    if (!visibleMachineIds.length) {
      return res.json({
        users_total: 0,
        equipamentos_ativos: 0,
        equipamentos_inativos: 0,
        _period: { from: fromStr, to: toStr, email: userEmail },
      });
    }

    // 2) ✅ restringe para “máquinas com fato no período” (BigQuery)
    const aggRows = await getEquipmentAggregatesFromBigQuery(
      visibleMachineIds,
      fromStr,
      toStr
    );

    const usedIds = (aggRows || [])
      .map((r) => Number(r.maquina_id))
      .filter(Boolean);

    if (!usedIds.length) {
      return res.json({
        users_total: 0,
        equipamentos_ativos: 0,
        equipamentos_inativos: 0,
        _period: { from: fromStr, to: toStr, email: userEmail },
      });
    }

    // 3) cidades (agora só das usadas)
    const [locRows] = await pool.query(
      `SELECT COUNT(DISTINCT m.cidade_id) AS qtd
         FROM maquinas m
        WHERE m.id IN (?)`,
      [usedIds]
    );
    const users_total = Number(locRows?.[0]?.qtd || 0);

    // 4) status (agora só das usadas) + regra correta
    const [statusRows] = await pool.query(
      `SELECT m.status
         FROM maquinas m
        WHERE m.id IN (?)`,
      [usedIds]
    );

    let equipamentos_ativos = 0;
    let equipamentos_inativos = 0;

    for (const r of statusRows || []) {
      const s = Number(r.status);
      if (s === 0) equipamentos_ativos++;
      else if (s === 1 || s === 2) equipamentos_inativos++;
    }

    return res.json({
      users_total,
      equipamentos_ativos,
      equipamentos_inativos,
      _period: { from: fromStr, to: toStr, email: userEmail },
    });
  } catch (e) {
    console.error("Erro em /api/location/kpis:", e);
    res.status(500).json({ error: String(e) });
  }
});

app.get("/api/location/summary", async (req, res) => {
  try {
    const userEmail = req.userEmail;
    const { from, to } = req.query;

    // Período padrão: últimos 30 dias
    const defaultTo = new Date();
    const defaultFrom = new Date();
    defaultFrom.setDate(defaultFrom.getDate() - 30);

    const toStr =
      typeof to === "string" && to ? to : defaultTo.toISOString().slice(0, 10);
    const fromStr =
      typeof from === "string" && from
        ? from
        : defaultFrom.toISOString().slice(0, 10);

    // Máquinas visíveis conforme filtros/usuário
    const machineIds = await resolveMachineIds(
      userEmail,
      req.query,
      req.isMaster
    );

    if (!machineIds.length) {
      return res.json({
        columns: [
          "Localização",
          "Total de Equipamentos",
          "Ativos no período",
          "Inativos no período",
          "Litros no período",
        ],
        rows: [],
        total: 0,
        _period: { from: fromStr, to: toStr, email: userEmail },
      });
    }

    // 1) Litros por máquina no BigQuery (mesma base do resto do dash)
    const litersRows = await getLitersByMachineFromBigQuery(
      machineIds,
      fromStr,
      toStr
    );

    const litersByMachine = new Map();
    for (const r of litersRows || []) {
      const mid = Number(r.maquina_id);
      const litros = Number(r.litros || 0);
      litersByMachine.set(mid, litros);
    }

    // 2) Busca cidades + status dos equipamentos no MySQL
    const [locations] = await pool.query(
      `
      SELECT
        m.id          AS maquina_id,
        COALESCE(c.nome, CONCAT('Cidade ', m.cidade_id)) AS cidade,
        c.uf          AS uf,
        m.status      AS status
      FROM maquinas m
      LEFT JOIN cidades c ON c.id = m.cidade_id
      WHERE m.id IN (?)
      `,
      [machineIds]
    );

    // 3) Agrupa por cidade, usando a MESMA regra de ativo/inativo do mapa
    const mapCidade = new Map();

    for (const row of locations || []) {
      const mid = Number(row.maquina_id);
      const cidade = row.cidade || "Sem Cidade";
      const uf = row.uf || "";
      const litros = litersByMachine.get(mid) || 0;

      // Normaliza status vindo do banco (0/2, texto etc.)
      let statusNorm = (row.status ?? "").toString().trim().toLowerCase();
      const sNum = Number(statusNorm);
      if (!Number.isNaN(sNum)) {
        if (sNum === 0) statusNorm = "ativo";
        else if (sNum === 2) statusNorm = "inativo";
      }

      // Mesma regra do /api/localizacao:
      // se teve consumo no período, consideramos ATIVO
      if (litros > 0) {
        statusNorm = "ativo";
      }

      const isAtivo = statusNorm === "ativo";

      const key = `${cidade}__${uf}`;

      if (!mapCidade.has(key)) {
        mapCidade.set(key, {
          cidade,
          uf,
          total: 0,
          ativos: 0,
          litrosTotal: 0,
        });
      }

      const item = mapCidade.get(key);
      item.total += 1;
      item.litrosTotal += litros;
      if (isAtivo) {
        item.ativos += 1;
      }
    }

    // 4) Monta linhas da tabela
    const rows = [];

    for (const [, item] of mapCidade.entries()) {
      const inativos = Math.max(item.total - item.ativos, 0);

      rows.push([
        `${item.cidade}${item.uf ? "/" + item.uf : ""}`,
        Math.round(item.total),
        Math.round(item.ativos),
        Math.round(item.inativos),
        item.litrosTotal,
      ]);
    }

    // Ordena por litros desc
    rows.sort((a, b) => Number(b[4]) - Number(a[4]));

    res.json({
      columns: [
        "Localização",
        "Total de Equipamentos",
        "Ativos no período",
        "Inativos no período",
        "Litros no período",
      ],
      rows,
      total: rows.length,
      _period: { from: fromStr, to: toStr, email: userEmail },
    });
  } catch (e) {
    console.error("Erro em /api/location/summary:", e);
    res.status(500).json({ error: String(e) });
  }
});

/* ------------------------- Filtros Options ------------------------- */

app.get("/api/filters", async (req, res) => {
  try {
    const userEmail = req.userEmail;
    const isMaster = !!req.isMaster;

    const machineIds = await getUserMachineIds(userEmail, isMaster);

    const status = [
      { value: "0", label: "Ativo" },
      { value: "2", label: "Inativo" },
    ];

    if (!machineIds.length) {
      return res.json({
        usuarios: [],
        modelos: [],
        equipamentos: [],
        series: [],
        status,
        _email: userEmail,
      });
    }

    let usuarios = [];

    if (isMaster) {
      const [userRows] = await pool.query(
        `
        SELECT DISTINCT u.id,
               u.email,
               COALESCE(u.name, u.email) AS label
          FROM users u
          JOIN usuarios_equipamentos ue ON ue.usuario_id = u.id
          JOIN maquinas m ON m.id = ue.maquina_id
         WHERE m.id IN (?)
         ORDER BY label
        `,
        [machineIds]
      );

      usuarios = userRows.map((u) => ({
        value: u.id,
        label: u.label,
        email: u.email,
      }));
    } else {
      const [userRows] = await pool.query(
        `SELECT id, email, COALESCE(name, email) AS label
           FROM users WHERE email = ? LIMIT 1`,
        [userEmail]
      );

      usuarios = (userRows || []).map((u) => ({
        value: u.id,
        label: u.label,
        email: u.email,
      }));
    }

    const [modelRows] = await pool.query(
      `
      SELECT DISTINCT COALESCE(NULLIF(t.nome,''), 'Sem Modelo') AS nome, t.id
        FROM maquinas m
   LEFT JOIN tipos t ON t.id = m.tipo_id
       WHERE m.id IN (?)
    ORDER BY nome
      `,
      [machineIds]
    );
    const modelos = modelRows.map((r) => ({
      value: Number(r.id || 0),
      label: r.nome,
    }));

    const [equipRows] = await pool.query(
      `
      SELECT
        m.id,
        COALESCE(NULLIF(m.nome,''), CONCAT('EQP-', m.id)) AS nome,
        m.data_instalacao
      FROM maquinas m
      WHERE m.id IN (?)
      ORDER BY nome
      `,
      [machineIds]
    );

    const equipamentos = equipRows.map((r) => ({
      value: r.id,
      label: r.nome,
      // yyyy-mm-dd ou null
      installedAt: r.data_instalacao
        ? new Date(r.data_instalacao).toISOString().slice(0, 10)
        : null,
    }));

    const [seriesRows] = await pool.query(
      `
      SELECT DISTINCT
             COALESCE(
               NULLIF(m.numeroSerieEquipamento,''),
               NULLIF(m.serialNumber,''),
               CONCAT('SN-', m.id)
             ) AS serie
        FROM maquinas m
       WHERE m.id IN (?)
    ORDER BY serie
      `,
      [machineIds]
    );
    const series = seriesRows
      .filter((r) => !!r.serie)
      .map((r) => ({ value: r.serie, label: r.serie }));

    res.json({
      usuarios,
      modelos,
      equipamentos,
      series,
      status,
      _email: userEmail,
      _isMaster: isMaster,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e) });
  }
});

/* ----------------------------- Debug ----------------------------- */

app.get("/api/_debug/user-machines", async (req, res) => {
  try {
    const email = req.userEmail;
    const [rows] = await pool.query(
      `SELECT u.id AS user_id, u.email, ue.maquina_id
         FROM users u
         LEFT JOIN usuarios_equipamentos ue ON ue.usuario_id = u.id
        WHERE u.email = ?`,
      [email]
    );
    res.json({
      email,
      machineIds: rows.map((r) => r.maquina_id).filter(Boolean),
      rows,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

/* ----------------------------- Boot ----------------------------- */

const PORT = Number(process.env.PORT) || 8080;
app.listen(PORT, () => {
  console.log(`API rodando em http://localhost:${PORT}`);
});
