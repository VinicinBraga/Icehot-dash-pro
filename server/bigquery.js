// server/bigquery.js
const { BigQuery } = require("@google-cloud/bigquery");

const bigquery = new BigQuery();

// Ajusta se o dataset/tabela mudarem no futuro
const PROJECT_ID = process.env.BQ_PROJECT_ID;

if (!PROJECT_ID) {
  throw new Error("BQ_PROJECT_ID não definido");
}
const DATASET_ID = "Dashboard_ICEHOT";
const FACT_TABLE = "fact_informacoes_diaria_v";

async function getKpisFromBigQuery(machineIds, fromDate, toDate) {
  if (!Array.isArray(machineIds) || machineIds.length === 0) {
    return {
      sum_v_fria: 0,
      sum_v_quente: 0,
      sum_v_pet: 0,
      sum_c_fria: 0,
      sum_c_quente: 0,
      sum_c_pet: 0,
      sum_c_asp: 0,
    };
  }

  const query = `
    DECLARE from_date DATE DEFAULT @from_date;
    DECLARE to_date   DATE DEFAULT @to_date;
    DECLARE machine_ids ARRAY<INT64> DEFAULT @machine_ids;

    WITH agg AS (
      SELECT
        SUM(litros_fria_dia)   AS sum_v_fria,
        SUM(litros_quente_dia) AS sum_v_quente,
        SUM(litros_pet_dia)    AS sum_v_pet,
        SUM(usos_fria_dia)     AS sum_c_fria,
        SUM(usos_quente_dia)   AS sum_c_quente,
        SUM(usos_pet_dia)      AS sum_c_pet,
        SUM(usos_aspersor_dia) AS sum_c_asp
      FROM \`${PROJECT_ID}.${DATASET_ID}.${FACT_TABLE}\`
      WHERE
        maquina_id IN UNNEST(machine_ids)
        AND event_date >= from_date
        AND event_date <= to_date
    )

    SELECT
      sum_v_fria,
      sum_v_quente,
      sum_v_pet,
      sum_c_fria,
      sum_c_quente,
      sum_c_pet,
      sum_c_asp
    FROM agg
  `;

  const options = {
    query,
    params: {
      from_date: fromDate,
      to_date: toDate,
      machine_ids: machineIds,
    },
  };

  const [rows] = await bigquery.query(options);
  return (
    rows[0] || {
      sum_v_fria: 0,
      sum_v_quente: 0,
      sum_v_pet: 0,
      sum_c_fria: 0,
      sum_c_quente: 0,
      sum_c_pet: 0,
      sum_c_asp: 0,
    }
  );
}

async function getLitersByMachineFromBigQuery(machineIds, fromDate, toDate) {
  if (!Array.isArray(machineIds) || machineIds.length === 0) {
    return [];
  }

  const query = `
    DECLARE from_date DATE DEFAULT @from_date;
    DECLARE to_date   DATE DEFAULT @to_date;
    DECLARE machine_ids ARRAY<INT64> DEFAULT @machine_ids;

    WITH agg AS (
      SELECT
        maquina_id,
        SUM(
          COALESCE(litros_fria_dia, 0) +
          COALESCE(litros_quente_dia, 0) +
          COALESCE(litros_pet_dia, 0)
        ) AS litros
      FROM \`${PROJECT_ID}.${DATASET_ID}.${FACT_TABLE}\`
      WHERE
        maquina_id IN UNNEST(machine_ids)
        AND event_date >= from_date
        AND event_date <= to_date
      GROUP BY maquina_id
    )
    SELECT
      maquina_id,
      litros
    FROM agg
  `;

  const options = {
    query,
    params: {
      from_date: fromDate,
      to_date: toDate,
      machine_ids: machineIds,
    },
  };

  const [rows] = await bigquery.query(options);
  // rows: [{ maquina_id: 24, litros: 123.45 }, ...]
  return rows;
}

