# Creative Suite — Production Deployment Guide

## Stack
- **Next.js 16** (App Router) em Vercel
- **Supabase** (`creative-suite` / `ostupvjenkebowvydjmh`) — Postgres + Auth + Storage
- **Bucket `assets`** (público, 50MB/arquivo) — imagens, áudios, vídeos gerados

---

## 1. Database

Schema inicial já aplicado via `supabase db push`:
- `video_projects`
- `video_clips`
- `voice_history`

Para aplicar novas migrations:
```bash
supabase db push
```

---

## 2. Supabase Storage

Bucket `assets` já criado (público). Se precisar recriar:
```bash
curl -X POST "$NEXT_PUBLIC_SUPABASE_URL/storage/v1/bucket" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"id":"assets","name":"assets","public":true,"file_size_limit":52428800,"allowed_mime_types":["image/*","audio/*","video/*","application/octet-stream"]}'
```

---

## 3. Auth — Email + Senha

Somente email/senha. **Usuários são cadastrados manualmente** no Supabase dashboard:

1. Supabase Dashboard → Authentication → Users → Add user → "Create new user"
2. Preencher email + senha
3. Marcar "Auto Confirm User" (para não precisar verificar email)

Para restringir quem pode entrar mesmo estando cadastrado, use `AUTH_ALLOWLIST` (emails separados por vírgula). Deixar vazio = qualquer usuário cadastrado pode entrar.

---

## 4. Vercel Deploy

```bash
cd creative-suite-next
git init
git add .
git commit -m "Initial commit"
# Push to GitHub, then in Vercel dashboard:
```

No Vercel:
1. Import the repo
2. Framework: Next.js (auto)
3. Add env vars (copiar de `.env.example`)
4. Deploy

### Vercel function timeouts
Routes com `maxDuration` custom:
- `/api/projects/[id]/generate-all` — 300s
- `/api/projects/[id]/check-status` — 120s
- `/api/projects/[id]/clips/[clipId]/chat` — 120s
- `/api/projects/[id]/clips/[clipId]/download` — 120s
- `/api/projects/[id]/download-zip` — 300s
- `/api/upload` — 60s

Precisa **Vercel Pro plan** para execuções > 60s.

---

## 5. Post-deploy checklist
- [ ] Cadastrar usuários no Supabase Dashboard
- [ ] Login funciona com email/senha
- [ ] Criar projeto → aparece no DB (`video_projects`)
- [ ] Upload de imagem → vai pra Storage (bucket `assets/images/*`)
- [ ] Gerar clip → status atualiza → vídeo arquivado em `assets/videos/*`
- [ ] Download ZIP funciona
- [ ] Logout funciona
