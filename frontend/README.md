# SOFON PABX Frontend

## Docker

```bash
cp .env.example .env
docker compose build
docker compose up -d
```

`VITE_API_URL` é embutida no bundle durante o build. Altere-a no `.env` e execute `docker compose up -d --build` para aplicar a mudança.

O Dockerfile usa cache BuildKit para o store do pnpm. A primeira imagem baixa as dependências, as próximas reutilizam o cache enquanto `pnpm-lock.yaml` não mudar.

## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `src/components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button"
```
