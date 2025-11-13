const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const { pool } = require("./db.cjs");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const app = express();
const fetch = require("node-fetch");

const MASTER_EMAILS = [
  "contato@icehot.net.br",
  "contato@devontecnologia.com.br",
];
/* --------------------------- CORS --------------------------- */
// Em dev: libera geral. Em produção: ajuste os domínios.
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

// Middleware global que já responde o preflight ANTES do auth
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

// Responder preflight sem exigir auth

app.use(express.json());

/* --------------------- Config / Helpers --------------------- */

const LITERS_SCALE = 0.001;
const BOTTLE_LITERS = 0.5;
const CO2_PER_LITER_M3 = 0.00003;

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

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
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

  // chave sem acento e sem múltiplos espaços
  const cidadeSlim = removeDiacritics(cidade).replace(/\s+/g, " ");
  return {
    cidade, // mantém original p/ exibir
    uf, // UF em maiúsculo
    keyCidade: cidadeSlim.toLowerCase(), // p/ comparar/buscar
  };
}

async function getCityCoords(pool, cidadeRaw, ufRaw) {
  const { cidade, uf, keyCidade } = normalizeCityUf(cidadeRaw, ufRaw);

  // sem cidade/UF → sem coordenada (deixa null para não “forçar” centro do BR)
  if (!cidade || !uf) {
    return { lat: null, lng: null, source: "missing" };
  }

  // 1) cache exato
  const [hit1] = await pool.query(
    "SELECT lat, lng FROM city_coords WHERE cidade = ? AND uf = ? LIMIT 1",
    [cidade, uf]
  );
  if (hit1.length) {
    return {
      lat: Number(hit1[0].lat),
      lng: Number(hit1[0].lng),
      source: "cache",
    };
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
    return {
      lat: Number(hit2[0].lat),
      lng: Number(hit2[0].lng),
      source: "cache-slim",
    };
  }

  // 3) não chama Nominatim aqui; deixa faltando para semear depois
  return { lat: null, lng: null, source: "missing" };
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

  if (isMaster) {
    const [rows] = await pool.query(`SELECT id FROM maquinas`);
    baseIds = rows.map((r) => r.id);
  } else {
    const [baseRows] = await pool.query(
      `SELECT ue.maquina_id
         FROM users u
         JOIN usuarios_equipamentos ue ON ue.usuario_id = u.id
        WHERE u.email = ?`,
      [userEmail]
    );
    baseIds = baseRows.map((r) => r.maquina_id);
  }

  if (!baseIds.length) return [];

  // atalho: equipamento específico
  if (equipamento) {
    return baseIds.includes(equipamento) ? [equipamento] : [];
  }

  const where = [`m.id IN (?)`];
  const params = [baseIds];

  if (modelo) {
    where.push(`m.tipo_id = ?`);
    params.push(modelo);
  }

  if (serie) {
    where.push(`(m.numeroSerieEquipamento = ? OR m.serialNumber = ?)`);
    params.push(serie, serie);
  }

  if (usuario) {
    // mantém: filtra por relação com usuarios_equipamentos
    where.push(`EXISTS (
      SELECT 1 FROM usuarios_equipamentos ue
      WHERE ue.usuario_id = ? AND ue.maquina_id = m.id
    )`);
    params.push(usuario);
  }

  // status especial Ativo/Inativo baseado em leituras
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
      params[0] = baseIds;
    } else {
      // status textual do campo m.status
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
/* ---------------------- Middleware Auth JWT ---------------------- */

app.use((req, res, next) => {
  // preflight NUNCA exige autenticação
  if (req.method === "OPTIONS") return res.sendStatus(204);
  // rotas públicas
  if (PUBLIC_PATHS.has(req.path)) return next();

  // login aberto
  if (req.path === "/api/auth/login") return next();

  const auth = req.header("authorization");
  const legacyEmail = req.header("x-user-email");

  if (auth && auth.startsWith("Bearer ")) {
    const token = auth.slice(7);
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
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
    const userEmail = req.userEmail;
    const { from, to } = req.query;

    const defaultTo = new Date();
    const defaultFrom = new Date();
    defaultFrom.setDate(defaultFrom.getDate() - 30);

    const toStr = to || defaultTo.toISOString().slice(0, 10);
    const fromStr = from || defaultFrom.toISOString().slice(0, 10);

    const toPlus1 = new Date(toStr);
    toPlus1.setDate(toPlus1.getDate() + 1);
    const toPlus1Str = toPlus1.toISOString().slice(0, 10);

    const machineIds = await resolveMachineIds(
      userEmail,
      req.query,
      req.isMaster
    );
    if (!machineIds.length) {
      return res.json({
        water: { total: 0, fria: 0, quente: 0, pets: 0 },
        triggers: {
          total: 0,
          fria: 0,
          quente: 0,
          pets: 0,
          aspersor: 0,
        },
        equipamentos_utilizados: 0,
        garrafas_poupadas: 0,
        co2_poupado_m3: 0,
        _period: { from: fromStr, to: toStr, email: userEmail },
      });
    }

    const perMachineDeltaSql = `
      SELECT
        DATE(inf.created_at) AS d,
        GREATEST(
          (MAX(COALESCE(NULLIF(inf.vazao_agua_fria,   ''), '0') + 0) -
           MIN(COALESCE(NULLIF(inf.vazao_agua_fria,   ''), '0') + 0)), 0
        ) AS water_fria_delta,
        GREATEST(
          (MAX(COALESCE(NULLIF(inf.vazao_agua_quente, ''), '0') + 0) -
           MIN(COALESCE(NULLIF(inf.vazao_agua_quente, ''), '0') + 0)), 0
        ) AS water_quente_delta,
        GREATEST(
          (MAX(COALESCE(NULLIF(inf.vazao_agua_pet,    ''), '0') + 0) -
           MIN(COALESCE(NULLIF(inf.vazao_agua_pet,    ''), '0') + 0)), 0
        ) AS water_pets_delta,
        GREATEST(
          (MAX(COALESCE(NULLIF(inf.contador_acionamentos_agua_fria,   ''), '0') + 0) -
           MIN(COALESCE(NULLIF(inf.contador_acionamentos_agua_fria,   ''), '0') + 0)), 0
        ) AS trg_fria_delta,
        GREATEST(
          (MAX(COALESCE(NULLIF(inf.contador_acionamentos_agua_quente, ''), '0') + 0) -
           MIN(COALESCE(NULLIF(inf.contador_acionamentos_agua_quente, ''), '0') + 0)), 0
        ) AS trg_quente_delta,
        GREATEST(
          (MAX(COALESCE(NULLIF(inf.contador_acionamentos_agua_pet,    ''), '0') + 0) -
           MIN(COALESCE(NULLIF(inf.contador_acionamentos_agua_pet,    ''), '0') + 0)), 0
        ) AS trg_pets_delta,
        GREATEST(
          (MAX(COALESCE(NULLIF(inf.contador_acionamentos_aspersor,    ''), '0') + 0) -
           MIN(COALESCE(NULLIF(inf.contador_acionamentos_aspersor,    ''), '0') + 0)), 0
        ) AS trg_aspersor_delta
      FROM informacoes inf FORCE INDEX (idx_informacoes_maquina_created)
      WHERE inf.maquina_id = ?
        AND inf.created_at >= ?
        AND inf.created_at < ?
      GROUP BY d
    `;

    const nz = (x) => Math.max(0, Number(x ?? 0));

    let sum_fria = 0,
      sum_quente = 0,
      sum_pets = 0;
    let sum_trg_fria = 0,
      sum_trg_quente = 0,
      sum_trg_pets = 0,
      sum_trg_aspersor = 0;

    await Promise.all(
      machineIds.map(async (mid) => {
        const [rows] = await pool.query(perMachineDeltaSql, [
          mid,
          fromStr,
          toPlus1Str,
        ]);
        for (const r of rows) {
          sum_fria += nz(r.water_fria_delta) * LITERS_SCALE;
          sum_quente += nz(r.water_quente_delta) * LITERS_SCALE;
          sum_pets += nz(r.water_pets_delta) * LITERS_SCALE;

          sum_trg_fria += nz(r.trg_fria_delta);
          sum_trg_quente += nz(r.trg_quente_delta);
          sum_trg_pets += nz(r.trg_pets_delta);
          sum_trg_aspersor += nz(r.trg_aspersor_delta);
        }
      })
    );

    const water_total = sum_fria + sum_quente + sum_pets;
    const trg_total =
      sum_trg_fria + sum_trg_quente + sum_trg_pets + sum_trg_aspersor;

    const equipamentos_utilizados = machineIds.length;
    const garrafas_poupadas = water_total / BOTTLE_LITERS;
    const co2_poupado_m3 = water_total * CO2_PER_LITER_M3;

    res.json({
      water: {
        total: water_total,
        fria: sum_fria,
        quente: sum_quente,
        pets: sum_pets,
      },
      triggers: {
        total: trg_total,
        fria: sum_trg_fria,
        quente: sum_trg_quente,
        pets: sum_trg_pets,
        aspersor: sum_trg_aspersor,
      },
      equipamentos_utilizados,
      garrafas_poupadas,
      co2_poupado_m3,
      _period: { from: fromStr, to: toStr, email: userEmail },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e) });
  }
});

