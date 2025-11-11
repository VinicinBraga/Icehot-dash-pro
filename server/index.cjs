// server/index.cjs
const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config({ path: __dirname + "/.env" });
const { pool } = require("./db.cjs"); // ✅ pool vem antes dos helpers

const app = express();
app.use(cors());
app.use(express.json());

const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

// Middleware de autenticação por JWT
app.use((req, res, next) => {
  // Libera rota de login sem exigir token
  if (req.path === "/api/auth/login") {
    return next();
  }

  const auth = req.header("authorization");
  const legacyEmail = req.header("x-user-email"); // ainda aceito p/ testes

  // Preferência: JWT
  if (auth && auth.startsWith("Bearer ")) {
    const token = auth.slice(7);
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.userId = decoded.id;
      req.userEmail = decoded.email;
      return next();
    } catch (err) {
      console.warn("JWT inválido:", err.message);
      return res.status(401).json({ error: "Token inválido ou expirado" });
    }
  }

  // Fallback temporário: x-user-email (enquanto front não usa login)
  if (legacyEmail) {
    req.userEmail = legacyEmail;
    return next();
  }

  // Sem token e sem header legado => não autenticado
  return res.status(401).json({ error: "Não autenticado" });
});

/* ------------------------- Helpers / Utils ------------------------- */
const LITERS_SCALE = 0.001;
// Converte string "123" -> number 123 ou undefined
const asNum = (v) =>
  v === undefined || v === null || v === "" ? undefined : Number(v);

// Utilitário: lista máquinas do usuário (sem filtros)
async function getUserMachineIds(email) {
  const [machinesRows] = await pool.query(
    `SELECT ue.maquina_id
       FROM users u
       JOIN usuarios_equipamentos ue ON ue.usuario_id = u.id
      WHERE u.email = ?`,
    [email]
  );
  return machinesRows.map((r) => r.maquina_id);
}
function signToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}
/**
 * resolveMachineIds: aplica os filtros (usuario, modelo, equipamento, serie, status)
 * e retorna apenas os IDs de máquinas pertencentes ao usuário do header.
 */
async function resolveMachineIds(userEmail, q = {}) {
  const usuario = asNum(q.usuario); // users.id (opcional)
  const modelo = asNum(q.modelo); // tipos.id
  const equipamento = asNum(q.equipamento); // maquinas.id
  const serie = q.serie?.trim();
  const status = q.status?.trim(); // "Ativo" | "Inativo" | outros

  // 1) Base: máquinas vinculadas ao usuário do header
  const [baseRows] = await pool.query(
    `SELECT ue.maquina_id
       FROM users u
       JOIN usuarios_equipamentos ue ON ue.usuario_id = u.id
      WHERE u.email = ?`,
    [userEmail]
  );
  let baseIds = baseRows.map((r) => r.maquina_id);
  if (!baseIds.length) return [];

  // 2) Atalho: equipamento específico
  if (equipamento) {
    return baseIds.includes(equipamento) ? [equipamento] : [];
  }

  // 3) Filtros simples (modelo, série, usuário)
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
    where.push(`EXISTS (
      SELECT 1 FROM usuarios_equipamentos ue
      WHERE ue.usuario_id = ? AND ue.maquina_id = m.id
    )`);
    params.push(usuario);
  }

  // 4) Filtro de status:
  // - "Ativo"  -> máquinas com leitura no período (from/to) em `informacoes`
  // - "Inativo"-> máquinas SEM leitura no período
  // - qualquer outro valor -> filtra literal por m.status
  if (status) {
    const s = String(status).trim().toLowerCase();

    if (s === "ativo" || s === "inativo") {
      // período vindo da query ou padrão (últimos 30 dias)
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

      // máquinas com atividade no período
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

      // redefine o conjunto base conforme o filtro
      baseIds =
        s === "ativo"
          ? baseIds.filter((id) => activeSet.has(id))
          : baseIds.filter((id) => !activeSet.has(id));

      if (!baseIds.length) return [];

      // atualiza o IN (?) principal
      params[0] = baseIds;
    } else {
      // fallback: status textual direto no campo m.status
      where.push(`LOWER(TRIM(m.status)) = ?`);
      params.push(s);
    }
  }

  // 5) Aplica todos os filtros em `maquinas`
  const [rows] = await pool.query(
    `SELECT m.id FROM maquinas m WHERE ${where.join(" AND ")}`,
    params
  );

  return rows.map((r) => r.id);
}

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

    // password é hash bcrypt na base (como vimos)
    const ok = await bcrypt.compare(password, user.password);

    if (!ok) {
      return res.status(401).json({ error: "Credenciais inválidas." });
    }

    const token = signToken(user);

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (e) {
    console.error("Erro no login:", e);
    return res.status(500).json({ error: "Erro ao autenticar." });
  }
});