async function getWaterSeriesFromBigQuery(machineIds, fromDate, toDate) {
  if (!Array.isArray(machineIds) || machineIds.length === 0) {
    return [];
  }

  const query = `
    DECLARE from_date DATE DEFAULT @from_date;
    DECLARE to_date   DATE DEFAULT @to_date;
    DECLARE machine_ids ARRAY<INT64> DEFAULT @machine_ids;

    -- Gera todos os meses entre from_date e to_date
    WITH months AS (
      SELECT
        month_start
      FROM UNNEST(
        GENERATE_DATE_ARRAY(
          DATE_TRUNC(from_date, MONTH),
          DATE_TRUNC(to_date,   MONTH),
          INTERVAL 1 MONTH
        )
      ) AS month_start
    ),
    agg AS (
      SELECT
        DATE_TRUNC(event_date, MONTH) AS month_start,
        SUM(COALESCE(litros_fria_dia,   0)) AS sum_v_fria,
        SUM(COALESCE(litros_quente_dia, 0)) AS sum_v_quente,
        SUM(COALESCE(litros_pet_dia,    0)) AS sum_v_pet
      FROM \`${PROJECT_ID}.${DATASET_ID}.${FACT_TABLE}\`
      WHERE
        maquina_id IN UNNEST(machine_ids)
        AND event_date >= from_date
        AND event_date <= to_date
      GROUP BY month_start
    )
    SELECT
      FORMAT_DATE('%Y-%m', m.month_start) AS ym,
      IFNULL(a.sum_v_fria,   0) AS sum_v_fria,
      IFNULL(a.sum_v_quente, 0) AS sum_v_quente,
      IFNULL(a.sum_v_pet,    0) AS sum_v_pet
    FROM months m
    LEFT JOIN agg a
      USING (month_start)
    ORDER BY ym
  `;

  const options = {
    query,
    params: {
      from_date: fromDate,
      to_date: toDate,
      machine_ids: machineIds,
    },
  };

  const [rows] = await bigquery.query(options);
  // rows: [{ ym: '2025-01', sum_v_fria: ..., sum_v_quente: ..., sum_v_pet: ... }, ...]
  return rows;
}

async function getTriggerSeriesFromBigQuery(machineIds, fromDate, toDate) {
  if (!Array.isArray(machineIds) || machineIds.length === 0) {
    return [];
  }

  const query = `
    DECLARE from_date DATE DEFAULT @from_date;
    DECLARE to_date   DATE DEFAULT @to_date;
    DECLARE machine_ids ARRAY<INT64> DEFAULT @machine_ids;

    -- Gera todos os meses entre from_date e to_date
    WITH months AS (
      SELECT
        month_start
      FROM UNNEST(
        GENERATE_DATE_ARRAY(
          DATE_TRUNC(from_date, MONTH),
          DATE_TRUNC(to_date,   MONTH),
          INTERVAL 1 MONTH
        )
      ) AS month_start
    ),
    agg AS (
      SELECT
        DATE_TRUNC(event_date, MONTH) AS month_start,
        SUM(COALESCE(usos_fria_dia,      0)) AS sum_c_fria,
        SUM(COALESCE(usos_quente_dia,    0)) AS sum_c_quente,
        SUM(COALESCE(usos_pet_dia,       0)) AS sum_c_pet,
        SUM(COALESCE(usos_aspersor_dia,  0)) AS sum_c_asp
      FROM \`${PROJECT_ID}.${DATASET_ID}.${FACT_TABLE}\`
      WHERE
        maquina_id IN UNNEST(machine_ids)
        AND event_date >= from_date
        AND event_date <= to_date
      GROUP BY month_start
    )
    SELECT
      FORMAT_DATE('%Y-%m', m.month_start) AS ym,
      IFNULL(a.sum_c_fria,   0) AS sum_c_fria,
      IFNULL(a.sum_c_quente, 0) AS sum_c_quente,
      IFNULL(a.sum_c_pet,    0) AS sum_c_pet,
      IFNULL(a.sum_c_asp,    0) AS sum_c_asp
    FROM months m
    LEFT JOIN agg a
      USING (month_start)
    ORDER BY ym
  `;

  const options = {
    query,
    params: {
      from_date: fromDate,
      to_date: toDate,
      machine_ids: machineIds,
    },
  };

  const [rows] = await bigquery.query(options);
  // rows: [{ ym: '2025-01', sum_c_fria: ..., sum_c_quente: ..., sum_c_pet: ..., sum_c_asp: ... }, ...]
  return rows;
}