// ===== Localização (mapa - por equipamento, alinhado com KPIs) =====
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

    // [from, to+1)
    const toPlus1 = new Date(toStr);
    toPlus1.setDate(toPlus1.getDate() + 1);
    const toPlus1Str = toPlus1.toISOString().slice(0, 10);

    // máquinas visíveis (usuário normal ou master, com filtros)
    const machineIds = await resolveMachineIds(
      userEmail,
      req.query,
      req.isMaster
    );

    if (!machineIds.length) {
      return res.json({
        points: [],
        _period: { from: fromStr, to: toStr, email: userEmail || null },
      });
    }

    // 1) calcula litros por máquina usando a MESMA lógica do /api/kpis
    const perMachineDeltaSql = `
      SELECT
        DATE(inf.created_at) AS d,
        GREATEST(
          (MAX(COALESCE(NULLIF(inf.vazao_agua_fria,   ''), '0') + 0) -
           MIN(COALESCE(NULLIF(inf.vazao_agua_fria,   ''), '0') + 0)), 0
        ) AS water_fria_delta,
        GREATEST(
          (MAX(COALESCE(NULLIF(inf.vazao_agua_quente, ''), '0') + 0) -
           MIN(COALESCE(NULLIF(inf.vazao_agua_quente, ''), '0') + 0)), 0
        ) AS water_quente_delta,
        GREATEST(
          (MAX(COALESCE(NULLIF(inf.vazao_agua_pet,    ''), '0') + 0) -
           MIN(COALESCE(NULLIF(inf.vazao_agua_pet,    ''), '0') + 0)), 0
        ) AS water_pets_delta
      FROM informacoes inf FORCE INDEX (idx_informacoes_maquina_created)
      WHERE inf.maquina_id = ?
        AND inf.created_at >= ?
        AND inf.created_at < ?
      GROUP BY d
    `;

    const litersByMachine = new Map();

    await Promise.all(
      machineIds.map(async (mid) => {
        const [rows] = await pool.query(perMachineDeltaSql, [
          mid,
          fromStr,
          toPlus1Str,
        ]);

        let sum = 0;
        for (const r of rows || []) {
          const fria = Number(r.water_fria_delta || 0);
          const quente = Number(r.water_quente_delta || 0);
          const pets = Number(r.water_pets_delta || 0);
          sum += fria + quente + pets;
        }

        const litros = sum * LITERS_SCALE;
        litersByMachine.set(mid, litros);
      })
    );

    // 2) busca metadados das máquinas (cidade/UF, nome, status)
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

    // 3) monta os pontos que o MapView usa
    const points = await Promise.all(
      (machines || []).map(async (m) => {
        const litros = Number(litersByMachine.get(m.id) || 0);

        // Normaliza status vindo do banco
        let statusNorm = (m.status ?? "").toString().trim().toLowerCase();

        // Se vier como código numérico (0 / 2), converte
        const sNum = Number(statusNorm);
        if (!Number.isNaN(sNum)) {
          if (sNum === 0) statusNorm = "ativo";
          else if (sNum === 2) statusNorm = "inativo";
        }

        // Regra “uso no período”: se teve consumo, consideramos ativo
        if (litros > 0) {
          statusNorm = "ativo";
        }

        const status = statusNorm === "ativo" ? "Ativo" : "Inativo";

        // busca coordenadas (cache local)
        const coords = await getCityCoords(pool, m.cidade, m.uf);

        return {
          lat: coords.lat,
          lng: coords.lng,
          cidade: m.cidade || "Sem cidade",
          uf: m.uf || "",
          qtd: 1,
          litros,
          status,
          equipamento: m.equipamento,
        };
      })
    );

    res.json({
      points,
      _period: { from: fromStr, to: toStr, email: userEmail || null },
    });
  } catch (e) {
    console.error("Erro em /api/localizacao:", e);
    res.status(500).json({ error: String(e) });
  }
});

