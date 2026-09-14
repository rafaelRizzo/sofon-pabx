"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import { api, apiError } from "@/lib/api"
import { useAuth } from "@/hooks/use-auth"

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024
const ALLOWED_AVATAR_TYPES = ["image/png", "image/jpeg"]

// GET /users/:id/avatar exige Bearer token (mesmo motivo de use-audios.ts: EventSource/<img src>
// não mandam header custom) - por isso busca como blob via axios em vez de <img src> direto.
// `v=avatarUpdatedAt` na querystring é cache-busting de verdade (força o navegador/proxy a tratar
// como recurso novo) - sem isso a URL é sempre a mesma (/users/:id/avatar) e o cache HTTP podia
// devolver bytes de uma foto antiga mesmo com o efeito refazendo o fetch, dando foto errada/
// inconsistente entre telas que montaram o hook em momentos diferentes.
export function useAvatarUrl(userId: string | null | undefined, avatarUpdatedAt: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!userId || !avatarUpdatedAt) {
      setUrl(null)
      return
    }

    let objectUrl: string | null = null
    let cancelled = false

    api
      .get(`/users/${userId}/avatar`, {
        responseType: "blob",
        params: { v: avatarUpdatedAt },
      })
      .then((res) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(res.data as Blob)
        setUrl(objectUrl)
      })
      .catch(() => {
        if (!cancelled) setUrl(null)
      })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [userId, avatarUpdatedAt])

  return url
}

export function useProfileAvatar() {
  const { user, refetch } = useAuth()

  // Validação aqui é só UX (feedback instantâneo, sem round-trip) - quem garante segurança de
  // verdade é o backend, que decodifica os bytes reais via sharp e rejeita qualquer coisa que
  // não seja de fato PNG/JPEG, reencodando o arquivo do zero (ver users.controller.ts).
  const uploadAvatar = async (file: File) => {
    if (!user) return false

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      toast.error("Envie uma imagem PNG ou JPEG")
      return false
    }
    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      toast.error("A imagem deve ter no máximo 5MB")
      return false
    }

    const toastId = toast.loading("Enviando foto...")
    try {
      const form = new FormData()
      form.append("file", file)
      await api.post(`/users/${user.id}/avatar`, form)
      toast.success("Foto de perfil atualizada", { id: toastId })
      await refetch()
      return true
    } catch (err) {
      toast.error(apiError(err, "Erro ao enviar foto de perfil"), { id: toastId })
      return false
    }
  }

  const removeAvatar = async () => {
    if (!user) return false

    const toastId = toast.loading("Removendo foto...")
    try {
      await api.delete(`/users/${user.id}/avatar`)
      toast.success("Foto de perfil removida", { id: toastId })
      await refetch()
      return true
    } catch (err) {
      toast.error(apiError(err, "Erro ao remover foto de perfil"), { id: toastId })
      return false
    }
  }

  return { uploadAvatar, removeAvatar }
}
