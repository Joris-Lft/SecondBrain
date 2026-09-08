import { QueryClient } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { removeOldestQuery } from "@tanstack/react-query-persist-client";

/*
 * Le plan Free d'Airtable plafonne à 1 000 appels API par mois, tous écrans
 * confondus. Les réglages ci-dessous existent pour ce budget, pas pour le
 * confort d'affichage : chaque requête évitée est une requête qui ne sera pas
 * bloquée en fin de mois.
 */

/** Au-delà, une requête est rejouée au montage suivant. */
const STALE_TIME = 5 * 60 * 1000;

/**
 * Durée de vie du cache sur disque. Le `gcTime` doit la couvrir : une requête
 * ramassée plus tôt ne serait pas restaurée au rechargement, et repartirait
 * interroger Airtable pour rien.
 */
export const CACHE_MAX_AGE = 24 * 60 * 60 * 1000;

const CACHE_KEY = "@app_query_cache";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_TIME,
      gcTime: CACHE_MAX_AGE,
      /*
       * Le coupable principal du dépassement : chaque retour sur l'onglet
       * rejouait toutes les requêtes montées. Les données ne bougent que par
       * nos mutations, qui tiennent le cache à jour elles-mêmes.
       */
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

export const queryPersister = createSyncStoragePersister({
  storage: window.localStorage,
  key: CACHE_KEY,
  // localStorage plafonne à quelques mégaoctets. Sans cette stratégie, une
  // écriture trop grosse échoue et plus rien n'est persisté : mieux vaut
  // sacrifier la requête la plus ancienne que perdre tout le cache.
  retry: removeOldestQuery,
});

/**
 * Vide le cache mémoire et sa copie sur disque.
 *
 * Indispensable à la déconnexion : le cache persisté survit à la session et
 * contient les données du compte qui vient de la quitter.
 */
export async function clearQueryCache(): Promise<void> {
  queryClient.clear();
  await queryPersister.removeClient();
}