async function getEquipmentAggregatesFromBigQuery(
  machineIds,
  fromDate,
  toDate
) {
  if (!Array.isArray(machineIds) || machineIds.length === 0) {
    return [];
  }

  const query = `
    DECLARE from_date DATE DEFAULT @from_date;
    DECLARE to_date   DATE DEFAULT @to_date;
    DECLARE machine_ids ARRAY<INT64> DEFAULT @machine_ids;

    SELECT
      maquina_id,
      -- Litros
      SUM(COALESCE(litros_fria_dia,   0)) AS sum_v_fria,
      SUM(COALESCE(litros_quente_dia, 0)) AS sum_v_quente,
      SUM(COALESCE(litros_pet_dia,    0)) AS sum_v_pet,

      -- Acionamentos
      SUM(COALESCE(usos_fria_dia,      0)) AS sum_c_fria,
      SUM(COALESCE(usos_quente_dia,    0)) AS sum_c_quente,
      SUM(COALESCE(usos_pet_dia,       0)) AS sum_c_pet,
      SUM(COALESCE(usos_aspersor_dia,  0)) AS sum_c_asp
    FROM \`${PROJECT_ID}.${DATASET_ID}.${FACT_TABLE}\`
    WHERE
      maquina_id IN UNNEST(machine_ids)
      AND event_date >= from_date
      AND event_date <= to_date
    GROUP BY maquina_id
    ORDER BY maquina_id
  `;

  const options = {
    query,
    params: {
      from_date: fromDate,
      to_date: toDate,
      machine_ids: machineIds,
    },
  };

  const [rows] = await bigquery.query(options);
  // rows: [{ maquina_id, sum_v_fria, sum_v_quente, sum_v_pet, sum_c_fria, ... }, ...]
  return rows;
}

async function getAspersorPresenceFromBigQuery(machineIds, toDate) {
  if (!Array.isArray(machineIds) || machineIds.length === 0) {
    return false;
  }

  const query = `
    DECLARE to_date   DATE DEFAULT @to_date;
    DECLARE from_date DATE DEFAULT DATE_SUB(to_date, INTERVAL 365 DAY);
    DECLARE machine_ids ARRAY<INT64> DEFAULT @machine_ids;

    SELECT
      SUM(COALESCE(usos_aspersor_dia, 0)) AS sum_c_asp
    FROM \`${BQ_PROJECT}.${BQ_DATASET}.${BQ_FACT_TABLE}\`
    WHERE maquina_id IN UNNEST(machine_ids)
      AND event_date BETWEEN from_date AND to_date
  `;

  const options = {
    query,
    params: {
      to_date: toDate,
      machine_ids: machineIds.map(Number),
    },
  };

  const [rows] = await bigquery.query(options);

  const sum = Number(rows?.[0]?.sum_c_asp || 0);

  return sum > 0;
}

// server/bigquery.js

async function getHotTemperatureNowFromBigQuery(machineIds) {
  // Temperatura "atual" só faz sentido quando há 1 equipamento selecionado
  if (!Array.isArray(machineIds) || machineIds.length !== 1) {
    return {
      hot_temp: null,
      hot_updated_at: null,
    };
  }

  const machineId = Number(machineIds[0]);

  const query = `
    SELECT
      temperatura_agua_quente AS hot_temp,
      temperatura_updated_at  AS hot_updated_at
    FROM \`${PROJECT_ID}.${DATASET_ID}.temperatura_quente_atual\`
    WHERE maquina_id = @machine_id
    LIMIT 1
  `;

  const options = {
    query,
    params: { machine_id: machineId },
  };

  const [rows] = await bigquery.query(options);

  return rows?.[0] || { hot_temp: null, hot_updated_at: null };
}

async function getHotTemperatureByMachineFromBigQuery(machineIds) {
  if (!Array.isArray(machineIds) || machineIds.length === 0) {
    return [];
  }

  const query = `
    DECLARE machine_ids ARRAY<INT64> DEFAULT @machine_ids;

    SELECT
      maquina_id,
      temperatura_agua_quente AS hot_temp,
      temperatura_updated_at  AS hot_updated_at
    FROM \`${PROJECT_ID}.${DATASET_ID}.temperatura_quente_atual\`
    WHERE maquina_id IN UNNEST(machine_ids)
  `;

  const options = {
    query,
    params: {
      machine_ids: machineIds.map(Number),
    },
  };

  const [rows] = await bigquery.query(options);
  return rows || [];
}

