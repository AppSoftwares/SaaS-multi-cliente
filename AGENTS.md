<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:rose-rules -->
# Reglas Rose Industry (Claude Code + Codex)

Responder **en español**. Contexto completo de TODOS los proyectos (estado, URL, ref de Supabase y
pendiente de cada uno) y reglas extendidas:
`C:\Users\Administrador\Documents\proyectos\CONTEXTO-GLOBAL.md` y `...\proyectos\AGENTS.md`.
**Léelos antes de trabajar en este repo.**

## No romper lo que funciona
- `git status` + `git log --oneline -10` antes de tocar nada. Cambios sin commitear = trabajo del otro
  agente o del usuario: no los mezcles ni los descartes.
- `git config core.autocrlf input` (local) antes del primer `git add` en esta PC Windows, o el diff
  sale con cientos de archivos falsos por fin de línea.
- Cambio mínimo: nada de reformatear, reordenar imports, renombrar ni actualizar dependencias de paso.
- Nada de `sed -i` en Git-Bash (voltea CRLF→LF): para sustituciones masivas, Node.
- `npm run build` tiene que pasar antes de reportar que está listo. Si falla, se dice con el error.
- Nunca `git push --force` ni reescribir historial. Nunca commitear `.env*` ni `.claude/`, ni imprimir
  la `service_role` o tokens.
- No borrar datos sembrados ni cuentas de clientes; para probar, crear usuario nuevo dedicado.

## Base de datos (Supabase)
- Migraciones secuenciales e **inmutables** (`NNNN_nombre.sql`): nunca editar una ya aplicada, crear la
  siguiente. Si parcheas la BD a mano, escribe la migración en el mismo turno.
- **Jamás** una política RLS que consulte su propia tabla (recursión). `SECURITY DEFINER` siempre con
  `search_path` fijo.

## Alternar Claude ↔ Codex
Un agente a la vez por repo. Antes de ceder el turno: commit (o stash con nombre) y árbol limpio.
La memoria privada de cada agente **no la ve el otro** → lo que importe va a `CONTEXTO-GLOBAL.md`.
<!-- END:rose-rules -->