/* -------------------- Séries Water / Triggers -------------------- */

app.get("/api/series/water", async (req, res) => {
  try {
    const userEmail = req.userEmail;
    const { from, to } = req.query;

    const defaultTo = new Date();
    const defaultFrom = new Date();
    defaultFrom.setMonth(defaultFrom.getMonth() - 5);

    const toStr = to || defaultTo.toISOString().slice(0, 10);
    const fromStr = from || defaultFrom.toISOString().slice(0, 10);

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

    const [rows] = await pool.query(
      `
      SELECT
        DATE_FORMAT(dia, '%Y-%m') AS ym,
        SUM(w_fria)   AS fria,
        SUM(w_quente) AS quente,
        SUM(w_pets)   AS pets
      FROM (
        SELECT
          DATE(inf.created_at) AS dia,
          GREATEST(
            (MAX(COALESCE(NULLIF(inf.vazao_agua_fria, ''), '0') + 0) -
             MIN(COALESCE(NULLIF(inf.vazao_agua_fria, ''), '0') + 0)), 0
          ) AS w_fria,
          GREATEST(
            (MAX(COALESCE(NULLIF(inf.vazao_agua_quente, ''), '0') + 0) -
             MIN(COALESCE(NULLIF(inf.vazao_agua_quente, ''), '0') + 0)), 0
          ) AS w_quente,
          GREATEST(
            (MAX(COALESCE(NULLIF(inf.vazao_agua_pet, ''), '0') + 0) -
             MIN(COALESCE(NULLIF(inf.vazao_agua_pet, ''), '0') + 0)), 0
          ) AS w_pets
        FROM informacoes inf FORCE INDEX (idx_informacoes_maquina_created)
        WHERE inf.maquina_id IN (?)
          AND inf.created_at >= ?
          AND inf.created_at < DATE_ADD(?, INTERVAL 1 DAY)
        GROUP BY dia, inf.maquina_id
      ) d
      GROUP BY ym
      ORDER BY ym
      `,
      [machineIds, fromStr, toStr]
    );

    const labels = rows.map((r) => {
      const [y, m] = r.ym.split("-");
      const dt = new Date(Number(y), Number(m) - 1, 1);
      return dt.toLocaleString("pt-BR", { month: "short" }).replace(".", "");
    });

    const series = [
      {
        key: "total",
        values: rows.map(
          (r) =>
            (Number(r.fria || 0) +
              Number(r.quente || 0) +
              Number(r.pets || 0)) *
            LITERS_SCALE
        ),
      },
      {
        key: "fria",
        values: rows.map((r) => Number(r.fria || 0) * LITERS_SCALE),
      },
      {
        key: "quente",
        values: rows.map((r) => Number(r.quente || 0) * LITERS_SCALE),
      },
      {
        key: "pets",
        values: rows.map((r) => Number(r.pets || 0) * LITERS_SCALE),
      },
    ];

    res.json({
      labels,
      series,
      _period: { from: fromStr, to: toStr, email: userEmail },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e) });
  }
});

