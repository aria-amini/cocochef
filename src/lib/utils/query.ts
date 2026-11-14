import { QueryClient } from '@tanstack/react-query'

// One per router: in the browser that is one for the visit, and on the server
// one per request, so what one person's page reads never reaches another's.
export const createQueryClient = () => new QueryClient()
