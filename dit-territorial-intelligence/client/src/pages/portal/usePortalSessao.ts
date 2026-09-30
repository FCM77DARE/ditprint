import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

/**
 * Sessao do assinante no portal, lida do servidor (portal.sessao).
 * O token vive no cookie httpOnly dit_portal_token, gravado quando o assinante abre o
 * link /entrar?token=. Nenhuma tela do portal le e-mail de outro lugar que nao este hook.
 */
export interface SessaoPortal {
  email: string;
  nome: string | null;
  territorios: string[];
  expiraEm: string | number | Date | null;
}

type Estado = { carregando: boolean; sessao: SessaoPortal | null; erro: boolean };

// Cache de modulo: as quatro telas do portal compartilham a mesma resposta e nao piscam ao navegar.
let cache: Estado = { carregando: true, sessao: null, erro: false };
let consultaAtiva: Promise<void> | null = null;
const ouvintes = new Set<(e: Estado) => void>();

function publicar(e: Estado) {
  cache = e;
  ouvintes.forEach(fn => fn(e));
}

/** Usado por /entrar depois de validar o token, para o portal abrir ja autenticado. */
export function definirSessaoPortal(sessao: SessaoPortal | null) {
  publicar({ carregando: false, sessao, erro: false });
}

export function usePortalSessao() {
  const [, navegar] = useLocation();
  const [estado, setEstado] = useState<Estado>(cache);
  const consultar = trpc.portal.sessao.useMutation();
  const sairMut = trpc.portal.sair.useMutation();

  useEffect(() => {
    ouvintes.add(setEstado);
    setEstado(cache);
    return () => {
      ouvintes.delete(setEstado);
    };
  }, []);

  useEffect(() => {
    if (!cache.carregando || consultaAtiva) return;
    consultaAtiva = consultar
      .mutateAsync({})
      .then(s => publicar({ carregando: false, sessao: (s as SessaoPortal | null) ?? null, erro: false }))
      .catch(() => publicar({ carregando: false, sessao: null, erro: true }))
      .finally(() => {
        consultaAtiva = null;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sair = useCallback(async () => {
    try {
      await sairMut.mutateAsync();
    } catch {
      /* o cookie expira sozinho em 7 dias; a tela sai de qualquer forma */
    }
    publicar({ carregando: false, sessao: null, erro: false });
    navegar("/entrar");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navegar]);

  const { sessao } = estado;
  return {
    email: sessao?.email ?? null,
    nome: sessao?.nome ?? null,
    territorios: sessao?.territorios ?? [],
    carregando: estado.carregando,
    erro: estado.erro,
    autenticado: Boolean(sessao),
    sair,
  };
}
