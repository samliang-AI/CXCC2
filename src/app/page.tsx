import { getAuth } from '@/lib/auth/config'
import { redirect } from 'next/navigation'

export default async function Home() {
  const auth = await getAuth()
  if (!auth) redirect('/login')
  redirect('/dashboard')
  return null
}
