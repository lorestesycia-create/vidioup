# VidioUp V1 — base de construcción
Android package: com.vidioup.app
Version inicial: 1.0 / versionCode 1

Economía V1 cerrada:
- Bonus bienvenida: 100 monedas
- Rewarded: 25 monedas; máximo 8/día; cooldown 0 min
- Campaña: mínimo 100, máximo 50.000; máximo 5 activas
- Básica: 1 moneda por impresión interna válida
- Destacada: 2
- Impulso: 4
- Tienda: 1.000/1,99€ · 3.000/4,99€ · 7.000/9,99€ · 16.000/19,99€

IMPORTANTE: esta base contiene UI/configuración y flujo local. Antes de un AAB funcional de testers todavía hay que conectar backend/autenticación, ledger server-authoritative, Google Play Billing y AdMob reales. No se deben acreditar monedas desde el dispositivo.


Avance actual:
- Navegación y UI V1 ampliadas.
- Validación local de URL/presupuesto y borradores de campaña.
- Pantallas de monedero, tienda, perfil y campañas.
- Contrato de backend definido para cuentas, ledger, campañas, AdMob y Google Play Billing.
- Las acciones económicas reales permanecen bloqueadas hasta conectar backend, evitando saldos/cobros falsos.


Backend V1 añadido:
- Esquema PostgreSQL para usuarios, wallets, ledger, vídeos, campañas, eventos, compras, rewarded y denuncias.
- API base con health/config, validación de URL y cálculo de campañas.
- Mutaciones económicas sensibles bloqueadas hasta disponer de verificación real de AdMob/Google Play y transacciones de base de datos.
- Preflight impide considerar la compilación lista mientras falten IDs/servicios reales.
