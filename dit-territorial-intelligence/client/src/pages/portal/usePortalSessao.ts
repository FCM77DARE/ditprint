import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";

/**
 * Contexto unico da sessao do assinante no portal.
 *
 * TODO backend B2: hoje o e-mail vem de ?email= ou do localStorage. Isso NAO e
 * autenticacao: qualquer pessoa digita um e-mail. Quando existir link magico
 * (portalAuth), este hook passa a ler a sessao do servidor e as procedures
 * alertPreferences.* e alertLog.* ignoram o e-mail enviado pelo cliente.
 * Nenhuma tela do portal deve ler e-mail de outro lugar que nao este hook.
 */
const CHAVE = "dit.portal.email";
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function lerArmazenado(): string | null {
  try {
    return window.localStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}

function gravar(email: string | null) {
  try {
    if (email) window.localStorage.setItem(CHAVE, email);
    else window.localStorage.removeItem(CHAVE);
  } catch {
    /* navegador sem storage: a sessao vale so para esta aba */
  }
}

function lerDaUrl(): string | null {
  try {
    const v = new URLSearchParams(window.location.search).get("email");
    return v && EMAIL_OK.test(v.trim()) ? v.trim().toLowerCase() : null;
  } catch {
    return null;
  }
}

export function usePortalSessao() {
  const [, navegar] = useLocation();
  const [email, setEmail] = useState<string | null>(() => lerDaUrl() ?? lerArmazenado());

  useEffect(() => {
    const daUrl = lerDaUrl();
    if (daUrl) {
      gravar(daUrl);
      setEmail(daUrl);
    }
  }, []);

  const sair = useCallback(() => {
    gravar(null);
    setEmail(null);
    navegar("/entrar");
  }, [navegar]);

  return { email, autenticado: Boolean(email), sair };
}
