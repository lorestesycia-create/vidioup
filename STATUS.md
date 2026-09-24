# VidioUp V1 — estado

## Preparado en el proyecto
- Identidad y logo.
- Application ID y versión inicial.
- Navegación y UI V1.
- Economía parametrizada.
- Esquema de base de datos.
- Contrato/API base del backend.
- Protección conceptual server-authoritative para saldo, campañas, rewarded y compras.
- Dockerfile y variables de despliegue.
- Configuración base de Codemagic.
- Ficha de Google Play en español.
- Checklist de prueba cerrada.
- Borradores de privacidad/términos.
- Notas para Data Safety.
- Preflight que bloquea una release incompleta.

## Datos externos que no se pueden fabricar
1. ~~AdMob App ID de VidioUp~~ — COMPLETADO.
2. ~~AdMob Rewarded Ad Unit ID~~ — COMPLETADO.
3. Aplicación/ficha VidioUp de Google Play y productos de compra.
4. URL HTTPS del backend desplegado.
5. Credenciales/firma de Codemagic/Android.

Hasta introducir y verificar esos cinco elementos no se debe generar ni subir un AAB como candidato a testers.

## Supabase conectado (23-09-2026)
- Proyecto: VidioUp
- Cliente configurado con URL del proyecto y publishable key (no secret key).
- Inicio de sesión por email/contraseña conectado a Supabase Auth.
- Sesión persistente y renovación mediante refresh token.
- Perfil y monedero leídos desde public.users y public.wallets bajo RLS.
- Usuario existente verificado en Supabase con saldo inicial de 100 monedas.
- Pendiente antes de publicación: operaciones económicas seguras del servidor, Rewarded validado, Google Play Billing verificado y firma/release final.
