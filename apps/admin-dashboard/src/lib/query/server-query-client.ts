// One QueryClient per server request (P1.6-T06): React.cache scopes it to the request being
// rendered, so prefetched data never leaks between tenants or users.
import 'server-only';
import { cache } from 'react';
import { QueryClient } from '@tanstack/react-query';

export const getServerQueryClient = cache(
  () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } }),
);
