# Icehot Dashboard
Aplicação completa para monitoramento de consumo, acionamentos e localização dos equipamentos Icehot. O projeto inclui frontend moderno em React e uma API Node/Express conectada a MySQL, com deploy em Vercel e Cloud Run.

---

## Sumário
- Visão Geral
- Arquitetura
- Tecnologias Utilizadas
- Frontend
- Backend API
- Banco de Dados
- Variáveis de Ambiente
- Como Rodar Localmente
- Deploy
- Endpoints da API
- Créditos

---

## Visão Geral
O Icehot Dashboard permite visualizar:

- Litros totais de água distribuídos
- Consumo por tipo (fria, quente, pet)
- Acionamentos por tipo
- Quantidade de equipamentos ativos e inativos
- Distribuição por modelo
- Mapa de localização
- Tendências de instalação e uso
- Tabelas com filtros e paginação

Três abas principais:
1. Visão Geral
2. Equipamentos
3. Localização

A API aplica filtragem de dados por usuário utilizando o header `x-user-email`.

---

## Arquitetura

Frontend (Vercel — React)
↓  
API REST (Cloud Run — Node/Express)
↓  
MySQL (DigitalOcean)

---

## Tecnologias Utilizadas

### Frontend
- React (Vite)
- TypeScript
- TailwindCSS + shadcn/ui
- Recharts
- Leaflet
- date-fns

### Backend
- Node.js + Express
- MySQL2
- Dotenv
- CORS

### Infra
- Vercel
- Google Cloud Run
- MySQL DigitalOcean

---

## Frontend

Componentes principais:

- DateRangePicker
- FilterBar
- KpiCard
- WaterChart
- TriggerChart
- ModelPieChart
- InstallationChart
- CumulativeChart
- DataTable
- MapView

Os filtros e datas são enviados à API via query strings.

---

## Backend API

A API utiliza Express e MySQL2 com pool de conexões.

### Middleware de filtragem por e-mail
```js
app.use((req, _res, next) => {
  req.userEmail = req.header("x-user-email") || "teste@icehot.com.br";
  next();
});
Estrutura
server/
├── index.cjs
├── db.cjs
└── .env

A API calcula KPIs realizando uma consulta por máquina e agregando no servidor para maior desempenho.

Banco de Dados
Tabelas utilizadas:

users

usuarios_equipamentos

maquinas

informacoes

cidades

estados

tipos

manutencoes

ultimo_registro

Índice importante:

idx_informacoes_maquina_created

Variáveis de Ambiente
Backend (.env)
env

DB_CONNECTION=mysql
DB_HOST=167.99.0.137
DB_PORT=3306
DB_DATABASE=icehot
DB_USERNAME=root
DB_PASSWORD=!Root@568f74e2b304
PORT=3001
Frontend (Vercel)
env

VITE_API_URL=https://<url-da-api>
Como Rodar Localmente
1. Clone o repositório
bash

git clone https://github.com/.../icehot-dashboard
cd icehot-dashboard
2. Instale dependências do frontend
bash

npm install
3. Configure o .env do frontend
env

VITE_API_URL=http://localhost:3001
4. Rode o frontend
bash

npm run dev
5. Rode o backend
bash

cd server
npm install
npm start
Deploy
Backend — Cloud Run
Configuração:

bash

SERVICE=icehot-api
REGION=southamerica-east1
IMAGE=$REGION-docker.pkg.dev/kv-bi-428819/icehot-repo/$SERVICE
Build:

bash

gcloud builds submit --tag $IMAGE
Deploy:

bash

gcloud run deploy $SERVICE \
  --image $IMAGE \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated
Frontend — Vercel
Importar repositório do GitHub

Adicionar variável de ambiente:

env

VITE_API_URL=https://<url-da-api>
Deploy automático

Endpoints da API
GET /api/health
Retorna status da API e da conexão com o banco.

GET /api/_debug/ping
Endpoint de debug.

GET /api/show-tables
Lista tabelas do banco.

GET /api/kpis
Retorna os KPIs do período informado.

Query Params:

ini

from=YYYY-MM-DD
to=YYYY-MM-DD
Header necessário:

pgsql

x-user-email: email-do-usuario
Exemplo:

bash

curl -H "x-user-email: teste@icehot.com.br" \
"https://api-url/api/kpis?from=2025-01-01&to=2025-01-31"
Créditos
Desenvolvido por:

Vinícius Braga — KV Consulting

ChatGPT — suporte técnico contínuo

Cliente:

Icehot

Infraestrutura:

Google Cloud Run

Vercel

DigitalOcean

yaml


--