// Opcional: validar token e obter usuário logado
app.get("/api/auth/me", (req, res) => {
  if (!req.userEmail) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  res.json({
    id: req.userId || null,
    email: req.userEmail,
  });
});

/* --------------------------- Rotas básicas --------------------------- */

// ping rápido
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
    res.json({ status: "ok", db: rows[0].ok, userEmail: req.userEmail });
  } catch (e) {
    res.status(500).json({ status: "error", error: String(e) });
  }
});

app.get("/api/show-tables", async (_req, res) => {
  try {
    const [rows] = await pool.query("SHOW TABLES;");
    res.json({ tables: rows });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

/* ----------------------------- KPIs --------------------------------- */
// KPIs (usando DELTA diário MAX−MIN por máquina) — AGORA COM FILTROS
app.get("/api/kpis", async (req, res) => {
  try {
    const userEmail = req.userEmail;
    const { from, to } = req.query; // YYYY-MM-DD

    // datas padrão (últimos 30 dias)
    const defaultTo = new Date();
    const defaultFrom = new Date();
    defaultFrom.setDate(defaultFrom.getDate() - 30);

    const toStr = to || defaultTo.toISOString().slice(0, 10);
    const fromStr = from || defaultFrom.toISOString().slice(0, 10);

    // intervalo semiaberto [from, to+1)
    const toPlus1 = new Date(toStr);
    toPlus1.setDate(toPlus1.getDate() + 1);
    const toPlus1Str = toPlus1.toISOString().slice(0, 10);

    // ✅ máquinas levando em conta FILTROS
    const machineIds = await resolveMachineIds(userEmail, req.query);
    if (!machineIds.length) {
      return res.json({
        water: { total: 0, fria: 0, quente: 0, pets: 0 },
        triggers: { total: 0, fria: 0, quente: 0, pets: 0, aspersor: 0 },
        equipamentos_utilizados: 0,
        garrafas_poupadas: 0,
        co2_poupado_m3: 0,
        _period: { from: fromStr, to: toStr, email: userEmail },
      });
    }

    // DELTA diário por máquina (MAX−MIN) e somado no Node
    const perMachineDeltaSql = `
      SELECT
        DATE(inf.created_at) AS d,

        -- LITROS (delta do dia)
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

        -- CLICKS (delta do dia)
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

    const promises = machineIds.map(async (mid) => {
      const [rows] = await pool.query(perMachineDeltaSql, [
        mid,
        fromStr,
        toPlus1Str,
      ]);
      for (const r of rows) {
        // aplica escala para litros
        sum_fria += nz(r.water_fria_delta) * LITERS_SCALE;
        sum_quente += nz(r.water_quente_delta) * LITERS_SCALE;
        sum_pets += nz(r.water_pets_delta) * LITERS_SCALE;

        // acionamentos permanecem sem escala
        sum_trg_fria += nz(r.trg_fria_delta);
        sum_trg_quente += nz(r.trg_quente_delta);
        sum_trg_pets += nz(r.trg_pets_delta);
        sum_trg_aspersor += nz(r.trg_aspersor_delta);
      }
    });
    await Promise.all(promises);

    const water_total = sum_fria + sum_quente + sum_pets;
    const trg_total =
      sum_trg_fria + sum_trg_quente + sum_trg_pets + sum_trg_aspersor;

    const BOTTLE_LITERS = 0.5;
    const CO2_PER_LITER_M3 = 0.00003;

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

/* ------------------------- Séries (Água) ---------------------------- */
// delta diário → agregado por mês — AGORA COM FILTROS
app.get("/api/series/water", async (req, res) => {
  try {
    const userEmail = req.userEmail;
    const { from, to } = req.query;

    const defaultTo = new Date();
    const defaultFrom = new Date();
    defaultFrom.setMonth(defaultFrom.getMonth() - 5);

    const toStr = to || defaultTo.toISOString().slice(0, 10);
    const fromStr = from || defaultFrom.toISOString().slice(0, 10);

    const machineIds = await resolveMachineIds(userEmail, req.query);
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

/* ---------------------- Séries (Acionamentos) ----------------------- */
// delta diário → agregado por mês — AGORA COM FILTROS
app.get("/api/series/triggers", async (req, res) => {
  try {
    const userEmail = req.userEmail;
    const { from, to } = req.query;

    const defaultTo = new Date();
    const defaultFrom = new Date();
    defaultFrom.setMonth(defaultFrom.getMonth() - 5);

    const toStr = to || defaultTo.toISOString().slice(0, 10);
    const fromStr = from || defaultFrom.toISOString().slice(0, 10);

    const machineIds = await resolveMachineIds(userEmail, req.query);
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

/* ----------------- Séries - Instalações por Mês (Equipamentos) ----------------- */
app.get("/api/series/installations", async (req, res) => {
  try {
    const userEmail = req.userEmail;
    const { from, to } = req.query;

    // período padrão: últimos 6 meses
    const defaultTo = new Date();
    const defaultFrom = new Date();
    defaultFrom.setMonth(defaultFrom.getMonth() - 5);

    const toStr =
      typeof to === "string" && to ? to : defaultTo.toISOString().slice(0, 10);
    const fromStr =
      typeof from === "string" && from
        ? from
        : defaultFrom.toISOString().slice(0, 10);

    const machineIds = await resolveMachineIds(userEmail, req.query);
    if (!machineIds.length) {
      return res.json({
        labels: [],
        series: [{ key: "instalacoes", values: [] }],
        _period: { from: fromStr, to: toStr, email: userEmail },
      });
    }

    // Busca instalações agregadas por ano-mês
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

    // Mapa ym -> quantidade
    const countsByYm = new Map();
    for (const r of rows) {
      countsByYm.set(r.ym, Number(r.instalacoes || 0));
    }

    // Gera todos os meses no range, preenchendo 0 onde não tiver instalação
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

    // período padrão: últimos 6 meses
    const defaultTo = new Date();
    const defaultFrom = new Date();
    defaultFrom.setMonth(defaultFrom.getMonth() - 5);

    const toStr =
      typeof to === "string" && to ? to : defaultTo.toISOString().slice(0, 10);
    const fromStr =
      typeof from === "string" && from
        ? from
        : defaultFrom.toISOString().slice(0, 10);

    const machineIds = await resolveMachineIds(userEmail, req.query);
    if (!machineIds.length) {
      return res.json({
        labels: [],
        series: [{ key: "acumulado", values: [] }],
        _period: { from: fromStr, to: toStr, email: userEmail },
      });
    }

    // 1) Quantos equipamentos (filtrados) já estavam instalados ANTES do período?
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

    // 2) Instalações por mês DENTRO do período
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

    // 3) Gera todos os meses do range, aplicando acumulado com base no saldo inicial
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

/* --------------------------- Pie (modelos) --------------------------- */
app.get("/api/models/pie", async (req, res) => {
  try {
    const userEmail = req.userEmail;
    const { from, to } = req.query;

    // defaults: últimos 30 dias
    const defaultTo = new Date();
    const defaultFrom = new Date();
    defaultFrom.setDate(defaultFrom.getDate() - 30);

    const toStr = to || defaultTo.toISOString().slice(0, 10);
    const fromStr = from || defaultFrom.toISOString().slice(0, 10);

    // máquinas já considerando filtros (usuario, modelo, equipamento, serie, status)
    const machineIds = await resolveMachineIds(userEmail, req.query);
    if (!machineIds.length) {
      return res.json([]);
    }

    // Delta diário de litros por equipamento, agregado por modelo (tipo)
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

/* ---------------------------- Tabelas ------------------------------- */
// Litros x Equipamentos (DELTA diário somado) — AGORA COM FILTROS
app.get("/api/tables/water-by-equipment", async (req, res) => {
  try {
    const userEmail = req.userEmail;
    const { from, to } = req.query;

    const defaultTo = new Date();
    const defaultFrom = new Date();
    defaultFrom.setDate(defaultFrom.getDate() - 30);

    const toStr = to || defaultTo.toISOString().slice(0, 10);
    const fromStr = from || defaultFrom.toISOString().slice(0, 10);

    const machineIds = await resolveMachineIds(userEmail, req.query);
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
/* -------------------- Tabela - Lista de Equipamentos -------------------- */
app.get("/api/tables/equipment-list", async (req, res) => {
  try {
    const userEmail = req.userEmail;
    const { from, to } = req.query;

    const machineIds = await resolveMachineIds(userEmail, req.query);

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

    // Calcula a próxima troca e formata linhas
    const formatted = rowsRaw.map((r) => {
      const dataTroca = r.data_instalacao ? new Date(r.data_instalacao) : null;
      if (dataTroca) dataTroca.setMonth(dataTroca.getMonth() + 6);

      const proxTroca = dataTroca?.toISOString().slice(0, 10) ?? "Sem data";

      // Normaliza o status
      const statusFormatado =
        r.status === 1 ||
        r.status === "1" ||
        r.status?.toLowerCase?.() === "ativo"
          ? "Ativo"
          : "Inativo";

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

// Acionamentos x Equipamentos (DELTA diário somado) — AGORA COM FILTROS
app.get("/api/tables/triggers-by-equipment", async (req, res) => {
  try {
    const userEmail = req.userEmail;
    const { from, to } = req.query;

    const defaultTo = new Date();
    const defaultFrom = new Date();
    defaultFrom.setDate(defaultFrom.getDate() - 30);

    const toStr = to || defaultTo.toISOString().slice(0, 10);
    const fromStr = from || defaultFrom.toISOString().slice(0, 10);

    const machineIds = await resolveMachineIds(userEmail, req.query);
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

app.get("/api/kpis/equipment", async (req, res) => {
  try {
    const userEmail = req.userEmail;
    const { from, to } = req.query; // YYYY-MM-DD

    // defaults: últimos 30 dias
    const defaultTo = new Date();
    const defaultFrom = new Date();
    defaultFrom.setDate(defaultFrom.getDate() - 30);

    const toStr = to || defaultTo.toISOString().slice(0, 10);
    const fromStr = from || defaultFrom.toISOString().slice(0, 10);

    // máquinas já considerando usuário + filtros (usuario, modelo, equipamento, serie, status)
    const machineIds = await resolveMachineIds(userEmail, req.query);

    if (!machineIds.length) {
      return res.json({
        total_equipamentos: 0,
        ativos: 0,
        inativos: 0,
        _period: { from: fromStr, to: toStr, email: userEmail },
      });
    }

    // quais dessas máquinas tiveram atividade no período?
    const [activeRows] = await pool.query(
      `
      SELECT DISTINCT inf.maquina_id
        FROM informacoes inf FORCE INDEX (idx_informacoes_maquina_created)
       WHERE inf.maquina_id IN (?)
         AND inf.created_at >= ?
         AND inf.created_at < DATE_ADD(?, INTERVAL 1 DAY)
      `,
      [machineIds, fromStr, toStr]
    );

    const ativos = activeRows.length;
    const total = machineIds.length;
    const inativos = Math.max(total - ativos, 0);

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

    // período padrão: últimos 30 dias
    const defaultTo = new Date();
    const defaultFrom = new Date();
    defaultFrom.setDate(defaultFrom.getDate() - 30);

    const toStr =
      typeof to === "string" && to ? to : defaultTo.toISOString().slice(0, 10);
    const fromStr =
      typeof from === "string" && from
        ? from
        : defaultFrom.toISOString().slice(0, 10);

    // aplica filtros e limita às máquinas do usuário
    const machineIds = await resolveMachineIds(userEmail, req.query);

    if (!machineIds.length) {
      return res.json({
        users_total: 0,
        equipamentos_ativos: 0,
        equipamentos_inativos: 0,
        _period: { from: fromStr, to: toStr, email: userEmail },
      });
    }

    // "Usuários" / "Localizações":
    // aqui vamos considerar cidades distintas das máquinas filtradas
    const [locRows] = await pool.query(
      `
      SELECT COUNT(DISTINCT m.cidade_id) AS qtd
      FROM maquinas m
      WHERE m.id IN (?)
      `,
      [machineIds]
    );
    const users_total = Number(locRows?.[0]?.qtd || 0);

    // máquinas com atividade no período
    const [activeRows] = await pool.query(
      `
      SELECT DISTINCT inf.maquina_id
        FROM informacoes inf FORCE INDEX (idx_informacoes_maquina_created)
       WHERE inf.maquina_id IN (?)
         AND inf.created_at >= ?
         AND inf.created_at < DATE_ADD(?, INTERVAL 1 DAY)
      `,
      [machineIds, fromStr, toStr]
    );
    const ativosSet = new Set(
      (activeRows || []).map((r) => r.maquina_id).filter(Boolean)
    );

    const equipamentos_ativos = ativosSet.size;
    const totalEquip = machineIds.length;
    const equipamentos_inativos = Math.max(totalEquip - equipamentos_ativos, 0);

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

    // período padrão: últimos 30 dias
    const defaultTo = new Date();
    const defaultFrom = new Date();
    defaultFrom.setDate(defaultFrom.getDate() - 30);

    const toStr =
      typeof to === "string" && to ? to : defaultTo.toISOString().slice(0, 10);
    const fromStr =
      typeof from === "string" && from
        ? from
        : defaultFrom.toISOString().slice(0, 10);

    // máquinas já filtradas (usuario, modelo, equipamento, serie, status)
    const machineIds = await resolveMachineIds(userEmail, req.query);
    if (!machineIds.length) {
      return res.json({
        columns: ["Localização", "Total de Equipamentos", "Ativos", "Inativos"],
        rows: [],
        total: 0,
        points: [],
        _period: { from: fromStr, to: toStr, email: userEmail },
      });
    }

    // atividade no período (para saber ativos/inativos)
    const [activeRows] = await pool.query(
      `
      SELECT DISTINCT inf.maquina_id
        FROM informacoes inf FORCE INDEX (idx_informacoes_maquina_created)
       WHERE inf.maquina_id IN (?)
         AND inf.created_at >= ?
         AND inf.created_at < DATE_ADD(?, INTERVAL 1 DAY)
      `,
      [machineIds, fromStr, toStr]
    );
    const activeSet = new Set(
      (activeRows || []).map((r) => r.maquina_id).filter(Boolean)
    );

    // agrega por cidade/local
    // 👇 Ajuste aqui se o seu schema de cidades for diferente.
    const [locRows] = await pool.query(
      `
      SELECT
        COALESCE(c.nome, CONCAT('Cidade ', m.cidade_id)) AS nome,
        m.cidade_id,
        COUNT(*) AS total_equip,
        SUM(CASE WHEN m.id IN (?) THEN (m.id IN (?)) END) AS dummy -- só para manter compatibilidade
      FROM maquinas m
      LEFT JOIN cidades c ON c.id = m.cidade_id
      WHERE m.id IN (?)
      GROUP BY m.cidade_id, nome
      `,
      // o terceiro "IN (?)" é o que importa (machineIds);
      // os outros estão só para manter a sintaxe consistente,
      // vamos calcular ativos/inativos na aplicação logo abaixo
      [machineIds, [...activeSet], machineIds]
    );

    const columns = [
      "Localização",
      "Total de Equipamentos",
      "Ativos no período",
      "Inativos no período",
    ];

    const rows = locRows.map((r) => {
      const total = Number(r.total_equip || 0);

      // conta quantos dessa cidade estão ativos no período
      const ativos = machineIds.filter(
        (id) => activeSet.has(id) && id // filtro já por usuário
      ).length; // simplificado: se quiser por cidade exata, pode refinar com subquery

      const inativos = Math.max(total - ativos, 0);

      return [r.nome, total, ativos, inativos];
    });

    // Pontos para o mapa (se tiver lat/lng em `cidades`)
    const points = locRows
      .map((r) => {
        // Se sua tabela `cidades` tiver latitude/longitude, exponha aqui:
        // return {
        //   name: r.nome,
        //   lat: r.latitude,
        //   lng: r.longitude,
        //   total: Number(r.total_equip || 0),
        // };
        return null; // placeholder: vamos ligar quando soubermos os campos
      })
      .filter(Boolean);

    res.json({
      columns,
      rows,
      total: rows.length,
      points,
      _period: { from: fromStr, to: toStr, email: userEmail },
    });
  } catch (e) {
    console.error("Erro em /api/location/summary:", e);
    res.status(500).json({ error: String(e) });
  }
});
/* ----------------------------- Filtros ------------------------------ */
// Lista de opções de filtros (sem aplicar os filtros entre si)
app.get("/api/filters", async (req, res) => {
  try {
    const userEmail = req.userEmail;
    const machineIds = await getUserMachineIds(userEmail);

    const status = [
      { value: "Ativo", label: "Ativo" },
      { value: "Inativo", label: "Inativo" },
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

    // Usuário atual
    const [userRows] = await pool.query(
      `SELECT id, email, COALESCE(name, email) AS label
         FROM users WHERE email = ? LIMIT 1`,
      [userEmail]
    );
    const usuarios = (userRows || []).map((u) => ({
      value: u.id,
      label: u.label,
      email: u.email,
    }));

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
      SELECT m.id, COALESCE(NULLIF(m.nome,''), CONCAT('EQP-', m.id)) AS nome
        FROM maquinas m
       WHERE m.id IN (?)
    ORDER BY nome
      `,
      [machineIds]
    );
    const equipamentos = equipRows.map((r) => ({ value: r.id, label: r.nome }));

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
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e) });
  }
});

/* ------------------------------- Debug ------------------------------ */
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

/* ----------------------------- Boot API ----------------------------- */
const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  console.log(`API rodando em http://localhost:${port}`);
});