async function getColdTemperatureNowFromBigQuery(machineIds) {
  if (!Array.isArray(machineIds) || machineIds.length !== 1) {
    return {
      cold_temp: null,
      cold_updated_at: null,
    };
  }

  const machineId = Number(machineIds[0]);

  const query = `
    WITH ult AS (
      SELECT
        maquina_id,
        temperatura_agua_fria AS cold_temp,
        updated_at AS cold_updated_at,
        ROW_NUMBER() OVER (
          PARTITION BY maquina_id
          ORDER BY updated_at DESC, id DESC
        ) AS rn
      FROM \`${PROJECT_ID}.${DATASET_ID}.informacoes_raw_dedup\`
      WHERE maquina_id = @machine_id
    )
    SELECT
      maquina_id,
      cold_temp,
      cold_updated_at
    FROM ult
    WHERE rn = 1
    LIMIT 1
  `;

  const options = {
    query,
    params: { machine_id: machineId },
  };

  const [rows] = await bigquery.query(options);
  return rows?.[0] || { cold_temp: null, cold_updated_at: null };
}

async function getColdTemperatureByMachineFromBigQuery(machineIds) {
  if (!Array.isArray(machineIds) || machineIds.length === 0) {
    return [];
  }

  const query = `
    DECLARE machine_ids ARRAY<INT64> DEFAULT @machine_ids;

    WITH ult AS (
      SELECT
        maquina_id,
        temperatura_agua_fria AS cold_temp,
        updated_at AS cold_updated_at,
        ROW_NUMBER() OVER (
          PARTITION BY maquina_id
          ORDER BY updated_at DESC, id DESC
        ) AS rn
      FROM \`${PROJECT_ID}.${DATASET_ID}.informacoes_raw_dedup\`
      WHERE maquina_id IN UNNEST(machine_ids)
    )
    SELECT
      maquina_id,
      cold_temp,
      cold_updated_at
    FROM ult
    WHERE rn = 1
  `;

  const options = {
    query,
    params: {
      machine_ids: machineIds.map(Number),
    },
  };

  const [rows] = await bigquery.query(options);
  return rows || [];
}

async function getTemperatureHistoryFromBigQuery(machineIds, fromDate, toDate) {
  if (!Array.isArray(machineIds) || machineIds.length === 0) {
    return [];
  }

  const query = `
    DECLARE machine_ids ARRAY<INT64> DEFAULT @machine_ids;

    SELECT
      t.maquina_id,
      m.maquina_nome,
      FORMAT_TIMESTAMP(
        '%Y-%m-%d %H:00:00',
        t.leitura_hora,
        'America/Sao_Paulo'
      ) AS leitura_em,
      t.temperatura_quente,
      t.temperatura_fria,
      t.leituras
    FROM \`${PROJECT_ID}.${DATASET_ID}.fact_temperatura_horaria\` t
    LEFT JOIN \`${PROJECT_ID}.${DATASET_ID}.dim_maquinas\` m
      ON m.maquina_id = t.maquina_id
    WHERE t.maquina_id IN UNNEST(machine_ids)
      AND DATE(t.leitura_hora, 'America/Sao_Paulo')
          BETWEEN @fromDate AND @toDate
    ORDER BY
      t.maquina_id,
      t.leitura_hora
  `;

  const options = {
    query,
    params: {
      machine_ids: machineIds.map(Number),
      fromDate,
      toDate,
    },
  };

  const [rows] = await bigquery.query(options);
  return rows || [];
}

module.exports = {
  getKpisFromBigQuery,
  getLitersByMachineFromBigQuery,
  getWaterSeriesFromBigQuery,
  getTriggerSeriesFromBigQuery,
  getEquipmentAggregatesFromBigQuery,
  getAspersorPresenceFromBigQuery,
  getHotTemperatureNowFromBigQuery,
  getHotTemperatureByMachineFromBigQuery,
  getColdTemperatureNowFromBigQuery,
  getColdTemperatureByMachineFromBigQuery,
  getTemperatureHistoryFromBigQuery,
};
