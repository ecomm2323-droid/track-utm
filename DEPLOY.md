# Subir la app a Railway (plan Hobby)

## 1. Código en GitHub
1. Creá un repositorio **privado** vacío en github.com (ej. `attribution`).
2. En esta carpeta (`app`):
   ```
   git init
   git add .
   git commit -m "first deploy"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/attribution.git
   git push -u origin main
   ```
   `.env.local` y `data/` están ignorados: no se suben ni el token ni la base.

## 2. Proyecto en Railway
1. railway.com → **New Project** → **Deploy from GitHub repo** → elegí el repo.
2. En el servicio: **Settings → Networking → Generate Domain**. Copiá la URL (`https://xxx.up.railway.app`).
3. **Volumes → New Volume**, montalo en `/data`.

## 3. Variables (servicio → Variables)
| Variable | Valor |
| --- | --- |
| `APP_URL` | la URL del paso 2 |
| `APP_PASSWORD` | una contraseña larga |
| `META_APP_ID` | de tu app de Meta |
| `META_APP_SECRET` | de tu app de Meta |
| `META_AD_ACCOUNT_ID` | `act_1615837480186140` |
| `DATA_DIR` | `/data` |

Guardá y Railway redeploya solo.

## 4. Meta
En developers.facebook.com → tu app → Inicio de sesión con Facebook → Configuración →
**URIs de redireccionamiento de OAuth válidos**, agregá:
`https://xxx.up.railway.app/api/meta/callback`

## 5. Conectar
1. Entrá a la URL, poné la contraseña.
2. En Resumen tocá **Conectar / reconectar con Meta** (el token anterior era de tu PC).
3. Integraciones → Webhooks → creá uno `impultienda` y copiá su URL.
4. Impultienda → Configuraciones → Webhooks → Agregar endpoint → pegá la URL.
   Eventos: order.created, order.approved, order.refunded, order.chargeback, order.rejected.
5. Botón **Probar** de Impultienda → mirá Integraciones → Pruebas (debe decir "prueba de Impultienda, no se guarda").

## Si algo falla
- Logs: servicio → **Deployments → View logs**.
- "Meta no conectado": repetí el paso 5.2.
- Las ventas no llegan: Impultienda deshabilita el endpoint tras 20 fallos seguidos; reactivalo en su panel.