app.get("/api/series/triggers", async (req, res) => {
  try {
    const userEmail = req.userEmail;
    const { from, to } = req.query;

    const defaultTo = new Date();
    const defaultFrom = new Date();
    defaultFrom.setMonth(defaultFrom.getMonth() - 5);

    const toStr = to || defaultTo.toISOString().slice(0, 10);
    const fromStr = from || defaultFrom.toISOString().slice(0, 10);

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

    const [rows] = await pool.query(
      `
      SELECT
        DATE_FORMAT(dia, '%Y-%m') AS ym,
        SUM(t_fria)     AS fria,
        SUM(t_quente)   AS quente,
        SUM(t_pets)     AS pets,
        SUM(t_aspersor) AS aspersor
      FROM (
        SELECT
          DATE(inf.created_at) AS dia,
          GREATEST(
            (MAX(COALESCE(NULLIF(inf.contador_acionamentos_agua_fria, ''), '0') + 0) -
             MIN(COALESCE(NULLIF(inf.contador_acionamentos_agua_fria, ''), '0') + 0)), 0
          ) AS t_fria,
          GREATEST(
            (MAX(COALESCE(NULLIF(inf.contador_acionamentos_agua_quente, ''), '0') + 0) -
             MIN(COALESCE(NULLIF(inf.contador_acionamentos_agua_quente, ''), '0') + 0)), 0
          ) AS t_quente,
          GREATEST(
            (MAX(COALESCE(NULLIF(inf.contador_acionamentos_agua_pet, ''), '0') + 0) -
             MIN(COALESCE(NULLIF(inf.contador_acionamentos_agua_pet, ''), '0') + 0)), 0
          ) AS t_pets,
          GREATEST(
            (MAX(COALESCE(NULLIF(inf.contador_acionamentos_aspersor, ''), '0') + 0) -
             MIN(COALESCE(NULLIF(inf.contador_acionamentos_aspersor, ''), '0') + 0)), 0
          ) AS t_aspersor
        FROM informacoes inf FORCE INDEX (idx_informacoes_maquina_created)
        WHERE inf.maquina_id IN (?)
          AND inf.created_at >= ?
          AND inf.created_at < DATE_ADD(?, INTERVAL 1 DAY)
        GROUP BY dia, inf.maquina_id
      ) d
      GROUP BY ym
      ORDER BY ym
      `,
      [machineIds, fromStr, toStr]
    );

    const labels = rows.map((r) => {
      const [y, m] = r.ym.split("-");
      const dt = new Date(Number(y), Number(m) - 1, 1);
      return dt.toLocaleString("pt-BR", { month: "short" }).replace(".", "");
    });

    const series = [
      {
        key: "total",
        values: rows.map(
          (r) =>
            Number(r.fria || 0) +
            Number(r.quente || 0) +
            Number(r.pets || 0) +
            Number(r.aspersor || 0)
        ),
      },
      { key: "fria", values: rows.map((r) => Number(r.fria || 0)) },
      { key: "quente", values: rows.map((r) => Number(r.quente || 0)) },
      { key: "pets", values: rows.map((r) => Number(r.pets || 0)) },
      { key: "aspersor", values: rows.map((r) => Number(r.aspersor || 0)) },
    ];

    res.json({
      labels,
      series,
      _period: { from: fromStr, to: toStr, email: userEmail },
    });
  } catch (e) {
    console.error(e);
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

    const defaultTo = new Date();
    const defaultFrom = new Date();
    defaultFrom.setDate(defaultFrom.getDate() - 30);

    const toStr = to || defaultTo.toISOString().slice(0, 10);
    const fromStr = from || defaultFrom.toISOString().slice(0, 10);

    const machineIds = await resolveMachineIds(
      userEmail,
      req.query,
      req.isMaster
    );
    if (!machineIds.length) {
      return res.json([]);
    }

    const [rows] = await pool.query(
      `
      SELECT
        x.label,
        SUM(x.delta) AS value
      FROM (
        SELECT
          COALESCE(t.nome, 'Sem Modelo') AS label,
          GREATEST(
            (MAX(COALESCE(NULLIF(inf.vazao_agua_fria, ''), '0') + 0) -
             MIN(COALESCE(NULLIF(inf.vazao_agua_fria, ''), '0') + 0)), 0
          ) +
          GREATEST(
            (MAX(COALESCE(NULLIF(inf.vazao_agua_quente, ''), '0') + 0) -
             MIN(COALESCE(NULLIF(inf.vazao_agua_quente, ''), '0') + 0)), 0
          ) +
          GREATEST(
            (MAX(COALESCE(NULLIF(inf.vazao_agua_pet, ''), '0') + 0) -
             MIN(COALESCE(NULLIF(inf.vazao_agua_pet, ''), '0') + 0)), 0
          ) AS delta
        FROM informacoes inf FORCE INDEX (idx_informacoes_maquina_created)
        JOIN maquinas m ON m.id = inf.maquina_id
        LEFT JOIN tipos t ON t.id = m.tipo_id
        WHERE inf.maquina_id IN (?)
          AND inf.created_at >= ?
          AND inf.created_at < DATE_ADD(?, INTERVAL 1 DAY)
        GROUP BY DATE(inf.created_at), m.id, label
      ) x
      GROUP BY x.label
      ORDER BY value DESC
      `,
      [machineIds, fromStr, toStr]
    );

    const pie = rows.map((r) => ({
      label: r.label,
      value: Number(r.value || 0) * LITERS_SCALE,
    }));

    res.json(pie);
  } catch (e) {
    console.error(e);
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

    const toStr = to || defaultTo.toISOString().slice(0, 10);
    const fromStr = from || defaultFrom.toISOString().slice(0, 10);

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

    const [rows] = await pool.query(
      `
      SELECT
        x.equipamento_id,
        x.equipamento,
        SUM(x.delta) AS litros
      FROM (
        SELECT
          m.id AS equipamento_id,
          COALESCE(NULLIF(m.nome,''), CONCAT('EQP-', m.id)) AS equipamento,
          GREATEST(
            (MAX(COALESCE(NULLIF(inf.vazao_agua_fria, ''), '0') + 0) -
             MIN(COALESCE(NULLIF(inf.vazao_agua_fria, ''), '0') + 0)), 0
          ) +
          GREATEST(
            (MAX(COALESCE(NULLIF(inf.vazao_agua_quente, ''), '0') + 0) -
             MIN(COALESCE(NULLIF(inf.vazao_agua_quente, ''), '0') + 0)), 0
          ) +
          GREATEST(
            (MAX(COALESCE(NULLIF(inf.vazao_agua_pet, ''), '0') + 0) -
             MIN(COALESCE(NULLIF(inf.vazao_agua_pet, ''), '0') + 0)), 0
          ) AS delta
        FROM informacoes inf FORCE INDEX (idx_informacoes_maquina_created)
        JOIN maquinas m ON m.id = inf.maquina_id
        WHERE inf.maquina_id IN (?)
          AND inf.created_at >= ?
          AND inf.created_at < DATE_ADD(?, INTERVAL 1 DAY)
        GROUP BY DATE(inf.created_at), m.id, equipamento
      ) x
      GROUP BY x.equipamento_id, x.equipamento
      ORDER BY litros DESC
      `,
      [machineIds, fromStr, toStr]
    );

    const columns = ["Equipamento", "Litros"];
    const tableRows = rows.map((r) => [
      String(r.equipamento),
      Number(r.litros || 0) * LITERS_SCALE,
    ]);
    const total = rows.length;

    res.json({
      columns,
      rows: tableRows,
      total,
      _period: { from: fromStr, to: toStr, email: userEmail },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e) });
  }
});

