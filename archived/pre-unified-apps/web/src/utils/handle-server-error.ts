import { AxiosError } from 'axios'
import { toast } from 'sonner'
import { uiLog } from '@/logger';
const log = uiLog('utils/handle-server-error.ts');

export function handleServerError(error: unknown) {
   
  log.info(error)

  let errMsg = 'Something went wrong!'

  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    Number(error.status) === 204
  ) {
    errMsg = 'Content not found.'
  }

  if (error instanceof AxiosError) {
    errMsg = error.response?.data.title
  }

  toast.error(errMsg)
}
