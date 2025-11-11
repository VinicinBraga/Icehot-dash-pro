// check-logins.cjs
// Usa o mesmo pool do seu servidor + bcrypt para validar logins fornecidos

const { pool } = require("./db.cjs");
const bcrypt = require("bcryptjs");

// Lista dos logins que você quer testar
const candidates = [
  {
    email: "credisudeste@icehot.net.br",
    password: "credisudeste",
  },
  {
    email: "saneaceu@icehot.net.br",
    password: "saneaceu",
  },
  {
    email: "sicoobguaranicredi@icehot.net.br",
    password: "Sicoob",
  },
  {
    email: "sicredi.ibiraiaras@icehot.net.br",
    password: "sicredi",
  },
];

async function checkOne({ email, password }) {
  const [rows] = await pool.query(
    "SELECT id, email, password FROM users WHERE email = ? LIMIT 1",
    [email]
  );

  if (!rows.length) {
    console.log(`${email}: usuário não encontrado`);
    return;
  }

  const user = rows[0];

  const ok = await bcrypt.compare(password, user.password);

  console.log(`${email}: senha ${ok ? "CORRETA ✅" : "INCORRETA ❌"}`);
}

async function run() {
  try {
    for (const c of candidates) {
      await checkOne(c);
    }
  } catch (err) {
    console.error("Erro ao verificar logins:", err);
  } finally {
    await pool.end();
  }
}

run();