/* ----------------- Tabela: Lista de Equipamentos ----------------- */

app.get("/api/tables/equipment-list", async (req, res) => {
  try {
    const userEmail = req.userEmail;
    const { from, to } = req.query;

    const machineIds = await resolveMachineIds(
      userEmail,
      req.query,
      req.isMaster
    );

    if (!machineIds.length) {
      return res.json({
        columns: ["Equipamento", "Modelo", "Status", "Próx. troca filtro"],
        rows: [],
        total: 0,
        _period: { from, to, email: userEmail },
      });
    }

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
      [machineIds]
    );

    const formatted = rowsRaw.map((r) => {
      const dataInst = r.data_instalacao ? new Date(r.data_instalacao) : null;
      if (dataInst) dataInst.setMonth(dataInst.getMonth() + 6);
      const proxTroca = dataInst
        ? dataInst.toISOString().slice(0, 10)
        : "Sem data";

      // 👇 Ajuste da regra de status: 0 = Ativo, 2 = Inativo
      const statusNum = Number(r.status);

      let statusFormatado;
      if (statusNum === 0) {
        statusFormatado = "Ativo";
      } else if (statusNum === 2) {
        statusFormatado = "Inativo";
      } else {
        statusFormatado = "Desconhecido";
      }

      return [r.equipamento, r.modelo, statusFormatado, proxTroca];
    });

    res.json({
      columns: ["Equipamento", "Modelo", "Status", "Próx. troca filtro"],
      rows: formatted,
      total: formatted.length,
      _period: { from, to, email: userEmail },
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

    const toStr = to || defaultTo.toISOString().slice(0, 10);
    const fromStr = from || defaultFrom.toISOString().slice(0, 10);

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

    const [rows] = await pool.query(
      `
      SELECT
        x.equipamento_id,
        x.equipamento,
        SUM(x.delta) AS acionamentos
      FROM (
        SELECT
          m.id AS equipamento_id,
          COALESCE(NULLIF(m.nome,''), CONCAT('EQP-', m.id)) AS equipamento,
          GREATEST(
            (MAX(COALESCE(NULLIF(inf.contador_acionamentos_agua_fria, ''), '0') + 0) -
             MIN(COALESCE(NULLIF(inf.contador_acionamentos_agua_fria, ''), '0') + 0)), 0
          ) +
          GREATEST(
            (MAX(COALESCE(NULLIF(inf.contador_acionamentos_agua_quente, ''), '0') + 0) -
             MIN(COALESCE(NULLIF(inf.contador_acionamentos_agua_quente, ''), '0') + 0)), 0
          ) +
          GREATEST(
            (MAX(COALESCE(NULLIF(inf.contador_acionamentos_agua_pet, ''), '0') + 0) -
             MIN(COALESCE(NULLIF(inf.contador_acionamentos_agua_pet, ''), '0') + 0)), 0
          ) +
          GREATEST(
            (MAX(COALESCE(NULLIF(inf.contador_acionamentos_aspersor, ''), '0') + 0) -
             MIN(COALESCE(NULLIF(inf.contador_acionamentos_aspersor, ''), '0') + 0)), 0
          ) AS delta
        FROM informacoes inf FORCE INDEX (idx_informacoes_maquina_created)
        JOIN maquinas m ON m.id = inf.maquina_id
        WHERE inf.maquina_id IN (?)
          AND inf.created_at >= ?
          AND inf.created_at < DATE_ADD(?, INTERVAL 1 DAY)
        GROUP BY DATE(inf.created_at), m.id, equipamento
      ) x
      GROUP BY x.equipamento_id, x.equipamento
      ORDER BY acionamentos DESC
      `,
      [machineIds, fromStr, toStr]
    );

    const columns = ["Equipamento", "Acionamentos"];
    const tableRows = rows.map((r) => [
      String(r.equipamento),
      Number(r.acionamentos || 0),
    ]);
    const total = rows.length;

    res.json({
      columns,
      rows: tableRows,
      total,
      _period: { from: fromStr, to: toStr, email: userEmail },
    });
  } catch (e) {
    console.error(e);
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

    const machineIds = await resolveMachineIds(
      userEmail,
      req.query,
      req.isMaster
    );

    if (!machineIds.length) {
      return res.json({
        total_equipamentos: 0,
        ativos: 0,
        inativos: 0,
        _period: { from: fromStr, to: toStr, email: userEmail },
      });
    }

    // 👉 Agora contamos ativos/inativos pelo campo m.status (0 / 2)
    const [statusRows] = await pool.query(
      `
      SELECT m.status
        FROM maquinas m
       WHERE m.id IN (?)
      `,
      [machineIds]
    );

    let ativos = 0;
    let inativos = 0;

    for (const r of statusRows || []) {
      const s = Number(r.status);
      if (s === 0) {
        ativos++;
      } else if (s === 2) {
        inativos++;
      }
    }

    const total = statusRows.length;

    res.json({
      total_equipamentos: total,
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

    const machineIds = await resolveMachineIds(
      userEmail,
      req.query,
      req.isMaster
    );

    if (!machineIds.length) {
      return res.json({
        users_total: 0,
        equipamentos_ativos: 0,
        equipamentos_inativos: 0,
        _period: { from: fromStr, to: toStr, email: userEmail },
      });
    }

    // Quantidade de localizações (cidades)
    const [locRows] = await pool.query(
      `
      SELECT COUNT(DISTINCT m.cidade_id) AS qtd
        FROM maquinas m
       WHERE m.id IN (?)
      `,
      [machineIds]
    );
    const users_total = Number(locRows?.[0]?.qtd || 0);

    // Conta ativos/inativos pelo campo m.status (0 = Ativo, 2 = Inativo)
    const [statusRows] = await pool.query(
      `
      SELECT m.status
        FROM maquinas m
       WHERE m.id IN (?)
      `,
      [machineIds]
    );

    let equipamentos_ativos = 0;
    let equipamentos_inativos = 0;

    for (const r of statusRows || []) {
      const s = Number(r.status);
      if (s === 0) {
        equipamentos_ativos++;
      } else if (s === 2) {
        equipamentos_inativos++;
      }
    }

    res.json({
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

    const defaultTo = new Date();
    const defaultFrom = new Date();
    defaultFrom.setDate(defaultFrom.getDate() - 30);

    const toStr =
      typeof to === "string" && to ? to : defaultTo.toISOString().slice(0, 10);
    const fromStr =
      typeof from === "string" && from
        ? from
        : defaultFrom.toISOString().slice(0, 10);

    const toPlus1 = new Date(toStr);
    toPlus1.setDate(toPlus1.getDate() + 1);
    const toPlus1Str = toPlus1.toISOString().slice(0, 10);

    // máquinas visíveis (usuário ou master) + filtros
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

    // --- 1) Litros por máquina (mesma lógica dos KPIs) ---
    const perMachineDeltaSql = `
      SELECT
        DATE(inf.created_at) AS d,
        GREATEST(
          (MAX(COALESCE(NULLIF(inf.vazao_agua_fria,   ''), '0') + 0) -
           MIN(COALESCE(NULLIF(inf.vazao_agua_fria,   ''), '0') + 0)), 0
        ) AS water_fria_delta,
        GREATEST(
          (MAX(COALESCE(NULLIF(inf.vazao_agua_quente, ''), '0') + 0) -
           MIN(COALESCE(NULLIF(inf.vazao_agua_quente, ''), '0') + 0)), 0
        ) AS water_quente_delta,
        GREATEST(
          (MAX(COALESCE(NULLIF(inf.vazao_agua_pet,    ''), '0') + 0) -
           MIN(COALESCE(NULLIF(inf.vazao_agua_pet,    ''), '0') + 0)), 0
        ) AS water_pets_delta
      FROM informacoes inf FORCE INDEX (idx_informacoes_maquina_created)
      WHERE inf.maquina_id = ?
        AND inf.created_at >= ?
        AND inf.created_at < ?
      GROUP BY d
    `;

    const litersByMachine = new Map();

    await Promise.all(
      machineIds.map(async (mid) => {
        const [rows] = await pool.query(perMachineDeltaSql, [
          mid,
          fromStr,
          toPlus1Str,
        ]);

        let sum = 0;
        for (const r of rows || []) {
          const fria = Number(r.water_fria_delta || 0);
          const quente = Number(r.water_quente_delta || 0);
          const pets = Number(r.water_pets_delta || 0);
          sum += fria + quente + pets;
        }

        const litros = sum * LITERS_SCALE;
        litersByMachine.set(mid, litros);
      })
    );

    // --- 2) Máquinas agrupadas por cidade ---
    const [locRows] = await pool.query(
      `
      SELECT
        m.cidade_id,
        COALESCE(c.nome, CONCAT('Cidade ', m.cidade_id)) AS nome,
        c.uf AS uf,
        COUNT(*) AS total_equip
      FROM maquinas m
      LEFT JOIN cidades c ON c.id = m.cidade_id
      WHERE m.id IN (?)
      GROUP BY m.cidade_id, nome, uf
      ORDER BY nome
      `,
      [machineIds]
    );

    const columns = [
      "Localização",
      "Total de Equipamentos",
      "Ativos no período",
      "Inativos no período",
      "Litros no período",
    ];

    const rows = [];

    for (const r of locRows || []) {
      // máquinas dessa cidade (dentro do conjunto filtrado)
      const [cityMachines] = await pool.query(
        `
        SELECT m.id
          FROM maquinas m
         WHERE m.id IN (?)
           AND m.cidade_id = ?
        `,
        [machineIds, r.cidade_id]
      );

      const ids = (cityMachines || []).map((m) => m.id);

      const total = Number(r.total_equip || ids.length || 0);

      // ativos = máquinas dessa cidade com litros > 0 no período
      let ativos = 0;
      let litrosTotal = 0;

      for (const id of ids) {
        const litros = litersByMachine.get(id) || 0;
        litrosTotal += litros;
        if (litros > 0) ativos++;
      }

      const inativos = Math.max(total - ativos, 0);

      rows.push([
        `${r.nome}${r.uf ? `/${r.uf}` : ""}`,
        total,
        ativos,
        inativos,
        litrosTotal,
      ]);
    }

    res.json({
      columns,
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
      // Master: lista todos os usuários que têm máquinas vinculadas
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
      // Cliente normal: só ele mesmo
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

    // Modelos
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

    // Equipamentos
    const [equipRows] = await pool.query(
      `
      SELECT m.id,
             COALESCE(NULLIF(m.nome,''), CONCAT('EQP-', m.id)) AS nome
        FROM maquinas m
       WHERE m.id IN (?)
    ORDER BY nome
      `,
      [machineIds]
    );
    const equipamentos = equipRows.map((r) => ({
      value: r.id,
      label: r.nome,
    }));

    // Séries
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
