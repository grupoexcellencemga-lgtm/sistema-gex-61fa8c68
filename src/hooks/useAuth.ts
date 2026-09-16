import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  isReady: boolean;
}

// Store único no módulo: uma assinatura e um getSession() para o app inteiro,
// em vez de um par por componente que chama useAuth().
let state: AuthState = { user: null, isReady: false };
const listeners = new Set<() => void>();
let started = false;

function setState(next: Partial<AuthState>) {
  const merged = { ...state, ...next };
  if (merged.user === state.user && merged.isReady === state.isReady) return;
  state = merged;
  listeners.forEach((notify) => notify());
}

function start() {
  if (started) return;
  started = true;

  supabase.auth.onAuthStateChange((_event, session) => {
    // O callback roda enquanto o supabase-js segura o lock de auth, e ele só
    // libera depois que toda chamada disparada de dentro dele terminar.
    // Propagar o estado aqui monta a árvore autenticada, que dispara dezenas
    // de queries — todas entram nessa fila e o signInWithPassword fica preso
    // esperando. setTimeout joga o render para o próximo ciclo do event loop,
    // já com o lock liberado.
    const user = session?.user ?? null;
    setTimeout(() => setState({ user, isReady: true }), 0);
  });

  // Se o getSession() travar (refresh token corrompido, rede fora), o app não
  // pode ficar presa na tela de carregamento para sempre.
  const timeout = setTimeout(() => setState({ isReady: true }), 8000);

  supabase.auth
    .getSession()
    .then(({ data: { session } }) => setState({ user: session?.user ?? null, isReady: true }))
    .catch(() => setState({ isReady: true }))
    .finally(() => clearTimeout(timeout));
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return state;
}

export function useAuth() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
